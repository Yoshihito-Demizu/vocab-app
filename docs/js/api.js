"use strict";

/**
 * api.js
 * - window.api を提供
 * - mock/prod 両対応
 * - ランキング取得：get_week_options / get_weekly_top10 / get_my_weekly_rank
 *   ※重要：rpcは「引数名つき」で渡す（p_week_id）
 * - submitRun：submit_run(p_week_id, p_score, p_max_combo[, p_client_ms]) を呼ぶ
 */

function pad2(n) { return String(n).padStart(2, "0"); }

// ISO週（YYYY-Www）
function getISOWeekId(d = new Date()) {
  // https://en.wikipedia.org/wiki/ISO_week_date (簡易実装)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
}

async function ensureClientReady() {
  // config.js を先に読み込んでいる前提
  if (window.USE_MOCK) return null;
  await window.clientReady;
  if (!window.client) throw new Error("Supabase client が無い（config.jsの読み込み/ネット確認）");
  return window.client;
}

// CSV語彙（mock用/バックアップ用）
let VOCAB = []; // {word, prompt, choice_a..choice_d, correct}
async function loadVocabCsv() {
  try {
    const res = await fetch("./vocab.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("csv fetch failed");
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    // 1行目ヘッダ想定：word,prompt,choice_a,choice_b,choice_c,choice_d,correct
    const header = lines.shift().split(",").map(s => s.trim());
    const idx = (k) => header.indexOf(k);

    VOCAB = lines.map(line => {
      // 超簡易CSV（カンマ含む本格CSVなら別処理必要）
      const cols = line.split(",").map(s => s.trim());
      return {
        word: cols[idx("word")] || cols[0] || "",
        prompt: cols[idx("prompt")] || "",
        choice_a: cols[idx("choice_a")] || "",
        choice_b: cols[idx("choice_b")] || "",
        choice_c: cols[idx("choice_c")] || "",
        choice_d: cols[idx("choice_d")] || "",
        correct: cols[idx("correct")] || "A",
      };
    }).filter(x => x.word);

    console.log("[api] vocab loaded from CSV:", VOCAB.length);
  } catch (e) {
    console.warn("[api] vocab load failed -> fallback vocab size = 4", e);
    VOCAB = [
      { word: "形骸化", prompt: "「形骸化」とは？", choice_a: "中身が充実すること", choice_b: "形式だけ残って意味を失うこと", choice_c: "形がなくなること", choice_d: "制度が廃止されること", correct: "B" },
      { word: "渾然", prompt: "「渾然」とは？", choice_a: "濁っている", choice_b: "入り混じって一体", choice_c: "急いでいる", choice_d: "危険が迫る", correct: "B" },
      { word: "逡巡", prompt: "「逡巡」とは？", choice_a: "ためらう", choice_b: "逃げる", choice_c: "進む", choice_d: "怒る", correct: "A" },
      { word: "僥倖", prompt: "「僥倖」とは？", choice_a: "不幸", choice_b: "偶然の幸運", choice_c: "計画", choice_d: "裏切り", correct: "B" },
    ];
  }
}

function pickRandomQuestionFromCsv() {
  if (!VOCAB.length) return null;
  const q = VOCAB[Math.floor(Math.random() * VOCAB.length)];
  const choices = [
    { key: "A", text: q.choice_a },
    { key: "B", text: q.choice_b },
    { key: "C", text: q.choice_c },
    { key: "D", text: q.choice_d },
  ];
  return {
    id: `csv:${q.word}`,
    word: q.word,
    prompt: q.prompt || `「${q.word}」とは？`,
    choices,
    correct_key: (q.correct || "A").trim().toUpperCase(),
  };
}

// ===== api 本体 =====
const api = {
  // 状態
  USE_MOCK: !!window.USE_MOCK,

  // 週ID
  getWeekIdNow() {
    return getISOWeekId(new Date());
  },

  // Auth
  async signIn(loginId, password) {
    if (window.USE_MOCK) {
      return { ok: true, mock: true, user_id: "mock-user" };
    }
    const client = await ensureClientReady();

    // loginIdがメールじゃないなら @ を付ける運用（以前の toEmail is not defined 対策）
    const email = (String(loginId).includes("@"))
      ? String(loginId).trim()
      : `${String(loginId).trim()}@vocab.local`;

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error };
    return { ok: true, data };
  },

  async signOut() {
    if (window.USE_MOCK) return { ok: true, mock: true };
    const client = await ensureClientReady();
    const { error } = await client.auth.signOut();
    return error ? { ok: false, error } : { ok: true };
  },

  async getMyUserId() {
    if (window.USE_MOCK) return "mock-user";
    const client = await ensureClientReady();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data?.user?.id || null;
  },

  // 問題取得：いまは CSV（B案を後でDBにしてもOK）
  async getNextQuestion() {
    // まずCSV（将来、DB方式に差し替え可能）
    if (!VOCAB.length) await loadVocabCsv();
    const q = pickRandomQuestionFromCsv();
    if (!q) throw new Error("question not found");
    return q;
  },

  /**
   * 1問ごとの送信（いまのAでは必須じゃないけど、quiz.js が期待してる場合があるので残す）
   * 返り値は必ず {is_correct, points, out_week_id} を返す
   */
  async submitAttempt(isCorrect, points = 0) {
    // Aでは「毎回の最高得点（=run）」を採用するので、attemptはローカルでOK
    return {
      is_correct: !!isCorrect,
      points: Number(points) || 0,
      out_week_id: api.getWeekIdNow(),
    };
  },

  /**
   * ★重要：60秒1回分の結果を保存（runsテーブル）
   * DB側に submit_run 関数がある前提：
   *  - submit_run(p_week_id text, p_score int, p_max_combo int [, p_client_ms int])
   */
  async submitRun(score, maxCombo, clientMs) {
    if (window.USE_MOCK) {
      return { ok: true, via: "mock", data: null };
    }
    const client = await ensureClientReady();
    const weekId = api.getWeekIdNow();

    // 関数オーバーロードがあるので、渡す引数を固定化（p_client_msはあってもなくてもOK）
    const args = {
      p_week_id: weekId,
      p_score: Number(score) || 0,
      p_max_combo: Number(maxCombo) || 0,
    };
    if (typeof clientMs === "number") args.p_client_ms = Math.max(0, Math.floor(clientMs));

    const { data, error } = await client.rpc("submit_run", args);
    if (error) return { ok: false, error };
    return { ok: true, via: "rpc", data: data ?? null };
  },

  // ランキング：週の選択肢（DBに無ければ runs から作る fallback）
  async fetchWeekOptions() {
    if (window.USE_MOCK) {
      // mockは今週だけ
      return [api.getWeekIdNow()];
    }
    const client = await ensureClientReady();

    // まずRPC
    const { data, error } = await client.rpc("get_week_options", {});
    if (!error && Array.isArray(data) && data.length) {
      return data.map(x => x.week_id || x).filter(Boolean);
    }

    // fallback: runs から distinct
    const { data: rows, error: e2 } = await client
      .from("runs")
      .select("week_id")
      .order("week_id", { ascending: false })
      .limit(50);

    if (e2) throw e2;
    const set = new Set((rows || []).map(r => r.week_id).filter(Boolean));
    return Array.from(set);
  },

  // ★週Top10（get_weekly_top10 に p_week_id を必ず渡す）
  async fetchWeeklyTop(weekId) {
    if (window.USE_MOCK) {
      return [];
    }
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_weekly_top10", { p_week_id: String(weekId) });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // ★自分の週順位（get_my_weekly_rank に p_week_id を必ず渡す）
  async fetchMyWeeklyRank(weekId) {
    if (window.USE_MOCK) {
      return null;
    }
    const client = await ensureClientReady();
    const { data, error } = await client.rpc("get_my_weekly_rank", { p_week_id: String(weekId) });
    if (error) throw error;
    // 1行返す想定（nullのこともある）
    return data || null;
  },
};

window.api = api;

// 初期ログ
(async () => {
  await loadVocabCsv();
  console.log("[api] loaded. USE_MOCK =", window.USE_MOCK, "fallback vocab size =", VOCAB.length || 4);
})();
