// docs/js/quiz.js
console.log("[quiz] loaded! (next-question-fix + 60s + best-score)");

/* global api */
"use strict";

// ===== DOM helper（$は使わない：main.js と衝突することがある）=====
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

// ===== result UI =====
const finalScoreEl = byId("finalScore");
const finalComboEl = byId("finalCombo");

// ===== overlay =====
const overlay = byId("overlay");
const overlayPanel = overlay ? overlay.querySelector(".panel") : null;

// ===== config =====
const GAME_SECONDS = 60;

// ===== state =====
let timerId = null;
let endAtMs = 0;

let currentQ = null;
let isPlaying = false;
let isAnswering = false;

let score = 0;
let combo = 0;
let maxCombo = 0;

// 1プレイ内で「同じ問題」を避けたい（保険）
const seenQuestionIds = new Set();

// ===== overlay helpers =====
function showOverlay(text, cls) {
  if (!overlay || !overlayPanel) return;
  overlayPanel.className = "panel " + (cls || "");
  overlayPanel.textContent = text;
  overlay.classList.remove("hidden");
}
function hideOverlay() {
  if (!overlay || !overlayPanel) return;
  overlay.classList.add("hidden");
}

// ===== UI helpers =====
function showPane(which) {
  if (startPane) startPane.classList.toggle("hidden", which !== "start");
  if (battlePane) battlePane.classList.toggle("hidden", which !== "battle");
  if (resultPane) resultPane.classList.toggle("hidden", which !== "result");
}

function setHUD() {
  if (scoreNowEl) scoreNowEl.textContent = String(score);
  if (comboNowEl) comboNowEl.textContent = String(combo);
}

function setTimeLeft(sec) {
  if (timeLeftEl) timeLeftEl.textContent = String(Math.max(0, sec));
}

function renderQuestion(q) {
  if (!qEl || !choicesEl) return;

  // 問題表示
  qEl.innerHTML = `
    <h3 style="margin:0 0 6px;">${escapeHTML(q.word || "")}</h3>
    <div class="prompt">${escapeHTML(q.prompt || "意味として正しいものは？")}</div>
  `;

  // 選択肢
  const items = [
    ["A", q.choice_a],
    ["B", q.choice_b],
    ["C", q.choice_c],
    ["D", q.choice_d],
  ];

  choicesEl.innerHTML = "";
  for (const [label, text] of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.choice = label;
    btn.innerHTML = `<div style="opacity:.85;font-size:12px;margin-bottom:6px;">${label}</div>
                     <div>${escapeHTML(text || "")}</div>`;
    btn.addEventListener("click", () => chooseAnswer(label));
    choicesEl.appendChild(btn);
  }
}

// ===== main loop =====
function startTimer() {
  endAtMs = Date.now() + GAME_SECONDS * 1000;
  tickTimer();
  timerId = setInterval(tickTimer, 200);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function tickTimer() {
  const left = Math.ceil((endAtMs - Date.now()) / 1000);
  setTimeLeft(left);

  if (left <= 0) {
    endGame();
  }
}

// ===== fetch question =====
async function loadQuestion() {
  // 重要：回答中に重複ロードしない
  if (!isPlaying) return;
  if (isAnswering) return;

  // 重要：毎回ちゃんと次の問題を取りにいく
  // 「たまたま同じ」が出た場合に備えて最大10回まで引き直す
  let q = null;
  for (let tries = 0; tries < 10; tries++) {
    q = await api.fetchLatestQuestion();
    if (!q) break;

    const qid = String(q.id || "");
    if (!qid) break;

    // 同一プレイ内の完全同一IDを避ける
    if (!seenQuestionIds.has(qid)) {
      seenQuestionIds.add(qid);
      break;
    }
  }

  if (!q) throw new Error("question not found");

  currentQ = q;
  renderQuestion(q);
}

// ===== scoring =====
// 60秒で差が出るように、コンボは控えめに加点（上限あり）
function calcPoints(isCorrect, nextCombo) {
  if (!isCorrect) return 0;
  const base = 10;
  const bonus = Math.min(20, nextCombo * 2); // 2点×combo、上限20
  return base + bonus;
}

// ===== answer handler =====
async function chooseAnswer(label) {
  if (!isPlaying) return;
  if (isAnswering) return;
  if (!currentQ) return;

  isAnswering = true;

  try {
    const chosen = String(label || "").toUpperCase();
    const qid = currentQ.id;

    // submitAttempt（正誤判定）→ 返り値から is_correct を取る
    const rows = await api.submitAttempt(qid, chosen);
    const row = Array.isArray(rows) ? rows[0] : rows;

    const isCorrect = !!(row && row.is_correct);

    if (isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const add = calcPoints(true, combo);
      score += add;
      setHUD();
      showOverlay("OK!", "ok");
    } else {
      combo = 0;
      setHUD();
      showOverlay("NG!", "ng");
    }

    // ちょい見せてから次問へ（ここが“同じ1問”バグの決定打）
    await sleep(220);
    hideOverlay();

    // 次の問題へ
    isAnswering = false;
    await loadQuestion();

  } catch (e) {
    console.warn("[quiz] chooseAnswer failed:", e);
    showOverlay("送信に失敗", "warn");
    await sleep(600);
    hideOverlay();
    isAnswering = false;
  }
}

// ===== public API (called by main.js) =====
window.startGame = async function startGame() {
  try {
    // mock/prodどちらも動く
    score = 0;
    combo = 0;
    maxCombo = 0;
    currentQ = null;
    seenQuestionIds.clear();

    setHUD();
    setTimeLeft(GAME_SECONDS);

    showPane("battle");
    isPlaying = true;
    isAnswering = false;

    startTimer();

    // 最初の問題
    await loadQuestion();

  } catch (e) {
    console.warn("[quiz] startGame failed:", e);
    isPlaying = false;
    stopTimer();
    showPane("start");
    alert(e && e.message ? e.message : "開始に失敗しました");
  }
};

window.endGame = async function endGame() {
  if (!isPlaying) return;
  isPlaying = false;
  stopTimer();

  // 結果表示
  if (finalScoreEl) finalScoreEl.textContent = String(score);
  if (finalComboEl) finalComboEl.textContent = String(maxCombo);
  showPane("result");

  // ここで「1プレイの最高得点」を保存（RPCが無い時は静かにスキップ）
  try {
    if (typeof api.submitRun === "function") {
      await api.submitRun(score, maxCombo);
    }
  } catch (e) {
    console.warn("[quiz] submitRun failed:", e);
  }

  // 結果画面が出たらランキング更新（あれば）
  try {
    if (typeof window.onResultShown === "function") {
      await window.onResultShown();
    }
  } catch (e) {
    console.warn("[quiz] onResultShown failed:", e);
  }
};

// ===== utils =====
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
