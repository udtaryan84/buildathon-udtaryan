// Renders the text scenes of the pitch video as 1920x1080 PNGs (one per beat).
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.APPDATA, "npm/node_modules/@playwright/cli/node_modules/playwright-core"));
const dark = "radial-gradient(1200px 700px at 70% 20%, #3a2410 0%, #120c07 60%, #070504 100%)";
const light = "linear-gradient(135deg,#f5f1ea,#e9e2d6)";
const blue = "radial-gradient(1200px 800px at 30% 30%, #0b3a7a 0%, #04122b 70%)";
const S = {
  h1: [dark, `<div class=big>Rs 12,400</div>`],
  h2: [dark, `<div class=big>Rs 51,900</div>`],
  h3: [dark, `<div class="big red">Rs 80,000</div>`],
  h4: [dark, `<div class="big red">Rs 80,000</div><div class=sub>Your deposit. Gone before you know it.</div>`],
  p1: [dark, `<div class=kicker>THE LANDLORD SAYS</div><div class=mid>"That wall was fine when you came."</div>`],
  p2: [dark, `<div class=kicker>YOU SAY</div><div class=mid>"But I have photos."</div><div class=sub>Different light. Different angle. Never shown to him.</div>`],
  p3: [dark, `<div class=kicker>THE REAL PROBLEM</div><div class=mid>Fighting costs more than giving up.</div><div class=sub>He holds the money.</div>`],
  f1: [light, `<div class="kicker dk">WHY THE USUAL FIXES FAIL</div><ul>${li(["Camera roll photos","Not comparable, never agreed"],0)}</ul>`],
  f2: [light, `<div class="kicker dk">WHY THE USUAL FIXES FAIL</div><ul>${li(["Camera roll photos","Not comparable, never agreed"],1)}${li(["Rental checklist","Written once, never checked"],0)}</ul>`],
  f3: [light, `<div class="kicker dk">WHY THE USUAL FIXES FAIL</div><ul>${li(["Camera roll photos","Not comparable, never agreed"],1)}${li(["Rental checklist","Written once, never checked"],1)}${li(["WhatsApp chat","Can be deleted, no proof of time"],0)}</ul>`],
  f4: [light, `<div class="kicker dk">WHY THE USUAL FIXES FAIL</div><ul>${li(["Camera roll photos","Not comparable, never agreed"],1)}${li(["Rental checklist","Written once, never checked"],1)}${li(["WhatsApp chat","Can be deleted, no proof of time"],1)}${li(["Property apps","Built for landlords, not tenants"],1)}</ul>`],
  i1: [blue, `<div class=logo>J</div><div class=big w>Jaisa Tha.</div><div class="sub w">A dashcam for your rental deposit.</div>`],
  c1: [blue, `<div class="big w">Evidence,<br>not arguments.</div>`],
  c2: [blue, `<div class="mid w">Works on phone and laptop</div><div class="url">jaisa-tha-udtaryan.netlify.app</div><div class="sub w">Team udtaryan  |  Build for the Physical World</div>`],
};
function li([a, b], struck) { return `<li class="${struck ? "x" : ""}"><b>${a}</b><span>${b}</span></li>`; }
const html = (bg, body) => `<!doctype html><meta charset=utf-8><style>
*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px;background:${bg};font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 160px;overflow:hidden}
.big{font-size:260px;font-weight:700;letter-spacing:-10px;line-height:1}.red{color:#ff5a4d}.mid{font-size:112px;font-weight:700;letter-spacing:-3px;line-height:1.08;max-width:1500px}
.sub{font-size:56px;font-weight:500;color:#d8c9b6;margin-top:36px;letter-spacing:-1px}.w{color:#fff}.kicker{font-size:34px;letter-spacing:8px;color:#ff9a4d;margin-bottom:34px;font-weight:600}.dk{color:#a0541a}
ul{list-style:none}li{display:flex;flex-direction:column;margin:0 0 30px;color:#1d1d1f}li b{font-size:78px;letter-spacing:-2px}li span{font-size:40px;color:#6b5f52}li.x b{text-decoration:line-through;text-decoration-thickness:8px;text-decoration-color:#d92d20;color:#8d8479}li.x span{color:#b3a999}
.logo{width:150px;height:150px;border-radius:38px;background:#0a84ff;font-size:96px;font-weight:700;display:grid;place-items:center;margin-bottom:40px}.url{font-size:92px;font-weight:700;color:#64d2ff;letter-spacing:-2px;margin:30px 0}
</style>${body}`;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [k, [bg, body]] of Object.entries(S)) { await p.setContent(html(bg, body)); await p.screenshot({ path: `pitch/${k}.png` }); }
await b.close();
console.log("scenes ok");
