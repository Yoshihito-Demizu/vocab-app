// js/quiz.js
/* global api */

console.log("[quiz] loaded! (SFX + flashy countdown + result BGM + combo FX + score-tier BGM)");

/* =====================
   状態
===================== */
let timer = null;
let timeLeft = 30;

let score = 0;
let combo = 0;
let streak = 0;
let maxCombo = 0;

let currentQuestion = null;
let playing = false;
let locked = false; // 連打防止

/* =====================
   DOM便利
===================== */
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.remove("hidden"); }
function hide(id) { $(id)?.classList.add("hidden"); }

function setText(id, text, cls = "") {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = text;
}

/* =====================
   ① 音（WebAudio）
===================== */
let AC = null;
let master = null;

let bgmTimer = null;
let bgmStep = 0;
let currentBgmTier = -1;

let resultBgmTimer = null;
let resultBgmStep = 0;

const AUDIO = {
  enabled: true,
  masterVol: 0.25,
  bgmVol: 0.18,
  sfxVol: 0.35,
};

function ensureAudio() {
  if (!AUDIO.enabled) return;
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = AUDIO.masterVol;
    master.connect(AC.destination);
  }
  if (AC.state === "suspended") AC.resume();
}

function tone(freq, durMs, type = "square", vol = 0.2, when = 0) {
  if (!AC || !master) return;
  const t0 = AC.currentTime + when;

  const o = AC.createOscillator();
  const g = AC.createGain();

  o.type = type;
  o.frequency.setValueAtTime(freq, t0);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);

  o.connect(g);
  g.connect(master);

  o.start(t0);
  o.stop(t0 + durMs / 1000 + 0.02);
}

function chord(freqs, durMs, type = "square", vol = 0.12, when = 0) {
  freqs.forEach((f, i) => tone(f, durMs, type, vol, when + i * 0.002));
}

// --- SFX ---
function sfxCorrect() {
  tone(880, 110, "square", AUDIO.sfxVol);
  tone(1175, 140, "square", AUDIO.sfxVol * 0.9, 0.08);
}

function sfxWrong() {
  tone(120, 220, "sawtooth", AUDIO.sfxVol * 0.9);
  tone(90, 260, "sawtooth", AUDIO.sfxVol * 0.7, 0.03);
}

function sfxTick() { tone(520, 70, "square", AUDIO.sfxVol * 0.55); }
function sfxGo() { chord([659, 784, 988], 180, "square", AUDIO.sfxVol * 0.6); }
function sfxEnd() { chord([523, 659, 784], 220, "triangle", AUDIO.sfxVol * 0.55); }

/* =====================
   ② BGM（スコア帯で切替）
   tier 0: 普通
   tier 1: 熱い
   tier 2: 覚醒（もっと密度）
===================== */
function stopBGM() {
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
  bgmStep = 0;
  currentBgmTier = -1;
}

function stopResultBGM() {
  if (resultBgmTimer) clearInterval(resultBgmTimer);
  resultBgmTimer = null;
  resultBgmStep = 0;
}

const BGM_SEQS = [
  // tier 0
  {
    interval: 150,
    seq: [
      [659, 140], [784, 140], [880, 140], [784, 140],
      [698, 140], [784, 140], [988, 140], [784, 140],
      [659, 140], [784, 140], [880, 140], [1047, 140],
      [988, 140], [784, 140], [698, 140], [784, 140],
    ]
  },
  // tier 1（リズム増し）
  {
    interval: 140,
    seq: [
      [659, 120], [784, 120], [880, 120], [988, 120],
      [784, 120], [698, 120], [784, 120], [880, 120],
      [988, 120], [1047, 120], [988, 120], [880, 120],
      [784, 120], [698, 120], [659, 120], [784, 120],
    ]
  },
  // tier 2（覚醒：刻み細かい＋副旋律っぽい）
  {
    interval: 120,
    seq: [
      [784, 100], [880, 100], [988, 100], [1047, 100],
      [988, 100], [880, 100], [784, 100], [698, 100],
      [784, 100], [880, 100], [988, 100], [1175, 100],
      [1047, 100], [988, 100], [880, 100], [784, 100],
    ]
  }
];

