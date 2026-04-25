/* global api */
"use strict";

console.log("[quiz] loaded! (BEST BGM timing)");

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
  overlayPanel: $("overlay")?.querySelector(".panel"),
};

// ===== SOUND =====
function playAudio(id, volume = 0.5, reset = true) {
  const a = document.getElementById(id);
  if (!a) return;

  if (reset) a.currentTime = 0;
  a.volume = volume;

  const p = a.play();
  if (p) p.catch(() => {});
}

function stopAudio(id) {
  const a = document.getElementById(id);
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}

function playSe(id) {
  playAudio(id, 0.7, true);
}

// ===== BGM（重要）=====
let bgm = null;

function initBgmSilentStart() {
  bgm = document.getElementById("bgm");
  if (!bgm) return;

  bgm.volume = 0; // 🔥 無音でスタート
  bgm.currentTime = 0;
  bgm.play().catch(() => {});
}

function enableBgm() {
  if (!bgm) return;
  bgm.volume = 0.4; // 🔥 GOで音出す
}

function stopBgm() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

function playResultBgm() {
  stopBgm();
  playAudio("bgmResult", 0.45, true);
}

// ===== STATE =====
let playing = false;
let answering = false;
let currentQ = null;

let score = 0;
let combo = 0;
let maxCombo = 0;

let timerId = null;
let msLeft = 0;

const GAME_SECONDS = 60;
const COUNT_MS = 600;
const GO_MS = 700;
const WRONG_PENALTY_MS = 2000;

// ===== UI =====
function showPane(name) {
  Object.values(panes).forEach((p) => p?.classList.add("hidden"));
  panes[name]?.classList.remove("hidden");
}

function setText(el, v) {
  if (el) el.textContent = String(v);
}

async function showOverlay(type, text, ms) {
  if (!els.overlay) return;

  els.overlay.classList.remove("hidden");
  els.overlayPanel.className = "panel " + type;
  els.overlayPanel.textContent = text;

  await new Promise((r) => setTimeout(r, ms));
  els.overlay.classList.add("hidden");
}

// ===== TIMER =====
function startTimer() {
  timerId = setInterval(() => {
    msLeft -= 100;
    setText(els.timeLeft, Math.ceil(msLeft / 1000));

    if (msLeft <= 0) endGame(true);
  }, 100);
}

function stopTimer() {
  clearInterval(timerId);
}

// ===== GAME =====
async function startGame() {
  if (playing) return;

  playing = true;

  score = 0;
  combo = 0;
  maxCombo = 0;

  setText(els.scoreNow, 0);
  setText(els.comboNow, 0);
  setText(els.timeLeft, GAME_SECONDS);

  showPane("battle");

  msLeft = GAME_SECONDS * 1000;
  startTimer();

  // 🔥 ここが最重要
  initBgmSilentStart();

  // ===== COUNTDOWN =====
  playSe("seCount3");
  await showOverlay("count", "3", COUNT_MS);

  playSe("seCount2");
  await showOverlay("count", "2", COUNT_MS);

  playSe("seCount1");
  await showOverlay("count", "1", COUNT_MS);

  playSe("seCountGo");
  await showOverlay("go", "GO", GO_MS);

  // 🔥 GOの瞬間にBGMオン
  enableBgm();

  await loadQuestion();
}

// ===== QUESTION =====
async function loadQuestion() {
  currentQ = await api.fetchLatestQuestion();

  els.q.innerHTML = `<h3>${currentQ.word}</h3>`;

  els.choices.innerHTML = ["A","B","C","D"].map((c)=>`
    <button onclick="answer('${c}')">${currentQ["choice_"+c.toLowerCase()]}</button>
  `).join("");
}

// ===== ANSWER =====
async function answer(choice) {
  if (!playing || answering) return;
  answering = true;

  const res = await api.submitAttempt(currentQ.id, choice);
  const ok = res[0]?.is_correct;

  if (ok) {
    playSe("seCorrect");
    combo++;
    score += 10;
  } else {
    playSe("seWrong");
    combo = 0;
    msLeft -= WRONG_PENALTY_MS;
  }

  setText(els.scoreNow, score);
  setText(els.comboNow, combo);

  await loadQuestion();
  answering = false;
}

// ===== END =====
async function endGame() {
  if (!playing) return;

  playing = false;

  stopTimer();
  stopBgm();
  playResultBgm();

  setText(els.finalScore, score);
  setText(els.finalCombo, combo);

  showPane("result");

  await api.submitRun(score, combo, true);
}

window.startGame = startGame;
window.answer = answer;
window.endGame = endGame;
