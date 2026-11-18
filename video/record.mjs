// Records the Jaisa Tha demo video from the live app, then joins and speeds up the AI waits.
// Run: node video/record.mjs   (needs Chrome, ffmpeg, and test photos in %TEMP%\jt-test)
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.APPDATA, "npm/node_modules/@playwright/cli/node_modules/playwright-core"));

const BASE = "https://jaisa-tha-udtaryan.netlify.app";
const PHOTOS = path.join(process.env.TEMP, "jt-test");
import { fileURLToPath } from "node:url";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(ROOT, "raw");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const pause = (p, ms) => p.waitForTimeout(ms);

// Caption bar burned into the page so it ends up in the recording.
const CAPTION_INIT = `
(() => {
  const css = 'position:fixed;left:12px;right:12px;top:12px;z-index:2147483647;padding:14px 18px;border-radius:20px;' +
    'background:rgba(20,20,22,0.78);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:#fff;' +
    'font:600 18px/1.3 -apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;letter-spacing:-0.01em;text-align:center;' +
    'transition:opacity .35s ease;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.25);';
  function ensure() {
    let el = document.getElementById('jt-cap');
    if (!el) { el = document.createElement('div'); el.id = 'jt-cap'; el.style.cssText = css; (document.body || document.documentElement).appendChild(el); }
    return el;
  }
  window.__cap = (t, big) => { const el = ensure(); el.style.opacity = t ? 1 : 0; el.style.fontSize = (window.innerWidth > 700 ? 26 : (big ? 22 : 18)) + 'px'; if (t) el.textContent = t; try { sessionStorage.setItem('jt-cap', t || ''); sessionStorage.setItem('jt-big', big ? '1' : ''); } catch (e) {} };
  document.addEventListener('DOMContentLoaded', () => { const t = sessionStorage.getItem('jt-cap'); if (t) window.__cap(t, sessionStorage.getItem('jt-big')); });
})();
`;

async function cap(page, text, ms = 3200, big = false) {
  ms = Math.round(ms * 0.78);
  await page.evaluate(([t, b]) => window.__cap && window.__cap(t, b), [text, big]);
  await pause(page, ms);
}

async function newCtx(name, w, h, mobile) {
  const ctx = await chromium.launch({ channel: "chrome", headless: true }).then((b) =>
    b.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      hasTouch: mobile,
      isMobile: mobile,
      recordVideo: { dir: path.join(RAW, name), size: { width: w, height: h } },
    }),
  );
  await ctx.addInitScript(CAPTION_INIT);
  const page = await ctx.newPage();
  return { ctx, page, t0: Date.now() };
}

const waits = [];
async function timed(t0, fn) {
  const s = (Date.now() - t0) / 1000;
  await fn();
  waits.push([s, (Date.now() - t0) / 1000]);
}

async function uploadVia(page, file) {
  await page.waitForSelector('input[type="file"]', { state: "attached" });
  await page.setInputFiles('input[type="file"]', path.join(PHOTOS, file));
}

async function rowCapture(page, spot) {
  const row = page.getByText(spot, { exact: true }).first().locator("xpath=ancestor::*[.//button[normalize-space(.)='Capture']][1]");
  await row.getByRole("button", { name: "Capture" }).first().click();
}

