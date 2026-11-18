// Offline tests for the AI side. No API key needed: the model is mocked.
// Run: node netlify/lib/test/run.mjs
// If GEMINI_API_KEY is set and docs/testdata/ has photos, a live check runs too.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseModelJson, validate, salvageArray } from "../json.mjs";
import { lookupCost, RATE_CARD, RATE_KEYS } from "../rateCard.mjs";
import { parseImage, MAX_IMAGE_BYTES } from "../images.mjs";
import { generateContent, ModelError, MODEL_ID } from "../gemini.mjs";
import { analyseSpot } from "../analyseSpot.mjs";
import { compareSpots, finalize, buildSummary } from "../compareSpots.mjs";
import { COMPARE_SCHEMA, ANALYSE_SCHEMA } from "../prompts.mjs";
import analyseHandler from "../../functions/analyse-spot.mjs";
import compareHandler from "../../functions/compare.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  pass  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

// A tiny fake PNG: real PNG signature plus padding, enough for the format check.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]).toString("base64");
const PNG2 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 2)]).toString("base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 3)]).toString("base64");

// Mock model: returns the queued answers in order and records each call.
function mockModel(...answers) {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (a instanceof Error) throw a;
    return { text: typeof a === "string" ? a : JSON.stringify(a), finishReason: "STOP" };
  };
  fn.calls = calls;
  return fn;
}

function change(over = {}) {
  return {
    description: "Black marker stain near the switchboard, about 15 cm",
    visible_in_move_in_photo: false,
    matches_move_in_note: -1,
    is_worsening_of_existing: false,
    category: "damage",
    rate_key: "wall_stain_marker",
    quantity: 1,
    confidence: "high",
    reason: "Not visible in the move-in photo and marker ink is not caused by ageing.",
    ...over
  };
}
function compareAnswer(changes, over = {}) {
  return { same_spot: true, photos_usable: true, problem_note: "", ignored_differences: "Warmer light in photo B.", changes, summary: "One new stain.", ...over };
}
const compareBody = (over = {}) => ({
  spotName: "Bedroom, north wall",
  moveIn: { imageBase64: PNG, mimeType: "image/png", issues: [{ description: "Scratch about 10 cm on lower left", severity: "minor" }] },
  moveOut: { imageBase64: PNG2, mimeType: "image/png" },
  ...over
});
const post = (url, body) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

function assertContractCompare(body) {
  assert.ok(Array.isArray(body.changes), "changes is an array");
  assert.equal(typeof body.summary, "string");
  for (const c of body.changes) {
    assert.equal(typeof c.description, "string");
    assert.ok(["pre_existing", "normal_wear", "damage"].includes(c.category));
    assert.equal(typeof c.reason, "string");
    assert.ok(Number.isInteger(c.cost_min_inr) && Number.isInteger(c.cost_max_inr));
    if (c.category !== "damage") assert.equal(c.cost_max_inr, 0, "non damage costs 0");
    assert.ok(c.cost_min_inr <= c.cost_max_inr);
  }
}

console.log(`\nJaisa Tha AI tests (model ${MODEL_ID})\n`);

