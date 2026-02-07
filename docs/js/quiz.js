// js/quiz.js
console.log("[quiz] loaded! (audio fix)");

// ===== 状態 =====
let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let streak = 0;
let currentQuestion = null;
let playing = false;

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
// 🔊 Audio（スマホ対応）
// =====================
let AC = null;              // AudioContext
let master = null;          // master gain
let bgmTimer = null;        // setInterval for BGM loop (chiptune)
let currentBgmTier = null;  // "low"|"mid"|"high"|"result"

function ensureAudio() {
  if (AC) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = 0.25;  // 全体音量
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

  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, AC.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);

  o.connect(g);
  g.connect(master);

  o.start();
  o.stop(AC.currentTime + dur + 0.02);
}

// ---- SFX ----
function sfxCorrect() {
  // ピンポンっぽく（2音）
  beep({ freq: 880, dur: 0.08, type: "square", gain: 0.20 });
  setTimeout(() => beep({ freq: 1175, dur: 0.10, type: "square", gain: 0.18 }), 90);
}
function sfxWrong() {
  // ブーっぽく（低いノコギリ + ちょい長め）
  beep({ freq: 160, dur: 0.22, type: "sawtooth", gain: 0.25 });
}
function sfxCount(n) {
  // 3,2,1用
  const f = n === 3 ? 440 : n === 2 ? 523 : 659;
  beep({ freq: f, dur: 0.12, type: "square", gain: 0.18 });
}
function sfxGo() {
  beep({ freq: 988, dur: 0.10, type: "square", gain: 0.22 });
  setTimeout(() => beep({ freq: 1319, dur: 0.12, type: "square", gain: 0.20 }), 80);
}

// ---- BGM（簡易チップチューン：tierで変える）----
function stopBGM() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  currentBgmTier = null;
}

function startBGM(tier) {
  ensureAudio();
  if (currentBgmTier === tier) return; // 同じなら何もしない
  stopBGM();
  currentBgmTier = tier;

  // tierごとにテンポ/フレーズを変える（テトリス“風”のノリ）
  const patterns = {
    low:  { bpm: 140, seq: [659, 523, 587, 523, 494, 440, 494, 523] },
    mid:  { bpm: 160, seq: [784, 659, 698, 659, 587, 523, 587, 659] },
    high: { bpm: 180, seq: [988, 784, 880, 784, 698, 659, 698, 784] },
    result:{ bpm: 120, seq: [523, 659, 784, 659, 523, 494, 523, 659] }
  };

  const p = patterns[tier] || patterns.low;
  const stepMs = Math.floor(60000 / p.bpm / 2); // 8分
  let i = 0;

  bgmTimer = setInterval(() => {
    // 軽めに
    beep({ freq: p.seq[i % p.seq.length], dur: 0.07, type: "square", gain: 0.08 });
    i++;
  }, stepMs);

  console.log("[bgm] start:", tier);
}

function updateBgmByScore() {
  // ざっくり：スコアで段階変更（好きに調整可）
  if (!playing) return;
  if (score >= 120) startBGM("high");
  else if (score >= 60) startBGM("mid");
  else startBGM("low");
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
        transform:scale(1.0);
        ">
        ${txt}
      </div>`;
  };

  showBig("3");
  sfxCount(3);
  await new Promise(r => setTimeout(r, 900));

  showBig("2");
  sfxCount(2);
  await new Promise(r => setTimeout(r, 900));

  showBig("1");
  sfxCount(1);
  await new Promise(r => setTimeout(r, 900));

  showBig("GO!!", "#0a7");
  sfxGo();
  await new Promise(r => setTimeout(r, 700));

  q.innerHTML = "";
}

// =====================
// ゲーム開始/終了
// =====================
async function startGame() {
  // ✅ スマホはここで音を必ず解放する（最重要）
  await unlockAudio();

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

  startBGM("low");

  await showCountdownThenStart();
  await loadQuestion();

  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft, timeLeft <= 5 ? "danger big" : "big");
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  clearInterval(timer);
  timer = null;
  playing = false;

  stopBGM();
  startBGM("result");

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

  // ○×表示（でかく）
  const eff = $("effect");
  if (r.is_correct) {
    score += r.points + Math.min(combo, 20); // ✅ コンボで増幅（上限つき）
    combo += 1;
    streak += 1;
    if (eff) {
      eff.innerHTML = `<div style="font-size:64px;font-weight:900;">⭕</div>`;
      eff.className = "effect ok";
    }
    sfxCorrect();
  } else {
    combo = 0;
    streak = 0;
    if (eff) {
      eff.innerHTML = `<div style="font-size:64px;font-weight:900;">❌</div>`;
      eff.className = "effect ng";
    }
    sfxWrong();
  }

  setText("scoreNow", score);
  setText("comboNow", combo);
  setText("streak", streak);

  // ✅ スコア帯でBGM変化（PC/スマホ共通）
  updateBgmByScore();

  setTimeout(() => {
    if (eff) { eff.textContent = ""; eff.className = "effect"; }
    loadQuestion();
  }, 650);
}

// ===== グローバル =====
window.startGame = startGame;
window.endGame = endGame;
