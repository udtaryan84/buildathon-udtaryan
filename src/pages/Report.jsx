import { useEffect, useState } from "react";
import { Btn, ErrorState, Icon, InlineError, Loading, PhotoThumb, Shell, humanError } from "../components/Bits.jsx";
import { api, formatCode, navigate, rememberInspection, rupees, when, whatsappLink } from "../lib/api.js";
import { haptic } from "../lib/motion.js";

// Move-in report, shown as a sealed document. The same link is opened by the landlord, who taps
// "I acknowledge". Save as PDF prints the whole record for the tenant's own drive.
export default function Report({ id }) {
  const [insp, setInsp] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const data = await api(`/inspections/${id}`);
      setInsp(data);
      rememberInspection({ id: data.id || id, property: data.property });
    } catch (e) {
      setLoadError(e.message);
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
      haptic(20);
      await load();
    } catch (err) {
      setError(humanError(err.message));
    }
    setBusy(false);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatCode(id));
      haptic();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the code is still on screen */
    }
  }

  if (loadError && !insp) return <ErrorState message={loadError} onRetry={() => (setLoadError(""), load())} />;
  if (!insp) return <Loading />;

  const link = `${location.origin}/r/${id}`;
  const hello = insp.landlordName ? `Namaste ${insp.landlordName}` : "Namaste";
  const text = `${hello}, maine ${insp.property} ki move-in condition ki photos le li hain, timestamp ke saath. Please ek baar dekh kar "I acknowledge" daba dijiye: ${link}`;
  const anyOut = insp.spots.some((s) => s.out);

  return (
    <Shell
      back="/"
      backLabel="Home"
      actions={
        <>
          {anyOut ? (
            <Btn className="block" onClick={() => navigate(`/v/${id}`)}>
              See the verdict
            </Btn>
          ) : (
            <a className="btn primary block" href={whatsappLink(insp.landlordWhatsapp, text)} target="_blank" rel="noreferrer" onClick={() => haptic()}>
              <Icon name="message" size={18} /> Send to landlord on WhatsApp
            </a>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <Btn kind="plain" onClick={() => window.print()}>
              <Icon name="doc" size={18} /> Save as PDF
            </Btn>
            {anyOut ? (
              <Btn kind="plain" onClick={() => navigate(`/m/${id}`)}>
                Move-out photos
              </Btn>
            ) : (
              <Btn kind="plain" onClick={() => navigate(`/m/${id}`)}>
                Start move-out
              </Btn>
            )}
          </div>
        </>
      }
    >
      <section className="doc-head stagger">
        <span className="seal" style={{ "--i": 0 }}>
          <Icon name="seal" size={16} />
          Sealed {insp.seal && <code>{insp.seal.slice(0, 12)}</code>}
        </span>
        <h1 style={{ "--i": 1 }}>{insp.property}</h1>
        <p className="caption" style={{ "--i": 2 }}>
          Move-in report. Created {when(insp.createdAt)}. {insp.spots.length} spot{insp.spots.length === 1 ? "" : "s"} recorded.
          {insp.depositAmount > 0 && <> Security deposit: <b>{rupees(insp.depositAmount)}</b>.</>}
        </p>
        <div className="code-row" style={{ "--i": 3 }}>
          <div>
            <div className="label">Inspection code</div>
            <div className="code">{formatCode(id)}</div>
          </div>
          <Btn kind="secondary" className="small no-print" onClick={copyCode} aria-live="polite">
            <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : "Copy"}
          </Btn>
        </div>
      </section>

      <div style={{ marginTop: 16 }}>
        {insp.ack ? (
          <div className="notice good">
            <Icon name="checkCircle" size={24} />
            <span>
              Acknowledged by <b>{insp.ack.name}</b> on {when(insp.ack.ts)}. This is the agreed condition at move-in.
            </span>
          </div>
        ) : (
          <form className="notice no-print" onSubmit={acknowledge}>
            <b>Landlord, please confirm</b>
            <span className="muted" style={{ fontSize: 15 }}>
              I have seen these photos and this is the condition of the flat at move-in.
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" aria-label="Your full name" required />
            <Btn disabled={busy || !name.trim()} type="submit">
              {busy ? "Saving" : "I acknowledge this condition"}
            </Btn>
          </form>
        )}
        <InlineError>{error}</InlineError>
      </div>

      {insp.spots.length === 0 ? (
        <div className="state">
          <div className="ico">
            <Icon name="camera" size={28} />
          </div>
          <h2>No photos yet</h2>
          <p>Add the move-in photos first. Then this report fills itself.</p>
          <Btn kind="secondary" onClick={() => navigate(`/i/${id}`)}>
            Add photos
          </Btn>
        </div>
      ) : (
        <div className="evidence stagger">
          {insp.spots.map((s, i) => (
            <article key={s.id} className="evidence-item" style={{ "--i": i }}>
              <PhotoThumb className="photo" src={`/api/photos/${id}/${s.id}/in`} alt={`${s.name} at move-in`} />
              <div className="body">
                <div className="name">{s.name}</div>
                <dl className="facts">
                  <dt>Taken</dt>
                  <dd>{when(s.tsIn)} (server time)</dd>
                  <dt>Fingerprint</dt>
                  <dd>
                    <code>{s.hashIn}</code>
                  </dd>
                  <dt>Condition</dt>
                  <dd>{s.issues.length === 0 ? "No existing damage found" : `${s.issues.length} existing issue${s.issues.length > 1 ? "s" : ""}`}</dd>
                </dl>
                {s.issues.length > 0 && (
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
            </article>
          ))}
        </div>
      )}

      {insp.seal && (
        <p className="fine">
          Seal (SHA-256 over every photo fingerprint, its time and the acknowledgement): <code style={{ overflowWrap: "anywhere" }}>{insp.seal}</code>. If a
          single byte changes, the seal changes.
        </p>
      )}
    </Shell>
  );
}
