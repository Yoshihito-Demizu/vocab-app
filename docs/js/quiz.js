// docs/js/quiz.js
(function () {

console.log("[quiz] loaded! (safe-scope + next-question)");

/* global api */

const byId = (id) => document.getElementById(id);

// ===== panes =====
const startPane  = byId("startPane");
const battlePane = byId("battlePane");
const resultPane = byId("resultPane");

// ===== HUD =====
const timeLeftEl = byId("timeLeft");
const scoreNowEl = byId("scoreNow");
const comboNowEl = byId("comboNow");

// ===== question UI =====
const qEl = byId("q");
const choicesEl = byId("choices");

// ===== result =====
const finalScoreEl = byId("finalScore");
const finalComboEl = byId("finalCombo");

// ===== config =====
const GAME_SECONDS = 60;

// ===== state =====
let timer = null;
let endAt = 0;

let currentQ = null;
let playing = false;
let answering = false;

let score = 0;
let combo = 0;
let maxCombo = 0;

// ===== UI =====

function showPane(name) {

  startPane?.classList.toggle("hidden", name !== "start");
  battlePane?.classList.toggle("hidden", name !== "battle");
  resultPane?.classList.toggle("hidden", name !== "result");

}

function setHUD() {

  if (scoreNowEl) scoreNowEl.textContent = score;
  if (comboNowEl) comboNowEl.textContent = combo;

}

function setTime(sec) {

  if (timeLeftEl) timeLeftEl.textContent = sec;

}

// ===== timer =====

function tick() {

  const left = Math.ceil((endAt - Date.now()) / 1000);
  setTime(left);

  if (left <= 0) endGame();

}

function startTimer() {

  endAt = Date.now() + GAME_SECONDS * 1000;

  tick();
  timer = setInterval(tick, 200);

}

function stopTimer() {

  if (timer) clearInterval(timer);
  timer = null;

}

// ===== question =====

function renderQuestion(q) {

  if (!qEl || !choicesEl) return;

  qEl.innerHTML = `<h3>${q.word}</h3>`;

  const list = [
    ["A", q.choice_a],
    ["B", q.choice_b],
    ["C", q.choice_c],
    ["D", q.choice_d],
  ];

  choicesEl.innerHTML = "";

  for (const [label, text] of list) {

    const btn = document.createElement("button");

    btn.textContent = `${label} ${text}`;
    btn.onclick = () => choose(label);

    choicesEl.appendChild(btn);

  }

}

async function loadQuestion() {

  if (!playing) return;

  const q = await api.fetchLatestQuestion();

  if (!q) throw new Error("question not found");

  currentQ = q;

  renderQuestion(q);

}

// ===== scoring =====

function calcPoints(nextCombo) {

  const base = 10;
  const bonus = Math.min(20, nextCombo * 2);

  return base + bonus;

}

// ===== answer =====

async function choose(label) {

  if (!playing) return;
  if (answering) return;

  answering = true;

  try {

    const rows = await api.submitAttempt(currentQ.id, label);
    const row = Array.isArray(rows) ? rows[0] : rows;

    const correct = !!row?.is_correct;

    if (correct) {

      combo++;
      maxCombo = Math.max(maxCombo, combo);

      score += calcPoints(combo);

    } else {

      combo = 0;

    }

    setHUD();

    answering = false;

    await loadQuestion();

  } catch (e) {

    console.warn("[quiz] choose failed", e);
    answering = false;

  }

}

// ===== start =====

async function startGame() {

  score = 0;
  combo = 0;
  maxCombo = 0;

  setHUD();
  setTime(GAME_SECONDS);

  playing = true;

  showPane("battle");

  startTimer();

  await loadQuestion();

}

// ===== end =====

async function endGame() {

  if (!playing) return;

  playing = false;

  stopTimer();

  if (finalScoreEl) finalScoreEl.textContent = score;
  if (finalComboEl) finalComboEl.textContent = maxCombo;

  showPane("result");

  try {

    await api.submitRun(score, maxCombo);

  } catch (e) {

    console.warn("[quiz] submitRun failed", e);

  }

  if (window.onResultShown) window.onResultShown();

}

// ===== expose =====

window.startGame = startGame;
window.endGame = endGame;

})();