// ---------------- Phone flow ----------------
async function phone() {
  const { ctx, page, t0 } = await newCtx("phone", 480, 1040, true);
  let id = "";
  try {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await cap(page, "You paid Rs 80,000 as deposit. Will you see it again?", 3600, true);
    await cap(page, "Photos in your camera roll fail: different light, different angle, and the landlord never saw them", 4600, true);
    await cap(page, "Jaisa Tha: a dashcam for your rental deposit", 2600, true);

    await page.getByRole("button", { name: /Start a move-in/ }).first().click();
    await pause(page, 900);
    await cap(page, "Step 1. Move-in: enter the flat and the deposit", 1800);
    await page.getByPlaceholder("2BHK, Sector 62, Gurugram").fill("2BHK, Sector 62, Gurugram");
    await page.getByPlaceholder("Mr. Sharma").fill("Mr. Sharma");
    await page.getByPlaceholder("98XXXXXXXX").fill("9812345678");
    await page.getByPlaceholder("For example 80000").fill("80000");
    await page.getByPlaceholder("For example 40000").fill("40000");
    await pause(page, 1200);
    await page.getByRole("button", { name: /Continue to photos/ }).click();
    await page.waitForURL(/\/i\//);
    id = page.url().split("/i/")[1];
    await cap(page, "Move-in: photograph each spot. AI notes what is already damaged", 2600);

    for (const spot of ["Bedroom wall", "Living room wall"]) {
      await rowCapture(page, spot);
      await pause(page, 1200);
      await uploadVia(page, "real.jpg");
      await timed(t0, async () => {
        await page.waitForSelector(".ring.on", { timeout: 6000 }).catch(() => {});
        await page.waitForFunction(() => !document.querySelector(".ring.on"), null, { timeout: 90000 }).catch(() => {});
        await pause(page, 1500);
      });
    }
    await page.waitForSelector("text=/2 spots saved/", { timeout: 60000 }).catch(() => {});
    await cap(page, "Every photo gets a server timestamp and a fingerprint", 2800);
    await page.getByRole("button", { name: /Finish and share/ }).click();
    await page.waitForURL(/\/r\//);
    await pause(page, 1200);
    await cap(page, "The record is sealed. Landlord taps one link and acknowledges", 3400);
    await page.locator("form.notice input").first().fill("Mr. Sharma");
    await pause(page, 600);
    await page.getByRole("button", { name: /I acknowledge this condition/ }).click();
    await pause(page, 1500);
    await cap(page, "Time and name are recorded. Now it is an agreed condition", 3200);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
    await pause(page, 1800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(page, 1000);

    await page.getByRole("button", { name: /Start move-out/ }).first().click();
    await page.waitForURL(/\/m\//);
    await cap(page, "Step 2. Move-out: line up roughly the same shot. It does not need to be exact", 3600);
    const outs = [["Bedroom wall", "out-damage2.jpg"], ["Living room wall", "out-clean2.jpg"]];
    for (const [spot, file] of outs) {
      await rowCapture(page, spot);
      await pause(page, 1200);
      await uploadVia(page, file);
      await timed(t0, async () => {
        await page.waitForSelector(".ring.on", { timeout: 6000 }).catch(() => {});
        await page.waitForFunction(() => !document.querySelector(".ring.on"), null, { timeout: 90000 }).catch(() => {});
        await pause(page, 1500);
      });
    }
    await cap(page, "Step 3. AI ignores light and angle. Only real damage counts", 3400);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
    await cap(page, "Marker stain: Rs 500 to 1,500. Clean wall: Rs 0", 3400);
    await page.getByRole("button", { name: /See the verdict/ }).first().click();
    await page.waitForURL(/\/v\//);
    await pause(page, 1800);
    await cap(page, "Fair deduction, and what should come back, in one number", 3400);
    await page.evaluate(() => window.scrollTo({ top: 380, behavior: "smooth" }));
    await cap(page, "The ledger: deposit held, damage found, refund due", 3600);

    // Before and after slider
    const ba = page.locator(".ba").first();
    await ba.scrollIntoViewIfNeeded();
    await cap(page, "Drag to compare move-in and move-out", 1600);
    const box = await ba.boundingBox();
    if (box) {
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.5, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.12, y, { steps: 20 });
      await page.mouse.move(box.x + box.width * 0.88, y, { steps: 30 });
      await page.mouse.move(box.x + box.width * 0.5, y, { steps: 15 });
      await page.mouse.up();
    }
    await pause(page, 800);
    await page.evaluate(() => window.scrollTo({ top: 360, behavior: "smooth" }));
    await pause(page, 800);
    const claim = page.locator('input[aria-label="Landlord claim in rupees"]');
    await claim.scrollIntoViewIfNeeded();
    await claim.fill("55000");
    await cap(page, "Landlord claimed Rs 55,000? The photos support far less", 4200);
    await cap(page, "Jaisa Tha. A dashcam for your rental deposit.", 3800, true);
  } finally {
    await pause(page, 300);
    await ctx.close();
  }
  return { id, waits: waits.slice() };
}

// ---------------- Laptop clip ----------------
async function laptop(id) {
  const { ctx, page } = await newCtx("laptop", 1280, 800, false);
  try {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await cap(page, "Works on phone and laptop", 3600);
    await page.goto(BASE + "/v/" + (id || "eb21bfa6a3"), { waitUntil: "networkidle" });
    await cap(page, "Same sealed record, same verdict, on a big screen", 3000);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
    await pause(page, 2400);
    await cap(page, "jaisa-tha-udtaryan.netlify.app", 2800);
  } finally {
    await ctx.close();
  }
}

const { id, waits: w } = await phone();
await laptop(id);
fs.writeFileSync(path.join(RAW, "waits.json"), JSON.stringify({ id, waits: w }));
console.log("recorded", id, JSON.stringify(w));
process.exit(0);
