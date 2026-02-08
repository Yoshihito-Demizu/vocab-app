// js/quiz.js
console.log("[quiz] loaded! (audio fixed)");

// ===== 状態 =====
let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let streak = 0;
let currentQuestion = null;
let playing = false;

// ===== HTML Audio（mp3用：リザルト曲など）=====
let htmlAudio = null;

function playHtmlLoop(src, volume = 0.5) {
  stopHtmlAudio();
  htmlAudio = new Audio(src);
  htmlAudio.loop = true;
  htmlAudio.volume = volume;
  htmlAudio.play().catch(() => {});
}

function stopHtmlAudio() {
  if (htmlAudio) {
    htmlAudio.pause();
    htmlAudio.currentTime = 0;
    htmlAudio = null;
  }
}

// ===== DOM =====
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.remove("hidden"); }
function hide(id) { $(id)?.classList.add("hidden"); }
function setText(id, text, cls = "") {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = text;
}

// =====================
// 🔊 WebAudio（スマホ対応：効果音 + チップBGM）
// =====================
let AC = null;
let master = null;

let chipTimer = null;        // setInterval for chiptune
let currentChipTier = null;  // "low"|"mid"|"high"|"result"

function ensureAudio() {
  if (AC) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = 0.25;
  master.connect(AC.destination);
  console.log("[audio] created");
}

async function unlockAudio() {
  ensureAudio();
  if (AC.state !== "running") {
    await AC.resume();
    console.log("[audio] resumed:", AC.state);
  }
}

// ---- beep helper ----
function beep({ freq = 440, dur = 0.12, type = "sine", gain = 0.2 }) {
  if (!AC || !master) return;
  const o = AC.createOscillator();
  const g = AC.createGain();

  o.type = type;
  o.frequency.value = freq;

  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(gain, AC.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);

  o.connect(g);
  g.connect(master);

  o.start();
  o.stop(AC.currentTime + dur + 0.02);
}

// ---- SFX ----
function sfxCorrect() {
  beep({ freq: 880, dur: 0.08, type: "square", gain: 0.20 });
  setTimeout(() => beep({ freq: 1175, dur: 0.10, type: "square", gain: 0.18 }), 90);
}
function sfxWrong() {
  beep({ freq: 160, dur: 0.22, type: "sawtooth", gain: 0.25 });
}
function sfxCount(n) {
  const f = n === 3 ? 440 : n === 2 ? 523 : 659;
  beep({ freq: f, dur: 0.12, type: "square", gain: 0.18 });
}
function sfxGo() {
  beep({ freq: 988, dur: 0.10, type: "square", gain: 0.22 });
  setTimeout(() => beep({ freq: 1319, dur: 0.12, type: "square", gain: 0.20 }), 80);
}

// ---- Chiptune BGM ----
function stopChipBGM() {
  if (chipTimer) {
    clearInterval(chipTimer);
    chipTimer = null;
  }
  currentChipTier = null;
}

function startChipBGM(tier) {
  ensureAudio();
  if (currentChipTier === tier) return;

  stopChipBGM();
  currentChipTier = tier;

  const patterns = {
    low:    { bpm: 140, seq: [659, 523, 587, 523, 494, 440, 494, 523] },
    mid:    { bpm: 160, seq: [784, 659, 698, 659, 587, 523, 587, 659] },
    high:   { bpm: 180, seq: [988, 784, 880, 784, 698, 659, 698, 784] },
    result: { bpm: 120, seq: [523, 659, 784, 659, 523, 494, 523, 659] },
  };

  const p = patterns[tier] || patterns.low;
  const stepMs = Math.floor(60000 / p.bpm / 2);
  let i = 0;

  chipTimer = setInterval(() => {
    beep({ freq: p.seq[i % p.seq.length], dur: 0.07, type: "square", gain: 0.08 });
    i++;
  }, stepMs);

  console.log("[chipBGM] start:", tier);
}

function updateBgmByScore() {
  if (!playing) return;
  if (score >= 120) startChipBGM("high");
  else if (score >= 60) startChipBGM("mid");
  else startChipBGM("low");
}

