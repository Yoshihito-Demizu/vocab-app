// docs/js/config.js
"use strict";

// =====================
// ここだけ自分の値にする
// =====================
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";

// ✅ ここを「本物の anon key」に置き換える（日本語NG）
// 例： const SUPABASE_ANON_KEY_RAW = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....";
const SUPABASE_ANON_KEY_RAW = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

// ★コピペ混入（改行/空白/見えない文字）を強制除去
const SUPABASE_ANON_KEY = String(SUPABASE_ANON_KEY_RAW).replace(/\s+/g, "");

// ★確認用（問題が解決したら消してOK）
window.__DEBUG_SUPABASE_KEY = SUPABASE_ANON_KEY;

// =====================
// MODE 切り替え（事故防止）
// =====================
// 優先度：URLパラメータ > localStorage > デフォルト
// ?mode=mock でMOCK、?mode=prod で本番
function getMode() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("mode") || "").toLowerCase();
  if (q === "mock" || q === "prod") return q;

  const saved = (localStorage.getItem("vocab_mode") || "").toLowerCase();
  if (saved === "mock" || saved === "prod") return saved;

  // 初期値：安全側（MOCK）
  return "mock";
}

function setMode(mode) {
  localStorage.setItem("vocab_mode", mode);
}

const MODE = getMode();
setMode(MODE);

window.USE_MOCK = (MODE === "mock");

// loginId をメール化（仮）
window.toEmail = (loginId) => `${loginId}@demo.local`;

// =====================
// SDK を動的に読み込む
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

// clientReady を用意（api.js が安全に待てる）
window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] MODE=mock -> supabase not used.");
    window.client = null;
    return;
  }

  // キーが未設定なら安全にMOCKへ
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_REAL_ANON_KEY_HERE") {
    console.warn("[config] ANON KEY not set -> MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  const ok = await loadSupabaseSDK();
  console.log("[config] Supabase SDK loaded =", ok);

  if (!ok) {
    console.warn("[config] SDK load failed. MODE forced mock.");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  // Supabase client 作成
  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] client created =", !!window.client);
})();

// =====================
// 画面に今のモードを出す（見落とし防止）
// =====================
window.addEventListener("DOMContentLoaded", () => {
  const badge = document.createElement("div");
  badge.textContent = window.USE_MOCK ? "MODE: MOCK" : "MODE: PROD";
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
    alert(`モードを ${next.toUpperCase()} に切り替えます。再読み込みします。`);
    location.reload();
  });

  document.body.appendChild(badge);
});
