"use strict";

/**
 * docs/js/config.js
 * - ID入力方式
 * - Supabase clientのみ作る（Authは使わない）
 */

const SUPABASE_URL = "https://cnczakndzbqvauovoybv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY3pha25kemJxdmF1b3ZveWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjQxNzgsImV4cCI6MjA4NDgwMDE3OH0.IRszAYwh3XPqWvl6fCApjEPTuOm9x647cqzPCgmgYUA";

window.USE_MOCK = false;
console.log("[config] MODE = prod USE_MOCK = false");

window.client = null;

window.clientReady = new Promise((resolve) => {
  const s = document.createElement("script");
  s.src = "./js/supabase.js";

  s.onload = () => {
    try {
      console.log("[config] Supabase SDK loaded = true");

      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("window.supabase.createClient が見つかりません");
      }

      window.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("[config] Supabase client created = true");
      resolve(window.client);
    } catch (e) {
      console.warn("[config] Supabase client create failed:", e);
      resolve(null);
    }
  };

  s.onerror = (e) => {
    console.warn("[config] Supabase SDK load failed:", e);
    resolve(null);
  };

  document.head.appendChild(s);
});
