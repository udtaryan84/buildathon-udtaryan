import { useEffect, useRef, useState } from "react";
import { navigate } from "../lib/api.js";
import { SPRINGS, haptic, reduceMotion } from "../lib/motion.js";

/* ---------- Icons: one stroke family, 1.75 weight, 24 grid ---------- */
const PATHS = {
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.8 2.8L16.2 9.6" />
    </>
  ),
  seal: (
    <>
      <path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </>
  ),
  message: <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.2A8 8 0 1 1 20 11.5z" />,
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16" />
    </>
  ),
  layers: (
    <>
      <path d="M12 4l8.5 4.5L12 13 3.5 8.5z" />
      <path d="M3.5 12.5L12 17l8.5-4.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  doc: (
    <>
      <path d="M7 3.5h7l4.5 4.5v10A2.5 2.5 0 0 1 16 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z" />
      <path d="M13.5 3.5V8.5h5M8.5 13h7M8.5 16.5h5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5M12 17.3v.2" />
    </>
  ),
  home: <path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z" />,
  swap: <path d="M9 7l-4 5 4 5M15 7l4 5-4 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  retake: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3.7h3.7" />
    </>
  ),
};

export function Icon({ name, size = 20, stroke = 1.75, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/* ---------- Page frame ---------- */
export function Shell({ children, back, backLabel = "Back", actions }) {
  return (
    <div className="page">
      <header className="topbar">
        <div>
          {back && (
            <button
              className="back"
              onClick={() => {
                haptic();
                navigate(back);
              }}
            >
              <Icon name="back" size={24} stroke={2} />
              {backLabel}
            </button>
          )}
        </div>
        <a
          href="/"
          className="title"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="mark">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
            </svg>
          </span>
          Jaisa Tha
        </a>
        <div />
      </header>
      {children}
      {actions && <ActionBar>{actions}</ActionBar>}
    </div>
  );
}

export function ActionBar({ children }) {
  return (
    <div className="actionbar">
      <div className="actionbar-inner">{children}</div>
    </div>
  );
}

/* A button that gives a small haptic tick on tap. */
export function Btn({ kind = "primary", className = "", onClick, children, ...rest }) {
  return (
    <button
      className={`btn ${kind} ${className}`}
      onClick={(e) => {
        haptic();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const LABELS = { pre_existing: "Already there", normal_wear: "Normal wear", damage: "Damage" };

export function Chip({ category, i = 0, children }) {
  return (
    <span className={`chip ${category}`} style={{ "--i": i }}>
      {children ?? LABELS[category] ?? category}
    </span>
  );
}

/* ---------- States ---------- */
export function Loading() {
  return (
    <Shell>
      <div className="skeleton" aria-label="Loading" role="status">
        <div className="sk" style={{ height: 40, width: "70%", marginTop: 12 }} />
        <div className="sk" style={{ height: 18, width: "45%" }} />
        <div className="sk" style={{ height: 88, marginTop: 16, borderRadius: 18 }} />
        <div className="sk" style={{ height: 88, borderRadius: 18 }} />
        <div className="sk" style={{ height: 88, borderRadius: 18 }} />
      </div>
    </Shell>
  );
}

// Turns raw errors into something a person can act on.
export function humanError(message = "") {
  const m = String(message);
  if (/not found|404/i.test(m)) return "We could not find this inspection. Check the code and try again.";
  if (/failed to fetch|network|load failed/i.test(m)) return "You seem to be offline. Check your connection and try again.";
  if (/5\d\d|busy|timeout|unavailable/i.test(m)) return "Our server is busy right now. Please try again in a few seconds.";
  return m || "Something went wrong. Please try again.";
}

export function ErrorState({ message, onRetry }) {
  return (
    <Shell back="/" backLabel="Home">
      <div className="state">
        <div className="ico">
          <Icon name="info" size={28} />
        </div>
        <h2>That did not open</h2>
        <p>{humanError(message)}</p>
        {onRetry ? (
          <Btn kind="secondary" onClick={onRetry}>
            Try again
          </Btn>
        ) : (
          <Btn kind="secondary" onClick={() => navigate("/")}>
            Go home
          </Btn>
        )}
      </div>
    </Shell>
  );
}

export function InlineError({ children }) {
  if (!children) return null;
  return (
    <div className="error-inline" role="alert">
      <Icon name="info" size={18} />
      <span>{children}</span>
    </div>
  );
}

/* ---------- Photo viewer: the thumbnail grows into a full-screen photo ---------- */
let openViewerFn = null;
export function openViewer(src, fromEl) {
  openViewerFn?.(src, fromEl);
}

export function PhotoThumb({ src, alt, className = "thumb", ...rest }) {
  const ref = useRef(null);
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={() => {
        haptic();
        openViewer(src, ref.current);
      }}
      aria-label={`Open photo: ${alt}`}
      {...rest}
    >
      <img src={src} alt={alt} loading="lazy" />
    </button>
  );
}

export function ViewerHost() {
  const [state, setState] = useState(null);
  const imgRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    openViewerFn = (src, fromEl) => {
      setReady(false);
      setState({ src, fromEl });
    };
    return () => (openViewerFn = null);
  }, []);

  // Rect of the image inside the viewer once it fills the screen.
  function finalRect(img) {
    const vw = innerWidth;
    const vh = innerHeight;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4 / 3;
    let w = vw;
    let h = w / ratio;
    if (h > vh) {
      h = vh;
      w = h * ratio;
    }
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }

  function transformFor(from, to) {
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  }

  function place(img) {
    const to = finalRect(img);
    Object.assign(img.style, { width: `${to.width}px`, height: `${to.height}px`, left: `${to.left}px`, top: `${to.top}px` });
    return to;
  }

  function onLoad() {
    const img = imgRef.current;
    if (!img || !state) return;
    const to = place(img);
    setReady(true);
    setOpen(true);
    const from = state.fromEl?.getBoundingClientRect();
    if (!from || reduceMotion()) return;
    img.animate([{ transform: transformFor(from, to), borderRadius: "12px" }, { transform: "none", borderRadius: "0px" }], {
      duration: SPRINGS.snappy.duration,
      easing: SPRINGS.snappy.easing,
    });
  }

  function close() {
    const img = imgRef.current;
    setOpen(false);
    const from = state?.fromEl?.getBoundingClientRect();
    if (!img || !from || reduceMotion()) return setState(null);
    const to = finalRect(img);
    const a = img.animate([{ transform: "none" }, { transform: transformFor(from, to), borderRadius: "12px" }], {
      duration: SPRINGS.smooth.duration - 60,
      easing: SPRINGS.smooth.easing,
      fill: "forwards",
    });
    a.onfinish = () => setState(null);
  }

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  if (!state) return null;
  return (
    <div className={`viewer ${open ? "open" : ""} ${ready ? "ready" : ""}`} onClick={close} role="dialog" aria-label="Photo">
      <img ref={imgRef} src={state.src} alt="" onLoad={onLoad} />
      <button className="cam-btn" aria-label="Close photo" onClick={close}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
