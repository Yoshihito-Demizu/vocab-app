// docs/js/config.js
"use strict";

const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY_RAW =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

// 1) 空白除去
let SUPABASE_ANON_KEY = String(SUPABASE_ANON_KEY_RAW).replace(/\s+/g, "");
// 2) JWTとして許可する文字だけ残す（見えない文字混入対策）
SUPABASE_ANON_KEY = SUPABASE_ANON_KEY.replace(/[^A-Za-z0-9._-]/g, "");

// デバッグ情報（これが見えれば「更新反映OK」）
window.__DEBUG_SUPABASE_KEY_INFO = {
  len: SUPABASE_ANON_KEY.length,
  dotCount: (SUPABASE_ANON_KEY.match(/\./g) || []).length,
  hasNonAscii: [...SUPABASE_ANON_KEY].some(ch => ch.charCodeAt(0) > 127),
};

// ===== MODE =====
function getMode() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("mode") || "").toLowerCase();
  if (q === "mock" || q === "prod") return q;

  const saved = (localStorage.getItem("vocab_mode") || "").toLowerCase();
  if (saved === "mock" || saved === "prod") return saved;

  return "mock";
}
function setMode(mode) { localStorage.setItem("vocab_mode", mode); }

const MODE = getMode();
setMode(MODE);
window.USE_MOCK = (MODE === "mock");

// loginId をメール化（仮）
window.toEmail = (loginId) => `${loginId}@demo.local`;

// ===== SDK load =====
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

// clientReady
window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] MODE=mock -> supabase not used.");
    window.client = null;
    return;
  }

  // キーが変なら安全に止める
  if (!SUPABASE_ANON_KEY || window.__DEBUG_SUPABASE_KEY_INFO.dotCount !== 2 || window.__DEBUG_SUPABASE_KEY_INFO.hasNonAscii) {
    console.error("[config] Bad anon key:", window.__DEBUG_SUPABASE_KEY_INFO);
    alert("Supabase anon key が不正（見えない文字混入など）。MOCKに切り替えます。");
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

  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] client created =", !!window.client);
})();

// バッジ
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
