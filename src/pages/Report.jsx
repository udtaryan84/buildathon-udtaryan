import { useEffect, useState } from "react";
import { Loading, Shell } from "../components/Bits.jsx";
import { api, navigate, when, whatsappLink } from "../lib/api.js";

// Move-in report. The same link is opened by the landlord, who taps "I acknowledge".
export default function Report({ id }) {
  const [insp, setInsp] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
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

  async function acknowledge(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/inspections/${id}/ack`, { name });
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (error && !insp) return <Shell back="/"><p className="error">{error}</p></Shell>;
  if (!insp) return <Loading />;

  const link = `${location.origin}/r/${id}`;
  const hello = insp.landlordName ? `Namaste ${insp.landlordName}` : "Namaste";
  const text = `${hello}, maine ${insp.property} ki move-in condition ki photos le li hain, timestamp ke saath. Please ek baar dekh kar "I acknowledge" daba dijiye: ${link}`;
  const anyOut = insp.spots.some((s) => s.out);

  return (
    <Shell back="/">
      <p className="eyebrow">Move-in report</p>
      <h1 className="h1s">{insp.property}</h1>
      <p className="muted">Created {when(insp.createdAt)}. {insp.spots.length} spots recorded.</p>

      {insp.ack ? (
        <div className="notice good">
          Acknowledged by <b>{insp.ack.name}</b> on {when(insp.ack.ts)}. This is the agreed condition at move-in.
        </div>
      ) : (
        <form className="notice" onSubmit={acknowledge}>
          <b>Landlord, please confirm</b>
          <span>I have seen these photos and this is the condition of the flat at move-in.</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
          <button className="primary" disabled={busy}>{busy ? "Saving" : "I acknowledge this condition"}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <a className="primary big link" href={whatsappLink(insp.landlordWhatsapp, text)} target="_blank" rel="noreferrer">
        Send to landlord on WhatsApp
      </a>

      {insp.spots.map((s) => (
        <div key={s.id} className="spot">
          <img className="wide" src={`/api/photos/${id}/${s.id}/in`} alt={s.name} />
          <b>{s.name}</b>
          <span className="muted">{when(s.tsIn)}</span>
          <code className="hash">SHA-256 {s.hashIn.slice(0, 16)}…</code>
          {s.issues.length === 0 ? (
            <span className="muted">No existing damage found.</span>
          ) : (
            <ul className="issues">
              {s.issues.map((i, k) => (
                <li key={k}>
                  {i.description} <em>({i.severity})</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="sticky-stack">
        {anyOut ? (
          <button className="primary big" onClick={() => navigate(`/v/${id}`)}>See the verdict</button>
        ) : (
          <button className="primary big" onClick={() => navigate(`/m/${id}`)}>Start move-out</button>
        )}
      </div>
    </Shell>
  );
}