function startBGM(tier = 0) {
  stopResultBGM();

  // 同じtierなら何もしない（無駄に再起動しない）
  if (currentBgmTier === tier && bgmTimer) return;

  // tier変えたいなら一度止めて再開
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;

  if (!AC) return;
  currentBgmTier = tier;
  bgmStep = 0;

  const conf = BGM_SEQS[tier] || BGM_SEQS[0];

  bgmTimer = setInterval(() => {
    const [f, d] = conf.seq[bgmStep % conf.seq.length];

    // 主旋律
    tone(f, d, "square", AUDIO.bgmVol);

    // 低音（拍）
    if (bgmStep % 4 === 0) tone(f / 2, d + 40, "triangle", AUDIO.bgmVol * 0.55);

    // tier 2は副旋律（薄く）
    if (tier >= 2 && bgmStep % 2 === 0) tone(f * 1.5, d - 20, "triangle", AUDIO.bgmVol * 0.25);

    bgmStep++;
  }, conf.interval);
}

function bgmTierFromScore(s) {
  if (s >= 120) return 2;
  if (s >= 60) return 1;
  return 0;
}

function updateBgmByScore() {
  if (!playing) return;
  const tier = bgmTierFromScore(score);
  startBGM(tier);
}

// リザルトBGM（ゆっくり祝福）
function startResultBGM() {
  stopBGM();
  stopResultBGM();
  if (!AC) return;

  const seq = [
    [523, 220], [659, 220], [784, 240], [659, 220],
    [587, 220], [659, 220], [880, 260], [784, 240],
  ];

  resultBgmTimer = setInterval(() => {
    const [f, d] = seq[resultBgmStep % seq.length];
    chord([f, f * 1.25, f * 1.5], d, "triangle", AUDIO.bgmVol * 0.55);
    resultBgmStep++;
  }, 260);
}

/* =====================
   ③ 321カウント（派手＆ゆっくり）
===================== */
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function showBigFlash(text, color = "#111") {
  const q = $("q");
  if (!q) return;

  q.innerHTML = `
    <div style="
      text-align:center;
      font-weight:900;
      font-size:78px;
      letter-spacing:2px;
      color:${color};
      transform:scale(0.78);
      opacity:0;
      transition: transform 220ms ease, opacity 220ms ease, filter 220ms ease;
      text-shadow: 0 10px 0 rgba(0,0,0,0.08);
      filter: drop-shadow(0 12px 18px rgba(0,0,0,0.12));
    " id="__flash">${text}</div>
  `;

  requestAnimationFrame(() => {
    const el = document.getElementById("__flash");
    if (!el) return;
    el.style.transform = "scale(1.10)";
    el.style.opacity = "1";
    el.style.filter = "drop-shadow(0 18px 24px rgba(0,0,0,0.18))";
  });
}

async function countdown() {
  const choices = $("choices");
  if (choices) choices.innerHTML = "";

  showBigFlash("3", "#222"); sfxTick(); await wait(950);
  showBigFlash("2", "#222"); sfxTick(); await wait(950);
  showBigFlash("1", "#222"); sfxTick(); await wait(950);

  showBigFlash("GO!!", "#0a7"); sfxGo(); await wait(700);

  const q = $("q");
  if (q) q.innerHTML = "";
}

/* =====================
   ④ スコア：コンボ倍率 + 演出
===================== */
function comboMultiplier(c) {
  if (c >= 10) return 2.0;
  if (c >= 5) return 1.5;
  if (c >= 3) return 1.2;
  return 1.0;
}

