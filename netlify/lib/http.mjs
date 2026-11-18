// Shared request and response helpers for the Netlify functions.

// Two photos of up to 4 MB each, base64 encoded, plus a little JSON.
const MAX_BODY_CHARS = 12 * 1024 * 1024;

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

/**
 * Read and parse a JSON request body. Never throws.
 * Returns { ok: true, body } or { ok: false, status, error }.
 */
export async function readJsonBody(req) {
  if (req.method !== "POST") return { ok: false, status: 405, error: "use POST" };
  let text;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400, error: "could not read request body" };
  }
  if (text.length > MAX_BODY_CHARS) return { ok: false, status: 413, error: "request is too large, send smaller photos" };
  if (text.trim() === "") return { ok: false, status: 400, error: "request body is empty" };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, status: 400, error: "request body must be a JSON object" };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, status: 400, error: "request body is not valid JSON" };
  }
}

// Turn a core handler result { status, body } into a Response, with a final
// safety net so a bug never surfaces as a crash.
export async function runHandler(req, core) {
  try {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return jsonResponse(parsed.status, { error: parsed.error });
    const { status, body } = await core(parsed.body);
    return jsonResponse(status, body);
  } catch (e) {
    console.error("handler failed:", e && e.message ? e.message : e);
    return jsonResponse(500, { error: "something went wrong while checking the photo, please try again" });
  }
}

export function cleanText(value, maxLen, fallback = "") {
  if (typeof value !== "string") return fallback;
  const s = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length === 0 ? fallback : s.slice(0, maxLen);
}
