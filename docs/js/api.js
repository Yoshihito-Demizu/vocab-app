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

// ===== 出題の「連続防止」状態 =====
const pickState = {
  recentWords: [],         // 直近の単語（最大5）
  recentCorrectLabels: [], // 直近の正解ラベル（最大3）
};

function rememberWord(w) {
  if (!w) return;
  pickState.recentWords = [w, ...pickState.recentWords.filter(x => x !== w)].slice(0, 5);
}

function rememberCorrectLabel(lbl) {
  if (!lbl) return;
  pickState.recentCorrectLabels = [lbl, ...pickState.recentCorrectLabels].slice(0, 3);
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

// ===== 乱数シャッフル（Fisher–Yates）=====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

window.vocabReady = (async () => { await _loadVocabCSV(); })();

// ===== choices generator（②：正解位置の偏り防止）=====
function makeChoices(vocabList, correctItem) {
  const base = vocabList.slice();
  const others = base
    .filter(v => v.word !== correctItem.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const meanings = [correctItem.meaning, ...others.map(o => o.meaning)];

  // 選択肢の中身をシャッフル
  const shuffledMeanings = shuffle(meanings);

  // ラベル（A/B/C/D）もシャッフル
  const labels = ["A", "B", "C", "D"];
  let shuffledLabels = shuffle(labels);

  // 直近3問で同じ正解ラベルを避ける（可能な範囲で）
  const recent = new Set(pickState.recentCorrectLabels);
  const correctIndex = shuffledMeanings.indexOf(correctItem.meaning);
  if (correctIndex >= 0 && recent.size > 0) {
    for (let tries = 0; tries < 10; tries++) {
      const candidateLabel = shuffledLabels[correctIndex];
      if (!recent.has(candidateLabel)) break;
      shuffledLabels = shuffle(labels);
    }
  }

  const map = {};
  for (let i = 0; i < 4; i++) {
    map[shuffledLabels[i]] = shuffledMeanings[i];
  }

  const correctLabel = shuffledLabels[correctIndex];
  rememberCorrectLabel(correctLabel);

  return {
    choice_a: map.A,
    choice_b: map.B,
    choice_c: map.C,
    choice_d: map.D,
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
    return (data && data.session && data.session.user && data.session.user.id)
      ? data.session.user.id
      : null;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  // ===== 出題（①：同じ単語が連続で出ない / ②：正解位置が偏らない）=====
  async fetchLatestQuestion() {
    if (window.vocabReady) {
      try { await window.vocabReady; } catch { /* ignore */ }
    }

    if (window.USE_MOCK) {
      const pool = (mock.vocab || []).slice();
      if (pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

      const v = pickAvoidRecent(pool, (x) => x.word);
      const r = makeChoices(mock.vocab, v);

      window.__LAST_MOCK_CORRECT = r.correctLabel;

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

    // ===== PROD（Supabase questions から取得）=====
    const client = await ensureClientReady();
    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d, correct_choice")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const q = pickAvoidRecent(data, (x) => x.word);
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
      p_client_ms: Date.now(),       // bigintで受ける想定
      p_quiz_session_id: null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return [{
      is_correct: !!(row && row.is_correct),
      points: Number(row && row.points ? row.points : 0),
      out_week_id: String(row && row.out_week_id ? row.out_week_id : weekId),
    }];
  },

  // ===== ランキング用（Supabase RPC）=====
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
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", mock.vocab.length);
