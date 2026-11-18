import { useEffect, useRef, useState } from "react";
import { processImage } from "../lib/api.js";

// Full screen camera. With `overlaySrc` the move-in photo is shown faded on top so the tenant
// can line up the exact same shot. Falls back to gallery upload if the camera is blocked.
export default function Camera({ title, overlaySrc, onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [opacity, setOpacity] = useState(40);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
        setError("Camera is not available here. You can upload a photo instead.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    onCapture(await processImage(canvas));
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    onCapture(await processImage(file));
  }

  return (
    <div className="cam">
      <div className="cam-top">
        <button className="ghost light" onClick={onCancel}>Close</button>
        <div className="cam-title">{title}</div>
        <span style={{ width: 56 }} />
      </div>
      <div className="cam-stage">
        {!error && <video ref={videoRef} playsInline muted className="cam-video" />}
        {error && <div className="cam-error">{error}</div>}
        {overlaySrc && ready && (
          <img src={overlaySrc} alt="Move-in photo for alignment" className="cam-overlay" style={{ opacity: opacity / 100 }} />
        )}
      </div>
      {overlaySrc && (
        <div className="cam-slider">
          <span>Move-in photo: line up the same shot</span>
          <input type="range" min="0" max="90" value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
        </div>
      )}
      <div className="cam-bar">
        <button className="ghost light" onClick={() => fileRef.current?.click()} disabled={busy}>Upload</button>
        <button className="shutter" onClick={snap} disabled={!ready || busy} aria-label="Take photo" />
        <span style={{ width: 72 }} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </div>
  );
}
