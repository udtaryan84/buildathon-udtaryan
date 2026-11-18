// Small helpers: API calls, image processing, navigation, WhatsApp links.
import { useEffect, useState } from "react";

export async function api(path, body) {
  const res = await fetch("/api" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
  return data;
}

// Shrinks a photo so uploads are fast, then returns base64 and a SHA-256 fingerprint.
export async function processImage(source, maxSide = 1280) {
  const bitmap = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = dataUrl.split(",")[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { base64, mimeType: "image/jpeg", dataUrl, hash };
}

export async function urlToBase64(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function navigate(path) {
  history.pushState({}, "", path);
  window.dispatchEvent(new Event("navchange"));
  window.scrollTo(0, 0);
}

export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener("navchange", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("navchange", update);
    };
  }, []);
  return path;
}

export const rupees = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

export function whatsappLink(number, text) {
  const digits = String(number || "").replace(/\D/g, "");
  const full = digits.length === 10 ? "91" + digits : digits;
  const base = full ? `https://wa.me/${full}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

// Remembers inspections created on this phone, so the home screen can list them.
export function rememberInspection(item) {
  try {
    const list = JSON.parse(localStorage.getItem("jt-inspections") || "[]").filter((i) => i.id !== item.id);
    list.unshift(item);
    localStorage.setItem("jt-inspections", JSON.stringify(list.slice(0, 10)));
  } catch {
    /* storage can be blocked */
  }
}

export function recentInspections() {
  try {
    return JSON.parse(localStorage.getItem("jt-inspections") || "[]");
  } catch {
    return [];
  }
}

export const when = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
