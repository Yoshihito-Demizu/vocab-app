// docs/js/api.js
/* global USE_MOCK, client, toEmail */

"use strict";

/**
 * この版は「まず端末内にスコア保存→ランキング表示」を完成させる版
 * （後でSupabaseに差し替えるのが楽な形にしてある）
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
  // 保険（CSVが読めない時）
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],
};

// Mockで「今出してる問題の正解ラベル」を覚えておく
window.__LAST_MOCK_CORRECT = null;

function assertClient() {
  if (!client) throw new Error("Supabase client が無い（config.js の読み込み順/ネット確認）");
}

// =====================
// CSV読み込み（vocab.csv）
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
      console.warn("[api] vocab.csv is too small (need >=4). keep fallback:", list.length);
    }
  } catch (e) {
    console.warn("[api] vocab.csv load skipped:", e?.message || e);
  }
}
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
// 端末内スコア保存（localStorage）
// =====================
const LS_KEY = "vocabapp_runs_v1";

function yyyymmdd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO週番号（YYYY-Www）
function isoWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const ww = String(weekNo).padStart(2, "0");
  return `${d.getUTCFullYear()}-W${ww}`;
}

function readRuns() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeRuns(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("[api] localStorage save failed:", e);
  }
}

function addRunLocal(run) {
  const arr = readRuns();
  arr.push(run);
  // サイズ肥大防止：直近200件だけ残す
  while (arr.length > 200) arr.shift();
  writeRuns(arr);
}

// 集計（端末内用）
// - 週: weekIdごとに合算
// - 総合: 全部合算
function aggregateLocal() {
  const runs = readRuns();
  const byWeek = new Map();
  let total = { points: 0, correct: 0, wrong: 0, plays: 0 };

  for (const r of runs) {
    const w = r.weekId || "unknown";
    if (!byWeek.has(w)) byWeek.set(w, { points: 0, correct: 0, wrong: 0, plays: 0 });

    const wk = byWeek.get(w);
    wk.points += r.score || 0;
    wk.correct += r.correct || 0;
    wk.wrong += r.wrong || 0;
    wk.plays += 1;

    total.points += r.score || 0;
    total.correct += r.correct || 0;
    total.wrong += r.wrong || 0;
    total.plays += 1;
  }

  return { byWeek, total };
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
    if (USE_MOCK) return "local-me";
    assertClient();
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id ?? null;
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
      if (!pool || pool.length < 4) throw new Error("mock.vocab が少なすぎます（最低4件必要）");

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
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  },

  async submitAttempt(questionId, chosen) {
    if (USE_MOCK) {
      const correct = window.__LAST_MOCK_CORRECT;
      const ok = chosen === correct;
      return [{
        is_correct: ok,
        points: ok ? 10 : 0,
        out_week_id: isoWeekId(new Date()),
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

  // ✅ ここが今回追加：1ゲーム(30秒)の結果を保存
  async submitRun({ score, correct, wrong, maxCombo }) {
    if (USE_MOCK) {
      addRunLocal({
        ts: Date.now(),
        day: yyyymmdd(new Date()),
        weekId: isoWeekId(new Date()),
        score: Number(score || 0),
        correct: Number(correct || 0),
        wrong: Number(wrong || 0),
        maxCombo: Number(maxCombo || 0),
      });
      return { ok: true };
    }

    // 本番(Supabase)は後でここにRPC/insertを入れる
    return { ok: false, message: "本番保存は未実装" };
  },

  // ---- Week options ----
  async fetchWeekOptions() {
    if (USE_MOCK) {
      const { byWeek } = aggregateLocal();
      const weeks = Array.from(byWeek.keys()).sort().reverse();
      return weeks.length ? weeks : mock.weekIds.slice();
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

  // ---- Rankings: personal ----
  async fetchPersonalWeeklyTop(weekId) {
    if (USE_MOCK) {
      // 端末内は「自分だけ」ランキングにする（まず動かす）
      const { byWeek } = aggregateLocal();
      const wk = byWeek.get(weekId) || { points: 0, correct: 0, wrong: 0 };
      return [{
        user_id: "local-me",
        points: wk.points,
        correct: wk.correct,
        wrong: wk.wrong,
      }];
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

  async fetchPersonalTotalTop() {
    if (USE_MOCK) {
      const { total } = aggregateLocal();
      return [{
        user_id: "local-me",
        points: total.points,
        correct: total.correct,
        wrong: total.wrong,
      }];
    }

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
    if (USE_MOCK) {
      // local-me の表示名
      return [{ id: "local-me", nickname: "あなた", grade: 0, class_no: 0 }];
    }

    assertClient();
    const { data, error } = await client
      .from("public_users")
      .select("id, nickname, grade, class_no")
      .in("id", userIds);
    if (error) throw error;
    return data ?? [];
  },

  // ---- Rankings: class（今はダミーのまま）----
  async fetchClassRankings(weekId) {
    if (USE_MOCK) {
      return {
        cw: [],
        ct: [],
        cwa: [],
        cta: [],
      };
    }

    // 本番は今までの通り（必要なら後で復活させる）
    return { cw: [], ct: [], cwa: [], cta: [] };
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", USE_MOCK, "fallback vocab size =", mock.vocab.length);
