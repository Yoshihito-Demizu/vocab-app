// docs/js/quiz.js
/* global api */
"use strict";

console.log("[quiz] loaded! (ideal-score-structure)");

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

  overlay: $("overlay"),
  overlayPanel: $("overlay") ? $("overlay").querySelector(".panel") : null,
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

let seenQuestionIds = new Set();

// 回答速度計測
let qShownAt = 0;
let totalAnswerMs = 0;
let answeredCount = 0;
let fastestAnswerMs = null;

// ===== settings =====
const GAME_SECONDS = 60;
const COUNT_MS = 600;
const GO_MS = 700;

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

    if (msLeft <= 0) endGame();
  }, 100);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensureResultUi() {
  const resultStats = document.querySelector(".resultStats");
  if (!resultStats) return;

  if (!document.getElementById("finalAvgTime")) {
    const card = document.createElement("div");
    card.className = "resultStatCard";
    card.innerHTML = `
      <div class="resultStatLabel">平均回答時間</div>
      <div class="resultStatValue" id="finalAvgTime">0.00秒</div>
    `;
    resultStats.appendChild(card);
  }

  if (!document.getElementById("finalFastestTime")) {
    const card = document.createElement("div");
    card.className = "resultStatCard";
    card.innerHTML = `
      <div class="resultStatLabel">最速回答</div>
      <div class="resultStatValue" id="finalFastestTime">0.00秒</div>
    `;
    resultStats.appendChild(card);
  }
}

// ===== scoring =====
function getComboBonus(nextCombo) {
  if (nextCombo >= 15) return 4;
  if (nextCombo >= 10) return 3;
  if (nextCombo >= 5) return 2;
  if (nextCombo >= 3) return 1;
  return 0;
}

function getSpeedBonus(answerMs) {
  const answerSec = answerMs / 1000;

  // 0.25秒刻み / 最大10点 / 2.5秒で0点
  // 5秒までは測るが、ボーナスは2.5秒以降0
  const step = Math.floor(answerSec / 0.25);
  return Math.max(0, 10 - step);
}

function getFastLabel(answerMs) {
  const sec = answerMs / 1000;
  if (sec <= 0.50) return "GOD SPEED";
  if (sec <= 1.00) return "FAST!";
  if (sec <= 1.50) return "QUICK!";
  return "";
}

// ===== FX =====
async function showOverlay(type, text, ms) {
  if (!els.overlay || !els.overlayPanel) return;
  els.overlay.classList.remove("hidden");
  els.overlayPanel.className = "panel " + (type || "");
  els.overlayPanel.textContent = text || "";
  await new Promise((r) => setTimeout(r, ms || 400));
  els.overlay.classList.add("hidden");
}

function markButtons(correctLabel, chosenLabel) {
  if (!els.choices) return;
  const btns = Array.from(els.choices.querySelectorAll("button"));
  for (const b of btns) {
    const lbl = clampLabel(b.dataset.choice);
    b.style.outline = "none";
    b.style.filter = "none";
    b.style.opacity = "1";

    if (lbl === correctLabel) {
      b.style.outline = "3px solid rgba(0,211,138,.95)";
    }
    if (lbl === chosenLabel && chosenLabel !== correctLabel) {
      b.style.outline = "3px solid rgba(255,77,125,.95)";
      b.style.opacity = "0.92";
    }
    if (chosenLabel && lbl !== chosenLabel && lbl !== correctLabel) {
      b.style.opacity = "0.65";
    }
  }
}

// ===== render =====
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
    btn.innerHTML = `
      <div style="font-weight:1000">${label}</div>
      <div style="margin-top:6px; font-weight:900">${escapeHtml(text || "")}</div>
    `;
    btn.addEventListener("click", () => answer(label));
    els.choices.appendChild(btn);
  }

  qShownAt = performance.now();
}