console.log("JSON repair and validation");
await test("parses clean JSON", () => assert.deepEqual(parseModelJson('{"a":1}').value, { a: 1 }));
await test("repairs code fences, chatter and trailing commas", () => {
  const r = parseModelJson('Sure! ```json\n{"issues": [{"description":"x","severity":"minor"},],}\n``` hope that helps');
  assert.ok(r.ok);
  assert.equal(r.value.issues.length, 1);
});
await test("rejects empty and garbage text", () => {
  assert.equal(parseModelJson("").ok, false);
  assert.equal(parseModelJson("no json here").ok, false);
  assert.equal(parseModelJson(undefined).ok, false);
});
await test("valid compare answer passes the schema", () => assert.deepEqual(validate(COMPARE_SCHEMA, compareAnswer([change()])), []));
await test("bad category, missing field and wrong type are caught", () => {
  const errs = validate(COMPARE_SCHEMA, compareAnswer([change({ category: "wear", quantity: "1" })], { summary: undefined }));
  const all = errs.join(" | ");
  assert.match(all, /category/);
  assert.match(all, /quantity/);
  assert.match(all, /summary/);
});
await test("invented rate key is rejected by the schema", () => {
  assert.notDeepEqual(validate(COMPARE_SCHEMA, compareAnswer([change({ rate_key: "gold_plating" })])), []);
});
await test("salvage keeps the valid items only", () => {
  const s = salvageArray(COMPARE_SCHEMA, compareAnswer([change(), change({ category: "oops" })]), "changes");
  assert.equal(s.value.changes.length, 1);
  assert.equal(s.dropped, 1);
});
await test("analyse schema accepts an empty issues list", () =>
  assert.deepEqual(validate(ANALYSE_SCHEMA, { photo_usable: true, problem_note: "", issues: [] }), []));

console.log("\nRate card");
await test("known key gives the table values", () => {
  const c = lookupCost("tile_crack", 1);
  assert.equal(c.cost_min_inr, RATE_CARD.tile_crack.min);
  assert.equal(c.cost_max_inr, RATE_CARD.tile_crack.max);
});
await test("unknown key falls back to general_repair", () => assert.equal(lookupCost("made_up").key, "general_repair"));
await test("quantity is clamped to 1..5", () => {
  assert.equal(lookupCost("tile_crack", 0).quantity, 1);
  assert.equal(lookupCost("tile_crack", 99).quantity, 5);
  assert.equal(lookupCost("tile_crack", "abc").quantity, 1);
  assert.equal(lookupCost("tile_crack", 3).cost_max_inr, RATE_CARD.tile_crack.max * 3);
});
await test("every rate has min <= max and whole rupees", () => {
  for (const k of RATE_KEYS) {
    const r = RATE_CARD[k];
    assert.ok(Number.isInteger(r.min) && Number.isInteger(r.max) && r.min > 0 && r.min <= r.max, k);
  }
});

console.log("\nPhoto input checks");
await test("missing or empty image is a 400", () => {
  assert.equal(parseImage(undefined).status, 400);
  assert.equal(parseImage("").status, 400);
  assert.equal(parseImage(12345).status, 400);
});
await test("bad base64 is a 400", () => assert.equal(parseImage("!!!not base64###").status, 400));
await test("valid base64 that is not a photo is a 400", () =>
  assert.equal(parseImage(Buffer.from("hello world ".repeat(20)).toString("base64")).status, 400));
await test("GIF is refused with 415", () =>
  assert.equal(parseImage(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(200)]).toString("base64")).status, 415));
await test("oversized photo is a 413", () =>
  assert.equal(parseImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_IMAGE_BYTES + 10)]).toString("base64")).status, 413));
await test("data: prefix is accepted and real type wins over declared type", () => {
  const r = parseImage(`data:image/jpeg;base64,${PNG}`, "image/jpeg");
  assert.ok(r.ok);
  assert.equal(r.mimeType, "image/png");
});

