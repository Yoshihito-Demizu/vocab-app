"use strict";

/**
 * config.js
 * - mode=mock|prod を URL or localStorage から決定
 * - window.USE_MOCK を必ず定義
 * - Supabase SDK を動的ロードし、window.client / window.clientReady を提供
 * - SWキャッシュで切替が反映されない対策として、モード切替はURLを書き換えて reload
 */

// ====== Supabase（あなたの値に置換） ======
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "ここにanonkey（長いeyJ...）"; // ←必ず本物

// ====== localStorage 安全ラッパ ======
function safeLSGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLSSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

// ====== モード決定 ======
const params = new URLSearchParams(location.search);
const urlMode = (params.get("mode") || "").toLowerCase();

let MODE = urlMode || safeLSGet("vocab_mode") || "mock";
if (MODE !== "mock" && MODE !== "prod") MODE = "mock";
safeLSSet("vocab_mode", MODE);

// 必ず定義（ranking.js/api.js がこれを参照）
window.MODE = MODE;
window.USE_MOCK = MODE === "mock";

// ====== 画面右上のMODE表示（クリックで切替） ======
(function mountModeBadge() {
  // index.html に MODEバッジ要素が無くても動くように、勝手に付ける
  const badge = document.createElement("div");
  badge.id = "modeBadge";
  badge.textContent = `MODE: ${MODE.toUpperCase()}`;
  badge.style.position = "fixed";
  badge.style.right = "12px";
  badge.style.top = "12px";
  badge.style.zIndex = "9999";
  badge.style.padding = "8px 12px";
  badge.style.borderRadius = "999px";
  badge.style.fontWeight = "900";
  badge.style.fontSize = "12px";
  badge.style.cursor = "pointer";
  badge.style.userSelect = "none";
  badge.style.border = "1px solid rgba(255,255,255,.18)";
  badge.style.background = MODE === "prod" ? "rgba(180,30,30,.55)" : "rgba(30,120,180,.45)";
  badge.style.color = "white";
  badge.title = "クリックで MODE 切替（mock/prod）";

  badge.addEventListener("click", () => {
    const next = (window.MODE === "prod") ? "mock" : "prod";
    safeLSSet("vocab_mode", next);

    // SWキャッシュ対策：URLにmodeとtを付けて強制リロード
    const u = new URL(location.href);
    u.searchParams.set("mode", next);
    u.searchParams.set("t", String(Date.now()));
    location.href = u.toString();
  });

  document.body.appendChild(badge);
})();

console.log("[config] MODE =", MODE, "USE_MOCK =", window.USE_MOCK);

// ====== Supabase client 準備 ======
window.client = null;

// clientReady: api.js が await できるようにする
let _resolveClientReady;
window.clientReady = new Promise((resolve) => { _resolveClientReady = resolve; });

// mock なら即 resolve
if (window.USE_MOCK) {
  _resolveClientReady(null);
} else {
  // prod でキーが空っぽなら mock 扱い（ただし MODE は表示の通り prod のままにする）
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 50) {
    console.warn("[config] Supabase key/url missing -> fallback to mock behavior.");
    window.client = null;
    _resolveClientReady(null);
  } else {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => {
      const ok = !!window.supabase?.createClient;
      console.log("[config] Supabase SDK loaded =", ok);
      if (!ok) {
        _resolveClientReady(null);
        return;
      }
      window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("[config] Supabase client created =", !!window.client);
      _resolveClientReady(window.client);
    };
    s.onerror = () => {
      console.warn("[config] Supabase SDK load failed -> fallback mock behavior.");
      _resolveClientReady(null);
    };
    document.head.appendChild(s);
  }
}
