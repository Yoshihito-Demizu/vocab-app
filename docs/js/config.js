// docs/js/config.js
"use strict";

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";

// ★ここは「英数字だけの本物anon key」を入れる（日本語/全角/改行が混ざると壊れる）
const SUPABASE_ANON_KEY_RAW = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

// 改行/空白/見えない文字を除去
const SUPABASE_ANON_KEY = String(SUPABASE_ANON_KEY_RAW).replace(/\s+/g, "");

// いまのキー長をデバッグ確認したい時だけ（本番では消してOK）
window.__DEBUG_SUPABASE_KEY = SUPABASE_ANON_KEY;

// loginId をメール化（プロジェクト側の運用に合わせる）
window.toEmail = (loginId) => `${loginId}@demo.local`;

// ===== モード決定 =====
// 優先：URL > localStorage > default(mock)
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

let MODE = getMode();
setMode(MODE);
window.USE_MOCK = (MODE === "mock");

console.log("[config] MODE =", MODE);

// ===== SDK 読み込み =====
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

// ===== clientReady（api.jsが待てるように）=====
window.client = null;

window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] MODE=mock -> supabase not used.");
    window.client = null;
    return;
  }

  // キーが空 or 仮文字列なら mockに落とす
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_REAL_ANON_KEY_HERE") {
    console.warn("[config] anon key not set -> MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  // 変な文字が入ってると supabase が落ちやすい（headersエラーになる）
  // “base64urlっぽいか”を軽くチェック
  if (!/^[A-Za-z0-9._-]+$/.test(SUPABASE_ANON_KEY)) {
    console.warn("[config] anon key looks invalid -> MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  const ok = await loadSupabaseSDK();
  console.log("[config] Supabase SDK loaded =", ok);

  if (!ok) {
    console.warn("[config] SDK load failed -> MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] Supabase client created =", !!window.client);
})();

