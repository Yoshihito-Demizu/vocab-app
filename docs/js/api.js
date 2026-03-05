// docs/js/api.js
/* global USE_MOCK, toEmail */
"use strict";

/**
 * 方針：
 * - 出題は「常に vocab.csv（なければ内蔵fallback）」からランダム
 * - prodでも questions テーブルは使わない（問題が出ない事故を防ぐ）
 * - スコア送信は runs テーブルへ insert（submit_run RPC は不要）
 * - ランキング取得は RPC（get_week_options / get_weekly_top10 / get_my_weekly_rank）を使う
 */

const fallbackVocab = [
  { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
  { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
  { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
  { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
];

const state = {
  vocab: fallbackVocab.slice(),
  recentWords: [],
  recentCorrectLabels: [],
  lastCorrectLabel: null,
};

// ===== 直近回避 =====
function rememberWord(w) {
  if (!w) return;
  state.recentWords = [w, ...state.recentWords.filter((x) => x !== w)].slice(0, 5);
}
function rememberCorrectLabel(lbl) {
  if (!lbl) return;
  state.recentCorrectLabels = [lbl, ...state.recentCorrectLabels].slice(0, 3);
}
function pickAvoidRecent(items, getWord) {
  if (!items || items.length === 0) return null;
  if (items.length === 1) return items[0];

  const recent = new Set(state.recentWords);
  let candidates = items.filter((it) => !recent.has(getWord(it)));
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

// ===== 選択肢生成（正解位置偏り＋直近ラベル回避）=====
function makeChoices(vocabList, correctItem) {
  const base = vocabList.slice();
  const others = base
    .filter((v) => v.word !== correctItem.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const meanings = [correctItem.meaning, ...others.map((o) => o.meaning)];
  const shuffledMeanings = shuffle(meanings);

  const labels = ["A", "B", "C", "D"];
  let shuffledLabels = shuffle(labels);

  const correctIndex = shuffledMeanings.indexOf(correctItem.meaning);
  const recent = new Set(state.recentCorrectLabels);

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

// ===== Supabase client 待ち =====
async function ensureClientReady() {
  if (window.USE_MOCK) return null;
  if (window.clientReady && typeof window.clientReady.then === "function") {
    await window.clientReady;
  }
  const c = window.client || null;
  if (!c) throw new Error("Supabase client が無い（config.js / anon key / ネット確認）");
  return c;
}

// ===== CSV loader =====
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length <= 1) return [];
  const header = lines[0].split(",").map((s) => s.trim());
  const idxWord = header.indexOf("word");
  const idxMeaning = header.indexOf("meaning");
  const idxLevel = header.indexOf("level");

  if (idxWord < 0 || idxMeaning < 0) throw new Error("CSVヘッダに word,meaning が必要です");

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim());
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
      state.vocab = list;
      console.log("[api] vocab loaded from CSV:", list.length);
    } else {
      console.warn("[api] vocab.csv too small (need >=4). keep fallback:", list.length);
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e && e.message ? e.message : e);
  }
}
window.vocabReady = (async () => {
  await loadVocabCSV();
})();

// ===== API =====
const api = {
  isMock() {
    return !!window.USE_MOCK;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

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
    return data?.session?.user?.id || null;
  },

  // ✅ 問題取得（prodでも CSV から）
  async fetchLatestQuestion() {
    if (window.vocabReady) {
      try {
        await window.vocabReady;
      } catch {
        /* ignore */
      }
    }

    const pool = (state.vocab || []).slice();
    if (pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

    const v = pickAvoidRecent(pool, (x) => x.word);
    const r = makeChoices(pool, v);
    state.lastCorrectLabel = r.correctLabel;

    return {
      id: "csv-" + Date.now(),
      word: v.word,
      prompt: "意味として正しいものは？",
      choice_a: r.choice_a,
      choice_b: r.choice_b,
      choice_c: r.choice_c,
      choice_d: r.choice_d,
    };
  },

  // ✅ 1問の採点（ローカル採点）
  async submitAttempt(_questionId, chosenLabel) {
    const weekId = this.getWeekIdNow();
    const correct = state.lastCorrectLabel;
    const ok = String(chosenLabel).toUpperCase() === String(correct).toUpperCase();

    // ここは「1問10点」にしておく（最終スコアは quiz.js で計算して submitRun）
    return [
      {
        is_correct: ok,
        points: ok ? 10 : 0,
        out_week_id: weekId,
      },
    ];
  },

  // ✅ 1プレイの結果を保存（runsへ直接insert：RPC不要）
  async submitRun(score, maxCombo) {
    if (window.USE_MOCK) return { ok: true, via: "mock" };

    const client = await ensureClientReady();
    const { data: sess, error: sessErr } = await client.auth.getSession();
    if (sessErr) return { ok: false, error: sessErr };
    const uid = sess?.session?.user?.id;
    if (!uid) return { ok: false, error: { message: "未ログイン" } };

    const weekId = this.getWeekIdNow();

    // runs(user_id, week_id, score, max_combo) を想定
    const { error } = await client.from("runs").insert([
      {
        user_id: uid,
        week_id: weekId,
        score: Number(score) || 0,
        max_combo: Number(maxCombo) || 0,
      },
    ]);

    if (error) return { ok: false, error };
    return { ok: true, via: "insert" };
  },

  // ===== ランキング系（RPC）=====
  async fetchWeekOptions() {
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_week_options");
    if (error) throw error;
    return (data || []).map((x) => x.week_id).filter(Boolean);
  },

  async fetchWeeklyTop(weekId) {
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

  // 互換（あなたが試してた関数名）
  async fetchPersonalWeeklyTop(weekId) {
    return await this.fetchWeeklyTop(weekId);
  },
};
  // ✅ プロフィールを保存（class_code固定・nicknameは任意）
  async upsertProfile({ nickname, classCode }) {
    if (window.USE_MOCK) return { ok: true, via: "mock" };

    const client = await ensureClientReady();
    const { data: sess, error: sessErr } = await client.auth.getSession();
    if (sessErr) return { ok: false, error: sessErr };
    const uid = sess?.session?.user?.id;
    if (!uid) return { ok: false, error: { message: "未ログイン" } };

    if (!classCode) return { ok: false, error: { message: "class_code が空" } };

    const payload = {
      user_id: uid,
      class_code: String(classCode),
      nickname: nickname ? String(nickname) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from("user_profile").upsert(payload);
    if (error) return { ok: false, error };
    return { ok: true, via: "upsert" };
  },
window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", (state.vocab || []).length);

