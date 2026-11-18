import { useState } from "react";
import { Shell } from "../components/Bits.jsx";
import { api, navigate, rememberInspection } from "../lib/api.js";

export default function NewInspection() {
  const [property, setProperty] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [landlordWhatsapp, setLandlordWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const insp = await api("/inspections", { property, landlordName, landlordWhatsapp });
      rememberInspection({ id: insp.id, property: insp.property });
      navigate(`/i/${insp.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Shell back="/">
      <h1 className="h1s">New move-in</h1>
      <form onSubmit={submit} className="form">
        <label>
          Flat or PG name
          <input value={property} onChange={(e) => setProperty(e.target.value)} placeholder="2BHK, Sector 62, Gurugram" required />
        </label>
        <label>
          Landlord name
          <input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} placeholder="Mr. Sharma" />
        </label>
        <label>
          Landlord WhatsApp number
          <input
            value={landlordWhatsapp}
            onChange={(e) => setLandlordWhatsapp(e.target.value)}
            inputMode="tel"
            placeholder="98XXXXXXXX"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary big" disabled={busy}>
          {busy ? "Creating" : "Continue to photos"}
        </button>
      </form>
    </Shell>
  );
}
