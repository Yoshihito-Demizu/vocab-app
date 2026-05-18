"use strict";

/**
 * ID入力方式 api.js
 * - Authなし
 * - player_id を localStorage に保存
 * - runs_public と public RPC を使う
 * - 生徒ID / 教員ID の両対応
 * - 正解ハイライト用に window.__LAST_PUBLIC_CORRECT を更新
 * - class_code は J1-1 / H2-3 形式で統一
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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeChoices(vocabList, correctItem) {
  const others = shuffle(
    vocabList.filter((v) => v.word !== correctItem.word)
  ).slice(0, 3);

  const options = shuffle([
    { meaning: correctItem.meaning, isCorrect: true },
    ...others.map((o) => ({ meaning: o.meaning, isCorrect: false })),
  ]);

  const labels = ["A", "B", "C", "D"];
  const map = {};
  let correctLabel = "A";

  for (let i = 0; i < 4; i++) {
    map[labels[i]] = options[i].meaning;
    if (options[i].isCorrect) {
      correctLabel = labels[i];
    }
  }

  rememberCorrectLabel(correctLabel);

  return {
    choice_a: map.A,
    choice_b: map.B,
    choice_c: map.C,
    choice_d: map.D,
    correctLabel,
  };
}

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

async function ensureClientReady() {
  if (window.clientReady && typeof window.clientReady.then === "function") {
    await window.clientReady;
  }
  const c = window.client || null;
  if (!c) throw new Error("Supabase client が無い");
  return c;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length <= 1) return [];

  const header = lines[0].split(",").map((s) => s.trim());
  const idxWord = header.indexOf("word");
  const idxMeaning = header.indexOf("meaning");
  const idxRuby = header.indexOf("ruby");
  const idxLevel = header.indexOf("level");

  if (idxWord < 0 || idxMeaning < 0) {
    throw new Error("CSVヘッダに word,meaning が必要です");
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim());
    const word = cols[idxWord] || "";
　　const ruby = idxRuby >= 0 ? (cols[idxRuby] || "") : "";
　　const meaning = cols[idxMeaning] || "";
    const levelRaw = idxLevel >= 0 ? (cols[idxLevel] || "1") : "1";
    const level = Number(levelRaw) || 1;
    if (!word || !meaning) continue;
    out.push({ word, ruby,meaning, level });
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
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e && e.message ? e.message : e);
  }
}

window.vocabReady = (async () => {
  await loadVocabCSV();
})();

function normalizePlayerId(s) {
  return String(s || "").trim().toLowerCase();
}
function getDeviceId() {
  let id = localStorage.getItem("device_id");

  if (!id) {
    id =
      "dev-" +
      crypto.randomUUID().replaceAll("-", "");

    localStorage.setItem("device_id", id);
  }

  return id;
}
/**
 * 対応するID例
 * - 2-3-01-k9f2
 * - j3-1-01-t11p
 * - k1-1-01-cyrm
 * - h2-4-12-abcd
 */
function parseClassCodeFromPlayerId(playerId) {
  const m = normalizePlayerId(playerId).match(/^([a-z]?)(\d{1,2})-(\d{1,2})-(\d{1,2})-[a-z0-9]{4}$/);
  if (!m) return null;

  const prefix = (m[1] || "").toUpperCase();
  const grade = m[2];
  const classNo = m[3];

  return `${prefix}${grade}-${classNo}`;
}

function makeNicknameFromPlayerId(playerId) {
  const m = normalizePlayerId(playerId).match(/^([a-z]?)(\d{1,2})-(\d{1,2})-(\d{1,2})-[a-z0-9]{4}$/);
  if (!m) return normalizePlayerId(playerId);

  const prefix = (m[1] || "").toUpperCase();
  const grade = m[2];
  const classNo = m[3];
  const number = m[4].padStart(2, "0");

  return `${prefix}${grade}-${classNo}-${number}`;
}