// ===== core =====
async function loadQuestion() {
  if (!playing) return;

  let q = null;

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

function getCorrectLabel() {
  const a = clampLabel(window.__LAST_MOCK_CORRECT);
  const b = clampLabel(window.__LAST_PROD_CORRECT);
  const c = clampLabel(window.__LAST_CORRECT);
  const d = clampLabel(window.__LAST_PUBLIC_CORRECT);
  return a || b || c || d || "";
}

async function answer(choiceLabel) {
  if (!playing || answering) return;
  answering = true;

  const chosen = clampLabel(choiceLabel);
  const answerMs = Math.min(5000, Math.max(0, performance.now() - qShownAt));

  try {
    const qid = currentQ ? currentQ.id : null;
    if (!qid) throw new Error("question missing");

    const res = await api.submitAttempt(qid, chosen);
    const row = Array.isArray(res) ? res[0] : res;

    const isCorrect = !!(row && row.is_correct);
    const correctLabel = getCorrectLabel();

    answeredCount += 1;
    totalAnswerMs += answerMs;
    fastestAnswerMs = fastestAnswerMs === null ? answerMs : Math.min(fastestAnswerMs, answerMs);

    if (correctLabel) markButtons(correctLabel, chosen);

    if (isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);

      const speedBonus = getSpeedBonus(answerMs);
      const comboBonus = getComboBonus(combo);
      const gained = 10 + speedBonus + comboBonus;

      score += gained;

      setText(els.scoreNow, score);
      setText(els.comboNow, combo);

      const fastLabel = getFastLabel(answerMs);
      const overlayText = fastLabel ? `${fastLabel} +${gained}` : `〇 +${gained}`;
      await showOverlay("ok", overlayText, 520);
    } else {
      combo = 0;
      setText(els.scoreNow, score);
      setText(els.comboNow, combo);

      await showOverlay("ng", "×", 520);
    }

    await loadQuestion();
  } catch (e) {
    console.warn("[quiz] answer failed:", e);
    await showOverlay("warn", "送信エラー", 700);
    try {
      await loadQuestion();
    } catch {}
  } finally {
    answering = false;
  }
}

async function startGame() {
  try {
    if (playing) return;

    ensureResultUi();

    playing = true;
    answering = false;

    score = 0;
    combo = 0;
    maxCombo = 0;
    seenQuestionIds.clear();

    totalAnswerMs = 0;
    answeredCount = 0;
    fastestAnswerMs = null;
    qShownAt = 0;

    setText(els.scoreNow, 0);
    setText(els.comboNow, 0);
    setText(els.timeLeft, GAME_SECONDS);

    showPane("battle");

    msLeft = GAME_SECONDS * 1000;
    startTimer();

    await showOverlay("count", "3", COUNT_MS);
    await showOverlay("count", "2", COUNT_MS);
    await showOverlay("count", "1", COUNT_MS);
    await showOverlay("go", "START", GO_MS);

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

  const avgSec = answeredCount > 0 ? (totalAnswerMs / answeredCount / 1000) : 0;
  const fastestSec = fastestAnswerMs !== null ? (fastestAnswerMs / 1000) : 0;

  setText(els.finalScore, score);
  setText(els.finalCombo, maxCombo);

  const finalScoreCard = document.getElementById("finalScoreCard");
  if (finalScoreCard) finalScoreCard.textContent = String(score);

  const finalAvgTime = document.getElementById("finalAvgTime");
  if (finalAvgTime) finalAvgTime.textContent = `${avgSec.toFixed(2)}秒`;

  const finalFastestTime = document.getElementById("finalFastestTime");
  if (finalFastestTime) finalFastestTime.textContent = `${fastestSec.toFixed(2)}秒`;

  showPane("result");

  if (typeof window.onResultShown === "function") {
    try {
      await window.onResultShown();
    } catch {}
  }

  try {
    if (api && typeof api.submitRun === "function") {
      await api.submitRun(score, maxCombo);
    }
  } catch (e) {
    console.warn("[quiz] submitRun failed:", e);
  }
}

window.startGame = startGame;
window.endGame = endGame;
