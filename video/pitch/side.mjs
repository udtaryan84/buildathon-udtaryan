import { createRequire } from "node:module"; import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.APPDATA, "npm/node_modules/@playwright/cli/node_modules/playwright-core"));
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.setContent(`<style>*{margin:0}body{width:1920px;height:1080px;background:transparent;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;color:#fff;padding:0 0 0 130px;display:flex;flex-direction:column;justify-content:center;gap:34px}
.k{font-size:30px;letter-spacing:7px;color:#64d2ff;font-weight:600}.t{font-size:96px;font-weight:700;letter-spacing:-3px;line-height:1.05}.s{font-size:40px;color:#cfd6e4;line-height:1.35;max-width:760px}</style>
<div class=k>JAISA THA</div><div class=t>Move in.<br>Move out.<br>Get it back.</div><div class=s>Sealed photos, AI that ignores light and angle, and a fair number you can send on WhatsApp.</div>`);
await p.screenshot({ path: "pitch/side.png", omitBackground: true }); await b.close();
