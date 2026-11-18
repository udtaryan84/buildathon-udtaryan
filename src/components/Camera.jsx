import { useEffect, useRef, useState } from "react";
import { processImage } from "../lib/api.js";
import { haptic } from "../lib/motion.js";
import { Icon } from "./Bits.jsx";

// Full screen camera that slides up like a sheet. With `overlaySrc` the move-in photo is shown
// faded on top so the tenant can line up roughly the same shot. Falls back to upload if the
// camera is blocked or missing.
export default function Camera({ title, overlaySrc, onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [opacity, setOpacity] = useState(40);
  const [showOverlay, setShowOverlay] = useState(true);
  const [grid, setGrid] = useState(false);
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch {
        setError("The camera is not available here. You can upload a photo instead.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busy) return;
    haptic(15);
    setFlash((n) => n + 1);
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    const photo = await processImage(canvas);
    // Let the flash land before the sheet closes.
    setTimeout(() => onCapture(photo), 160);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onCapture(await processImage(file));
    } catch {
      setBusy(false);
      setError("That file did not open as a photo. Please pick a JPG or PNG.");
    }
  }

  return (
    <div className="cam" role="dialog" aria-label={`Camera: ${title}`}>
      <div className="cam-top">
        <button className="cam-btn" onClick={onCancel} aria-label="Close camera" style={{ justifySelf: "start" }}>
          <Icon name="close" size={18} />
        </button>
        <div className="cam-title">{title}</div>
        <span />
      </div>

      <div className="cam-stage">
        {!error && <video ref={videoRef} playsInline muted className="cam-video" />}
        {error && (
          <div className="cam-msg">
            <Icon name="camera" size={40} />
            <p>{error}</p>
            <button className="cam-btn on" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="upload" size={16} /> Upload a photo
            </button>
          </div>
        )}
        {overlaySrc && ready && (
          <img
            src={overlaySrc}
            alt=""
            className="cam-overlay"
            style={{ opacity: showOverlay ? opacity / 100 : 0 }}
          />
        )}
        {grid && <div className="cam-grid" />}
        {overlaySrc && ready && <div className="cam-tip">Roughly the same spot is fine</div>}
        {flash > 0 && <div className="cam-flash" key={flash} />}
      </div>

      <div className="cam-tools">
        {overlaySrc && (
          <button
            className={`cam-btn ${showOverlay ? "on" : ""}`}
            onClick={() => {
              haptic();
              setShowOverlay((s) => !s);
            }}
            aria-pressed={showOverlay}
          >
            <Icon name="layers" size={16} /> Move-in photo
          </button>
        )}
        <button
          className={`cam-btn ${grid ? "on" : ""}`}
          onClick={() => {
            haptic();
            setGrid((g) => !g);
          }}
          aria-pressed={grid}
        >
          <Icon name="grid" size={16} /> Grid
        </button>
      </div>
      {overlaySrc && showOverlay && ready && (
        <div className="cam-slider">
          <span>Fade</span>
          <input type="range" min="10" max="90" value={opacity} onChange={(e) => setOpacity(+e.target.value)} aria-label="Overlay strength" />
        </div>
      )}

      <div className="cam-bar">
        <button className="cam-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="upload" size={16} /> Upload
        </button>
        <button className="shutter" onClick={snap} disabled={!ready || busy} aria-label="Take photo">
          <span />
        </button>
        <span />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </div>
  );
}
