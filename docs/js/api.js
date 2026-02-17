// docs/js/api.js
/* global USE_MOCK, toEmail */
"use strict";

/**
 * 目的：
 * - 本番でも「出題の偏り」「選択肢固定」を解消する
 * 方針：
 * - DBからは questions（id,word,prompt,choice_a..d）は読む（現状維持）
 * - ただし表示する選択肢は、DBの選択肢を毎回シャッフルして固定感を消す
 * - 出題自体も「最近出た問題ID」を避けて偏りを減らす
 */

const mock = {
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],
};

window.__LAST_MOCK_CORRECT = null;

// ===== client 準備待ち（config.js の clientReady を使う）=====
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
function getISOWeekId(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const yyyy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yyyy}-W${ww}`;
}

// ===== CSV（MOCK用。いまは本番出題には使わない）=====
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
    const word = cols[idxWord] ?? "";
    const meaning = cols[idxMeaning] ?? "";
    const levelRaw = idxLevel >= 0 ? cols[idxLevel] : "1";
    const level = Number(levelRaw || 1) || 1;
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
    } else {
      console.warn("[api] vocab.csv too small (need >=4). keep fallback:", list.length);
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e?.message || e);
  }
}
loadVocabCSV();

// ===== choices shuffle（本番の固定感を消す）=====
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * DBの choice_a..d を毎回シャッフルして返す
 * correct_choice も一緒に変換して、正誤判定は崩さない
 */
function shuffleQuestionChoices(q) {
  const labels = ["A", "B", "C", "D"];
  const pairs = [
    { label: "A", text: q.choice_a },
    { label: "B", text: q.choice_b },
    { label: "C", text: q.choice_c },
    { label: "D", text: q.choice_d },
  ];

  const shuffled = shuffle(pairs);

  const out = {
    id: q.id,
    word: q.word,
    prompt: q.prompt,
    choice_a: shuffled[0].text,
    choice_b: shuffled[1].text,
    choice_c: shuffled[2].text,
    choice_d: shuffled[3].text,
  };

  // 正解ラベルを「シャッフル後のラベル」に変換
  const correctOrig = String(q.correct_choice || "").trim().toUpperCase();
  const idx = pairs.findIndex(p => p.label === correctOrig);
  if (idx >= 0) {
    const correctText = pairs[idx].text;
    const newIdx = shuffled.findIndex(p => p.text === correctText);
    out.__correct_label = labels[newIdx >= 0 ? newIdx : 0];
  } else {
    // 念のため（正解が無い/壊れてる）
    out.__correct_label = "A";
  }

  return out;
}

// ===== STEP2: 連発防止（最近出た問題IDを保存）=====
const RECENT_KEY = "vocabTA_recent_qids_v2";
const RECENT_MAX = 12;

function loadRecent() {
  try {
    const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function saveRecent(list) {
  const uniq = Array.from(new Set(list)).slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(uniq));
}
function pickRandom(list) {
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

const api = {
  isMock() { return !!window.USE_MOCK; },

  async signIn(loginId, password) {
    if (window.USE_MOCK) return { ok: true, message: "（モック：ログイン不要）" };
    const client = await ensureClientReady();
    const email = window.toEmail ? window.toEmail(loginId) : toEmail(loginId);
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

  // ===== 問題 =====
  async fetchLatestQuestion() {
    // -------- MOCK（今まで通り）--------
    if (window.USE_MOCK) {
      const level = document.getElementById("levelSelect")?.value || "all";
      let pool = (mock.vocab || []).slice();
      if (level !== "all") pool = pool.filter(v => String(v.level || 1) === String(level));
      if (pool.length < 4) pool = (mock.vocab || []).slice();
      if (!pool || pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

      const i = Math.floor(Math.random() * pool.length);
      const v = pool[i];

      const base = (mock.vocab || []).slice();
      // MOCKは意味選択肢生成（今まで通り）
      const others = base
        .filter(x => x.word !== v.word)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const meanings = [v.meaning, ...others.map(o => o.meaning)].sort(() => Math.random() - 0.5);
      const labels = ["A", "B", "C", "D"];
      const map = {};
      meanings.forEach((m, idx) => (map[labels[idx]] = m));
      const correctLabel = labels[meanings.indexOf(v.meaning)];
      window.__LAST_MOCK_CORRECT = correctLabel;

      return {
        id: "mock-" + Date.now() + "-" + i,
        word: v.word,
        prompt: "意味として正しいものは？",
        choice_a: map.A,
        choice_b: map.B,
        choice_c: map.C,
        choice_d: map.D,
      };
    }

    // -------- PROD（偏り防止 + 選択肢シャッフル）--------
    const client = await ensureClientReady();

    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d, correct_choice")
      .eq("is_active", true)
      .limit(500);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const recent = loadRecent();
    let candidates = data.filter(q => !recent.includes(q.id));
    if (candidates.length === 0) candidates = data.slice();

    const raw = pickRandom(candidates);
    if (!raw) return null;

    // recent更新
    saveRecent([raw.id, ...recent]);

    // choicesを毎回シャッフルして固定感を消す
    const q = shuffleQuestionChoices(raw);

    // 正解ラベルを保存（submitAttemptで使う）
    window.__LAST_PROD_CORRECT = q.__correct_label;

    // 外部には余計なフィールドを出さない
    delete q.__correct_label;
    return q;
  },

  // ===== 解答送信 =====
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

    // ここがポイント：
    // 本番でも choices をシャッフルしたので、chosen は「シャッフル後の A/B/C/D」。
    // DBの correct_choice とズレる可能性があるため、ここでは直前に保存した正解ラベルで判定する。
    const ok = String(chosen) === String(window.__LAST_PROD_CORRECT || "");

    const client = await ensureClientReady();
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) throw { message: "未ログインです。スタート画面でログインしてから再開してください。" };

    const { data, error } = await client.rpc("submit_attempt", {
      p_question_id: questionId,
      p_chosen_choice: String(chosen),
      p_client_ms: Date.now(),
      p_quiz_session_id: null,
    });

    if (error) throw error;

    // RPCが返す正誤はDB基準の可能性があるので、表示は“今の出題”に合わせて上書き
    const row = Array.isArray(data) ? data[0] : data;
    const basePoints = Number(row?.points || 10) || 10;

    return [{
      is_correct: ok,
      points: ok ? basePoints : 0,
      out_week_id: String(row?.out_week_id || weekId),
    }];
  },

   // ===== ranking.js 用（Supabase RPC）=====
  async fetchWeekOptions() {
    if (window.USE_MOCK) return [this.getWeekIdNow()];
    const client = await ensureClientReady();

    const { data, error } = await client.rpc("list_weeks", { p_limit: 30 });
    if (error) throw error;

    const weeks = (data || []).map(r => r.week_id).filter(Boolean);
    const now = this.getWeekIdNow();
    if (!weeks.includes(now)) weeks.unshift(now);

    // 重複排除して新しい順
    return Array.from(new Set(weeks)).sort().reverse();
  },

  async fetchPersonalWeeklyTop(weekId) {
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();

    const { data, error } = await client.rpc("get_weekly_top", {
      p_week_id: weekId,
      p_limit: 10,
    });
    if (error) throw error;
    return data || [];
  },

  async fetchMyWeeklyRank(weekId) {
    if (window.USE_MOCK) return null;
    const client = await ensureClientReady();

    const { data, error } = await client.rpc("get_my_weekly_rank", {
      p_week_id: weekId,
    });
    if (error) throw error;

    // RPCは「1行 or 0行」で返る
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  },

window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", mock.vocab.length);

