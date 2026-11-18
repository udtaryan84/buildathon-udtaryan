import { useEffect, useState } from "react";
import Camera from "../components/Camera.jsx";
import { Btn, Chip, ErrorState, Icon, InlineError, Loading, PhotoThumb, Shell, humanError } from "../components/Bits.jsx";
import { api, navigate, rupees, urlToBase64 } from "../lib/api.js";
import { flyInto } from "../lib/motion.js";
import { thumbSelector } from "./MoveIn.jsx";

// When the AI finds nothing because the shot could not be compared, the summary says why.
// We show that as a calm hint with a Retake button, not as an error.
const RETAKE_HINT =
  /same (spot|place|area|wall|view)|different (spot|place|area|angle|room|view)|too dark|dark|blurr|unclear|cannot compare|can.t compare|not comparable|does not match|doesn.t match/i;
export const needsRetake = (out) => out && (out.changes || []).length === 0 && RETAKE_HINT.test(out.summary || "");

export default function MoveOut({ id }) {
  const [insp, setInsp] = useState(null);
  const [capturing, setCapturing] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  async function load() {
    try {
      setInsp(await api(`/inspections/${id}`));
    } catch (e) {
      setLoadError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function onCapture(photo) {
    const spot = capturing;
    setCapturing(null);
    setBusyId(spot.id);
    setPreview(photo.dataUrl);
    setError("");
    requestAnimationFrame(() => flyInto(photo.dataUrl, document.querySelector(thumbSelector(spot.id))));
    try {
      const moveInBase64 = await urlToBase64(`/api/photos/${id}/${spot.id}/in`);
      const payload = {
        spotName: spot.name,
        moveIn: { imageBase64: moveInBase64, mimeType: "image/jpeg", issues: spot.issues },
        moveOut: { imageBase64: photo.base64, mimeType: photo.mimeType },
      };
      let result;
      try {
        result = await api("/compare", payload);
      } catch {
        // One automatic retry: the AI service is sometimes busy for a few seconds.
        result = await api("/compare", payload);
      }
      await api(`/inspections/${id}/spots/${spot.id}/out`, {
        imageBase64: photo.base64,
        hash: photo.hash,
        changes: result.changes || [],
        summary: result.summary || "",
      });
      await load();
    } catch (e) {
      setError(`Could not compare ${spot.name}. ${humanError(e.message)}`);
    }
    setBusyId("");
    setPreview("");
  }

  if (loadError && !insp) return <ErrorState message={loadError} onRetry={() => (setLoadError(""), load())} />;
  if (!insp) return <Loading />;

  const doneCount = insp.spots.filter((s) => s.out).length;
  const total = insp.spots.length;

  return (
    <>
      <Shell
        back={`/r/${id}`}
        backLabel="Report"
        actions={
          <>
            <p className="hint num">
              {doneCount === 0 ? "Shoot at least one spot to see the verdict" : `${doneCount} of ${total} spots compared`}
            </p>
            <Btn className="block" disabled={doneCount === 0 || !!busyId} onClick={() => navigate(`/v/${id}`)}>
              See the verdict
            </Btn>
          </>
        }
      >
        <h1 className="large-title">Shoot the same spots again</h1>
        <p className="subtitle">
          The move-in photo shows faded on the camera. Roughly the same spot is fine. Light and angle do not need to match.
        </p>

        {total === 0 && (
          <div className="state">
            <div className="ico">
              <Icon name="camera" size={28} />
            </div>
            <h2>No move-in photos</h2>
            <p>This inspection has no move-in photos to compare against.</p>
          </div>
        )}

        <div className="spots stagger">
          {insp.spots.map((s, i) => {
            const checking = busyId === s.id;
            const changes = s.out?.changes || [];
            const dmg = changes.filter((c) => c.category === "damage");
            const retake = needsRetake(s.out);
            const outSrc = s.out ? `/api/photos/${id}/${s.id}/out?v=${(s.out.hash || "").slice(0, 8)}` : "";
            return (
              <div key={s.id} className="spot" style={{ "--i": i }}>
                <div className="spot-head">
                  <span className={`ring ${checking ? "on" : ""}`} data-thumb={s.id}>
                    {checking && preview ? (
                      <span className="thumb checking">
                        <img src={preview} alt="" />
                      </span>
                    ) : (
                      <PhotoThumb src={s.out ? outSrc : `/api/photos/${id}/${s.id}/in`} alt={s.name} />
                    )}
                  </span>
                  <div className="grow">
                    <span className="name">{s.name}</span>
                    {checking && <span className="status live">Comparing with move-in</span>}
                    {!checking && !s.out && <span className="meta">Waiting for a photo</span>}
                    {!checking && s.out && !retake && (
                      <span className={`status ${dmg.length === 0 ? "ok" : ""}`}>
                        {dmg.length === 0 ? (
                          <>
                            <Icon name="check" size={16} stroke={2.2} /> No new damage
                          </>
                        ) : (
                          `${dmg.length} damage item${dmg.length > 1 ? "s" : ""}`
                        )}
                      </span>
                    )}
                    {!checking && retake && <span className="meta">Needs another photo</span>}
                  </div>
                  {!checking && !retake && (
                    <Btn kind={s.out ? "secondary" : "primary"} className="small" onClick={() => setCapturing(s)} disabled={!!busyId}>
                      {s.out ? "Retake" : "Capture"}
                    </Btn>
                  )}
                </div>

                {!checking && retake && (
                  <div className="hint-card">
                    <Icon name="info" size={18} />
                    <div>
                      <div>{s.out.summary}</div>
                      <Btn kind="secondary" className="small" onClick={() => setCapturing(s)} disabled={!!busyId}>
                        <Icon name="retake" size={16} /> Retake
                      </Btn>
                    </div>
                  </div>
                )}

                {!checking && s.out && !retake && (
                  <ul className="issues">
                    {changes.map((c, k) => (
                      <li key={k} style={{ "--i": k }}>
                        <Chip category={c.category} i={k} />
                        <span>{c.description}</span>
                        {c.category === "damage" && (
                          <span className="cost">
                            {rupees(c.cost_min_inr)} to {rupees(c.cost_max_inr)}
                          </span>
                        )}
                      </li>
                    ))}
                    {changes.length === 0 && <li className="muted">{s.out.summary || "Nothing has changed here."}</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <InlineError>{error}</InlineError>
      </Shell>
      {capturing && (
        <Camera
          title={`Move-out: ${capturing.name}`}
          overlaySrc={`/api/photos/${id}/${capturing.id}/in`}
          onCapture={onCapture}
          onCancel={() => setCapturing(null)}
        />
      )}
    </>
  );
}
