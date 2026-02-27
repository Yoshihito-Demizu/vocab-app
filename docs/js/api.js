// docs/js/api.js
/* global USE_MOCK, toEmail */
"use strict";

// ===== MOCK vocab（vocab.csvがあれば上書きされる）=====
const mock = {
  vocab: [
    { word: "憂慮", meaning: "心配して気にかけること", level: 1 },
    { word: "端緒", meaning: "物事のはじまり・きっかけ", level: 1 },
    { word: "恣意的", meaning: "自分勝手で根拠がないさま", level: 1 },
    { word: "形骸化", meaning: "中身が失われ形だけ残ること", level: 1 },
  ],
};

// ===== 出題の連続防止 =====
const pickState = {
  recentWords: [],
  recentCorrectLabels: [],
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
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

// ===== CSV loader（MOCK vocab を増やす）=====
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

// ===== choices generator（正解位置の偏り防止）=====
function makeChoices(vocabList, correctItem) {
  const base = vocabList.slice();
  const others = base
    .filter(v => v.word !== correctItem.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const meanings = [correctItem.meaning, ...others.map(o => o.meaning)];
  const shuffledMeanings = shuffle(meanings);

  const labels = ["A", "B", "C", "D"];
  let shuffledLabels = shuffle(labels);

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
  for (let i = 0; i < 4; i++) map[shuffledLabels[i]] = shuffledMeanings[i];

  const correctLabel = shuffledLabels[correctIndex];
  rememberCorrectLabel(correctLabel);

  return {
    choice_a: map.A, choice_b: map.B, choice_c: map.C, choice_d: map.D,
    correctLabel,
  };
}

window.__LAST_MOCK_CORRECT = null;

// ===== API 本体 =====
const api = {
  isMock() { return !!window.USE_MOCK; },

  getWeekIdNow() { return getISOWeekId(new Date()); },

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

  // ===== 出題（mock: CSV/配列からランダム、prod: questionsテーブルがあるなら後で）=====
  async fetchLatestQuestion() {
    if (window.vocabReady) { try { await window.vocabReady; } catch {} }

    // まずは mock 優先（あなたの運用上「安全」）
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

    // prodは（今は）CSV出題でもOKなら、ここでmock同様に出しても良い
    // ただし「送信だけprod」みたいな運用にしづらいので、まずはmock運用推奨
    const pool = (mock.vocab || []).slice();
    if (pool.length < 4) throw new Error("vocabが少なすぎます（最低4件）");

    const v = pickAvoidRecent(pool, (x) => x.word);
    const r = makeChoices(mock.vocab, v);

    // prodでは正解ラベルを保持（quiz.js側が判定するなら不要だが、念のため）
    window.__LAST_MOCK_CORRECT = r.correctLabel;

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

  // ===== ランキング用 =====
  async fetchWeekOptions() {
    if (window.USE_MOCK) return [this.getWeekIdNow()];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_week_options");
    if (error) throw error;
    const weeks = (data || []).map(x => x.week_id).filter(Boolean);
    if (!weeks.includes(this.getWeekIdNow())) weeks.unshift(this.getWeekIdNow());
    return weeks;
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
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  },

  async fetchPersonalWeeklyTop(weekId) {
    // 「自分の最高」だけ取りたい時用（既存互換）
    if (window.USE_MOCK) return [];
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_my_weekly_rank", { p_week_id: weekId });
    if (error) throw error;
    const row = Array.isArray(data) ? (data[0] || null) : (data || null);
    return row ? [row] : [];
  },

  // ===== 送信系（ここが “not a function” を潰す）=====
  // quiz.jsが submitAttempt を呼んでも submitRun を呼んでも動くようにする

  async submitAttempt(score, maxCombo) {
    // 旧名互換：submitAttempt → submitRun
    return await this.submitRun(score, maxCombo);
  },

  async submitRun(score, maxCombo) {
    const weekId = this.getWeekIdNow();

    if (window.USE_MOCK) {
      // mockでは runs に保存しない（必要ならlocalStorageで擬似保存に拡張可）
      return { ok: true, skipped: true, mock: true, week_id: weekId, score, max_combo: maxCombo };
    }

    const client = await ensureClientReady();
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id || null;
    if (!uid) return { ok: false, message: "未ログインです（ログインしてから送信してください）" };

    // まずRPC submit_run を試す（あるならそれが本命）
    try {
      const { data, error } = await client.rpc("submit_run", {
        p_week_id: weekId,
        p_score: Number(score) || 0,
        p_max_combo: Number(maxCombo) || 0,
      });
      if (error) throw error;
      return { ok: true, via: "rpc", data };
    } catch (e) {
      // RPCが無い/404 のとき：runsへ直接insert（RLSが許している場合のみ成功）
      console.warn("[api] submit_run rpc failed -> try insert runs:", e);

      try {
        const { error: insErr } = await client.from("runs").insert([{
          user_id: uid,
          week_id: weekId,
          score: Number(score) || 0,
          max_combo: Number(maxCombo) || 0,
        }]);
        if (insErr) throw insErr;
        return { ok: true, via: "insert" };
      } catch (e2) {
        console.warn("[api] insert runs failed:", e2);
        return { ok: false, message: (e2 && e2.message) ? e2.message : "送信失敗" };
      }
    }
  },
};

window.api = api;
console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", mock.vocab.length);
