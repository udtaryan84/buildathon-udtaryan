import { useEffect, useState } from "react";
import Camera from "../components/Camera.jsx";
import { Btn, ErrorState, Icon, InlineError, Loading, PhotoThumb, Shell, humanError } from "../components/Bits.jsx";
import { api, navigate } from "../lib/api.js";
import { flyInto } from "../lib/motion.js";

const PRESETS = ["Bedroom wall", "Bedroom floor", "Living room wall", "Bathroom", "Kitchen counter", "Main door"];

export const thumbSelector = (key) => `[data-thumb="${CSS.escape(key)}"]`;

export default function MoveIn({ id }) {
  const [insp, setInsp] = useState(null);
  const [capturing, setCapturing] = useState(null);
  const [busyName, setBusyName] = useState("");
  const [preview, setPreview] = useState("");
  const [custom, setCustom] = useState("");
  const [extra, setExtra] = useState([]);
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
    const name = capturing;
    setCapturing(null);
    setBusyName(name);
    setPreview(photo.dataUrl);
    setError("");
    requestAnimationFrame(() => flyInto(photo.dataUrl, document.querySelector(thumbSelector(name))));
    try {
      let issues = [];
      try {
        const res = await api("/analyse-spot", { spotName: name, imageBase64: photo.base64, mimeType: photo.mimeType });
        issues = res.issues || [];
      } catch {
        setError(`The photo of ${name} is saved, but the AI could not check it this time. You can carry on.`);
      }
      await api(`/inspections/${id}/spots`, { name, imageBase64: photo.base64, hash: photo.hash, issues });
      await load();
    } catch (e) {
      setError(`Could not save ${name}. ${humanError(e.message)}`);
    }
    setBusyName("");
    setPreview("");
  }

  if (loadError && !insp) return <ErrorState message={loadError} onRetry={() => (setLoadError(""), load())} />;
  if (!insp) return <Loading />;

  const done = Object.fromEntries(insp.spots.map((s) => [s.name, s]));
  const names = [...new Set([...PRESETS, ...insp.spots.map((s) => s.name), ...extra])];
  const count = insp.spots.length;

  return (
    <>
      <Shell
        back="/"
        backLabel="Home"
        actions={
          <>
            <p className="hint num">
              {count === 0 ? "Capture at least one spot to continue" : `${count} spot${count > 1 ? "s" : ""} saved and fingerprinted`}
            </p>
            <Btn className="block" disabled={count === 0 || !!busyName} onClick={() => navigate(`/r/${id}`)}>
              Finish and share
            </Btn>
          </>
        }
      >
        <h1 className="large-title">Photograph each spot</h1>
        <p className="subtitle">
          {insp.property}. Stand where you would stand at move-out. Walls, floors and fittings matter most. Three spots is enough
          to try it.
        </p>

        <div className="spots stagger">
          {names.map((name, i) => {
            const s = done[name];
            const checking = busyName === name;
            return (
              <div key={name} className="spot" style={{ "--i": i }}>
                <div className="spot-head">
                  <span className={`ring ${checking ? "on" : ""}`} data-thumb={name}>
                    {checking && preview ? (
                      <span className="thumb checking">
                        <img src={preview} alt="" />
                      </span>
                    ) : s ? (
                      <PhotoThumb src={`/api/photos/${id}/${s.id}/in`} alt={name} />
                    ) : (
                      <span className="thumb empty">
                        <Icon name="camera" size={22} />
                      </span>
                    )}
                  </span>
                  <div className="grow">
                    <span className="name">{name}</span>
                    {checking && <span className="status live">Checking the photo</span>}
                    {s && !checking && (
                      <span className={`status ${s.issues.length === 0 ? "ok" : ""}`}>
                        {s.issues.length === 0 ? (
                          <>
                            <Icon name="check" size={16} stroke={2.2} /> No existing damage
                          </>
                        ) : (
                          `${s.issues.length} existing issue${s.issues.length > 1 ? "s" : ""} noted`
                        )}
                      </span>
                    )}
                    {!s && !checking && <span className="meta">Not captured yet</span>}
                  </div>
                  {!s && !checking && (
                    <Btn className="small" onClick={() => setCapturing(name)} disabled={!!busyName}>
                      Capture
                    </Btn>
                  )}
                </div>
                {s && s.issues.length > 0 && !checking && (
                  <ul className="issues">
                    {s.issues.map((it, k) => (
                      <li key={k} style={{ "--i": k }}>
                        <span>
                          {it.description} <span className="sev">{it.severity}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = custom.trim();
            if (!n) return;
            setExtra((x) => [...x, n]);
            setCustom("");
            setCapturing(n);
          }}
        >
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a spot, like Balcony door" aria-label="New spot name" />
          <Btn kind="secondary" className="small" type="submit" disabled={!custom.trim() || !!busyName}>
            <Icon name="plus" size={16} /> Add
          </Btn>
        </form>

        <InlineError>{error}</InlineError>
      </Shell>
      {capturing && <Camera title={capturing} onCapture={onCapture} onCancel={() => setCapturing(null)} />}
    </>
  );
}
