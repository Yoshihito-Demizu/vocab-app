// docs/js/quiz.js
/* global api */
"use strict";

console.log("[quiz] loaded! (next-question-fix + 60s + best-score)");

// ===== DOM =====
const $ = (id) => document.getElementById(id);

const panes = {
  start: $("startPane"),
  battle: $("battlePane"),
  result: $("resultPane"),
};

const els = {
  q: $("q"),
  choices: $("choices"),

  timeLeft: $("timeLeft"),
  scoreNow: $("scoreNow"),
  comboNow: $("comboNow"),

  finalScore: $("finalScore"),
  finalCombo: $("finalCombo"),
};

// ===== state =====
let playing = false;
let answering = false;
let currentQ = null;

let score = 0;
let combo = 0;
let maxCombo = 0;

let timerId = null;
let msLeft = 0;

// ✅ 1プレイ中の「同じ問題」防止
let seenQuestionIds = new Set();

// ===== settings =====
const GAME_SECONDS = 60;

// ===== helpers =====
function showPane(name) {
  Object.values(panes).forEach((p) => p && p.classList.add("hidden"));
  panes[name] && panes[name].classList.remove("hidden");
}

function setText(el, v) {
  if (el) el.textContent = String(v);
}

function clampLabel(x) {
  return String(x || "").trim().toUpperCase();
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!playing) return;

    msLeft -= 100;
    const sec = Math.max(0, Math.ceil(msLeft / 1000));
    setText(els.timeLeft, sec);

    if (msLeft <= 0) {
      endGame();
    }
  }, 100);
}

// ===== UI render =====
function renderQuestion(q) {
  if (!els.q || !els.choices) return;

  els.q.innerHTML = `
    <h3>${escapeHtml(q.word || "")}</h3>
    <div class="prompt">${escapeHtml(q.prompt || "意味として正しいものは？")}</div>
  `;

  const items = [
    ["A", q.choice_a],
    ["B", q.choice_b],
    ["C", q.choice_c],
    ["D", q.choice_d],
  ];

  els.choices.innerHTML = "";

  for (const [label, text] of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.choice = label;
    btn.innerHTML = `<div style="font-weight:1000">${label}</div><div style="margin-top:6px; font-weight:900">${escapeHtml(text || "")}</div>`;
    btn.addEventListener("click", () => answer(label));
    els.choices.appendChild(btn);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== core =====
async function loadQuestion() {
  if (!playing) return;

  let q = null;

  // ✅ 最大10回まで引き直して「未出」を探す
  for (let i = 0; i < 10; i++) {
    q = await api.fetchLatestQuestion();
    if (!q) break;

    const id = String(q.id);
    if (!seenQuestionIds.has(id)) {
      seenQuestionIds.add(id);
      break;
    }
  }

  if (!q) throw new Error("question not found");

  currentQ = q;
  renderQuestion(q);
}

async function answer(choiceLabel) {
  if (!playing || answering) return;
  answering = true;

  try {
    const chosen = clampLabel(choiceLabel);
    const qid = currentQ ? currentQ.id : null;
    if (!qid) throw new Error("question missing");

    // ✅ 送信（mock/prodの中身は api.js 側で吸収）
    const res = await api.submitAttempt(qid, chosen);

    // res は [{is_correct, points, out_week_id}] の想定
    const row = Array.isArray(res) ? res[0] : res;
    const isCorrect = !!(row && row.is_correct);
    const pts = Number(row && row.points ? row.points : 0);

    if (isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      score += pts;
    } else {
      combo = 0;
      // ptsが0でもOK
      score += pts;
    }

    setText(els.scoreNow, score);
    setText(els.comboNow, combo);

    // 次の問題へ
    await loadQuestion();
  } catch (e) {
    console.warn("[quiz] answer failed:", e);
    // とりあえずプレイは続ける（止めたくない）
    try {
      await loadQuestion();
    } catch {}
  } finally {
    answering = false;
  }
}

async function startGame() {
  try {
    // ✅ 連打/二重開始防止
    if (playing) return;

    playing = true;
    answering = false;

    // ✅ ここで毎回リセット
    score = 0;
    combo = 0;
    maxCombo = 0;
    seenQuestionIds.clear();

    setText(els.scoreNow, 0);
    setText(els.comboNow, 0);
    setText(els.timeLeft, GAME_SECONDS);

    showPane("battle");

    msLeft = GAME_SECONDS * 1000;
    startTimer();

    await loadQuestion();
  } catch (e) {
    console.warn("[quiz] startGame failed:", e);
    playing = false;
    stopTimer();
    showPane("start");
  }
}

async function endGame() {
  if (!playing) return;

  playing = false;
  answering = false;
  stopTimer();

  setText(els.finalScore, score);
  setText(els.finalCombo, maxCombo);

  showPane("result");

  // ✅ 結果画面が出たタイミングでランキング更新（main.js が拾う）
  if (typeof window.onResultShown === "function") {
    try { await window.onResultShown(); } catch {}
  }

  // ✅ 最高得点ランキング用：runs へ保存（あれば）
  // api.submitRun があれば呼ぶ。なければ無視。
  try {
    if (api && typeof api.submitRun === "function") {
      await api.submitRun(score, maxCombo);
    }
  } catch (e) {
    console.warn("[quiz] submitRun failed:", e);
  }
}

// ===== expose =====
window.startGame = startGame;
window.endGame = endGame;
