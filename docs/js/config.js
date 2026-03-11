"use strict";

/**
 * docs/js/config.js
 * - 本番固定
 * - Supabase SDK を ./js/supabase.js から読む
 * - loginId -> email 変換
 */

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

// ===== 本番固定 =====
window.USE_MOCK = false;
localStorage.setItem("vocab_mode", "prod");

console.log("[config] MODE = prod USE_MOCK = false");

// ===== Supabase client =====
window.client = null;

window.clientReady = new Promise((resolve) => {
  const s = document.createElement("script");
  s.src = "./js/supabase.js";

  s.onload = () => {
    try {
      console.log("[config] Supabase SDK loaded = true");

      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("window.supabase.createClient が見つかりません");
      }

      window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("[config] Supabase client created = true");
      resolve(window.client);
    } catch (e) {
      console.warn("[config] Supabase client create failed:", e);
      resolve(null);
    }
  };

  s.onerror = (e) => {
    console.warn("[config] Supabase SDK load failed:", e);
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
