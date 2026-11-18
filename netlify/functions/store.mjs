// Storage for Jaisa Tha: inspections, photos and acknowledgements in Netlify Blobs.
// One function, small router. All timestamps are server time so they cannot be edited by the phone.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

export const config = {
  path: ["/api/inspections", "/api/inspections/*", "/api/photos/*"],
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

// The server fingerprints every photo itself, so the phone cannot fake a hash.
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// A seal covers every move-in photo hash, its server timestamp and the landlord acknowledgement.
// It is recomputed on every read, so anyone can check years later that nothing was edited.
function withSeal(inspection) {
  const body = JSON.stringify({
    id: inspection.id,
    createdAt: inspection.createdAt,
    spots: inspection.spots.map((s) => [s.id, s.name, s.hashIn, s.tsIn]),
    ack: inspection.ack,
  });
  return { ...inspection, seal: sha256(Buffer.from(body)) };
}

export default async (req) => {
  const store = getStore({ name: "jaisa-tha", consistency: "strong" });
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const method = req.method;

  try {
    // GET /api/photos/:id/:spotId/:kind  (kind = in | out)
    if (parts[0] === "photos" && method === "GET") {
      const [, id, spotId, kind] = parts;
      const data = await store.get(`photo/${id}/${spotId}/${kind}`, { type: "arrayBuffer" });
      if (!data) return json({ error: "Photo not found" }, 404);
      return new Response(data, {
        headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
      });
    }

    if (parts[0] !== "inspections") return json({ error: "Not found" }, 404);

    // POST /api/inspections
    if (parts.length === 1 && method === "POST") {
      const body = await req.json();
      const id = newId();
      const inspection = {
        id,
        property: String(body.property || "My flat").slice(0, 120),
        landlordName: String(body.landlordName || "").slice(0, 80),
        landlordWhatsapp: String(body.landlordWhatsapp || "").replace(/[^\d]/g, "").slice(-10),
        depositAmount: Math.min(Number(String(body.depositAmount || "").replace(/[^\d]/g, "")) || 0, 100000000),
        monthlyRent: Math.min(Number(String(body.monthlyRent || "").replace(/[^\d]/g, "")) || 0, 10000000),
        createdAt: new Date().toISOString(),
        spots: [],
        ack: null,
      };
      await store.setJSON(`insp/${id}`, inspection);
      return json(inspection);
    }

    const id = parts[1];
    const inspection = id ? await store.get(`insp/${id}`, { type: "json" }) : null;
    if (!inspection) return json({ error: "Inspection not found" }, 404);

    // GET /api/inspections/:id
    if (parts.length === 2 && method === "GET") return json(withSeal(inspection));

    // POST /api/inspections/:id/spots  (move-in photo for one spot)
    if (parts[2] === "spots" && parts.length === 3 && method === "POST") {
      const body = await req.json();
      if (!body.imageBase64) return json({ error: "Photo missing" }, 400);
      const spotId = newId();
      const bytes = Buffer.from(body.imageBase64, "base64");
      await store.set(`photo/${id}/${spotId}/in`, bytes);
      const spot = {
        id: spotId,
        name: String(body.name || "Spot").slice(0, 80),
        hashIn: sha256(bytes),
        tsIn: new Date().toISOString(),
        issues: Array.isArray(body.issues) ? body.issues.slice(0, 12) : [],
        out: null,
      };
      inspection.spots.push(spot);
      await store.setJSON(`insp/${id}`, inspection);
      return json(spot);
    }

    // POST /api/inspections/:id/spots/:spotId/out  (move-out photo and result)
    if (parts[2] === "spots" && parts[4] === "out" && method === "POST") {
      const spot = inspection.spots.find((s) => s.id === parts[3]);
      if (!spot) return json({ error: "Spot not found" }, 404);
      const body = await req.json();
      if (!body.imageBase64) return json({ error: "Photo missing" }, 400);
      const outBytes = Buffer.from(body.imageBase64, "base64");
      await store.set(`photo/${id}/${spot.id}/out`, outBytes);
      spot.out = {
        hash: sha256(outBytes),
        ts: new Date().toISOString(),
        changes: Array.isArray(body.changes) ? body.changes : [],
        summary: String(body.summary || ""),
      };
      await store.setJSON(`insp/${id}`, inspection);
      return json(spot);
    }

    // POST /api/inspections/:id/ack  (landlord or tenant acknowledges the move-in condition)
    if (parts[2] === "ack" && method === "POST") {
      const body = await req.json();
      const name = String(body.name || "").trim().slice(0, 80);
      if (!name) return json({ error: "Please enter a name" }, 400);
      if (inspection.ack) return json(inspection.ack);
      inspection.ack = { name, ts: new Date().toISOString() };
      await store.setJSON(`insp/${id}`, inspection);
      return json(inspection.ack);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: err?.message || "Server error" }, 500);
  }
};
