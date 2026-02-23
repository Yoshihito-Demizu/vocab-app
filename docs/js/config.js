// docs/js/config.js
"use strict";

// =====================
// ここだけ自分の値にする
// =====================
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";

// ✅ Supabase Dashboard → Project Settings → API → anon / public
// ここを「本物の anon key」に置き換え
const SUPABASE_ANON_KEY_RAW = "";

// =====================
// キーの「見えない文字混入」を徹底除去eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA
// - JWTに出ない文字は全部捨てる（日本語/全角/ゼロ幅/BOMなど全部落ちる）
// =====================
function cleanJwtLikeKey(raw) {
  const s = String(raw || "");
  // JWTで使う可能性がある文字だけ残す（base64url + "." + "_" + "-"）
  return s.replace(/[^A-Za-z0-9._-]/g, "");
}
const SUPABASE_ANON_KEY = cleanJwtLikeKey(SUPABASE_ANON_KEY_RAW);

// デバッグ（問題解決したら消してOK）
window.__DEBUG_SUPABASE_KEY = SUPABASE_ANON_KEY;

// =====================
// MODE（超安定版）
// 優先：URL ?mode=mock|prod → localStorage → default mock
// =====================
function getMode() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("mode") || "").toLowerCase();
  if (q === "mock" || q === "prod") return q;

  const saved = (localStorage.getItem("vocab_mode") || "").toLowerCase();
  if (saved === "mock" || saved === "prod") return saved;

  return "mock";
}
function setMode(mode) {
  localStorage.setItem("vocab_mode", mode);
}

const MODE = getMode();
setMode(MODE);

window.USE_MOCK = (MODE === "mock");
console.log("[config] MODE =", MODE);

// loginId -> email（あなたの設計どおり）
window.toEmail = (loginId) => `${String(loginId || "").trim()}@demo.local`;

// =====================
// SDKロード & client作成
// =====================
async function loadSupabaseSDK() {
  if (window.supabase?.createClient) return true;

  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => resolve(!!window.supabase?.createClient);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

window.client = null;

window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] MODE=mock -> supabase not used.");
    window.client = null;
    return null;
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 80) {
    console.warn("[config] anon key looks invalid -> MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return null;
  }

  const ok = await loadSupabaseSDK();
  console.log("[config] Supabase SDK loaded =", ok);

  if (!ok) {
    console.warn("[config] SDK load failed -> MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return null;
  }

  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] Supabase client created =", !!window.client);
  return window.client;
})();
