"use strict";

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "あなたのanonキー";

// ===== モード決定（超シンプル版）=====
const params = new URLSearchParams(location.search);
const urlMode = params.get("mode");

let MODE = urlMode || localStorage.getItem("vocab_mode") || "mock";

if (MODE !== "mock" && MODE !== "prod") {
  MODE = "mock";
}

localStorage.setItem("vocab_mode", MODE);

window.USE_MOCK = MODE === "mock";

console.log("[config] MODE =", MODE);

// ===== Supabase読み込み =====
window.client = null;

if (!window.USE_MOCK) {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  s.onload = () => {
    window.client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    console.log("[config] Supabase client created");
  };
  document.head.appendChild(s);
}
