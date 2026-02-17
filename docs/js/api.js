// docs/js/api.js
/* global USE_MOCK, toEmail */
"use strict";

const mock = {
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],
};

window.__LAST_MOCK_CORRECT = null;
window.__LAST_PROD_CORRECT = null;

// ===== client 準備待ち =====
async function ensureClientReady() {
  if (window.USE_MOCK) return null;
  if (window.clientReady && typeof window.clientReady.then === "function") {
    await window.clientReady;
  }
  const c = window.client || null;
  if (!c) throw new Error("Supabase client が無い（config.jsの読み込み/ネット確認）");
  return c;
}

// ===== week_id（YYYY-Www）=====
function getISOWeekId(d) {
  const dd = d ? new Date(d) : new Date();
  const date = new Date(Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const yyyy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yyyy}-W${ww}`;
}

// ===== CSV loader（MOCK用語彙を増やす）=====
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length <= 1) return [];
  const header = lines[0].split(",").map(s => s.trim());
  const idxWord = header.indexOf("word");
  const idxMeaning = header.indexOf("meaning");
  const idxLevel = header.indexOf("level");

  if (idxWord < 0 || idxMeaning < 0) throw new Error("CSVヘッダに word,meaning が必要です");

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(s => s.trim());
    const word = cols[idxWord] || "";
    const meaning = cols[idxMeaning] || "";
    const levelRaw = idxLevel >= 0 ? (cols[idxLevel] || "1") : "1";
    const level = Number(levelRaw) || 1;
    if (!word || !meaning) continue;
    out.push({ word, meaning, level });
  }
  return out;
}

async function _loadVocabCSV() {
  try {
    const res = await fetch("./vocab.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("vocab.csv fetch failed: " + res.status);
    const text = await res.text();
    const list = parseCSV(text);
    if (list.length >= 4) {
      mock.vocab = list;
      console.log("[api] vocab loaded from CSV:", list.length);
    } else {
      console.warn("[api] vocab.csv too small (need >=4). keep fallback:", list.length);
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e && e.message ? e.message : e);
  }
}

// ✅ これを待てば vocab が必ず準備できる
window.vocabReady = (async () => {
  await _loadVocabCSV();
})();

// ===== choices generator（意味4択）=====
function makeChoices(vocabList, correctItem) {
  const others = vocabList
    .filter(v => v.word !== correctItem.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const meanings = [correctItem.meaning].concat(others.map(o => o.meaning))
    .sort(() => Math.random() - 0.5);

  const labels = ["A", "B", "C", "D"];
  const map = {};
  for (let i = 0; i < 4; i++) map[labels[i]] = meanings[i];

  const correctLabel = labels[meanings.indexOf(correctItem.meaning)];
  return { map, correctLabel };
}

const api = {
  isMock() { return !!window.USE_MOCK; },

  async signIn(loginId, password) {
    if (window.USE_MOCK) return { ok: true, message: "（モック：ログイン不要）" };
    const client = await ensureClientReady();
    const email = (window.toEmail || toEmail)(loginId);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "ログイン成功" };
  },

  async signOut() {
    if (window.USE_MOCK) return;
    const client = await ensureClientReady();
    await client.auth.signOut();
  },

  async getMyUserId() {
    if (window.USE_MOCK) return "u1";
    const client = await ensureClientReady();
    const { data } = await client.auth.getSession();
    return (data && data.session && data.session.user && data.session.user.id) ? data.session.user.id : null;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  // ===== 出題 =====
  async fetchLatestQuestion() {
    // ✅ 最初の出題前に必ずCSVロード完了を待つ
    if (window.vocabReady) {
      try { await window.vocabReady; } catch { /* ignore */ }
    }

    // ---- MOCK：CSV vocab から作る ----
    if (window.USE_MOCK) {
      const pool = (mock.vocab || []).slice();
      if (pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");
      const v = pool[Math.floor(Math.random() * pool.length)];
      const base = (mock.vocab || []).slice();
      const r = makeChoices(base, v);
      window.__LAST_MOCK_CORRECT = r.correctLabel;

      return {
        id: "mock-" + Date.now(),
        word: v.word,
        prompt: "意味として正しいものは？",
        choice_a: r.map.A,
        choice_b: r.map.B,
        choice_c: r.map.C,
        choice_d: r.map.D,
      };
    }

    // ---- PROD：DB questions ----
    const client = await ensureClientReady();
    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d, correct_choice")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const q = data[Math.floor(Math.random() * data.length)];
    window.__LAST_PROD_CORRECT = String(q.correct_choice || "").trim().toUpperCase();

    return {
      id: q.id,
      word: q.word,
      prompt: q.prompt,
      choice_a: q.choice_a,
      choice_b: q.choice_b,
      choice_c: q.choice_c,
      choice_d: q.choice_d,
    };
  },

  // ===== 送信 =====
  async submitAttempt(questionId, chosen) {
    const weekId = this.getWeekIdNow();

    if (window.USE_MOCK) {
      const correct = window.__LAST_MOCK_CORRECT;
      const ok = chosen === correct;
      return [{
        is_correct: ok,
        points: ok ? 10 : 0,
        out_week_id: weekId,
      }];
    }

    const client = await ensureClientReady();
    const { data: sess } = await client.auth.getSession();
    const uid = sess && sess.session && sess.session.user ? sess.session.user.id : null;
    if (!uid) throw { message: "未ログインです。スタート画面でログインしてから再開してください。" };

    const { data, error } = await client.rpc("submit_attempt", {
      p_question_id: questionId,
      p_chosen_choice: String(chosen),
      p_client_ms: Date.now(),
      p_quiz_session_id: null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const ok = (row && typeof row.is_correct !== "undefined")
      ? !!row.is_correct
      : (String(chosen) === String(window.__LAST_PROD_CORRECT));

    return [{
      is_correct: ok,
      points: ok ? Number(row && row.points ? row.points : 10) : 0,
      out_week_id: String(row && row.out_week_id ? row.out_week_id : weekId),
    }];
  },

  // ===== ranking 用（あれば使う / 無ければ ranking.js が local fallback）=====
  async fetchWeekOptions() {
    if (window.USE_MOCK) return [this.getWeekIdNow()];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("list_weeks", { p_limit: 30 });
    if (error) throw error;
    const weeks = (data || []).map(r => r.week_id).filter(Boolean);
    const now = this.getWeekIdNow();
    if (weeks.indexOf(now) < 0) weeks.unshift(now);
    return Array.from(new Set(weeks)).sort().reverse();
  },

  async fetchPersonalWeeklyTop(weekId) {
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_weekly_top", { p_week_id: weekId, p_limit: 10 });
    if (error) throw error;
    return data || [];
  },

  async fetchMyWeeklyRank(weekId) {
    if (window.USE_MOCK) return null;
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_my_weekly_rank", { p_week_id: weekId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", mock.vocab.length);
