// docs/js/quiz.js
console.log("[quiz] loaded! (best-score+combo-tuning)");

/* global api */

const $ = (id) => document.getElementById(id);

const els = {
  startPane: $("startPane"),
  battlePane: $("battlePane"),
  resultPane: $("resultPane"),

  timeLeft: $("timeLeft"),
  scoreNow: $("scoreNow"),
  comboNow: $("comboNow"),

  q: $("q"),
  choices: $("choices"),

  finalScore: $("finalScore"),
  finalCombo: $("finalCombo"),

  overlay: $("overlay"),
  overlayPanel: document.querySelector("#overlay .panel"),
};

const GAME_SECONDS = 60;

// ===== 状態 =====
let timer = null;
let endAt = 0;
let score = 0;
let combo = 0;
let maxCombo = 0;
let locked = false;
let currentQ = null;

// ===== 演出（最小）=====
function showOverlay(text, cls) {
  if (!els.overlay || !els.overlayPanel) return;
  els.overlay.classList.remove("hidden");
  els.overlayPanel.className = "panel " + (cls || "");
  els.overlayPanel.textContent = text;
}
function hideOverlay() {
  if (!els.overlay) return;
  els.overlay.classList.add("hidden");
}

function showPane(which) {
  els.startPane?.classList.add("hidden");
  els.battlePane?.classList.add("hidden");
  els.resultPane?.classList.add("hidden");
  which?.classList.remove("hidden");
}

// ===== 描画 =====
function renderHUD() {
  if (els.scoreNow) els.scoreNow.textContent = String(score);
  if (els.comboNow) els.comboNow.textContent = String(combo);
}
function renderTime() {
  const t = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  if (els.timeLeft) els.timeLeft.textContent = String(t);
  if (t <= 0) endGame();
}

function renderQuestion(q) {
  if (!q) return;

  els.q.innerHTML = `
    <h3 style="margin:0 0 6px;">${escapeHTML(q.word)}</h3>
    <div class="prompt">${escapeHTML(q.prompt || "")}</div>
  `;

  const btn = (label, text) => `
    <button data-choice="${label}">
      <div style="font-size:12px;opacity:.75;margin-bottom:6px;">${label}</div>
      <div>${escapeHTML(text || "")}</div>
    </button>
  `;

  els.choices.innerHTML =
    btn("A", q.choice_a) + btn("B", q.choice_b) + btn("C", q.choice_c) + btn("D", q.choice_d);

  els.choices.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => onChoose(b.getAttribute("data-choice")));
  });
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ===== 問題ロード =====
async function loadQuestion() {
  if (locked) return;
  locked = true;
  try {
    if (!api || typeof api.fetchLatestQuestion !== "function") {
      throw new Error("api.fetchLatestQuestion が見つかりません（api.js差し替え確認）");
    }
    currentQ = await api.fetchLatestQuestion();
    renderQuestion(currentQ);
  } finally {
    locked = false;
  }
}

// ===== 回答 =====
async function onChoose(label) {
  if (locked) return;
  locked = true;
  try {
    const res = await api.submitAttempt(currentQ?.id, label);
    const row = Array.isArray(res) ? res[0] : res;

    const isCorrect = !!row?.is_correct;

    if (isCorrect) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);

      // ✅ コンボボーナス（調整しやすい形）
      // 例：基本10点 + combo*2（上限なし、好みで上限付けてもOK）
      score += 10 + combo * 2;

      showOverlay("OK!", "ok");
      setTimeout(hideOverlay, 180);
    } else {
      combo = 0;
      showOverlay("NG!", "ng");
      setTimeout(hideOverlay, 220);
    }

    renderHUD();
    await loadQuestion();
  } catch (e) {
    console.warn("[quiz] submitAttempt failed:", e);
    showOverlay("通信エラー", "warn");
    setTimeout(hideOverlay, 600);
  } finally {
    locked = false;
  }
}

// ===== ゲーム制御 =====
async function startGame() {
  try {
    score = 0;
    combo = 0;
    maxCombo = 0;
    currentQ = null;
    locked = false;

    showPane(els.battlePane);

    endAt = Date.now() + GAME_SECONDS * 1000;
    renderHUD();
    renderTime();

    if (timer) clearInterval(timer);
    timer = setInterval(renderTime, 250);

    await loadQuestion();
  } catch (e) {
    console.warn("[startGame] failed:", e);
    showOverlay("開始できません", "warn");
    setTimeout(hideOverlay, 800);
    showPane(els.startPane);
  }
}

async function endGame() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  showPane(els.resultPane);

  if (els.finalScore) els.finalScore.textContent = String(score);
  if (els.finalCombo) els.finalCombo.textContent = String(maxCombo);

  // ✅ 1プレイ結果を保存（本番のみ）
  try {
    if (api && typeof api.submitRun === "function") {
      const r = await api.submitRun(score, maxCombo);
      if (!r?.ok) console.warn("[endGame] submitRun not ok:", r);
    }
  } catch (e) {
    console.warn("[endGame] submitRun failed:", e);
  }

  // 結果画面表示後にランキング更新（main.js が設定してる想定）
  try {
    if (typeof window.onResultShown === "function") await window.onResultShown();
  } catch {}
}

// グローバルに公開（main.jsが呼ぶ）
window.startGame = startGame;
window.endGame = endGame;
