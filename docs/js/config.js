// docs/js/config.js
"use strict";

// =====================
// ここだけ自分の値にする
// =====================
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";

// ★ Supabase Project Settings → API → anon public を貼る
// 先頭が eyJ... で始まる長い文字列
const SUPABASE_ANON_KEY_RAW = "あなたのanonキー";

// ★ コピペ混入（改行/空白/見えない文字）を除去
const SUPABASE_ANON_KEY = String(SUPABASE_ANON_KEY_RAW).replace(/\s+/g, "");

// =====================
// MODE 決定（URL > localStorage > default）
// =====================
function getMode() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("mode") || "").toLowerCase();
  if (q === "mock" || q === "prod") return q;

  const saved = (localStorage.getItem("vocab_mode") || "").toLowerCase();
  if (saved === "mock" || saved === "prod") return saved;

  return "mock"; // 安全側
}
function setMode(mode) {
  localStorage.setItem("vocab_mode", mode);
}

const MODE = getMode();
setMode(MODE);

window.USE_MOCK = (MODE === "mock");
console.log("[config] MODE =", MODE);

// ✅ これが無いと api.js で「toEmail is not defined」になる
window.toEmail = (loginId) => `${loginId}@demo.local`;

// =====================
// Supabase SDK を読み込む
// =====================
async function loadSupabaseSDK() {
  if (window.supabase && typeof window.supabase.createClient === "function") return true;

  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => resolve(!!(window.supabase && window.supabase.createClient));
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

// ✅ これが超重要：他のJSが「clientできた？」を待てるようにする
window.client = null;
window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] mock -> supabase not used");
    window.client = null;
    return;
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "あなたのanonキー") {
    console.warn("[config] anon key not set -> force mock");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  const ok = await loadSupabaseSDK();
  console.log("[config] Supabase SDK loaded =", ok);

  if (!ok) {
    console.warn("[config] SDK load failed -> force mock");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] Supabase client created");
})();
