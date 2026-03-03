"use strict";

/**
 * docs/js/api.js
 * - mock/prod両対応
 * - quiz.js が api.isMock() を呼ぶ前提に合わせる
 * - ランキングRPC：
 *   get_week_options()
 *   get_weekly_top10(p_week_id text)
 *   get_my_weekly_rank(p_week_id text)
 *   submit_run(p_week_id text, p_score int, p_max_combo int, [p_client_ms int])
 */

console.log("[api] loaded (booting...)");

async function ensureClientReady() {
  // config.js が作る window.clientReady を待つ
  if (typeof window.clientReady !== "undefined") {
    await window.clientReady;
  }

  // mockなら client不要
  if (window.USE_MOCK) return null;

  // prodなのに client無いならエラー
  if (!window.client) {
    throw new Error("Supabase client が無い（config.jsの読み込み/ネット確認）");
  }
  return window.client;
}

// ===== util: week id =====
function getISOWeekId(d = new Date()) {
  // ISO week (簡易実装)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const yyyy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yyyy}-W${ww}`;
}

// ===== CSV vocab loader (既存 assets を読む想定) =====
async function loadVocabFromCSV() {
  // 既にあなたのプロジェクトで動いてる前提の最小実装
  // docs/vocab.csv などに合わせて必要ならパスを書き換え
  const tryPaths = ["./vocab.csv", "./data/vocab.csv", "./assets/vocab.csv"];
  for (const p of tryPaths) {
    try {
      const r = await fetch(p, { cache: "no-store" });
      if (!r.ok) continue;
      const text = await r.text();
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      // 期待: word,meaning のCSV（ヘッダあってもOK）
      const rows = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && /word/i.test(line) && /mean/i.test(line)) continue;
        const parts = line.split(",");
        if (parts.length < 2) continue;
        const word = parts[0].trim();
        const meaning = parts.slice(1).join(",").trim();
        if (word && meaning) rows.push({ word, meaning });
      }
      return rows;
    } catch {
      // 次へ
    }
  }
  return [];
}

// ===== api object =====
const api = {
  isMock() {
    return !!window.USE_MOCK;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  async getMyUserId() {
    if (window.USE_MOCK) return "mock-user";
    const client = await ensureClientReady();
    const { data } = await client.auth.getUser();
    return data?.user?.id || null;
  },

  async signIn(loginId, password) {
    if (window.USE_MOCK) {
      return { ok: true, message: "MOCK：ログイン不要" };
    }
    const client = await ensureClientReady();

    // ここはあなたの運用（loginId を email 化）に合わせる
    // 例: taro -> taro@demo.local のような固定ドメイン
    const email = String(loginId).includes("@")
      ? String(loginId)
      : `${String(loginId)}@demo.local`;

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "ログインOK" };
  },

  async signOut() {
    if (window.USE_MOCK) return { ok: true };
    const client = await ensureClientReady();
    await client.auth.signOut();
    return { ok: true };
  },

  // ===== Ranking: week options =====
  async fetchWeekOptions() {
    if (window.USE_MOCK) return [api.getWeekIdNow()];
    const client = await ensureClientReady();

    const { data, error } = await client.rpc("get_week_options");
    if (error) throw error;

    // data: [{week_id:"2026-W09"}, ...] or ["2026-W09", ...] どっちでも吸収
    if (!Array.isArray(data)) return [api.getWeekIdNow()];
    const weeks = data.map(x => (typeof x === "string" ? x : x.week_id)).filter(Boolean);
    return weeks.length ? weeks : [api.getWeekIdNow()];
  },

  // ===== Ranking: top10 =====
  async fetchWeeklyTop(weekId) {
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();

    const { data, error } = await client.rpc("get_weekly_top10", { p_week_id: weekId });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // ===== Ranking: my rank =====
  async fetchMyWeeklyRank(weekId) {
    if (window.USE_MOCK) return null;
    const client = await ensureClientReady();

    const { data, error } = await client.rpc("get_my_weekly_rank", { p_week_id: weekId });
    if (error) throw error;

    // 返りが配列/単体どっちでも吸収
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  },

  // ===== Submit run (weekly best-score用) =====
  async submitRun(score, maxCombo, clientMs) {
    if (window.USE_MOCK) return { ok: true, via: "mock", data: null };

    const client = await ensureClientReady();
    const weekId = api.getWeekIdNow();

    // 関数が2種類ある（p_client_ms有無）ので、あれば4引数版へ
    const payload = {
      p_week_id: weekId,
      p_score: Number(score) | 0,
      p_max_combo: Number(maxCombo) | 0,
    };
    if (typeof clientMs === "number") payload.p_client_ms = Number(clientMs) | 0;

    const { data, error } = await client.rpc("submit_run", payload);
    if (error) throw error;
    return { ok: true, via: "rpc", data };
  },

  // ===== vocab =====
  _vocab: [],
  async loadVocab() {
    const rows = await loadVocabFromCSV();
    api._vocab = rows;
    console.log("[api] vocab loaded from CSV:", rows.length);
    return rows;
  },
};

window.api = api;

// 起動時に語彙だけは読んでおく
(async () => {
  await api.loadVocab();
  console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", api._vocab.length);
})();
