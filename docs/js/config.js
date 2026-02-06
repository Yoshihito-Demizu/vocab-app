// js/config.js

// ★ ネットが直ったら false にする
const USE_MOCK = true;

// あなたのSupabase（本番用）
const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jz9P5p5bD7MBbfitHvYTiA_q_3CArJz";

// supabase-js が読み込めているかチェック
const hasSupabaseSDK = typeof supabase !== "undefined";

// 本番用クライアント（SDKがある時だけ）
const client = hasSupabaseSDK ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 便利：メール化（本番用）
function toEmail(loginId) {
  return `${loginId}@school.local`;
}

// デバッグ用
console.log("[config] USE_MOCK =", USE_MOCK);
console.log("[config] Supabase SDK loaded =", hasSupabaseSDK);