const api = {
  isMock() {
    return false;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  getCurrentTermRange(now = new Date()) {
    const y = now.getFullYear();
    const t = now.getTime();

    const make = (start, end, label) => ({
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      label,
    });

    const ranges = [
      make(new Date(y, 3, 1, 0, 0, 0, 0), new Date(y, 4, 7, 0, 0, 0, 0), `${y}年度 試作期間`),
      make(new Date(y, 4, 7, 0, 0, 0, 0), new Date(y, 6, 22, 0, 0, 0, 0), `${y}年度 1学期`),
      make(new Date(y, 6, 22, 0, 0, 0, 0), new Date(y, 7, 30, 0, 0, 0, 0), `${y}年度 夏休み`),
      make(new Date(y, 8, 1, 0, 0, 0, 0), new Date(y, 11, 23, 0, 0, 0, 0), `${y}年度 2学期`),
      make(new Date(y, 11, 23, 0, 0, 0, 0), new Date(y + 1, 2, 1, 0, 0, 0, 0), `${y}年度 3学期`),
      make(new Date(y - 1, 11, 23, 0, 0, 0, 0), new Date(y, 2, 1, 0, 0, 0, 0), `${y - 1}年度 3学期`),
    ];

    for (const r of ranges) {
      const start = new Date(r.start_at).getTime();
      const end = new Date(r.end_at).getTime();
      if (t >= start && t < end) return r;
    }

    return make(
      new Date(y, 3, 1, 0, 0, 0, 0),
      new Date(y, 4, 7, 0, 0, 0, 0),
      `${y}年度 試作期間`
    );
  },

  async signIn(playerId) {
    const normalized = normalizePlayerId(playerId);
    const classCode = parseClassCodeFromPlayerId(normalized);

    if (!normalized) {
      return { ok: false, message: "プレイヤーIDを入れてください" };
    }

    if (!classCode) {
      return { ok: false, message: "ID形式が違います（例：2-3-01-k9f2 / j3-1-01-t11p / h2-4-12-abcd / k1-1-01-cyrm）" };
    }

    localStorage.setItem("player_id", normalized);
    return { ok: true, message: "IDを保存しました" };
  },

  async signOut() {
    localStorage.removeItem("player_id");
  },

  async getMyUserId() {
    return localStorage.getItem("player_id") || null;
  },

  async upsertProfile() {
    return { ok: true, via: "local" };
  },

  async fetchLatestQuestion() {
    if (window.vocabReady) {
      try {
        await window.vocabReady;
      } catch {}
    }

    const pool = (state.vocab || []).slice();
    if (pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

    const v = pickAvoidRecent(pool, (x) => x.word);
    const r = makeChoices(pool, v);

    state.lastCorrectLabel = r.correctLabel;
    window.__LAST_PUBLIC_CORRECT = r.correctLabel;
    window.__LAST_CORRECT = r.correctLabel;

    return {
      id: "csv-" + Date.now(),
      word: v.word,
      ruby: v.ruby || "",
      prompt: "意味として正しいものは？",
      choice_a: r.choice_a,
      choice_b: r.choice_b,
      choice_c: r.choice_c,
      choice_d: r.choice_d,
    };
  },

  async submitAttempt(questionId, chosenLabel, answerMs, quizSessionId) {
  const client = await ensureClientReady();

  const weekId = this.getWeekIdNow();

  const playerId = normalizePlayerId(
    localStorage.getItem("player_id")
  );

  const classCode =
    parseClassCodeFromPlayerId(playerId);

  const nickname =
    makeNicknameFromPlayerId(playerId);
  const deviceId = getDeviceId();

  const correct =
    state.lastCorrectLabel || "";

  window.__LAST_PUBLIC_CORRECT = correct;
  window.__LAST_CORRECT = correct;

  const { data, error } = await client.rpc(
    "submit_public_attempt",
    {
      p_quiz_session_id: quizSessionId,
      p_player_id: playerId,
      p_class_code: classCode,
      p_nickname: nickname,
      p_question_key:
  String(
    questionId ||
    state.current?.word ||
    crypto.randomUUID()
  ),
      p_correct_choice: correct,
      p_chosen_choice: String(chosenLabel || ""),
      p_client_ms: Math.floor(answerMs || 0),
      p_week_id: weekId,
      p_device_id: deviceId,
    }
  );

  if (error) {
    console.error("[submitAttempt]", error);
    throw error;
  }

  return data;
},

  async submitRun(score, maxCombo, isFinished) {
    const client = await ensureClientReady();

    const playerId = normalizePlayerId(localStorage.getItem("player_id"));
    const classCode = parseClassCodeFromPlayerId(playerId);
    const nickname = makeNicknameFromPlayerId(playerId);
    const weekId = this.getWeekIdNow();

    if (!playerId || !classCode) {
      return { ok: false, error: { message: "プレイヤーID未設定" } };
    }

    const { data, error } = await client.rpc("submit_public_run", {
      p_player_id: playerId,
      p_class_code: classCode,
      p_nickname: nickname,
      p_week_id: weekId,
      p_score: Number(score) || 0,
      p_max_combo: Number(maxCombo) || 0,
      p_is_finished: !!isFinished,
    });

    if (error) return { ok: false, error };
    if (!data?.ok) return { ok: false, error: { message: data?.error || "submit failed" } };
    return { ok: true, via: "rpc" };
  },

  async fetchWeekOptions() {
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_public_week_options");
    if (error) throw error;
    return (data || []).map((x) => x.week_id).filter(Boolean);
  },

  async fetchWeeklyTop(weekId) {
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_public_weekly_top10", { p_week_id: weekId });
    if (error) throw error;
    return data || [];
  },

  async fetchMyWeeklyRank(weekId) {
    const client = await ensureClientReady();
    const playerId = normalizePlayerId(localStorage.getItem("player_id"));
    if (!playerId) return null;

    const { data, error } = await client.rpc("get_public_my_weekly_rank", {
      p_week_id: weekId,
      p_player_id: playerId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },

  async fetchMyTermBestStatus(termRange) {
    const client = await ensureClientReady();
    const playerId = normalizePlayerId(localStorage.getItem("player_id"));
    if (!playerId) return null;

    const range = termRange || this.getCurrentTermRange();

    const { data, error } = await client.rpc("get_public_my_term_best_status", {
      p_start: range.start_at,
      p_end: range.end_at,
      p_player_id: playerId,
    });

    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  },

  async fetchClassWeeklyRanking(weekId, limit = 20) {
    const client = await ensureClientReady();
    const now = new Date();
    const schoolYear = now.getFullYear();

    const { data, error } = await client.rpc("get_public_class_weekly_ranking", {
      p_week_id: weekId,
      p_limit: limit,
      p_school_year: schoolYear,
      p_min_participants: 5,
    });

    if (error) throw error;
    return data || [];
  },

  async fetchPersonalWeeklyTop(weekId) {
    return await this.fetchWeeklyTop(weekId);
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK = false fallback vocab size =", (state.vocab || []).length);
