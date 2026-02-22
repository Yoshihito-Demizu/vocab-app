"use strict";

const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY_RAW = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";
const SUPABASE_ANON_KEY = String(SUPABASE_ANON_KEY_RAW).replace(/\s+/g, "");

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
console.log("[config] MODE =", MODE);

// 必須
window.toEmail = (loginId) => `${loginId}@demo.local`;

async function loadSupabaseSDK() {
  if (window.supabase?.createClient) return true;

  return await new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => resolve(!!window.supabase?.createClient);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

window.client = null;

window.clientReady = (async () => {
  if (window.USE_MOCK) {
    console.log("[config] mock -> supabase not used");
    return null;
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "ここにanon key（長い eyJ...）") {
    throw new Error("[config] anon key not set");
  }

  const ok = await loadSupabaseSDK();
  console.log("[config] Supabase SDK loaded =", ok);
  if (!ok) throw new Error("[config] failed to load supabase-js");

  window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("[config] Supabase client created =", !!window.client);

  if (!window.client) throw new Error("[config] client create failed");
  return window.client;
})();

