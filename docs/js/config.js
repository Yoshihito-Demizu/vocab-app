"use strict";

/**
 * docs/js/config.js
 * - mode=prod/mock を決定
 * - SupabaseのURL/KEYが無い・不正なら強制mock
 * - window.USE_MOCK と window.clientReady の整合を取る
 * - Supabase SDK はローカル ./js/supabase.js を読む
 * - loginId -> email 変換を定義
 */

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

// ===== モード決定 =====
const params = new URLSearchParams(location.search);
const urlMode = (params.get("mode") || "").toLowerCase();

let MODE = urlMode || localStorage.getItem("vocab_mode") || "mock";
if (MODE !== "mock" && MODE !== "prod") MODE = "mock";

// ===== KEY/URLの検査 =====
const key = (SUPABASE_ANON_KEY || "").trim();
const url = (SUPABASE_URL || "").trim();

const looksMissing = !url || !key;
const looksPlaceholder =
  key.includes("ここに") ||
  key.includes("あなたの") ||
  key.includes("ANON KEY") ||
  key.length < 80;
const hasNonAscii = /[^\x00-\x7F]/.test(key);
const looksInvalid = looksMissing || looksPlaceholder || hasNonAscii;

// prod指定でも鍵がダメならmockへ強制
if (MODE === "prod" && looksInvalid) {
  console.warn("[config] Supabase key/url invalid -> MODE forced mock.");
  MODE = "mock";
}

// ここで確定
localStorage.setItem("vocab_mode", MODE);
window.USE_MOCK = (MODE === "mock");

console.log("[config] MODE =", MODE, "USE_MOCK =", window.USE_MOCK);

// ===== Supabase読み込み & clientReady =====
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

// ===== loginId -> email 変換 =====
// 例: "2-3-01-k9f2" -> "2-3-01-k9f2@app.local"
window.toEmail = function toEmail(loginId) {
  const s = String(loginId || "").trim().toLowerCase();
  const safe = s.replace(/[^a-z0-9\-_]/g, "-");
  return `${safe}@app.local`;
};