// 画面フラッシュ
function screenFlash(color = "rgba(0, 255, 120, 0.20)", ms = 120) {
  const pane = $("battlePane") || document.body;
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.left = "0";
  div.style.top = "0";
  div.style.width = "100%";
  div.style.height = "100%";
  div.style.background = color;
  div.style.pointerEvents = "none";
  div.style.opacity = "0";
  div.style.transition = "opacity 80ms ease";
  div.style.zIndex = "9999";
  document.body.appendChild(div);

  requestAnimationFrame(() => { div.style.opacity = "1"; });
  setTimeout(() => { div.style.opacity = "0"; }, ms);
  setTimeout(() => { div.remove(); }, ms + 200);
}

// ぷるぷる（画面揺れ）
function shakeBattle(ms = 180) {
  const target = $("battlePane");
  if (!target) return;

  target.animate([
    { transform: "translate(0,0)" },
    { transform: "translate(-6px, 2px)" },
    { transform: "translate(6px, -2px)" },
    { transform: "translate(-4px, -2px)" },
    { transform: "translate(4px, 2px)" },
    { transform: "translate(0,0)" },
  ], { duration: ms, iterations: 1 });
}

// かんたん紙吹雪（CSS無しの簡易）
function confettiBurst(count = 18) {
  const root = document.body;
  const colors = ["#ff4d4f", "#ffa940", "#ffec3d", "#73d13d", "#36cfc9", "#597ef7", "#9254de"];

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.style.position = "fixed";
    p.style.left = (50 + (Math.random() * 20 - 10)) + "%";
    p.style.top = "40%";
    p.style.width = (6 + Math.random() * 6) + "px";
    p.style.height = (10 + Math.random() * 14) + "px";
    p.style.background = colors[i % colors.length];
    p.style.opacity = "0.95";
    p.style.borderRadius = "2px";
    p.style.zIndex = "10000";
    p.style.pointerEvents = "none";

    root.appendChild(p);

    const dx = (Math.random() * 600 - 300);
    const dy = (Math.random() * 500 + 300);
    const rot = (Math.random() * 720 - 360);

    p.animate([
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }
    ], { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2,.8,.2,1)" });

    setTimeout(() => p.remove(), 1400);
  }
}

// COMBO表示を虹っぽく（上がるほど派手）
function styleComboEffect(c) {
  const effect = $("effect");
  if (!effect) return;

  // フォントサイズを段階で
  const size =
    c >= 10 ? 96 :
    c >= 5  ? 80 :
    c >= 3  ? 70 : 56;

  effect.style.fontSize = size + "px";
  effect.style.fontWeight = "900";
  effect.style.textAlign = "center";
  effect.style.marginTop = "12px";
  effect.style.textShadow = "0 10px 0 rgba(0,0,0,0.08)";

  // combo大でグラデっぽく（CSSだけ）
  if (c >= 5) {
    effect.style.background = "linear-gradient(90deg, #ff4d4f, #ffa940, #ffec3d, #73d13d, #36cfc9, #597ef7, #9254de)";
    effect.style.webkitBackgroundClip = "text";
    effect.style.backgroundClip = "text";
    effect.style.color = "transparent";
    effect.style.filter = "drop-shadow(0 10px 14px rgba(0,0,0,0.10))";
  } else {
    effect.style.background = "";
    effect.style.webkitBackgroundClip = "";
    effect.style.backgroundClip = "";
    effect.style.color = "";
    effect.style.filter = "";
  }
}

