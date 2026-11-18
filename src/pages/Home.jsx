import { Shell } from "../components/Bits.jsx";
import { navigate, recentInspections } from "../lib/api.js";

export default function Home() {
  const recent = recentInspections();
  return (
    <Shell>
      <section className="hero">
        <p className="eyebrow">A dashcam for your rental deposit</p>
        <h1>Jaisa tha, waisa hi hai.</h1>
        <p className="lead">
          Photograph your flat once on move-in day. At move-out, Jaisa Tha shows what was already there, what is
          normal wear and what is real damage, and works out a fair deduction you can send to your landlord.
        </p>
        <button className="primary big" onClick={() => navigate("/new")}>
          Start a move-in
        </button>
      </section>

      <section className="steps">
        <div className="step">
          <b>1. Move-in</b>
          <span>Photograph each spot. The AI notes what is already damaged.</span>
        </div>
        <div className="step">
          <b>2. Landlord acknowledges</b>
          <span>Send one WhatsApp link. They tap a button, we record the time.</span>
        </div>
        <div className="step">
          <b>3. Move-out</b>
          <span>Line up the same shot. Get a fair deduction in one tap.</span>
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2>Your inspections</h2>
          {recent.map((r) => (
            <button key={r.id} className="row-card" onClick={() => navigate(`/r/${r.id}`)}>
              <b>{r.property}</b>
              <span>Open</span>
            </button>
          ))}
        </section>
      )}
      <p className="fine">
        Jaisa Tha is an evidence tool. It is not legal advice. Photos get a server timestamp and a SHA-256 fingerprint.
      </p>
    </Shell>
  );
}
