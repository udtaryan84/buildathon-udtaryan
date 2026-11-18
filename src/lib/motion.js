// Motion helpers: spring curves as CSS linear() easing, haptics, count-up and a "fly to" effect.

export const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Damped spring sampled into a CSS linear() easing. `response` is roughly the period in seconds,
// `damping` is the damping ratio (1 = no overshoot, 0.85 = snappy, 0.7 = bouncy).
export function spring(response = 0.4, damping = 0.85, threshold = 0.004) {
  const w = (2 * Math.PI) / response;
  const zw = damping * w;
  const duration = Math.min(0.6, -Math.log(threshold) / zw);
  const wd = w * Math.sqrt(Math.max(1e-6, 1 - damping * damping));
  const steps = 48;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    const x = damping >= 1 ? 1 - Math.exp(-w * t) * (1 + w * t) : 1 - Math.exp(-zw * t) * (Math.cos(wd * t) + (zw / wd) * Math.sin(wd * t));
    pts.push(i === steps ? "1" : x.toFixed(4));
  }
  return { easing: `linear(${pts.join(", ")})`, duration: Math.round(duration * 1000) };
}

export const SPRINGS = {
  smooth: spring(0.42, 1),
  snappy: spring(0.36, 0.85),
  bouncy: spring(0.42, 0.72),
};

// Expose the springs to CSS as custom properties once.
export function installSprings() {
  const root = document.documentElement.style;
  for (const [name, s] of Object.entries(SPRINGS)) {
    root.setProperty(`--spring-${name}`, s.easing);
    root.setProperty(`--spring-${name}-ms`, `${s.duration}ms`);
  }
}

export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

// Count a number up inside an element without re-rendering React.
export function countUp(el, to, format, duration = 900) {
  if (!el) return () => {};
  if (reduceMotion() || !to) {
    el.textContent = format(to);
    return () => {};
  }
  let raf;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = format(to * eased);
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// A full-screen photo shrinks into the element it belongs to (the capture moment).
export function flyInto(src, target) {
  if (!target || reduceMotion()) return;
  const r = target.getBoundingClientRect();
  const img = document.createElement("img");
  img.src = src;
  img.className = "fly";
  document.body.appendChild(img);
  const vw = innerWidth;
  const vh = innerHeight;
  const sx = r.width / vw;
  const sy = r.height / vh;
  const anim = img.animate(
    [
      { transform: "translate(0,0) scale(1,1)", borderRadius: "0px", opacity: 1 },
      { transform: `translate(${r.left}px, ${r.top}px) scale(${sx}, ${sy})`, borderRadius: `${12 / Math.min(sx, sy)}px`, opacity: 1 },
    ],
    { duration: SPRINGS.snappy.duration + 60, easing: SPRINGS.snappy.easing, fill: "forwards" },
  );
  anim.onfinish = () => {
    target.animate([{ transform: "scale(0.92)" }, { transform: "scale(1)" }], { duration: SPRINGS.bouncy.duration, easing: SPRINGS.bouncy.easing });
    img.remove();
  };
}
