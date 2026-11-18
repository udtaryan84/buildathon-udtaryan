// Core logic for POST /api/compare (move-out). No Netlify specifics here,
// so the tests can call it with a fake model.
//
// The model proposes; code decides. After the model answers, finalize()
// applies fixed rules so the result is fair even when the model slips:
//   1. Not the same spot, or a photo too dark or blurry: no changes at all.
//   2. Anything in the move-in notes or visible in the move-in photo is
//      pre_existing with cost 0, unless it clearly got worse.
//   3. Damage the model is unsure about becomes normal_wear (tenant's favour).
//   4. "Got worse" only counts as damage when the model is highly confident.
//   5. Costs come only from the rate card. pre_existing and normal_wear cost 0.

import { generateContent, ModelError } from "./gemini.mjs";
import { generateStructured } from "./structured.mjs";
import { parseImage } from "./images.mjs";
import { cleanText } from "./http.mjs";
import { lookupCost } from "./rateCard.mjs";
import { COMPARE_SCHEMA, COMPARE_SYSTEM, MAX_CHANGES, compareUserIntro, compareNotesText } from "./prompts.mjs";

const SEVERITIES = new Set(["minor", "moderate", "major"]);
const MAX_NOTES = 30;

export function sanitizeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  const out = [];
  for (const it of issues) {
    const description = cleanText(typeof it === "string" ? it : it?.description, 300);
    if (!description) continue;
    out.push({ description, severity: SEVERITIES.has(it?.severity) ? it.severity : "minor" });
    if (out.length >= MAX_NOTES) break;
  }
  return out;
}

export async function compareSpots(body, { callModel = generateContent } = {}) {
  const spotName = cleanText(body?.spotName, 120, "this spot");
  const moveIn = body?.moveIn && typeof body.moveIn === "object" ? body.moveIn : null;
  const moveOut = body?.moveOut && typeof body.moveOut === "object" ? body.moveOut : null;
  if (!moveIn || !moveOut) return { status: 400, body: { error: "moveIn and moveOut are both required" } };

  const imgA = parseImage(moveIn.imageBase64, moveIn.mimeType, "moveIn photo");
  if (!imgA.ok) return { status: imgA.status, body: { error: imgA.error } };
  const imgB = parseImage(moveOut.imageBase64, moveOut.mimeType, "moveOut photo");
  if (!imgB.ok) return { status: imgB.status, body: { error: imgB.error } };
  const notes = sanitizeIssues(moveIn.issues);

  // Same file sent twice: nothing can have changed, and the model is not needed.
  if (imgA.data === imgB.data) {
    return {
      status: 200,
      body: {
        changes: notes.map((n, i) => preExistingFromNote(n, i)),
        summary: "The move-out photo is the same file as the move-in photo, so no change can be shown. Take a fresh move-out photo to compare."
      }
    };
  }

  let value;
  try {
    ({ value } = await generateStructured({
      callModel,
      system: COMPARE_SYSTEM,
      parts: [
        { text: compareUserIntro(spotName) },
        { inlineData: { mimeType: imgA.mimeType, data: imgA.data } },
        { text: "Photo B (MOVE-OUT) follows." },
        { inlineData: { mimeType: imgB.mimeType, data: imgB.data } },
        { text: compareNotesText(notes) }
      ],
      schema: COMPARE_SCHEMA,
      arrayKey: "changes"
    }));
  } catch (e) {
    if (e instanceof ModelError) return { status: e.status || 502, body: { error: e.message } };
    throw e;
  }

  return { status: 200, body: finalize(value, notes) };
}

function preExistingFromNote(note, index) {
  return {
    description: note.description,
    category: "pre_existing",
    reason: `Recorded at move-in (note ${index + 1}).`,
    cost_min_inr: 0,
    cost_max_inr: 0
  };
}

const MONEY_PATTERN = /₹|\brs\.?\s*\d|\binr\b|rupee/i;

/**
 * Turn the model's internal answer into the contract response, applying the
 * fairness rules. Exported for tests.
 */
export function finalize(value, notes = []) {
  if (!value.same_spot || !value.photos_usable) {
    const fallback = !value.same_spot
      ? "These two photos do not seem to show the same spot, so they were not compared. Retake the move-out photo from where the move-in photo was taken."
      : "One of the photos is too dark or blurry to compare. Retake it in better light.";
    const note = cleanText(value.problem_note, 200);
    return { changes: [], summary: note ? `${fallback} (${note})` : fallback };
  }

  let overridden = false;
  const changes = [];
  const seen = new Set();

  for (const c of value.changes) {
    const description = cleanText(c.description, 300);
    if (!description || seen.has(description.toLowerCase())) continue;
    seen.add(description.toLowerCase());

    let category = c.category;
    let reason = cleanText(c.reason, 400, "");
    const noteIdx = Number.isInteger(c.matches_move_in_note) && c.matches_move_in_note >= 0 && c.matches_move_in_note < notes.length
      ? c.matches_move_in_note
      : -1;
    const wasThere = noteIdx >= 0 || c.visible_in_move_in_photo === true;

    // Rule 2 and 4: already there means pre_existing, unless it clearly got worse.
    if (wasThere && !(c.is_worsening_of_existing && category === "damage")) {
      if (category !== "pre_existing") overridden = true;
      category = "pre_existing";
      if (!reason) reason = noteIdx >= 0 ? `Recorded at move-in (note ${noteIdx + 1}).` : "Visible in the move-in photo.";
    } else if (wasThere && c.is_worsening_of_existing && category === "damage" && c.confidence !== "high") {
      overridden = true;
      category = "normal_wear";
      reason = `${reason} It was already there at move-in and it is not clear it got worse beyond ageing, so it is treated as wear.`.trim();
    }

    // Rule 3: unsure damage goes the tenant's way.
    if (category === "damage" && c.confidence === "low") {
      overridden = true;
      category = "normal_wear";
      reason = `${reason} It is unclear if this is beyond normal use, so it is treated as wear in the tenant's favour.`.trim();
    }

    if (!reason) reason = category === "normal_wear" ? "Ordinary wear from living in the flat." : "New since move-in.";

    const item = { description, category, reason, cost_min_inr: 0, cost_max_inr: 0 };
    // Rule 5: money only from the rate card.
    if (category === "damage") {
      const cost = lookupCost(c.rate_key, c.quantity);
      item.cost_min_inr = cost.cost_min_inr;
      item.cost_max_inr = cost.cost_max_inr;
      // Extra field, not in the contract: which rate card line was used.
      item.rate_key = cost.key;
    }
    changes.push(item);
    if (changes.length >= MAX_CHANGES) break;
  }

  const modelSummary = cleanText(value.summary, 300);
  const summary = !overridden && modelSummary && !MONEY_PATTERN.test(modelSummary) ? modelSummary : buildSummary(changes);
  return { changes, summary };
}

function countPhrase(n, one, many) {
  return n === 1 ? `One ${one}` : `${n} ${many}`;
}

export function buildSummary(changes) {
  const damage = changes.filter((c) => c.category === "damage").length;
  const wear = changes.filter((c) => c.category === "normal_wear").length;
  const pre = changes.filter((c) => c.category === "pre_existing").length;
  const parts = [];
  parts.push(damage ? `${countPhrase(damage, "new damage item", "new damage items")} found.` : "No new damage found.");
  if (wear) parts.push(`${countPhrase(wear, "change is", "changes are")} normal wear and cost nothing.`);
  if (pre) parts.push(`${countPhrase(pre, "issue was", "issues were")} already there at move-in.`);
  return parts.join(" ");
}
