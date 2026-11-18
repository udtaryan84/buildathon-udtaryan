import { useEffect, useState } from "react";
import Camera from "../components/Camera.jsx";
import { Loading, Shell, Spinner } from "../components/Bits.jsx";
import { api, navigate } from "../lib/api.js";

const PRESETS = ["Bedroom wall", "Bedroom floor", "Living room wall", "Bathroom", "Kitchen counter", "Main door"];

export default function MoveIn({ id }) {
  const [insp, setInsp] = useState(null);
  const [capturing, setCapturing] = useState(null);
  const [busyName, setBusyName] = useState("");
  const [custom, setCustom] = useState("");
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
    const name = capturing;
    setCapturing(null);
    setBusyName(name);
    setError("");
    try {
      let issues = [];
      try {
        const res = await api("/analyse-spot", { spotName: name, imageBase64: photo.base64, mimeType: photo.mimeType });
        issues = res.issues || [];
      } catch (e) {
        setError(`Saved the photo, but the AI could not check it: ${e.message}`);
      }
      await api(`/inspections/${id}/spots`, { name, imageBase64: photo.base64, hash: photo.hash, issues });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusyName("");
  }

  if (error && !insp) return <Shell back="/"><p className="error">{error}</p></Shell>;
  if (!insp) return <Loading />;

  const done = Object.fromEntries(insp.spots.map((s) => [s.name, s]));
  const names = [...PRESETS, ...insp.spots.map((s) => s.name).filter((n) => !PRESETS.includes(n))];

  if (capturing) {
    return <Camera title={capturing} onCapture={onCapture} onCancel={() => setCapturing(null)} />;
  }

  return (
    <Shell back="/">
      <p className="eyebrow">Move-in · {insp.property}</p>
      <h1 className="h1s">Photograph each spot</h1>
      <p className="lead small">Stand where you would at move-out. Capture walls, floors and fittings. Three spots is enough for a demo.</p>

      {names.map((name) => {
        const s = done[name];
        return (
          <div key={name} className="spot">
            <div className="spot-head">
              {s ? <img className="thumb" src={`/api/photos/${id}/${s.id}/in`} alt={name} /> : <div className="thumb empty" />}
              <div className="grow">
                <b>{name}</b>
                {busyName === name && <Spinner text="AI is checking the photo" />}
                {s && busyName !== name && (
                  <span className="muted">
                    {s.issues.length === 0 ? "No existing damage found" : `${s.issues.length} existing issue${s.issues.length > 1 ? "s" : ""} noted`}
                  </span>
                )}
              </div>
              {!s && busyName !== name && (
                <button className="primary" onClick={() => setCapturing(name)} disabled={!!busyName}>
                  Capture
                </button>
              )}
            </div>
            {s && s.issues.length > 0 && (
              <ul className="issues">
                {s.issues.map((i, k) => (
                  <li key={k}>
                    {i.description} <em>({i.severity})</em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) {
            setCapturing(custom.trim());
            setCustom("");
          }
        }}
      >
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add another spot, e.g. Balcony door" />
        <button className="ghost" type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}
      <button className="primary big sticky" disabled={insp.spots.length === 0 || !!busyName} onClick={() => navigate(`/r/${id}`)}>
        Finish and share with landlord
      </button>
    </Shell>
  );
}