/* =====================
   ⑤ ゲーム開始/終了
===================== */
async function startGame() {
  ensureAudio(); // クリック直後に音が鳴るように

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
  maxCombo = 0;

  setText("timeLeft", timeLeft, "big");
  setText("scoreNow", score, "big");
  setText("comboNow", combo, "big");
  setText("streak", streak);
  setText("effect", "");
  setText("result", "");

  await countdown();

  startBGM(0);

  await loadQuestion();

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft, timeLeft <= 5 ? "danger big" : "big");
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  if (!playing) return;

  playing = false;
  locked = true;

  if (timer) clearInterval(timer);
  timer = null;

  stopBGM();
  sfxEnd();
  startResultBGM();

  hide("battlePane");
  show("resultPane");

  const summary = $("resultSummary");
  if (summary) {
    summary.innerHTML = `
      <div style="text-align:center;font-size:34px;font-weight:900;">🎊 リザルト 🎊</div>
      <div style="text-align:center;margin-top:10px;font-size:22px;">
        スコア：<span style="font-weight:900;font-size:30px;">${score}</span> 点
      </div>
      <div style="text-align:center;margin-top:6px;font-size:18px;">
        最大COMBO：<b>${maxCombo}</b>
      </div>
      <div style="text-align:center;margin-top:8px;font-weight:800;">
        ${score >= 120 ? "🔥 覚醒！" : score >= 60 ? "✨ ノッてきた！" : "🌱 まずは慣れよう"}
      </div>
      <div style="text-align:center;margin-top:6px;" class="muted">
        もう一回で記録更新しよう
      </div>
    `;
  }

  // リザルトも少し派手に（紙吹雪）
  confettiBurst(28);
}

/* =====================
   ⑥ 問題表示
===================== */
async function loadQuestion() {
  if (!playing) return;

  const q = await api.fetchLatestQuestion();
  currentQuestion = q;

  const qEl = $("q");
  const choicesEl = $("choices");
  if (!qEl || !choicesEl) return;

  qEl.innerHTML = `<h3>${q.word}</h3><div>${q.prompt}</div>`;
  choicesEl.innerHTML = "";

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
    choicesEl.appendChild(b);
  });
}

/* =====================
   ⑦ 回答（○×ドーン + ピンポン/ブー + 自動次へ）
===================== */
async function answer(chosen) {
  if (!currentQuestion || !playing) return;
  if (locked) return;

  locked = true;

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r) {
    setText("result", "送信失敗: 戻りが空", "ng");
    locked = false;
    return;
  }

  const effect = $("effect");

  if (r.is_correct) {
    combo += 1;
    streak += 1;
    maxCombo = Math.max(maxCombo, combo);

    const mul = comboMultiplier(combo);
    const gain = Math.floor(r.points * mul);
    score += gain;

    // ✅スコア帯BGM更新
    updateBgmByScore();

    // ✅演出：combo上がるほど派手
    sfxCorrect();
    styleComboEffect(combo);

    if (effect) effect.textContent = "⭕";
    setText("result", `+${gain}点  (COMBO ${combo} / x${mul})`, "ok");

    // 演出の段階
    if (combo >= 3) screenFlash("rgba(0, 255, 120, 0.18)", 110);
    if (combo >= 5) { screenFlash("rgba(120, 255, 220, 0.22)", 140); shakeBattle(180); }
    if (combo >= 10) { confettiBurst(22); shakeBattle(240); }

  } else {
    combo = 0;
    streak = 0;

    sfxWrong();

    // 不正解フラッシュ
    screenFlash("rgba(255, 60, 60, 0.18)", 130);
    shakeBattle(180);

    if (effect) {
      effect.style.fontSize = "70px";
      effect.style.fontWeight = "900";
      effect.style.textAlign = "center";
      effect.style.marginTop = "12px";
      effect.style.textShadow = "0 10px 0 rgba(0,0,0,0.08)";
      effect.style.color = "";
      effect.style.background = "";
      effect.style.webkitBackgroundClip = "";
      effect.style.backgroundClip = "";
      effect.style.filter = "";
      effect.textContent = "❌";
    }
    setText("result", `0点  (COMBO リセット)`, "ng");
  }

  setText("scoreNow", score, "big");
  setText("comboNow", combo, "big");
  setText("streak", streak);

  // 0.9秒見せて次へ
  setTimeout(async () => {
    setText("effect", "");
    setText("result", "");
    locked = false;
    await loadQuestion();
  }, 900);
}

/* =====================
   グローバル（main.jsが呼ぶ）
===================== */
window.startGame = startGame;
window.endGame = endGame;