console.log("\nGemini client (mocked fetch)");
await test("sends images, schema and key header correctly", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "thinking", thought: true }, { text: '{"ok":true}' }] } }] }), { status: 200 });
  };
  const out = await generateContent({ system: "s", parts: [{ text: "t" }, { inlineData: { mimeType: "image/png", data: PNG } }], schema: { type: "object" }, apiKey: "test-key", fetchImpl });
  assert.equal(out.text, '{"ok":true}', "thought parts are dropped");
  assert.match(seen.url, new RegExp(`${MODEL_ID}:generateContent$`));
  assert.equal(seen.init.headers["x-goog-api-key"], "test-key");
  assert.equal(seen.body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(seen.body.generationConfig.responseJsonSchema, { type: "object" });
  assert.equal(seen.body.contents[0].parts[1].inlineData.mimeType, "image/png");
});
await test("missing key gives a config error, no network call", async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(generateContent({ system: "s", parts: [], schema: {}, fetchImpl: () => assert.fail("fetched") }), (e) => e.kind === "config");
  } finally {
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  }
});
await test("429, bad image, blocked and timeout map to clear errors", async () => {
  const resp = (status, body) => async () => new Response(JSON.stringify(body), { status });
  const run = (fetchImpl) => generateContent({ system: "s", parts: [], schema: {}, apiKey: "k", fetchImpl });
  await assert.rejects(run(resp(429, { error: { message: "quota" } })), (e) => e.kind === "rate_limit");
  await assert.rejects(run(resp(400, { error: { message: "Unable to process input image" } })), (e) => e.kind === "bad_image" && e.status === 400);
  await assert.rejects(run(resp(200, { promptFeedback: { blockReason: "SAFETY" } })), (e) => e.kind === "blocked");
  await assert.rejects(run(resp(500, "not json")), (e) => e.kind === "upstream");
  const slow = (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  await assert.rejects(generateContent({ system: "s", parts: [], schema: {}, apiKey: "k", fetchImpl: slow, timeoutMs: 50 }), (e) => e.kind === "timeout");
});

console.log("\nPOST /api/analyse-spot (mocked model)");
await test("returns contract shape and drops duplicate issues", async () => {
  const model = mockModel({ photo_usable: true, problem_note: "", issues: [{ description: "Scratch 10 cm lower left", severity: "minor" }, { description: "Scratch 10 cm lower left", severity: "minor" }] });
  const r = await analyseSpot({ spotName: "Hall", imageBase64: JPEG, mimeType: "image/jpeg" }, { callModel: model });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { issues: [{ description: "Scratch 10 cm lower left", severity: "minor" }] });
});
await test("clean spot gives an empty array", async () => {
  const r = await analyseSpot({ imageBase64: JPEG }, { callModel: mockModel({ photo_usable: true, problem_note: "", issues: [] }) });
  assert.deepEqual(r.body.issues, []);
});
await test("dark photo gives empty issues and a retake note", async () => {
  const r = await analyseSpot({ imageBase64: JPEG }, { callModel: mockModel({ photo_usable: false, problem_note: "Too dark", issues: [{ description: "x", severity: "minor" }] }) });
  assert.deepEqual(r.body.issues, []);
  assert.match(r.body.note, /dark/i);
});
await test("broken JSON is repaired with exactly one retry", async () => {
  const model = mockModel("I think the wall is fine", { photo_usable: true, problem_note: "", issues: [] });
  const r = await analyseSpot({ imageBase64: JPEG }, { callModel: model });
  assert.equal(r.status, 200);
  assert.equal(model.calls.length, 2);
  assert.match(model.calls[1].parts.at(-1).text, /could not be used/);
});
await test("garbage twice gives a clear 502 error, no crash", async () => {
  const model = mockModel("garbage", "more garbage");
  const r = await analyseSpot({ imageBase64: JPEG }, { callModel: model });
  assert.equal(r.status, 502);
  assert.equal(typeof r.body.error, "string");
  assert.equal(model.calls.length, 2);
});
await test("schema rejected by API falls back to plain JSON mode", async () => {
  const model = mockModel(new ModelError("bad_request", "rejected", 502), { photo_usable: true, problem_note: "", issues: [] });
  const r = await analyseSpot({ imageBase64: JPEG }, { callModel: model });
  assert.equal(r.status, 200);
  assert.equal(model.calls[1].plain, true);
});
await test("model timeout twice gives 504 with an error message", async () => {
  const t = new ModelError("timeout", "the AI check took too long", 504);
  const r = await analyseSpot({ imageBase64: JPEG }, { callModel: mockModel(t, t) });
  assert.equal(r.status, 504);
  assert.match(r.body.error, /too long/);
});
await test("bad photo never reaches the model", async () => {
  const model = mockModel({});
  const r = await analyseSpot({ imageBase64: "%%%" }, { callModel: model });
  assert.equal(r.status, 400);
  assert.equal(model.calls.length, 0);
});

