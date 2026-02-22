"use strict";

// ===== Supabase =====
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "ここに本物のanonキー";

// ===== モード決定 =====
const params = new URLSearchParams(location.search);
const urlMode = params.get("mode");

let MODE = urlMode || localStorage.getItem("vocab_mode") || "mock";

if (MODE !== "mock" && MODE !== "prod") {
  MODE = "mock";
}

localStorage.setItem("vocab_mode", MODE);
window.USE_MOCK = MODE === "mock";

console.log("[config] MODE =", MODE);

// ===== Supabase clientReady を必ず作る =====
window.client = null;

window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] MOCK mode");
    return null;
  }

  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => {
      window.client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );
      console.log("[config] Supabase client created");
      resolve(window.client);
    };
    s.onerror = () => {
      console.warn("[config] Supabase load failed → fallback mock");
      window.USE_MOCK = true;
      resolve(null);
    };
    document.head.appendChild(s);
  });
})();
