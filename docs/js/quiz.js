// docs/js/quiz.js
/* global api */
"use strict";

console.log("[quiz] loaded! (fx + 60s + next-question-fix + best-score)");

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
  await new Promise((r) => setTimeout(r, ms || 240));
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
// mock: window.__LAST_MOCK_CORRECT
// prod: window.__LAST_PROD_CORRECT
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

    // submitAttempt（mock/prod吸収）
    const res = await api.submitAttempt(qid, chosen);

    // res は [{is_correct, points, out_week_id}] の想定
    const row = Array.isArray(res) ? res[0] : res;
    const isCorrect = !!(row && row.is_correct);
    const pts = Number(row && row.points ? row.points : 0);

    // ✅ 正解/不正解演出
    const correctLabel = getCorrectLabel();
    if (correctLabel) {
      markButtons(correctLabel, chosen);
    }

    if (isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      score += pts;

      setText(els.scoreNow, score);
      setText(els.comboNow, combo);

      await showOverlay("ok", "OK!", 220);
    } else {
      combo = 0;
      score += pts;

      setText(els.scoreNow, score);
      setText(els.comboNow, combo);

      await showOverlay("ng", "NG!", 260);
    }

    // 次の問題へ
    await loadQuestion();
  } catch (e) {
    console.warn("[quiz] answer failed:", e);
    await showOverlay("warn", "送信エラー\n（次へ）", 420);

    // とりあえず続行（止めない）
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

    playing = true;
    answering = false;

    // ✅ 毎回リセット
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

    await showOverlay("count", "3", 220);
    await showOverlay("count", "2", 220);
    await showOverlay("count", "1", 220);
    await showOverlay("go", "GO!", 260);

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

  // 結果画面が出たタイミングでランキング更新（main.js が拾う）
  if (typeof window.onResultShown === "function") {
    try { await window.onResultShown(); } catch {}
  }

  // ✅ 最高得点ランキング用：runsへ保存（存在すれば）
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
