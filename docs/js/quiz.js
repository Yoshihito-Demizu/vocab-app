/* global api */
"use strict";

console.log("[quiz] loaded! (penalty + anti-spam)");

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

// ★追加：連打防止
let inputLocked = false;
const LOCK_MS = 300;
const PENALTY_MS = 2000;

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

// ===== core =====
async function loadQuestion() {
  if (!playing) return;

  let q = await api.fetchLatestQuestion();
  currentQ = q;

  els.q.innerHTML = `
    <h3>${q.word}</h3>
    <div class="prompt">${q.prompt}</div>
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
    btn.dataset.choice = label;
    btn.innerHTML = `<b>${label}</b><div>${text}</div>`;

    btn.onclick = () => answer(label);

    els.choices.appendChild(btn);
  }
}

// ===== 回答処理（ここが重要） =====
async function answer(choiceLabel) {

  // ロック中は無視
  if (!playing || answering || inputLocked) return;

  answering = true;
  inputLocked = true;

  try {
    const res = await api.submitAttempt(currentQ.id, choiceLabel);
    const row = res?.[0];
    const isCorrect = row?.is_correct;

    if (isCorrect) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);

      score += row.points || 0;

      await showOverlay("ok", "〇", 400);
    }

    // ===== ❌ 不正解 =====
    else {
      combo = 0;

      // ★時間減少（-2秒）
      msLeft = Math.max(0, msLeft - PENALTY_MS);

      // ★赤フラッシュ
      document.body.style.background = "rgba(255,0,0,0.15)";
      setTimeout(() => {
        document.body.style.background = "";
      }, 150);

      await showOverlay("ng", "-2秒", 400);
    }

    setText(els.scoreNow, score);
    setText(els.comboNow, combo);

    await loadQuestion();

  } catch (e) {
    console.warn(e);
  }

  // ★0.3秒ロック解除
  setTimeout(() => {
    inputLocked = false;
  }, LOCK_MS);

  answering = false;
}

// ===== overlay =====
async function showOverlay(type, text, ms) {
  if (!els.overlay || !els.overlayPanel) return;

  els.overlay.classList.remove("hidden");
  els.overlayPanel.className = "panel " + type;
  els.overlayPanel.textContent = text;

  await new Promise((r) => setTimeout(r, ms));

  els.overlay.classList.add("hidden");
}

// ===== start =====
async function startGame() {
  playing = true;
  score = 0;
  combo = 0;
  maxCombo = 0;

  setText(els.scoreNow, 0);
  setText(els.comboNow, 0);

  showPane("battle");

  msLeft = 60000;
  startTimer();

  await showOverlay("count", "3", 500);
  await showOverlay("count", "2", 500);
  await showOverlay("count", "1", 500);
  await showOverlay("go", "START", 600);

  await loadQuestion();
}

// ===== end =====
async function endGame() {
  playing = false;
  stopTimer();

  setText(els.finalScore, score);
  setText(els.finalCombo, maxCombo);

  showPane("result");

  try {
    await api.submitRun(score, maxCombo);
  } catch {}
}

window.startGame = startGame;
window.endGame = endGame;
