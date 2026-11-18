// Checks an incoming base64 photo before it goes anywhere near the model.
// Never throws: returns { ok: true, data, mimeType, bytes } or { ok: false, status, error }.

// Netlify synchronous functions accept a request body of about 6 MB, and compare
// carries two photos, so each photo has to stay well under that. The frontend
// should resize to about 1600 px on the long side as JPEG before sending.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIN_IMAGE_BYTES = 100;

// Formats the Gemini API accepts for image understanding.
const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// Work out the real format from the first bytes of the file.
export function sniffMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  if (buf.length >= 4 && buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

export function parseImage(imageBase64, declaredMime, label = "image") {
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return { ok: false, status: 400, error: `${label}: imageBase64 is missing` };
  }
  let s = imageBase64;
  // Be lenient: accept a data: URL prefix even though the contract says none.
  const dataUrl = /^data:([^;,]+)?(;base64)?,/i.exec(s);
  if (dataUrl) s = s.slice(dataUrl[0].length);
  s = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");

  // Quick size check before decoding (base64 is about 4/3 of the byte size).
  if (s.length * 0.75 > MAX_IMAGE_BYTES * 1.01) {
    return { ok: false, status: 413, error: `${label}: photo is too large, keep it under 4 MB` };
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.replace(/=+$/, "").length % 4 === 1) {
    return { ok: false, status: 400, error: `${label}: imageBase64 is not valid base64` };
  }

  const buf = Buffer.from(s, "base64");
  if (buf.length < MIN_IMAGE_BYTES) {
    return { ok: false, status: 400, error: `${label}: photo is empty or too small` };
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: `${label}: photo is too large, keep it under 4 MB` };
  }

  const sniffed = sniffMime(buf);
  if (!sniffed) {
    return { ok: false, status: 400, error: `${label}: data is not a JPEG, PNG, WebP or HEIC photo` };
  }
  if (!SUPPORTED.has(sniffed)) {
    return { ok: false, status: 415, error: `${label}: ${sniffed} is not supported, send JPEG, PNG, WebP or HEIC` };
  }
  // declaredMime is ignored on purpose: the bytes are trusted over the label,
  // so a PNG sent as "image/jpeg" still reaches the model with the right type.
  return { ok: true, data: buf.toString("base64"), mimeType: sniffed, bytes: buf.length };
}
