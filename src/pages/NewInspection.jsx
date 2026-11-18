import { useState } from "react";
import { Btn, InlineError, Shell, humanError } from "../components/Bits.jsx";
import { api, navigate, rememberInspection } from "../lib/api.js";

export default function NewInspection() {
  const [property, setProperty] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordWhatsapp, setLandlordWhatsapp] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e?.preventDefault();
    if (!property.trim()) return setError("Please add the flat or PG name.");
    setBusy(true);
    setError("");
    try {
      const insp = await api("/inspections", { property, landlordName, landlordWhatsapp, depositAmount, monthlyRent });
      rememberInspection({ id: insp.id, property: insp.property });
      navigate(`/i/${insp.id}`);
    } catch (err) {
      setError(humanError(err.message));
      setBusy(false);
    }
  }

  return (
    <Shell
      back="/"
      backLabel="Home"
      actions={
        <Btn className="block" disabled={busy || !property.trim()} onClick={submit}>
          {busy ? "Creating" : "Continue to photos"}
        </Btn>
      }
    >
      <h1 className="large-title">New move-in</h1>
      <p className="subtitle">Who is this flat with? We use the number only to open WhatsApp for you.</p>
      <form onSubmit={submit} className="stagger">
        <div className="group" style={{ "--i": 0 }}>
          <label className="field">
            <span>Flat or PG name</span>
            <input value={property} onChange={(e) => setProperty(e.target.value)} placeholder="2BHK, Sector 62, Gurugram" required autoFocus />
          </label>
        </div>
        <div className="group" style={{ "--i": 1 }}>
          <label className="field">
            <span>Landlord name</span>
            <input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} placeholder="Mr. Sharma" />
          </label>
          <label className="field">
            <span>Landlord WhatsApp number</span>
            <input value={landlordWhatsapp} onChange={(e) => setLandlordWhatsapp(e.target.value)} inputMode="tel" placeholder="98XXXXXXXX" />
          </label>
        </div>
        <p className="helper" style={{ "--i": 2 }}>Ten digits is fine. We add +91 for you.</p>
        <div className="group" style={{ "--i": 3 }}>
          <label className="field">
            <span>Security deposit you paid (₹)</span>
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} inputMode="numeric" placeholder="For example 80000" />
          </label>
          <label className="field">
            <span>Monthly rent (₹), optional</span>
            <input value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} inputMode="numeric" placeholder="For example 40000" />
          </label>
        </div>
        <p className="helper" style={{ "--i": 4 }}>Any deduction at move-out has to come out of this deposit, so we keep it with the record.</p>
        <InlineError>{error}</InlineError>
        <button type="submit" hidden />
      </form>
    </Shell>
  );
}
