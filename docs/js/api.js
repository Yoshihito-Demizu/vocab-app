// docs/js/api.js
/* global USE_MOCK, client, toEmail */
"use strict";

// =====================
// Mock data
// =====================
const mock = {
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],
};

window.__LAST_MOCK_CORRECT = null;

// =====================
// Supabase
// =====================
function assertClient() {
  if (!client) throw new Error("Supabase client が無い（config.jsの読み込み/ネット確認）");
}

// =====================
// week_id（YYYY-Www）
// =====================
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

// =====================
// CSV loader -> mock.vocab
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
// 4-choice builder
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
// API
// =====================
const api = {
  isMock() { return !!USE_MOCK; },

  async getMyUserId() {
    if (USE_MOCK) return "u1";
    assertClient();
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id ?? null;
  },

  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  async fetchLatestQuestion() {
    if (USE_MOCK) {
      const level = document.getElementById("levelSelect")?.value || "all";
      let pool = (mock.vocab || []).slice();
      if (level !== "all") pool = pool.filter(v => String(v.level || 1) === String(level));
      if (pool.length < 4) pool = (mock.vocab || []).slice();
      if (!pool || pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

      const i = Math.floor(Math.random() * pool.length);
      const v = pool[i];

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

    assertClient();
    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("本番DBに有効な問題がありません（is_active=true）");

    return data[Math.floor(Math.random() * data.length)];
  },

  async submitAttempt(questionId, chosen) {
    if (USE_MOCK) {
      const correct = window.__LAST_MOCK_CORRECT;
      const ok = chosen === correct;
      return [{
        is_correct: ok,
        points: ok ? 10 : 0,
        out_week_id: this.getWeekIdNow(),
      }];
    }

    assertClient();

    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) throw { message: "ログインしていないため送信できません（RLS/auth）" };

    const { data, error } = await client.rpc("submit_attempt", {
      p_question_id: questionId,
      p_chosen_choice: chosen,
      p_client_ms: Date.now(),
      p_quiz_session_id: null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw { message: "submit_attempt の返り値が空です" };

    return [{
      is_correct: !!row.is_correct,
      points: Number(row.points || 0),
      out_week_id: String(row.out_week_id || this.getWeekIdNow()),
    }];
  },

  async fetchWeekOptions() {
    if (USE_MOCK) return [this.getWeekIdNow()];
    assertClient();

    const { data, error } = await client
      .from("score_weekly")
      .select("week_id")
      .order("week_id", { ascending: false })
      .limit(30);

    if (error) throw error;
    return Array.from(new Set((data ?? []).map(x => x.week_id)));
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", USE_MOCK, "fallback vocab size =", mock.vocab.length);
