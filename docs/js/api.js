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

// ===== 連続防止 =====
const pickState = { recentWords: [] };
function rememberWord(w) {
  if (!w) return;
  pickState.recentWords = [w, ...pickState.recentWords.filter(x => x !== w)].slice(0, 8);
}
function pickAvoidRecent(items, getWord) {
  if (!items || items.length === 0) return null;
  if (items.length === 1) return items[0];

  const recent = new Set(pickState.recentWords);
  let candidates = items.filter(it => !recent.has(getWord(it)));
  if (candidates.length === 0) candidates = items;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  rememberWord(getWord(picked));
  return picked;
}

// ===== シャッフル =====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

window.__LAST_MOCK_CORRECT = null;

// ===== Supabase client待ち =====
async function ensureClientReady() {
  if (window.USE_MOCK) return null;
  if (window.clientReady && typeof window.clientReady.then === "function") {
    await window.clientReady;
  }
  const c = window.client || null;
  if (!c) throw new Error("Supabase client が無い（config.jsの読み込み/ネット確認）");
  return c;
}

// ===== week_id =====
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

// ===== vocab.csv（MOCK用語彙）=====
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

async function loadVocabCSV() {
  try {
    const res = await fetch("./vocab.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("vocab.csv fetch failed: " + res.status);
    const text = await res.text();
    const list = parseCSV(text);
    if (list.length >= 4) {
      mock.vocab = list;
      console.log("[api] vocab loaded from CSV:", list.length);
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e?.message || e);
  }
}
window.vocabReady = (async () => { await loadVocabCSV(); })();

// ===== MOCKの4択生成（意味から作る）=====
function makeChoicesFromVocab(vocabList, correctItem) {
  const base = vocabList.slice();
  const others = shuffle(base.filter(v => v.word !== correctItem.word)).slice(0, 3);
  const meanings = shuffle([correctItem.meaning, ...others.map(o => o.meaning)]);

  const labels = ["A", "B", "C", "D"];
  const correctLabel = labels[meanings.indexOf(correctItem.meaning)];
  window.__LAST_MOCK_CORRECT = correctLabel;

  return {
    choice_a: meanings[0],
    choice_b: meanings[1],
    choice_c: meanings[2],
    choice_d: meanings[3],
    correctLabel,
  };
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
    return data?.session?.user?.id ?? null;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  // ===== 出題 =====
  async fetchLatestQuestion() {
    // vocabReadyはMOCKだけで使う
    if (window.vocabReady) { try { await window.vocabReady; } catch {} }

    // ---- MOCK：CSVから出題 ----
    if (window.USE_MOCK) {
      const pool = (mock.vocab || []).slice();
      if (pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

      const v = pickAvoidRecent(pool, (x) => x.word);
      const r = makeChoicesFromVocab(pool, v);

      return {
        id: "mock-" + Date.now(),
        word: v.word,
        prompt: "意味として正しいものは？",
        choice_a: r.choice_a,
        choice_b: r.choice_b,
        choice_c: r.choice_c,
        choice_d: r.choice_d,
      };
    }

    // ---- PROD：questionsテーブルから出題（送信と整合） ----
    const client = await ensureClientReady();

    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d, correct_choice")
      .eq("is_active", true)
      .limit(300);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const q = pickAvoidRecent(data, (x) => x.word);

    // quiz.jsが期待する形
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

  // ===== ランキング用RPC =====
  async fetchWeekOptions() {
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_week_options");
    if (error) throw error;
    return (data || []).map(x => x.week_id).filter(Boolean);
  },

  async fetchPersonalWeeklyTop(weekId) {
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_weekly_top10", { p_week_id: weekId });
    if (error) throw error;
    return data || [];
  },

  async fetchMyWeeklyRank(weekId) {
    if (window.USE_MOCK) return null;
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_my_weekly_rank", { p_week_id: weekId });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },

  // ===== 送信 =====
  async submitAttempt(questionId, chosen) {
    const weekId = this.getWeekIdNow();

    if (window.USE_MOCK) {
      const ok = String(chosen) === String(window.__LAST_MOCK_CORRECT);
      return [{ is_correct: ok, points: ok ? 10 : 0, out_week_id: weekId }];
    }

    const client = await ensureClientReady();
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) throw { message: "未ログインです。スタート画面でログインしてから再開してください。" };

    const { data, error } = await client.rpc("submit_attempt", {
      p_question_id: questionId,           // ★ここがDBのUUIDじゃないと落ちる
      p_chosen_choice: String(chosen),
      p_client_ms: Date.now(),
      p_quiz_session_id: null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return [{
      is_correct: !!row?.is_correct,
      points: Number(row?.points || 0),
      out_week_id: String(row?.out_week_id || weekId),
    }];
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", mock.vocab.length);
