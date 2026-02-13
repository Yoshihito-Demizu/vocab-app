// docs/js/config.js
"use strict";

// =====================
// ここだけ自分の値にする
// =====================
const SUPABASE_URL = "https://xxxxx.supabase.co";   // ← Supabase Project Settings → API → Project URL
const SUPABASE_ANON_KEY = "xxxxx";                  // ← Supabase Project Settings → API → anon public

// Mock切り替え
// true  = 端末内モード（Supabase不要）
// false = Supabase本番
window.USE_MOCK = false;

// loginId をメール化（今は仮）
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

(async () => {
  const ok = await loadSupabaseSDK();
  console.log("[config] Supabase SDK loaded =", ok);

  if (!ok) {
    console.warn("[config] SDK load failed. USE_MOCK forced true.");
    window.USE_MOCK = true;
    window.client = null;
    return;
  }

  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] client created =", !!window.client);
})();
