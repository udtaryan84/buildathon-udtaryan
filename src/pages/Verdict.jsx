import { useEffect, useRef, useState } from "react";
import { Btn, Chip, ErrorState, Icon, Loading, Shell } from "../components/Bits.jsx";
import { api, navigate, rupees, when, whatsappLink } from "../lib/api.js";
import { SPRINGS, countUp, haptic, reduceMotion } from "../lib/motion.js";

// Drag the handle to wipe between the move-in and the move-out photo. Past the edges the handle
// resists (rubber band) and springs back on release.
function BeforeAfter({ inSrc, outSrc, name }) {
  const ref = useRef(null);
  const knobRef = useRef(null);
  const drag = useRef(null);

  const setX = (pct, over = 0) => {
    ref.current?.style.setProperty("--x", `${pct}%`);
    if (knobRef.current) knobRef.current.style.translate = over ? `${over}px 0` : "";
  };

  function move(e) {
    const el = ref.current;
    if (!drag.current || !el) return;
    const r = el.getBoundingClientRect();
    const raw = e.clientX - r.left;
    const clamped = Math.max(0, Math.min(r.width, raw));
    const past = raw - clamped;
    // Rubber band: offset = (1 - 1 / (c * x / d + 1)) * d
    const d = 80;
    const band = past === 0 ? 0 : Math.sign(past) * (1 - 1 / ((0.55 * Math.abs(past)) / d + 1)) * d;
    setX((clamped / r.width) * 100, band);
  }

  function end() {
    if (!drag.current) return;
    drag.current = null;
    ref.current?.classList.remove("dragging");
    const k = knobRef.current;
    if (k && k.style.translate && !reduceMotion()) {
      const from = k.style.translate;
      k.style.translate = "";
      k.animate([{ translate: from }, { translate: "0px 0" }], { duration: SPRINGS.bouncy.duration, easing: SPRINGS.bouncy.easing });
    } else if (k) k.style.translate = "";
  }

  // A gentle nudge on first show so people see it can be dragged.
  useEffect(() => {
    if (reduceMotion() || !ref.current) return;
    const el = ref.current;
    const t = setTimeout(() => {
      el.animate([{ "--x": "50%" }, { "--x": "38%" }, { "--x": "50%" }], { duration: 900, easing: "ease-in-out" });
    }, 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={ref}
      className="ba"
      role="slider"
      aria-label={`Compare ${name}: move-in on the left, move-out on the right`}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        const cur = parseFloat(ref.current.style.getPropertyValue("--x")) || 50;
        if (e.key === "ArrowLeft") setX(Math.max(0, cur - 5));
        if (e.key === "ArrowRight") setX(Math.min(100, cur + 5));
      }}
      onPointerDown={(e) => {
        drag.current = true;
        ref.current.setPointerCapture(e.pointerId);
        ref.current.classList.add("dragging");
        haptic(8);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img src={inSrc} alt={`${name} at move-in`} draggable="false" />
      <img src={outSrc} alt={`${name} at move-out`} className="after" draggable="false" />
      <span className="tag in">Move-in</span>
      <span className="tag out">Move-out</span>
      <div className="handle">
        <div className="knob" ref={knobRef}>
          <Icon name="swap" size={18} stroke={2} />
        </div>
      </div>
    </div>
  );
}

function CountUp({ value }) {
  const ref = useRef(null);
  useEffect(() => countUp(ref.current, value, rupees), [value]);
  return <span ref={ref}>{rupees(0)}</span>;
}

export default function Verdict({ id }) {
  const [insp, setInsp] = useState(null);
  const [claim, setClaim] = useState("");
  const [dues, setDues] = useState("");
  const [depositText, setDepositText] = useState(null);
  const [error, setError] = useState("");

  const load = () => api(`/inspections/${id}`).then(setInsp).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [id]);

  if (error) return <ErrorState message={error} onRetry={() => (setError(""), load())} />;
  if (!insp) return <Loading />;

  const checked = insp.spots.filter((s) => s.out);
  const all = checked.flatMap((s) => (s.out.changes || []).map((c) => ({ ...c, spot: s.name })));
  const damage = all.filter((c) => c.category === "damage");
  const fairMin = damage.reduce((n, c) => n + (c.cost_min_inr || 0), 0);
  const fairMax = damage.reduce((n, c) => n + (c.cost_max_inr || 0), 0);
  const num = (v) => Number(String(v).replace(/[^\d]/g, "")) || 0;
  const claimNum = num(claim);
  const deposit = num(depositText !== null ? depositText : insp.depositAmount || 0);
  const duesNum = num(dues);
  // Deductions that are fair: damage found in the photos, plus any rent or bills still unpaid.
  const totalMin = fairMin + duesNum;
  const totalMax = fairMax + duesNum;
  const refundHigh = Math.max(0, deposit - totalMin);
  const refundLow = Math.max(0, deposit - totalMax);
  const over = claimNum > totalMax ? claimNum - totalMax : 0;
  const counts = {
    pre_existing: all.filter((c) => c.category === "pre_existing").length,
    normal_wear: all.filter((c) => c.category === "normal_wear").length,
    damage: damage.length,
  };
  const scale = Math.max(claimNum, totalMax, 1);

  const hello = insp.landlordName ? `Namaste ${insp.landlordName}` : "Namaste";
  const damageLines = damage.length
    ? damage.map((c) => `${c.spot}: ${c.description} (${rupees(c.cost_min_inr)} se ${rupees(c.cost_max_inr)})`).join("; ")
    : "koi naya damage nahi mila";
  const claimLine = claimNum ? ` Aapne ${rupees(claimNum)} ki deduction bataayi.` : "";
  const depositLine = deposit
    ? ` Security deposit ${rupees(deposit)} tha, to report ke hisaab se ${rupees(refundLow)} se ${rupees(refundHigh)} wapas banta hai.`
    : "";
  const duesLine = duesNum ? ` Isme ${rupees(duesNum)} pending rent ya bills bhi joda hai.` : "";
  const text =
    `${hello}, move-out par maine ${insp.property} ki condition move-in ki photos se match ki.` +
    ` Move-in report${insp.ack ? ` (aapne ${when(insp.ack.ts)} par acknowledge ki thi)` : ""}: ${location.origin}/r/${id}.` +
    ` Naya damage: ${damageLines}. Baaki sab pehle se tha ya normal wear hai.` +
    `${claimLine} Report ke hisaab se fair deduction ${rupees(totalMin)} se ${rupees(totalMax)} banta hai.${duesLine}` +
    `${depositLine} Please baaki deposit wapas kar dein. Dhanyavaad!`;

  if (checked.length === 0) {
    return (
      <Shell back={`/r/${id}`} backLabel="Report">
        <div className="state">
          <div className="ico">
            <Icon name="swap" size={28} />
          </div>
          <h2>No move-out photos yet</h2>
          <p>Shoot at least one spot again at move-out. The verdict appears here.</p>
          <Btn kind="secondary" onClick={() => navigate(`/m/${id}`)}>
            Start move-out
          </Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      back={`/m/${id}`}
      backLabel="Move-out"
      actions={
        <>
          <a className="btn primary block" href={whatsappLink(insp.landlordWhatsapp, text)} target="_blank" rel="noreferrer" onClick={() => haptic()}>
            <Icon name="message" size={18} /> Send to landlord on WhatsApp
          </a>
          <Btn kind="plain" onClick={() => navigate(`/r/${id}`)}>
            View move-in report
          </Btn>
        </>
      }
    >
      <section className="verdict-hero">
        <div className="label">Fair deduction for {insp.property}</div>
        <div className="big-number num" aria-live="polite">
          {totalMin === totalMax ? (
            <CountUp value={totalMax} />
          ) : (
            <>
              <CountUp value={totalMin} />
              <span className="to">to</span>
              <CountUp value={totalMax} />
            </>
          )}
        </div>
        <div className="tally">
          <Chip category="pre_existing" i={0}>
            {counts.pre_existing} already there
          </Chip>
          <Chip category="normal_wear" i={1}>
            {counts.normal_wear} normal wear
          </Chip>
          <Chip category="damage" i={2}>
            {counts.damage} damage
          </Chip>
        </div>
        <p className="caption" style={{ marginTop: 12 }}>
          Only damage counts. Things that were already there and normal wear cost nothing.
        </p>
      </section>

      <section className="claim">
        <h2 className="section-title" style={{ marginTop: 0 }}>Where the deduction comes from</h2>
        <div className="group">
          <label className="field">
            <span>Security deposit you paid</span>
            <input
              value={depositText !== null ? depositText : insp.depositAmount || ""}
              onChange={(e) => setDepositText(e.target.value)}
              inputMode="numeric"
              placeholder="For example 80000"
              aria-label="Security deposit in rupees"
            />
          </label>
          <label className="field">
            <span>Unpaid rent or bills, if any</span>
            <input value={dues} onChange={(e) => setDues(e.target.value)} inputMode="numeric" placeholder="0" aria-label="Unpaid rent or bills in rupees" />
          </label>
          <div className="ledger">
            <div className="row">
              <span>Deposit held by landlord</span>
              <b className="num">{rupees(deposit)}</b>
            </div>
            <div className="row">
              <span>Damage found in the photos</span>
              <b className="num minus">{fairMin === fairMax ? `− ${rupees(fairMax)}` : `− ${rupees(fairMin)} to ${rupees(fairMax)}`}</b>
            </div>
            {duesNum > 0 && (
              <div className="row">
                <span>Unpaid rent or bills</span>
                <b className="num minus">− {rupees(duesNum)}</b>
              </div>
            )}
            <div className="row total">
              <span>You should get back</span>
              <b className="num">{refundLow === refundHigh ? rupees(refundHigh) : `${rupees(refundLow)} to ${rupees(refundHigh)}`}</b>
            </div>
          </div>
          {deposit === 0 && <p className="helper">Add your deposit amount to see what comes back to you.</p>}
        </div>
      </section>

      <section className="claim">
        <div className="group">
          <label className="field">
            <span>What did the landlord claim?</span>
            <input
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              inputMode="numeric"
              placeholder="For example 55000"
              aria-label="Landlord claim in rupees"
            />
          </label>
          {claimNum > 0 && (
            <div className="compare">
              <div className="compare-bar" aria-hidden="true">
                <div className={`claimed ${over > 0 ? "" : "ok"}`} style={{ transform: `scaleX(${claimNum / scale})` }} />
                <div className="fair" style={{ transform: `scaleX(${totalMax / scale})` }} />
              </div>
              <div className="compare-legend">
                <span>
                  Photos support <b className="num">{rupees(totalMax)}</b>
                </span>
                <span>
                  Claim <b className="num">{rupees(claimNum)}</b>
                </span>
              </div>
              <div className={`compare-msg ${over > 0 ? "over" : "ok"}`}>
                {over > 0 ? `${rupees(over)} more than the photos support.` : "The claim is within what the photos support."}
              </div>
            </div>
          )}
        </div>
      </section>

      <h2 className="section-title">Spot by spot</h2>
      <div className="spots stagger">
        {checked.map((s, i) => (
          <div key={s.id} className="verdict-spot" style={{ "--i": i }}>
            <BeforeAfter
              name={s.name}
              inSrc={`/api/photos/${id}/${s.id}/in`}
              outSrc={`/api/photos/${id}/${s.id}/out?v=${(s.out.hash || "").slice(0, 8)}`}
            />
            <div className="head">
              <b>{s.name}</b>
            </div>
            <ul className="issues" style={{ borderTop: 0, paddingTop: 8 }}>
              {s.out.changes.map((c, k) => (
                <li key={k} style={{ "--i": k }}>
                  <Chip category={c.category} i={k} />
                  <span>{c.description}</span>
                  {c.reason && <span className="reason">{c.reason}</span>}
                  {c.category === "damage" && (
                    <span className="cost">
                      {rupees(c.cost_min_inr)} to {rupees(c.cost_max_inr)}
                    </span>
                  )}
                </li>
              ))}
              {s.out.changes.length === 0 && <li className="muted">{s.out.summary || "Nothing has changed here."}</li>}
            </ul>
          </div>
        ))}
      </div>

      <p className="fine">Jaisa Tha is an evidence tool, not legal advice. Costs come from a fixed rate card for Indian metros.</p>
    </Shell>
  );
}
