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

// ===== client 準備待ち（config.js の clientReady を使う）=====
async function ensureClientReady() {
  if (window.USE_MOCK) return null;
  // config.js が用意した Promise があれば待つ
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

// ===== CSV（簡易）=====
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
    if (window.USE_MOCK) {
      // levelSelect は存在しなくてもOK（all扱い）
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

    const client = await ensureClientReady();
    const { data, error } = await client
      .from("questions")
      .select("id, word, prompt, choice_a, choice_b, choice_c, choice_d")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data[Math.floor(Math.random() * data.length)];
  },

  // ===== 解答送信 =====
  async submitAttempt(questionId, chosen) {
    const weekId = this.getWeekIdNow();

    if (window.USE_MOCK) {
      const correct = window.__LAST_MOCK_CORRECT;
      const ok = chosen === correct;
      const row = {
        is_correct: ok,
        points: ok ? 10 : 0,
        out_week_id: weekId,
      };

      // ✅ mock時は端末内ランキングに記録（ranking.js がいれば）
      try {
        const userId = await this.getMyUserId(); // u1
        if (typeof window.__recordAttempt === "function") {
          await window.__recordAttempt({ userId, weekId, is_correct: row.is_correct, points: row.points });
        }
      } catch (_) {}

      return [row];
    }

    const client = await ensureClientReady();

    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) {
      throw { message: "未ログインです。スタート画面でログインしてから再開してください。" };
    }

   const { data, error } = await client.rpc("submit_attempt", {
  p_question_id: questionId,
  p_chosen_choice: String(chosen),            // text
  p_client_ms: Date.now(),                    // ← DBがbigintならこれでOK（JS numberでも13桁は安全に表現できる）
  p_quiz_session_id: null,
});
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw { message: "submit_attempt の返り値が空です" };

    return [{
      is_correct: !!row.is_correct,
      points: Number(row.points || 0),
      out_week_id: String(row.out_week_id || weekId),
    }];
  },

  // =========================
  // ランキング用API（ranking.js が呼ぶやつ）
  // =========================

  // 週の候補一覧（新しい順）
  async fetchWeekOptions() {
    if (window.USE_MOCK) {
      // localStorage 側は ranking.js が持ってるので、最小は「今週だけ」でOK
      return [this.getWeekIdNow()];
    }

    const client = await ensureClientReady();
    // ここは「attempts」テーブルなどがある想定。
    // ない場合でも壊れないように try/catch で ranking.js がフォールバックできる。
    const { data, error } = await client
      .from("weekly_rankings")
      .select("week_id")
      .order("week_id", { ascending: false })
      .limit(50);

    if (error) throw error;
    const weeks = (data || []).map(r => r.week_id).filter(Boolean);
    return weeks.length ? weeks : [this.getWeekIdNow()];
  },

  // 週Top10（想定：weekly_rankings view/table）
  async fetchPersonalWeeklyTop(weekId) {
    if (window.USE_MOCK) return [];

    const client = await ensureClientReady();
    const { data, error } = await client
      .from("weekly_rankings")
      .select("user_id, nickname, points, correct, wrong")
      .eq("week_id", weekId)
      .order("points", { ascending: false })
      .order("correct", { ascending: false })
      .limit(10);

    if (error) throw error;
    return data || [];
  },

  // 自分の順位（想定：my_weekly_rank view/rpc）
  async fetchMyWeeklyRank(weekId) {
    if (window.USE_MOCK) return null;

    const client = await ensureClientReady();
    const uid = await this.getMyUserId();
    if (!uid) return null;

    // まずは view/table から直取り（無ければエラー→ranking.js がlocal fallback）
    const { data, error } = await client
      .from("weekly_rankings")
      .select("user_id, nickname, points, correct, wrong, rank")
      .eq("week_id", weekId)
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", mock.vocab.length);

