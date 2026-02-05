// js/api.js
/* global USE_MOCK, client, toEmail */

"use strict";

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

  // ★最初は保険として少数だけ入れておく（CSVが読めない時に動かすため）
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],

  // ランキング用（ダミー）
  personalWeekly: {
    "2026-W04": [
      { user_id: "u1", points: 40, correct: 4, wrong: 0 },
      { user_id: "u2", points: 30, correct: 3, wrong: 1 },
      { user_id: "u3", points: 10, correct: 1, wrong: 3 },
    ],
    "2026-W03": [
      { user_id: "u2", points: 20, correct: 2, wrong: 0 },
      { user_id: "u1", points: 10, correct: 1, wrong: 1 },
    ],
  },

  personalTotal: [
    { user_id: "u1", points: 120, correct: 12, wrong: 3 },
    { user_id: "u2", points: 80, correct: 8, wrong: 5 },
    { user_id: "u3", points: 50, correct: 5, wrong: 8 },
  ],

  classWeekly: {
    "2026-W04": [
      { grade: 2, class_no: 3, class_points: 200, players: 25 },
      { grade: 2, class_no: 4, class_points: 180, players: 24 },
    ],
    "2026-W03": [
      { grade: 2, class_no: 4, class_points: 160, players: 20 },
      { grade: 2, class_no: 3, class_points: 140, players: 19 },
    ],
  },

  classTotal: [
    { grade: 2, class_no: 3, class_points: 900, players: 30 },
    { grade: 2, class_no: 4, class_points: 870, players: 30 },
  ],

  classWeeklyAvg: {
    "2026-W04": [
      { grade: 2, class_no: 3, avg_points: 8.0, players: 25 },
      { grade: 2, class_no: 4, avg_points: 7.5, players: 24 },
    ],
    "2026-W03": [
      { grade: 2, class_no: 4, avg_points: 8.0, players: 20 },
      { grade: 2, class_no: 3, avg_points: 7.4, players: 19 },
    ],
  },

  classTotalAvg: [
    { grade: 2, class_no: 3, avg_points: 30.0, players: 30 },
    { grade: 2, class_no: 4, avg_points: 29.0, players: 30 },
  ],
};

// Mockで「今出してる問題の正解ラベル」を覚えておく
window.__LAST_MOCK_CORRECT = null;

function assertClient() {
  if (!client) throw new Error("Supabase client が無い（config.js の読み込み順/ネット確認）");
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

// vocab.csv を読み込んで mock.vocab を置き換える（失敗しても落とさない）
async function loadVocabCSV() {
  try {
    const res = await fetch("./vocab.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("vocab.csv fetch failed: " + res.status);
    const text = await res.text();
    const list = parseCSV(text);

    // 4択のため最低4語必要
    if (list.length >= 4) {
      mock.vocab = list;
      console.log("[api] vocab loaded from CSV:", list.length);
    } else {
      console.warn("[api] vocab.csv is too small (need >=4). keep fallback:", list.length);
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e?.message || e);
  }
}

// すぐ開始（api.js読み込み時に走る）
loadVocabCSV();

// =====================
// 4択生成（意味をシャッフル）
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
  isMock() {
    return !!USE_MOCK;
  },

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
    if (USE_MOCK) return "u1";
    assertClient();
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id ?? null;
  },

  // ---- Question ----
  async fetchLatestQuestion() {
    if (USE_MOCK) {
      const list = mock.vocab;

      if (!list || list.length < 4) {
        throw new Error("語彙が少なすぎます（最低4件必要）");
      }

      // レベル絞り込み（UIが無くても落ちない）
      const levelSel = document.getElementById("levelSelect");
      const level = levelSel ? (levelSel.value || "all") : "all";

      const pool =
        level === "all"
          ? list
          : list.filter(v => String(v.level || 1) === String(level));

      const finalPool = pool.length >= 4 ? pool : list; // 絞り込みで少なすぎたら全体に戻す

      const i = Math.floor(Math.random() * finalPool.length);
      const v = finalPool[i];

      const { map, correctLabel } = makeChoices(finalPool, v);
      window.__LAST_MOCK_CORRECT = correctLabel;

      return {
        id: "mock-" + i,
        word: v.word,
        prompt: "意味として正しいものは？",
        choice_a: map.A,
        choice_b: map.B,
        choice_c: map.C,
        choice_d: map.D,
        correct_choice: correctLabel,
      };
    }

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

  async submitAttempt(questionId, chosen) {
    if (USE_MOCK) {
      const ok = chosen === window.__LAST_MOCK_CORRECT;
      return [{
        is_correct: ok,
        points: ok ? 10 : 0,
        out_week_id: mock.weekIds[0],
      }];
    }

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
    if (USE_MOCK) return mock.weekIds.slice();

    assertClient();
    const { data, error } = await client
      .from("score_weekly")
      .select("week_id")
      .order("week_id", { ascending: false })
      .limit(30);

    if (error) throw error;
    return Array.from(new Set((data ?? []).map(x => x.week_id)));
  },

  // ---- Rankings: personal ----
  async fetchPersonalWeeklyTop(weekId) {
    if (USE_MOCK) return (mock.personalWeekly[weekId] ?? []).slice();

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

  async fetchPersonalTotalTop() {
    if (USE_MOCK) return mock.personalTotal.slice();

    assertClient();
    const { data, error } = await client
      .from("score_total")
      .select("user_id, points, correct, wrong")
      .order("points", { ascending: false })
      .order("correct", { ascending: false })
      .limit(10);

    if (error) throw error;
    return data ?? [];
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

  // ---- Rankings: class ----
  async fetchClassRankings(weekId) {
    if (USE_MOCK) {
      return {
        cw: (mock.classWeekly[weekId] ?? []).slice(),
        ct: mock.classTotal.slice(),
        cwa: (mock.classWeeklyAvg[weekId] ?? []).slice(),
        cta: mock.classTotalAvg.slice(),
      };
    }

    assertClient();

    const { data: cw } = await client
      .from("class_weekly_ranking")
      .select("grade, class_no, class_points, players")
      .eq("week_id", weekId)
      .order("class_points", { ascending: false })
      .limit(10);

    const { data: ct } = await client
      .from("class_total_ranking")
      .select("grade, class_no, class_points, players")
      .order("class_points", { ascending: false })
      .limit(10);

    const { data: cwa } = await client
      .from("class_weekly_avg_ranking")
      .select("grade, class_no, avg_points, players")
      .eq("week_id", weekId)
      .order("avg_points", { ascending: false })
      .limit(10);

    const { data: cta } = await client
      .from("class_total_avg_ranking")
      .select("grade, class_no, avg_points, players")
      .order("avg_points", { ascending: false })
      .limit(10);

    return { cw: cw ?? [], ct: ct ?? [], cwa: cwa ?? [], cta: cta ?? [] };
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", USE_MOCK, "fallback vocab size =", mock.vocab.length);