console.log("\nPOST /api/compare (mocked model)");
await test("new marker stain is damage with rate card cost", async () => {
  const r = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change()])) });
  assert.equal(r.status, 200);
  assertContractCompare(r.body);
  const c = r.body.changes[0];
  assert.equal(c.category, "damage");
  assert.equal(c.cost_min_inr, RATE_CARD.wall_stain_marker.min);
  assert.equal(c.cost_max_inr, RATE_CARD.wall_stain_marker.max);
});
await test("move-in notes and both photos are sent to the model in order", async () => {
  const model = mockModel(compareAnswer([]));
  await compareSpots(compareBody(), { callModel: model });
  const parts = model.calls[0].parts;
  assert.equal(parts[1].inlineData.data, PNG, "photo A is move-in");
  assert.equal(parts[3].inlineData.data, PNG2, "photo B is move-out");
  assert.match(parts[4].text, /0\. \[minor\] Scratch about 10 cm/);
});
await test("issue in move-in notes is forced to pre_existing with cost 0", async () => {
  const r = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change({ matches_move_in_note: 0, rate_key: "wall_scratch_dent" })])) });
  assertContractCompare(r.body);
  assert.equal(r.body.changes[0].category, "pre_existing");
  assert.equal(r.body.changes[0].cost_max_inr, 0);
  assert.doesNotMatch(r.body.summary, /new stain/, "model summary replaced after an override");
});
await test("issue visible in move-in photo is pre_existing even without a note", async () => {
  const r = await compareSpots(compareBody({ moveIn: { imageBase64: PNG, issues: [] } }), { callModel: mockModel(compareAnswer([change({ visible_in_move_in_photo: true })])) });
  assert.equal(r.body.changes[0].category, "pre_existing");
});
await test("unsure damage becomes normal_wear with cost 0", async () => {
  const r = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change({ confidence: "low" })])) });
  assert.equal(r.body.changes[0].category, "normal_wear");
  assert.equal(r.body.changes[0].cost_max_inr, 0);
  assert.match(r.body.changes[0].reason, /tenant's favour/);
});
await test("worsening counts as damage only when highly confident", async () => {
  const high = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change({ matches_move_in_note: 0, is_worsening_of_existing: true, rate_key: "wall_scratch_dent" })])) });
  assert.equal(high.body.changes[0].category, "damage");
  const med = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change({ matches_move_in_note: 0, is_worsening_of_existing: true, confidence: "medium" })])) });
  assert.equal(med.body.changes[0].category, "normal_wear");
});
await test("normal wear costs 0 even if the model picked a rate key", async () => {
  const r = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change({ category: "normal_wear", description: "Light scuffs" })])) });
  assert.equal(r.body.changes[0].cost_max_inr, 0);
});
await test("quantity multiplies and is capped", async () => {
  const r = await compareSpots(compareBody(), { callModel: mockModel(compareAnswer([change({ rate_key: "tile_crack", quantity: 5 })])) });
  assert.equal(r.body.changes[0].cost_max_inr, RATE_CARD.tile_crack.max * 5);
});
await test("different spot or dark photo gives no changes and says why", () => {
  const a = finalize(compareAnswer([change()], { same_spot: false, problem_note: "Kitchen vs bedroom" }));
  assert.deepEqual(a.changes, []);
  assert.match(a.summary, /not seem to show the same spot/);
  const b = finalize(compareAnswer([change()], { photos_usable: false }));
  assert.deepEqual(b.changes, []);
  assert.match(b.summary, /dark or blurry/);
});
await test("money in the model summary is replaced by a computed summary", () => {
  const r = finalize(compareAnswer([change()], { summary: "Deduct Rs 5000 for the stain." }));
  assert.doesNotMatch(r.summary, /5000/);
  assert.equal(r.summary, "One new damage item found.");
});
await test("same file twice skips the model and lists notes as pre_existing", async () => {
  const model = mockModel({});
  const r = await compareSpots(compareBody({ moveOut: { imageBase64: PNG } }), { callModel: model });
  assert.equal(model.calls.length, 0);
  assertContractCompare(r.body);
  assert.equal(r.body.changes[0].category, "pre_existing");
});
await test("missing moveOut, bad issues and empty arrays never crash", async () => {
  assert.equal((await compareSpots({ moveIn: { imageBase64: PNG } }, { callModel: mockModel({}) })).status, 400);
  assert.equal((await compareSpots({}, { callModel: mockModel({}) })).status, 400);
  const r = await compareSpots(compareBody({ moveIn: { imageBase64: PNG, issues: "not an array" } }), { callModel: mockModel(compareAnswer([])) });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.changes, []);
  const r2 = await compareSpots(compareBody({ moveIn: { imageBase64: PNG, issues: [null, 5, { description: "" }, "Loose handle"] } }), { callModel: mockModel(compareAnswer([])) });
  assert.equal(r2.status, 200);
});
await test("bad move-out photo is a 400 naming the photo", async () => {
  const r = await compareSpots(compareBody({ moveOut: { imageBase64: "@@@" } }), { callModel: mockModel({}) });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /moveOut/);
});
await test("summary wording", () => {
  assert.equal(buildSummary([]), "No new damage found.");
  assert.equal(
    buildSummary([{ category: "damage" }, { category: "pre_existing" }]),
    "One new damage item found. One issue was already there at move-in."
  );
});

