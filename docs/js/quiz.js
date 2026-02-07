// js/quiz.js
/* global api */

console.log("[quiz] loaded! (countdown + big OX + auto-next)");

// ===== 状態 =====
let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let streak = 0;
let currentQuestion = null;
let playing = false;
let locked = false; // 連打防止

// ===== 便利 =====
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.remove("hidden"); }
function hide(id) { $(id)?.classList.add("hidden"); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setText(id, text, cls = "") {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = text;
}

function ensureOverlay() {
  // 画面中央にドーンと出す「〇 / ✕」用オーバーレイを動的に作る
  if ($("judgeOverlay")) return;

  const el = document.createElement("div");
  el.id = "judgeOverlay";
  el.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: none;
  `;
  el.innerHTML = `
    <div id="judgeMark" style="
      font-size: 120px;
      font-weight: 900;
      padding: 24px 34px;
      border-radius: 28px;
      background: rgba(0,0,0,0.55);
      color: #fff;
      text-shadow: 0 0 10px rgba(0,0,0,0.9);
      transform: scale(0.92);
      opacity: 0;
      transition: transform 180ms ease, opacity 180ms ease;
    ">〇</div>
  `;
  document.body.appendChild(el);
}

async function flashJudge(isCorrect) {
  ensureOverlay();
  const overlay = $("judgeOverlay");
  const mark = $("judgeMark");
  if (!overlay || !mark) return;

  overlay.style.display = "flex";
  mark.textContent = isCorrect ? "〇" : "×";
  mark.style.color = isCorrect ? "#7CFF6B" : "#FF5A5A";

  // アニメ（ふわっと出て、少し縮む）
  requestAnimationFrame(() => {
    mark.style.opacity = "1";
    mark.style.transform = "scale(1.06)";
  });
  await sleep(240);
  mark.style.transform = "scale(0.98)";
  await sleep(260);

  // 消す
  mark.style.opacity = "0";
  mark.style.transform = "scale(0.92)";
  await sleep(200);
  overlay.style.display = "none";
}

// ===== 321カウント（派手＋ゆっくり）=====
async function showCountdown() {
  const q = $("q");
  const choices = $("choices");
  if (!q) return;

  if (choices) choices.innerHTML = "";

  const render = (txt, color = "#ffffff") => {
    q.innerHTML = `
      <div style="
        text-align:center;
        font-size:86px;
        font-weight:900;
        letter-spacing:4px;
        color:${color};
        text-shadow:
          0 0 6px rgba(0,0,0,0.95),
          0 10px 22px rgba(0,0,0,0.95),
          0 18px 40px rgba(0,0,0,0.95);
        transform: translateY(-6px);
      ">${txt}</div>
    `;
  };

  render("3", "#FFE066");
  await sleep(1000);
  render("2", "#FFE066");
  await sleep(1000);
  render("1", "#FFE066");
  await sleep(1000);
  render("GO!", "#7CFF6B");
  await sleep(700);

  q.innerHTML = "";
}

// ===== ゲーム開始 =====
async function startGame() {
  if (playing) return;

  playing = true;
  locked = false;

  hide("startPane");
  hide("resultPane");
  show("battlePane");

  timeLeft = 30;
  score = 0;
  combo = 0;
  streak = 0;

  setText("timeLeft", timeLeft, "big");
  setText("scoreNow", score, "big");
  setText("comboNow", combo, "big");
  setText("streak", streak);
  setText("effect", "");
  setText("result", "");

  await showCountdown();
  await loadQuestion();

  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft, timeLeft <= 5 ? "danger big" : "big");
    if (timeLeft <= 0) endGame();
  }, 1000);
}

// ===== 終了 =====
function endGame() {
  clearInterval(timer);
  playing = false;
  locked = false;

  hide("battlePane");
  show("resultPane");

  const summary = $("resultSummary");
  if (summary) {
    summary.innerHTML = `
      <div style="text-align:center;font-size:26px;font-weight:900;">🎉 終了！</div>
      <div style="text-align:center;margin-top:10px;">スコア：<b style="font-size:22px;">${score}</b> 点</div>
      <div style="text-align:center;margin-top:6px;">最大COMBO：<b style="font-size:18px;">${combo}</b></div>
    `;
  }
}

// ===== 問題読み込み =====
async function loadQuestion() {
  if (!playing) return;

  const q = await api.fetchLatestQuestion();
  currentQuestion = q;

  const qBox = $("q");
  const cBox = $("choices");
  if (!qBox || !cBox) return;

  qBox.innerHTML = `<h3 style="margin:0 0 8px;">${q.word}</h3><div>${q.prompt}</div>`;
  cBox.innerHTML = "";

  const list = [
    ["A", q.choice_a],
    ["B", q.choice_b],
    ["C", q.choice_c],
    ["D", q.choice_d],
  ];

  list.forEach(([k, txt]) => {
    const b = document.createElement("button");
    b.textContent = `${k}: ${txt}`;
    b.onclick = () => answer(k);
    cBox.appendChild(b);
  });
}

// ===== 回答 =====
async function answer(chosen) {
  if (!currentQuestion || !playing) return;
  if (locked) return; // 連打防止
  locked = true;

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r) {
    locked = false;
    return;
  }

  // --- コンボ倍率（例：1→1.0倍、2→1.1倍、3→1.2倍… 最大2.0倍）---
  const mult = Math.min(2.0, 1.0 + combo * 0.1);

  if (r.is_correct) {
    streak += 1;
    combo += 1;

    // points * 倍率で加点（小数は切り捨て）
    const add = Math.floor((r.points ?? 10) * mult);
    score += add;

    setText("effect", `🎉 正解！ +${add}点（x${mult.toFixed(1)}）`, "ok");
    await flashJudge(true);
  } else {
    streak = 0;
    combo = 0;
    setText("effect", "💥 不正解…", "ng");
    await flashJudge(false);
  }

  setText("scoreNow", score, "big");
  setText("comboNow", combo, "big");
  setText("streak", streak);

  // 次の問題へ（結果をちょい見せてから）
  await sleep(650);
  setText("effect", "");

  locked = false;
  await loadQuestion();
}

// ===== グローバル公開（main.js から呼ばれる）=====
window.startGame = startGame;
window.endGame = endGame;
