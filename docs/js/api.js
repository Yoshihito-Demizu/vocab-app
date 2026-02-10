// docs/js/api.js
/* global USE_MOCK, client, toEmail */
"use strict";

/**
 * ✅ このapi.jsの目的（先生テスト配布で壊れない）
 * - week_id固定（2026-W06形式）
 * - user_id必ず取得（MOCKは u1 / 本番は auth user.id）
 * - 回答結果を必ず {is_correct, points, out_week_id} で返す
 * - MOCK時は localStorage に「週スコア」を保存してランキングに反映
 */

// =====================
// Mock（CSVから読み込む）
// =====================
const mock = {
  weekIds: ["2026-W04", "2026-W03"],
  users: [
    { id: "u1", nickname: "テスト生徒A", grade: 2, class_no: 3 },
    { id: "u2", nickname: "テスト生徒B", grade: 2, class_no: 4 },
    { id: "u3", nickname: "テスト生徒C", grade: 2, class_no: 3 },
  ],
  // CSVが読めないときの保険（最低4件）
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],
};

// Mockで「今出してる問題の正解ラベル」を覚えておく（答え合わせの生命線）
window.__LAST_MOCK_CORRECT = null;

// =====================
// localStorage（ランキング用）
// =====================
const LS_KEY = "vocab_ta_scores_v1";

// { week_id: { user_id: {points, correct, wrong} } }
function loadScores() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveScores(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // storage使えない環境もあるので落とさない
  }
}
function ensureUserWeek(scores, weekId, userId) {
  scores[weekId] = scores[weekId] || {};
  scores[weekId][userId] = scores[weekId][userId] || { points: 0, correct: 0, wrong: 0 };
  return scores[weekId][userId];
}

// =====================
// Supabase
// =====================
function assertClient() {
  if (!client) throw new Error("Supabase client が無い（config.jsの読み込み/ネット確認）");
}