console.log("\nNetlify function wrappers (no model needed)");
await test("GET is a 405 with an error body", async () => {
  const res = await analyseHandler(new Request("http://localhost/api/analyse-spot"));
  assert.equal(res.status, 405);
  assert.equal(typeof (await res.json()).error, "string");
});
await test("invalid JSON, empty body and array body are 400", async () => {
  for (const b of ["{oops", "", "[]"]) {
    const res = await compareHandler(post("/api/compare", b));
    assert.equal(res.status, 400, `body ${JSON.stringify(b)}`);
    assert.equal(typeof (await res.json()).error, "string");
  }
});
if (!process.env.GEMINI_API_KEY) {
  await test("valid request without a key gives a 500 error message, not a crash", async () => {
    const res = await compareHandler(post("/api/compare", compareBody()));
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /GEMINI_API_KEY/);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);

// ---------- Optional live check ----------
const testdata = join(repoRoot, "docs", "testdata");
const photos = existsSync(testdata)
  ? readdirSync(testdata).filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase())).sort()
  : [];
if (!process.env.GEMINI_API_KEY || photos.length === 0) {
  console.log(
    `\nLive check skipped: ${!process.env.GEMINI_API_KEY ? "GEMINI_API_KEY is not set" : "no photos in docs/testdata/"}.` +
      " To run it, set the key and add move-in and move-out photos (sorted by name: move-in first)."
  );
} else {
  console.log(`\nLive check with ${MODEL_ID} on ${photos.slice(0, 2).join(", ")}`);
  const b64 = (f) => readFileSync(join(testdata, f)).toString("base64");
  const t0 = Date.now();
  const a = await analyseSpot({ spotName: "Test spot", imageBase64: b64(photos[0]) });
  console.log(`analyse-spot ${a.status} in ${Date.now() - t0} ms:`, JSON.stringify(a.body, null, 2));
  if (photos.length >= 2) {
    const t1 = Date.now();
    const c = await compareSpots({
      spotName: "Test spot",
      moveIn: { imageBase64: b64(photos[0]), issues: a.body.issues || [] },
      moveOut: { imageBase64: b64(photos[1]) }
    });
    console.log(`compare ${c.status} in ${Date.now() - t1} ms:`, JSON.stringify(c.body, null, 2));
    if (c.status === 200) assertContractCompare(c.body);
  }
}

process.exit(failed ? 1 : 0);
