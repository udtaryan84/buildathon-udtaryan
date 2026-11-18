// Joins the raw recordings into one 1080p MP4. AI waits are sped up, the rest plays at normal speed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(ROOT, "raw");
const { waits } = JSON.parse(fs.readFileSync(path.join(RAW, "waits.json"), "utf8"));
const one = (d) => path.join(RAW, d, fs.readdirSync(path.join(RAW, d)).find((f) => f.endsWith(".webm")));
const phone = one("phone");
const laptop = one("laptop");
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const phoneDur = dur(phone);

// Segment list for the phone clip: normal parts and sped-up waits.
const segs = [];
let cur = 0;
for (const [s, e] of waits) {
  if (s > cur) segs.push({ s: cur, e: s, speed: 1 });
  segs.push({ s, e, speed: Math.max(1, (e - s) / 2.2) });
  cur = e;
}
segs.push({ s: cur, e: phoneDur, speed: 1 });

const f = [];
const labels = [];
segs.forEach((g, i) => {
  f.push(`[0:v]trim=start=${g.s}:end=${g.e},setpts=(PTS-STARTPTS)/${g.speed.toFixed(3)},fps=30[s${i}]`);
  labels.push(`[s${i}]`);
});
f.push(`${labels.join("")}concat=n=${segs.length}:v=1:a=0,scale=-2:1040:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0d,setsar=1[ph]`);
f.push(`[1:v]fps=30,scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0d,setsar=1[lp]`);
f.push(`[ph][lp]concat=n=2:v=1:a=0[v]`);
fs.writeFileSync(path.join(ROOT, "tmp", "filter.txt"), f.join(";\n"));

const out = path.join(ROOT, "jaisa-tha-demo.mp4");
execFileSync(
  "ffmpeg",
  [
    "-v", "error", "-y",
    "-i", phone, "-i", laptop,
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-/filter_complex", path.join(ROOT, "tmp", "filter.txt"),
    "-map", "[v]", "-map", "2:a",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-maxrate", "8M", "-bufsize", "16M",
    "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" },
);
console.log("built", out);
