import { useEffect, useState } from "react";
import Camera from "../components/Camera.jsx";
import { Chip, Loading, Shell, Spinner } from "../components/Bits.jsx";
import { api, navigate, rupees, urlToBase64 } from "../lib/api.js";

export default function MoveOut({ id }) {
  const [insp, setInsp] = useState(null);
  const [capturing, setCapturing] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setInsp(await api(`/inspections/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function onCapture(photo) {
    const spot = capturing;
    setCapturing(null);
    setBusyId(spot.id);
    setError("");
    try {
      const moveInBase64 = await urlToBase64(`/api/photos/${id}/${spot.id}/in`);
      const result = await api("/compare", {
        spotName: spot.name,
        moveIn: { imageBase64: moveInBase64, mimeType: "image/jpeg", issues: spot.issues },
        moveOut: { imageBase64: photo.base64, mimeType: photo.mimeType },
      });
      await api(`/inspections/${id}/spots/${spot.id}/out`, {
        imageBase64: photo.base64,
        hash: photo.hash,
        changes: result.changes || [],
        summary: result.summary || "",
      });
      await load();
    } catch (e) {
      setError(`Could not compare ${spot.name}: ${e.message}`);
    }
    setBusyId("");
  }

  if (error && !insp) return <Shell back="/"><p className="error">{error}</p></Shell>;
  if (!insp) return <Loading />;
  if (capturing) {
    return (
      <Camera
        title={`Move-out: ${capturing.name}`}
        overlaySrc={`/api/photos/${id}/${capturing.id}/in`}
        onCapture={onCapture}
        onCancel={() => setCapturing(null)}
      />
    );
  }

  const doneCount = insp.spots.filter((s) => s.out).length;

  return (
    <Shell back={`/r/${id}`}>
      <p className="eyebrow">Move-out · {insp.property}</p>
      <h1 className="h1s">Shoot the same spots again</h1>
      <p className="lead small">The move-in photo shows faded on the camera. Line it up, then capture.</p>

      {insp.spots.map((s) => {
        const dmg = (s.out?.changes || []).filter((c) => c.category === "damage");
        return (
          <div key={s.id} className="spot">
            <div className="spot-head">
              <img className="thumb" src={`/api/photos/${id}/${s.id}/in`} alt={s.name} />
              <div className="grow">
                <b>{s.name}</b>
                {busyId === s.id && <Spinner text="Comparing photos" />}
                {s.out && busyId !== s.id && (
                  <span className="muted">
                    {dmg.length === 0 ? "No new damage" : `${dmg.length} damage item${dmg.length > 1 ? "s" : ""}`}
                  </span>
                )}
              </div>
              {busyId !== s.id && (
                <button className={s.out ? "ghost" : "primary"} onClick={() => setCapturing(s)} disabled={!!busyId}>
                  {s.out ? "Retake" : "Capture"}
                </button>
              )}
            </div>
            {s.out && (
              <ul className="changes">
                {s.out.changes.map((c, k) => (
                  <li key={k}>
                    <Chip category={c.category} /> {c.description}
                    {c.category === "damage" && (
                      <span className="cost"> {rupees(c.cost_min_inr)} to {rupees(c.cost_max_inr)}</span>
                    )}
                  </li>
                ))}
                {s.out.changes.length === 0 && <li className="muted">{s.out.summary || "No changes found."}</li>}
              </ul>
            )}
          </div>
        );
      })}

      {error && <p className="error">{error}</p>}
      <button className="primary big sticky" disabled={doneCount === 0 || !!busyId} onClick={() => navigate(`/v/${id}`)}>
        See the verdict
      </button>
    </Shell>
  );
}
