// docs/js/config.js
"use strict";

/*
  ✅ ここだけ自分の値にする
  - SUPABASE_URL
  - SUPABASE_ANON_KEY_RAW（本物の anon key）
*/
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY_RAW = "ここに本物のanon key（eyJ...）を貼る";

// コピペ混入（改行/空白/見えない文字）を強制除去
const SUPABASE_ANON_KEY = String(SUPABASE_ANON_KEY_RAW || "").replace(/\s+/g, "");

// デバッグ用（必要なくなったら消してOK）
window.__DEBUG_SUPABASE_KEY = SUPABASE_ANON_KEY;

// loginId -> email 化（必ず定義して「toEmail is not defined」を根絶）
window.toEmail = (loginId) => `${String(loginId || "").trim()}@demo.local`;

// =====================
// MODE 決定（URL優先 / 次にlocalStorage / 最後にmock）
// 重要：切替は localStorage に頼らず、URL書き換えで確実化する
// =====================
function safeGetLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetLS(key, val) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

function getMode() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("mode") || "").toLowerCase();
  if (q === "mock" || q === "prod") return q;

  const saved = (safeGetLS("vocab_mode") || "").toLowerCase();
  if (saved === "mock" || saved === "prod") return saved;

  return "mock";
}

function setMode(mode) {
  safeSetLS("vocab_mode", mode);
}

const MODE = getMode();
setMode(MODE);
window.USE_MOCK = (MODE === "mock");

console.log("[config] MODE =", MODE);

// =====================
// Supabase SDK 動的ロード
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

// clientReady（api.jsが待てる）
window.client = null;

window.clientReady = (async () => {
  if (window.USE_MOCK) {
    window.client = null;
    return;
  }

  // キー未設定は安全にMOCKへ
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 80 || !SUPABASE_ANON_KEY.startsWith("ey")) {
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

// =====================
// 右上バッジ（クリックでURLを書き換えて確実に切替）
// =====================
window.addEventListener("DOMContentLoaded", () => {
  const badge = document.createElement("div");
  const refreshText = () => badge.textContent = window.USE_MOCK ? "MODE: MOCK" : "MODE: PROD";
  refreshText();

  badge.style.position = "fixed";
  badge.style.top = "10px";
  badge.style.right = "10px";
  badge.style.zIndex = "99999";
  badge.style.padding = "6px 10px";
  badge.style.borderRadius = "999px";
  badge.style.fontWeight = "900";
  badge.style.fontSize = "12px";
  badge.style.border = "1px solid rgba(255,255,255,.18)";
  badge.style.background = window.USE_MOCK ? "rgba(0,211,138,.18)" : "rgba(255,59,48,.18)";
  badge.style.color = "white";
  badge.style.backdropFilter = "blur(6px)";
  badge.style.cursor = "pointer";
  badge.title = "クリックで切替（MOCK/PROD）";

  badge.addEventListener("click", () => {
    const next = window.USE_MOCK ? "prod" : "mock";
    setMode(next);

    // ✅ localStorageが効かない/キャッシュが強い環境でも確実に切り替わるよう、URLで切替
    const url = new URL(location.href);
    url.searchParams.set("mode", next);
    url.searchParams.set("t", String(Date.now())); // キャッシュバスター
    location.href = url.toString();
  });

  document.body.appendChild(badge);
});
