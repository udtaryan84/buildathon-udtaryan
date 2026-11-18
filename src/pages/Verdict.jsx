import { useEffect, useState } from "react";
import { Chip, Loading, Shell } from "../components/Bits.jsx";
import { api, navigate, rupees, when, whatsappLink } from "../lib/api.js";

export default function Verdict({ id }) {
  const [insp, setInsp] = useState(null);
  const [claim, setClaim] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/inspections/${id}`).then(setInsp).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Shell back="/"><p className="error">{error}</p></Shell>;
  if (!insp) return <Loading />;

  const checked = insp.spots.filter((s) => s.out);
  const all = checked.flatMap((s) => (s.out.changes || []).map((c) => ({ ...c, spot: s.name })));
  const damage = all.filter((c) => c.category === "damage");
  const fairMin = damage.reduce((n, c) => n + (c.cost_min_inr || 0), 0);
  const fairMax = damage.reduce((n, c) => n + (c.cost_max_inr || 0), 0);
  const claimNum = Number(String(claim).replace(/[^\d]/g, "")) || 0;
  const over = claimNum > fairMax ? claimNum - fairMax : 0;

  const hello = insp.landlordName ? `Namaste ${insp.landlordName}` : "Namaste";
  const damageLines = damage.length
    ? damage.map((c) => `${c.spot}: ${c.description} (${rupees(c.cost_min_inr)} se ${rupees(c.cost_max_inr)})`).join("; ")
    : "koi naya damage nahi mila";
  const claimLine = claimNum ? ` Aapne ${rupees(claimNum)} ki deduction bataayi.` : "";
  const text =
    `${hello}, move-out par maine ${insp.property} ki condition move-in ki photos se match ki.` +
    ` Move-in report${insp.ack ? ` (aapne ${when(insp.ack.ts)} par acknowledge ki thi)` : ""}: ${location.origin}/r/${id}.` +
    ` Naya damage: ${damageLines}. Baaki sab pehle se tha ya normal wear hai.` +
    `${claimLine} Report ke hisaab se fair deduction ${rupees(fairMin)} se ${rupees(fairMax)} banta hai.` +
    ` Please baaki deposit wapas kar dein. Dhanyavaad!`;

  return (
    <Shell back={`/m/${id}`}>
      <p className="eyebrow">Verdict · {insp.property}</p>
      <h1 className="h1s">Fair deduction</h1>
      <div className="big-number">
        {fairMin === fairMax ? rupees(fairMax) : `${rupees(fairMin)} to ${rupees(fairMax)}`}
      </div>
      <p className="muted">Only items marked Damage count. Already-there and normal wear cost ₹0.</p>

      <label className="claim">
        What did the landlord claim?
        <input value={claim} onChange={(e) => setClaim(e.target.value)} inputMode="numeric" placeholder="e.g. 55000" />
      </label>
      {claimNum > 0 && (
        <div className={`notice ${over > 0 ? "warn" : "good"}`}>
          {over > 0
            ? `The claim is ${rupees(over)} above what the photos support.`
            : "The claim is within what the photos support."}
        </div>
      )}

      {checked.map((s) => (
        <div key={s.id} className="spot">
          <div className="pair">
            <figure>
              <img src={`/api/photos/${id}/${s.id}/in`} alt={`${s.name} at move-in`} />
              <figcaption>Move-in</figcaption>
            </figure>
            <figure>
              <img src={`/api/photos/${id}/${s.id}/out`} alt={`${s.name} at move-out`} />
              <figcaption>Move-out</figcaption>
            </figure>
          </div>
          <b>{s.name}</b>
          <ul className="changes">
            {s.out.changes.map((c, k) => (
              <li key={k}>
                <Chip category={c.category} /> {c.description}
                <div className="reason">{c.reason}</div>
                {c.category === "damage" && (
                  <span className="cost">{rupees(c.cost_min_inr)} to {rupees(c.cost_max_inr)}</span>
                )}
              </li>
            ))}
            {s.out.changes.length === 0 && <li className="muted">{s.out.summary || "No changes found."}</li>}
          </ul>
        </div>
      ))}

      <p className="fine">Jaisa Tha is an evidence tool, not legal advice. Costs come from a fixed rate card for Indian metros.</p>
      <div className="sticky-stack">
        <a className="primary big link" href={whatsappLink(insp.landlordWhatsapp, text)} target="_blank" rel="noreferrer">
          Send to landlord on WhatsApp
        </a>
        <button className="ghost" onClick={() => navigate(`/r/${id}`)}>View move-in report</button>
      </div>
    </Shell>
  );
}
