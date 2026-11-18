// Minimal Gemini API client using global fetch (Node 20+), no SDK.
//
// Model id checked against the official model list at
// https://aistudio.google.com/docs/models on 2026-11-18: gemini-3.8-flash is the
// current stable Flash model and accepts image input and structured output.
// Change it here only.
export const MODEL_ID = "gemini-3.5-flash-lite";

// Newest models (3.7, 3.8) were overloaded on launch day (503s and 40 s hangs), so we try a
// proven Flash first and fall back to a fast Flash-Lite. Each entry: [model id, timeout in ms].
export const MODEL_CHAIN = [
  [MODEL_ID, 12000],
  ["gemini-3.1-flash-lite", 11000]
];

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class ModelError extends Error {
  // kind: "config" | "timeout" | "rate_limit" | "bad_request" | "bad_image" | "blocked" | "upstream" | "network"
  constructor(kind, message, status) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Call generateContent once and return the model's text.
 *
 * parts: array of { text } and { inlineData: { mimeType, data } } in prompt order.
 * schema: JSON schema for structured output (sent as responseJsonSchema).
 * plain: when true, send a minimal generationConfig (used as a fallback if the
 *        API rejects the schema or thinking settings).
 */
export async function generateContent(opts) {
  let lastError;
  for (const [model, ms] of MODEL_CHAIN) {
    try {
      return await generateOnce({ ...opts, model, timeoutMs: Math.min(ms, opts.timeoutMs ?? ms) });
    } catch (e) {
      lastError = e;
      const retryable = e instanceof ModelError && ["timeout", "upstream", "network", "rate_limit"].includes(e.kind);
      if (!retryable) throw e;
      console.error(`Model ${model} failed (${e.kind}), trying the next one`);
    }
  }
  throw lastError;
}

async function generateOnce({ system, parts, schema, timeoutMs = 20000, plain = false, apiKey, fetchImpl, model = MODEL_ID }) {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new ModelError("config", "server is missing GEMINI_API_KEY", 500);
  const doFetch = fetchImpl ?? globalThis.fetch;

  const generationConfig = plain
    ? { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 8192 }
    : {
        // Temperature is ignored by Gemini 3.6 Flash and newer, kept low for older fallbacks.
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        // Low thinking keeps latency inside the serverless time limit.
        thinkingConfig: { thinkingLevel: "LOW" },
        maxOutputTokens: 8192
      };

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await doFetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ModelError("timeout", "the AI check took too long", 504);
    throw new ModelError("network", "could not reach the AI service", 502);
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    // Log the upstream message for debugging. It never contains the key.
    const msg = payload?.error?.message ? String(payload.error.message).slice(0, 300) : `HTTP ${res.status}`;
    console.error(`Gemini error ${res.status}: ${msg}`);
    if (res.status === 429) throw new ModelError("rate_limit", "the AI service is busy, try again in a minute", 503);
    if (res.status === 400 && /image|inline|mime|decode/i.test(msg)) {
      throw new ModelError("bad_image", "the photo could not be read, please retake it", 400);
    }
    if (res.status === 400) throw new ModelError("bad_request", "the AI service rejected the request", 502);
    if (res.status === 401 || res.status === 403) throw new ModelError("config", "the AI service key is not valid", 500);
    throw new ModelError("upstream", "the AI service had a problem, try again", 502);
  }

  if (payload?.promptFeedback?.blockReason) {
    throw new ModelError("blocked", "the AI service refused to check this photo", 422);
  }
  const candidate = payload?.candidates?.[0];
  if (!candidate) throw new ModelError("upstream", "the AI service returned no answer", 502);
  if (candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
    throw new ModelError("blocked", "the AI service refused to check this photo", 422);
  }
  const text = (candidate.content?.parts || [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");
  return { text, finishReason: candidate.finishReason || "" };
}
