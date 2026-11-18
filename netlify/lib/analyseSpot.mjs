// Core logic for POST /api/analyse-spot (move-in). No Netlify specifics here,
// so the tests can call it with a fake model.

import { generateContent, ModelError } from "./gemini.mjs";
import { generateStructured } from "./structured.mjs";
import { parseImage } from "./images.mjs";
import { cleanText } from "./http.mjs";
import { ANALYSE_SCHEMA, ANALYSE_SYSTEM, analyseUserText } from "./prompts.mjs";

export async function analyseSpot(body, { callModel = generateContent } = {}) {
  const spotName = cleanText(body?.spotName, 120, "this spot");
  const img = parseImage(body?.imageBase64, body?.mimeType, "photo");
  if (!img.ok) return { status: img.status, body: { error: img.error } };

  let value;
  try {
    ({ value } = await generateStructured({
      callModel,
      system: ANALYSE_SYSTEM,
      parts: [{ text: analyseUserText(spotName) }, { inlineData: { mimeType: img.mimeType, data: img.data } }],
      schema: ANALYSE_SCHEMA,
      arrayKey: "issues"
    }));
  } catch (e) {
    if (e instanceof ModelError) return { status: e.status || 502, body: { error: e.message } };
    throw e;
  }

  if (!value.photo_usable) {
    // Extra field "note" (not in the contract, safe to ignore) tells the app to ask for a retake.
    return {
      status: 200,
      body: { issues: [], note: cleanText(value.problem_note, 200, "The photo is too dark or blurry to check. Please retake it.") }
    };
  }

  const seen = new Set();
  const issues = [];
  for (const it of value.issues) {
    const description = cleanText(it.description, 300);
    const key = description.toLowerCase();
    if (!description || seen.has(key)) continue;
    seen.add(key);
    issues.push({ description, severity: it.severity });
  }
  return { status: 200, body: { issues } };
}
