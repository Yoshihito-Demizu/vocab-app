"use strict";

console.log("[quiz] loaded! (ideal-score-structure + BGM)");

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

// ===== BGM =====
function playBgm(){
  const bgm = document.getElementById("bgm");
  if(!bgm) return;
  bgm.currentTime = 0;
  bgm.volume = 0.4;
  bgm.play().catch(()=>{});
}

function stopBgm(){
  const bgm = document.getElementById("bgm");
  if(!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

// ===== state =====
let playing = false;
let answering = false;
let currentQ = null;

let score = 0;
let combo = 0;
let maxCombo = 0;

let timerId = null;
let msLeft = 0;

const GAME_SECONDS = 60;
const WRONG_PENALTY_MS = 2000;

// ===== core =====
function showPane(name) {
  Object.values(panes).forEach((p) => p && p.classList.add("hidden"));
  panes[name] && panes[name].classList.remove("hidden");
}

function setText(el, v) {
  if (el) el.textContent = String(v);
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
    setText(els.timeLeft, Math.ceil(msLeft / 1000));
    if (msLeft <= 0) endGame(true);
  }, 100);
}

async function loadQuestion() {
  const q = await api.fetchLatestQuestion();
  currentQ = q;

  els.q.innerHTML = `<h3>${q.word}</h3>`;
  els.choices.innerHTML = ["A","B","C","D"].map(l => `
    <button data-choice="${l}">
      ${l}: ${q["choice_" + l.toLowerCase()]}
    </button>
  `).join("");

  els.choices.querySelectorAll("button").forEach(btn=>{
    btn.onclick = ()=>answer(btn.dataset.choice);
  });
}

async function answer(choice){
  if(answering) return;
  answering = true;

  const res = await api.submitAttempt(currentQ.id, choice);
  const ok = res[0]?.is_correct;

  if(ok){
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    score += 10;
  }else{
    combo = 0;
    msLeft -= WRONG_PENALTY_MS;
  }

  setText(els.scoreNow, score);
  setText(els.comboNow, combo);

  answering = false;
  await loadQuestion();
}

async function startGame(){
  if(playing) return;

  playing = true;
  score = 0;
  combo = 0;
  maxCombo = 0;

  setText(els.scoreNow, 0);
  setText(els.comboNow, 0);

  showPane("battle");

  msLeft = GAME_SECONDS * 1000;
  startTimer();

  playBgm(); // 🔥ここで再生

  await loadQuestion();
}

async function endGame(isFinished=false){
  if(!playing) return;

  playing = false;
  stopTimer();

  stopBgm(); // 🔥ここで停止

  setText(els.finalScore, score);
  setText(els.finalCombo, maxCombo);

  showPane("result");

  if (typeof window.onResultShown === "function") {
    await window.onResultShown();
  }

  try {
    await api.submitRun(score, maxCombo, isFinished);
  } catch {}
}

window.startGame = startGame;
window.endGame = endGame;
