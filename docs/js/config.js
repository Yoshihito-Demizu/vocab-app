"use strict";

/**
 * docs/js/config.js
 * - prod/mock を決定
 * - Supabase SDK を ./js/supabase.js から読む
 * - loginId -> email 変換
 * - 本番キーが正しければ prod のまま動く
 */

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

// ===== mode =====
const params = new URLSearchParams(location.search);
const urlMode = (params.get("mode") || "").toLowerCase();

let MODE = "prod";
if (MODE !== "mock" && MODE !== "prod") MODE = "mock";

// ===== key/url check =====
const key = (SUPABASE_ANON_KEY || "").trim();
const url = (SUPABASE_URL || "").trim();

const looksMissing = !url || !key;
const looksPlaceholder =
  key.includes("ここを") ||
  key.includes("ANON KEY") ||
  key.includes("あなたの") ||
  key.length < 80;
const hasNonAscii = /[^\x00-\x7F]/.test(key);
const looksInvalid = looksMissing || looksPlaceholder || hasNonAscii;

// prod指定でも鍵がダメならmockへ
if (MODE === "prod" && looksInvalid) {
  console.warn("[config] Supabase key/url invalid -> MODE forced mock.");
  MODE = "mock";
}

localStorage.setItem("vocab_mode", MODE);
window.USE_MOCK = (MODE === "mock");

console.log("[config] MODE =", MODE, "USE_MOCK =", window.USE_MOCK);

// ===== Supabase client =====
window.client = null;

window.clientReady = new Promise((resolve) => {
  if (window.USE_MOCK) {
    resolve(null);
    return;
  }

  const s = document.createElement("script");
  s.src = "./js/supabase.js";

  s.onload = () => {
    try {
      console.log("[config] Supabase SDK loaded = true");

      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("window.supabase.createClient が見つかりません");
      }

      window.client = window.supabase.createClient(url, key);
      console.log("[config] Supabase client created = true");
      resolve(window.client);
    } catch (e) {
      console.warn("[config] Supabase client create failed -> fallback mock:", e);
      window.USE_MOCK = true;
      localStorage.setItem("vocab_mode", "mock");
      resolve(null);
    }
  };

  s.onerror = (e) => {
    console.warn("[config] Supabase SDK load failed -> fallback mock:", e);
    window.USE_MOCK = true;
    localStorage.setItem("vocab_mode", "mock");
    resolve(null);
  };

  document.head.appendChild(s);
});

// ===== loginId -> email =====
// 例: 2-3-01-k9f2 -> 2-3-01-k9f2@app.local
window.toEmail = function toEmail(loginId) {
  const s = String(loginId || "").trim().toLowerCase();
  const safe = s.replace(/[^a-z0-9\-_]/g, "-");
  return `${safe}@app.local`;
};

