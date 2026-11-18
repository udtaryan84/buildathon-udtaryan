import { useState } from "react";
import { Btn, Icon, Shell } from "../components/Bits.jsx";
import { formatCode, navigate, parseCode, recentInspections } from "../lib/api.js";
import { haptic } from "../lib/motion.js";

const STEPS = [
  { icon: "camera", title: "Move-in", text: "Photograph each spot. The AI notes damage that is already there." },
  { icon: "message", title: "Landlord agrees", text: "Send one WhatsApp link. They tap a button and we record the time." },
  { icon: "swap", title: "Move-out", text: "Shoot the same spots again. Get a fair deduction in rupees." },
];

export default function Home() {
  const recent = recentInspections();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

  function find(e) {
    e.preventDefault();
    const id = parseCode(code);
    if (!/^[0-9a-z]{6,}$/.test(id)) {
      setCodeError("That code looks too short. It is printed on your report, like D7F0-E579-B9.");
      return;
    }
    haptic();
    navigate(`/r/${id}`);
  }

  return (
    <Shell>
      <section className="hero stagger">
        <h1 style={{ "--i": 0 }}>Jaisa tha, waisa hi hai.</h1>
        <p style={{ "--i": 1 }}>A dashcam for your rental deposit. Photograph the flat on day one and get your deposit back fairly.</p>
        <Btn className="block" style={{ "--i": 2 }} onClick={() => navigate("/new")}>
          Start a move-in
        </Btn>
      </section>

      <section className="how stagger" aria-label="How it works">
        {STEPS.map((s, i) => (
          <div className="how-step" key={s.title} style={{ "--i": i + 3 }}>
            <span className="ico">
              <Icon name={s.icon} />
            </span>
            <div>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </div>
          </div>
        ))}
      </section>

      <h2 className="section-title">Find my inspection</h2>
      <form className="find" onSubmit={find}>
        <Icon name="search" size={18} />
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeError("");
          }}
          placeholder="Code from your report"
          aria-label="Inspection code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
        />
        <Btn kind="primary" className="small" type="submit" disabled={!code.trim()}>
          Open
        </Btn>
      </form>
      {codeError && <p className="helper" role="alert">{codeError}</p>}

      {recent.length > 0 && (
        <>
          <h2 className="section-title">On this phone</h2>
          <div className="group stagger">
            {recent.map((r, i) => (
              <button
                key={r.id}
                className="row"
                style={{ "--i": i }}
                onClick={() => {
                  haptic();
                  navigate(`/r/${r.id}`);
                }}
              >
                <span className="grow">
                  <span className="name">{r.property}</span>
                  <span className="caption num">{formatCode(r.id)}</span>
                </span>
                <Icon name="chevron" size={18} className="chev" />
              </button>
            ))}
          </div>
        </>
      )}

      <p className="fine">
        Jaisa Tha is an evidence tool, not legal advice. Every photo gets a server timestamp and a SHA-256 fingerprint, and the
        record is sealed.
      </p>
    </Shell>
  );
}
