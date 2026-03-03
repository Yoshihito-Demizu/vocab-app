"use strict";

/**
 * docs/js/config.js
 * - mode=prod/mock を決定
 * - SupabaseのURL/KEYが無い・不正なら強制mock
 * - window.USE_MOCK と window.clientReady の整合を100%取る
 */

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "ここにanonkey（長いeyJ...）"; // ←必ず本物に置き換え

// ===== モード決定 =====
const params = new URLSearchParams(location.search);
const urlMode = (params.get("mode") || "").toLowerCase();

let MODE = urlMode || localStorage.getItem("vocab_mode") || "mock";
if (MODE !== "mock" && MODE !== "prod") MODE = "mock";

// ===== KEY/URLの検査 =====
const key = (SUPABASE_ANON_KEY || "").trim();
const url = (SUPABASE_URL || "").trim();

// ざっくり検査：未設定/短すぎ/日本語が混じってる/プレースホルダっぽい
const looksMissing = !url || !key;
const looksPlaceholder = key.includes("ここに") || key.includes("あなたの") || key.includes("anon") && key.length < 80;
const hasNonAscii = /[^\x00-\x7F]/.test(key); // 日本語など
const looksInvalid = looksMissing || looksPlaceholder || hasNonAscii || key.length < 80;

// prod指定でも鍵がダメならmockへ強制
if (MODE === "prod" && looksInvalid) {
  console.warn("[config] Supabase key/url missing -> MODE forced mock.");
  MODE = "mock";
}

// ここで確定
localStorage.setItem("vocab_mode", MODE);
window.USE_MOCK = (MODE === "mock");

// デバッグ用（長さだけ）
window.__DEBUG_SUPABASE_KEY = key;

console.log("[config] MODE =", MODE, "USE_MOCK =", window.USE_MOCK);

// ===== Supabase読み込み & clientReady =====
window.client = null;

// 「clientが使える状態」になるのを待つPromise（mockなら即resolve）
window.clientReady = new Promise((resolve) => {
  if (window.USE_MOCK) return resolve(null);

  // SDKを動的ロード
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload = () => {
    try {
      console.log("[config] Supabase SDK loaded = true");
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
