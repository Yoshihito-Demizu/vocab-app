// js/quiz.js
console.log("[quiz] loaded! (countdown fixed)");

// ===== 状態 =====
let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let streak = 0;
let currentQuestion = null;
let playing = false;

// ===== 便利 =====
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.remove("hidden"); }
function hide(id) { $(id)?.classList.add("hidden"); }

function setText(id, text, cls = "") {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== 321カウント（これ1本に統一） =====
async function showCountdown() {
  const q = $("q");
  const choices = $("choices");
  if (!q) return;

  // 選択肢は一旦消す（押し間違い防止）
  if (choices) choices.innerHTML = "";

  const render = (txt, color = "#fff") => {
    q.innerHTML = `
      <div style="
        text-align:center;
        font-size:72px;
        font-weight:900;
        letter-spacing:2px;
        color:${color};
        text-shadow: 0 8px 18px rgba(0,0,0,0.55);
        transform: translateY(-6px);
      ">${txt}</div>
      <div style="text-align:center;color:#fff;opacity:0.9;margin-top:6px;text-shadow:0 6px 14px rgba(0,0,0,0.45);">
        READY?
      </div>
    `;
  };

  render("3");
  await sleep(900);
  render("2");
  await sleep(900);
  render("1");
  await sleep(900);
  render("GO!", "#7CFF6B");
  await sleep(650);

  q.innerHTML = "";
}

// ===== ゲーム開始 =====
async function startGame() {
  if (playing) return;
  playing = true;

  hide("startPane");
  hide("resultPane");
  show("battlePane");

  // リセット
  clearInterval(timer);
  timeLeft = 30;
  score = 0;
  combo = 0;
  streak = 0;
  currentQuestion = null;

  setText("timeLeft", timeLeft, "big");
  setText("scoreNow", score);
  setText("comboNow", combo);
  setText("streak", streak);
  setText("effect", "");
  setText("result", "");

  // 321 → 問題表示 → タイマー開始（順番固定）
  await showCountdown();
  await loadQuestion();

  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft, timeLeft <= 5 ? "danger big" : "big");
    if (timeLeft <= 0) endGame();
  }, 1000);
}

// ===== 終了 =====
function endGame() {
  clearInterval(timer);
  timer = null;
  playing = false;

  hide("battlePane");
  show("resultPane");

  const maxCombo = combo; // 今回の仕様だと「最後のコンボ」なので、必要なら別変数で最大保持も可能
  const summary = $("resultSummary");
  if (summary) {
    summary.innerHTML = `
      <div style="text-align:center;font-size:28px;font-weight:900;">🎉 終了！</div>
      <div style="text-align:center;margin-top:8px;font-size:18px;">
        スコア：<b style="font-size:22px;">${score}</b> 点
      </div>
      <div style="text-align:center;margin-top:4px;">
        最終COMBO：<b>${maxCombo}</b>
      </div>
    `;
  }
}

// ===== 問題読み込み =====
async function loadQuestion() {
  if (!playing) return;

  const q = await api.fetchLatestQuestion();
  currentQuestion = q;

  const qBox = $("q");
  const choicesBox = $("choices");
  if (!qBox || !choicesBox) return;

  qBox.innerHTML = `<h3>${q.word}</h3><div>${q.prompt}</div>`;
  choicesBox.innerHTML = "";

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
    choicesBox.appendChild(b);
  });
}

// ===== 回答 =====
async function answer(chosen) {
  if (!currentQuestion || !playing) return;

  // 二重クリック防止
  const choicesBox = $("choices");
  if (choicesBox) {
    Array.from(choicesBox.querySelectorAll("button")).forEach(btn => (btn.disabled = true));
  }

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r) return;

  // コンボで得点増幅（例：1問10点 + コンボ×2点）
  // ※増幅の形はあとで調整しやすいようにここにまとめてる
  const base = r.is_correct ? 10 : 0;
  const bonus = r.is_correct ? Math.min(combo * 2, 40) : 0; // 上限40（暴走防止）
  const gained = base + bonus;

  if (r.is_correct) {
    score += gained;
    combo += 1;
    streak += 1;
    setText("effect", "⭕ 正解！", "ok");
  } else {
    combo = 0;
    streak = 0;
    setText("effect", "✖ 不正解…", "ng");
  }

  setText("scoreNow", score);
  setText("comboNow", combo);
  setText("streak", streak);

  // 0.8秒見せて次へ（残り時間がある時だけ）
  setTimeout(() => {
    setText("effect", "");
    if (playing && timeLeft > 0) loadQuestion();
  }, 800);
}

// ===== グローバル =====
window.startGame = startGame;
window.endGame = endGame;
