// docs/js/quiz.js
/* global api */
"use strict";

console.log("[quiz] loaded! (maru-batsu + normal-countdown + 60s + next-question-fix + best-score)");

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

// ✅ 1プレイ中の「同じ問題」防止
let seenQuestionIds = new Set();

// ===== settings =====
const GAME_SECONDS = 60;

// カウントダウン速度（ここだけ好みで変えられる）
const COUNT_MS = 600;   // 3,2,1 の1つあたり
const GO_MS = 700;      // GO表示

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

// ===== FX (overlay) =====
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

// ✅ 正解ラベル取得（mock/prod両方対応）
function getCorrectLabel() {
  const a = clampLabel(window.__LAST_MOCK_CORRECT);
  const b = clampLabel(window.__LAST_PROD_CORRECT);
  return a || b || "";
}

async function answer(choiceLabel) {
  if (!playing || answering) return;
  answering = true;

  const chosen = clampLabel(choiceLabel);

  try {
    const qid = currentQ ? currentQ.id : null;
    if (!qid) throw new Error("question missing");

    const res = await api.submitAttempt(qid, chosen);
    const row = Array.isArray(res) ? res[0] : res;

    const isCorrect = !!(row && row.is_correct);
    const pts = Number(row && row.points ? row.points : 0);

    const correctLabel = getCorrectLabel();
    if (correctLabel) markButtons(correctLabel, chosen);

    if (isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      score += pts;
      setText(els.scoreNow, score);
      setText(els.comboNow, combo);

      // ✅ 〇
      await showOverlay("ok", "〇", 450);
    } else {
      combo = 0;
      score += pts;
      setText(els.scoreNow, score);
      setText(els.comboNow, combo);

      // ✅ ×
      await showOverlay("ng", "×", 520);
    }

    await loadQuestion();
  } catch (e) {
    console.warn("[quiz] answer failed:", e);
    await showOverlay("warn", "送信エラー", 700);
    try { await loadQuestion(); } catch {}
  } finally {
    answering = false;
  }
}

async function startGame() {
  try {
    if (playing) return;

    playing = true;
    answering = false;

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

    // ✅ 普通の速さのカウントダウン
    await showOverlay("count", "3", COUNT_MS);
    await showOverlay("count", "2", COUNT_MS);
    await showOverlay("count", "1", COUNT_MS);

    // GOは控えめ（要らなければ消してOK）
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

  setText(els.finalScore, score);
  setText(els.finalCombo, maxCombo);

  showPane("result");

  if (typeof window.onResultShown === "function") {
    try { await window.onResultShown(); } catch {}
  }

  // 最高得点ランキング用
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