// =====================
// 321カウント（派手＆ゆっくり）
// =====================
async function showCountdownThenStart() {
  const q = $("q");
  const choices = $("choices");
  if (!q || !choices) return;

  choices.innerHTML = "";

  const showBig = (txt, color = "#fff") => {
    q.innerHTML = `
      <div style="
        font-size:72px;font-weight:900;text-align:center;
        color:${color};
        text-shadow:0 8px 30px rgba(0,0,0,.6);
      ">${txt}</div>`;
  };

  showBig("3"); sfxCount(3); await new Promise(r => setTimeout(r, 900));
  showBig("2"); sfxCount(2); await new Promise(r => setTimeout(r, 900));
  showBig("1"); sfxCount(1); await new Promise(r => setTimeout(r, 900));
  showBig("GO!!", "#0a7"); sfxGo(); await new Promise(r => setTimeout(r, 700));

  q.innerHTML = "";
}

// =====================
// ゲーム開始/終了
// =====================
async function startGame() {
  // ★再スタート時に残骸を全部止める（これが超大事）
  if (timer) { clearInterval(timer); timer = null; }
  stopHtmlAudio();   // ← result.mp3 を止める
  stopChipBGM();     // ← チップBGMを止める

  await unlockAudio(); // スマホ解錠

  if (playing) return;
  playing = true;

  hide("startPane");
  hide("resultPane");
  show("battlePane");

  timeLeft = 30;
  score = 0;
  combo = 0;
  streak = 0;

  setText("timeLeft", timeLeft);
  setText("scoreNow", score);
  setText("comboNow", combo);
  setText("streak", streak);
  setText("effect", "");
  setText("result", "");

  startChipBGM("low");

  await showCountdownThenStart();
  await loadQuestion();

  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft, timeLeft <= 5 ? "danger big" : "big");
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  if (timer) { clearInterval(timer); timer = null; }
  playing = false;

  // BGM切り替え
  stopChipBGM();
  playHtmlLoop("./sounds/result.mp3", 0.5);

  hide("battlePane");
  show("resultPane");

  const rs = $("resultSummary");
  if (rs) {
    rs.innerHTML = `
      <div style="text-align:center;font-size:28px;font-weight:900;">🎉 終了！</div>
      <div style="text-align:center;margin-top:6px;">スコア：<b style="font-size:22px;">${score}</b> 点</div>
      <div style="text-align:center;margin-top:6px;">最大COMBO：<b style="font-size:22px;">${combo}</b></div>
    `;
  }
}

// =====================
// 問題読み込み / 回答
// =====================
async function loadQuestion() {
  const q = await api.fetchLatestQuestion();
  currentQuestion = q;

  $("q").innerHTML = `<h3>${q.word}</h3><div>${q.prompt}</div>`;

  const box = $("choices");
  box.innerHTML = "";

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
    box.appendChild(b);
  });
}

async function answer(chosen) {
  if (!currentQuestion || !playing) return;

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r) return;

  const eff = $("effect");

 if (r.is_correct) {
  // ✅ コンボで増幅（上限つき）
  score += r.points + Math.min(combo, 20);
  combo += 1;
  streak += 1;

  if (eff) {
    // 画面中央にドーン（⭕ + 光 + ぷるん）
    eff.innerHTML = `⭕`;
    eff.className = "fx fx-ok fx-pop";

    // ちょい遅れてもう1回ポップ（気持ちよさ）
    setTimeout(() => {
      if (!playing) return;
      eff.classList.remove("fx-pop");
      void eff.offsetWidth; // reflow
      eff.classList.add("fx-pop2");
    }, 140);
  }

  // 背景フラッシュ
  document.body.classList.add("bg-flash-ok");
  setTimeout(() => document.body.classList.remove("bg-flash-ok"), 120);

  sfxCorrect();
} else {
  combo = 0;
  streak = 0;

  if (eff) {
    // 画面中央にドーン（❌ + 揺れ + 影）
    eff.innerHTML = `❌`;
    eff.className = "fx fx-ng fx-shake";
  }

  // 背景フラッシュ
  document.body.classList.add("bg-flash-ng");
  setTimeout(() => document.body.classList.remove("bg-flash-ng"), 140);

  sfxWrong();
}

setText("scoreNow", score);
setText("comboNow", combo);
setText("streak", streak);

updateBgmByScore();

// ✅ しばらく見せてから次へ
setTimeout(() => {
  if (eff) { eff.className = "fx"; eff.innerHTML = ""; }
  loadQuestion();
}, 720);


  setText("scoreNow", score);
  setText("comboNow", combo);
  setText("streak", streak);

  updateBgmByScore();

  setTimeout(() => {
    if (eff) { eff.textContent = ""; eff.className = "effect"; }
    loadQuestion();
  }, 650);
}

// ===== グローバル =====
window.startGame = startGame;
window.endGame = endGame;