// =====================
// 週ID固定（2026-W06形式）
// =====================
function getISOWeekId(d = new Date()) {
  // ISO week number
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const yyyy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yyyy}-W${ww}`;
}

// =====================
// CSV読み込み
// =====================
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length <= 1) return [];
  const header = lines[0].split(",").map(s => s.trim());
  const idxWord = header.indexOf("word");
  const idxMeaning = header.indexOf("meaning");
  const idxLevel = header.indexOf("level");

  if (idxWord < 0 || idxMeaning < 0) {
    throw new Error("CSVヘッダに word,meaning が必要です（例: word,meaning,level）");
  }

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

// =====================
// 4択生成
// =====================
function makeChoices(vocabList, correctItem) {
  const others = vocabList
    .filter(v => v.word !== correctItem.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const meanings = [correctItem.meaning, ...others.map(o => o.meaning)]
    .sort(() => Math.random() - 0.5);

  const labels = ["A", "B", "C", "D"];
  const map = {};
  meanings.forEach((m, i) => (map[labels[i]] = m));

  const correctLabel = labels[meanings.indexOf(correctItem.meaning)];
  return { map, correctLabel };
}

// =====================
// API本体
// =====================
const api = {
  isMock() { return !!USE_MOCK; },

  // ---- Auth ----
  async signIn(loginId, password) {
    if (USE_MOCK) return { ok: true, message: "（ダミーモード：ログイン不要）" };
    assertClient();
    const email = toEmail(loginId);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "ログイン成功" };
  },

  async signOut() {
    if (USE_MOCK) return;
    assertClient();
    await client.auth.signOut();
  },

  async getMyUserId() {
    if (USE_MOCK) return "u1"; // ← 後で本番に差し替えしやすい
    assertClient();
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id ?? null;
  },

  getWeekIdNow() {
    // week_id固定
    return getISOWeekId(new Date());
  },

  // ---- Question ----
  async fetchLatestQuestion() {
    if (USE_MOCK) {
      const level = document.getElementById("levelSelect")?.value || "all";
      let pool = (mock.vocab || []).slice();

      if (level !== "all") {
        pool = pool.filter(v => String(v.level || 1) === String(level));
      }
      if (pool.length < 4) pool = (mock.vocab || []).slice();
      if (pool.length < 4) throw new Error("mock.vocab が少なすぎます（最低4件必要）");

      const i = Math.floor(Math.random() * pool.length);
      const v = pool[i];

      // 外れ選択肢は全体から取る
      const base = (mock.vocab || []).slice();
      const { map, correctLabel } = makeChoices(base, v);

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

    // 本番（Supabase）
    assertClient();
    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] ?? null;
  },

  // ---- Attempt（必ず同じ形を返す）----
  async submitAttempt(questionId, chosen) {
    if (USE_MOCK) {
      const userId = await this.getMyUserId();
      const weekId = this.getWeekIdNow();

      const correct = window.__LAST_MOCK_CORRECT;
      const ok = chosen === correct;
      const pts = ok ? 10 : 0;

      // ✅ localStorageに週スコア保存（ランキング反映）
      const scores = loadScores();
      const row = ensureUserWeek(scores, weekId, userId);
      row.points += pts;
      if (ok) row.correct += 1;
      else row.wrong += 1;
      saveScores(scores);

      return [{
        is_correct: ok,
        points: pts,
        out_week_id: weekId,
      }];
    }

    // 本番（Supabase RPC）
    assertClient();
    const { data, error } = await client.rpc("submit_attempt", {
      p_question_id: questionId,
      p_chosen_choice: chosen,
      p_client_ms: null,
      p_quiz_session_id: null,
    });
    if (error) throw error;
    return data ?? [];
  },

  // ---- Week options ----
  async fetchWeekOptions() {
    if (USE_MOCK) {
      // localStorageにある週 + 今週 を混ぜる
      const scores = loadScores();
      const weeks = new Set(Object.keys(scores || {}));
      weeks.add(this.getWeekIdNow());
      return Array.from(weeks).sort().reverse();
    }

    assertClient();
    const { data, error } = await client
      .from("score_weekly")
      .select("week_id")
      .order("week_id", { ascending: false })
      .limit(30);
    if (error) throw error;
    return Array.from(new Set((data ?? []).map(x => x.week_id)));
  },

  // ---- Rankings: personal weekly top ----
  async fetchPersonalWeeklyTop(weekId) {
    if (USE_MOCK) {
      const scores = loadScores();
      const week = scores?.[weekId] || {};
      const rows = Object.entries(week).map(([user_id, s]) => ({
        user_id,
        points: s.points || 0,
        correct: s.correct || 0,
        wrong: s.wrong || 0,
      }));
      rows.sort((a,b) => (b.points-a.points) || (b.correct-a.correct));
      return rows.slice(0, 10);
    }

    assertClient();
    const { data, error } = await client
      .from("score_weekly")
      .select("user_id, points, correct, wrong")
      .eq("week_id", weekId)
      .order("points", { ascending: false })
      .order("correct", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data ?? [];
  },

  // ---- My rank ----
  async fetchMyRank(weekId) {
    if (USE_MOCK) {
      const userId = await this.getMyUserId();
      const scores = loadScores();
      const week = scores?.[weekId] || {};
      const rows = Object.entries(week).map(([user_id, s]) => ({
        user_id,
        points: s.points || 0,
        correct: s.correct || 0,
        wrong: s.wrong || 0,
      }));
      rows.sort((a,b) => (b.points-a.points) || (b.correct-a.correct));
      const idx = rows.findIndex(r => r.user_id === userId);
      return { user_id: userId, rank: idx >= 0 ? (idx + 1) : null, total: rows.length };
    }

    // 本番は後で（SQL/RPCで出す）
    return { user_id: null, rank: null, total: null };
  },

  async fetchPublicUsers(userIds) {
    if (USE_MOCK) return mock.users.filter(u => userIds.includes(u.id));

    assertClient();
    const { data, error } = await client
      .from("public_users")
      .select("id, nickname, grade, class_no")
      .in("id", userIds);
    if (error) throw error;
    return data ?? [];
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", USE_MOCK, "fallback vocab size =", mock.vocab.length);
