// docs/js/quiz.js
console.log("[quiz] loaded! (flow+overlay)");

/* global api */

// ===== 状態 =====
let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentQuestion = null;
let playing = false;

// ===== DOM =====
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.remove("hidden"); }
function hide(id) { $(id)?.classList.add("hidden"); }
function setText(id, v, cls) {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = String(v);
}

// ===== Audio（スマホ対応：ユーザー操作で解放）=====
let AC = null;
let master = null;
let bgmTimer = null;
let bgmTier = null;

function ensureAudio() {
  if (AC) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = 0.25;
  master.connect(AC.destination);
}
async function unlockAudio() {
  ensureAudio();
  if (AC.state !== "running") await AC.resume();
}
function beep({ freq=440, dur=0.12, type="square", gain=0.12 }) {
  if (!AC || !master) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = type;
  o.frequency.value = freq;

  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(gain, AC.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);

  o.connect(g); g.connect(master);
  o.start();
  o.stop(AC.currentTime + dur + 0.02);
}

// SFX
function sfxCount(n){
  const f = n===3?440:n===2?523:659;
  beep({ freq:f, dur:0.12, type:"square", gain:0.16 });
}
function sfxGo(){
  beep({ freq:988, dur:0.10, type:"square", gain:0.18 });
  setTimeout(()=>beep({ freq:1319, dur:0.12, type:"square", gain:0.16 }), 90);
}
function sfxCorrect(){
  beep({ freq:880, dur:0.08, type:"square", gain:0.18 });
  setTimeout(()=>beep({ freq:1175, dur:0.10, type:"square", gain:0.16 }), 90);
}
function sfxWrong(){
  beep({ freq:160, dur:0.22, type:"sawtooth", gain:0.22 });
}

// BGM（簡易チップチューン）
function stopBGM(){
  if (bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; }
  bgmTier = null;
}
function startBGM(tier){
  ensureAudio();
  if (bgmTier === tier) return;
  stopBGM();
  bgmTier = tier;

  const patterns = {
    low:  { bpm: 140, seq: [659, 523, 587, 523, 494, 440, 494, 523] },
    mid:  { bpm: 160, seq: [784, 659, 698, 659, 587, 523, 587, 659] },
    high: { bpm: 180, seq: [988, 784, 880, 784, 698, 659, 698, 784] },
    result:{ bpm: 120, seq: [523, 659, 784, 659, 523, 494, 523, 659] }
  };
  const p = patterns[tier] || patterns.low;
  const stepMs = Math.floor(60000 / p.bpm / 2);
  let i = 0;
  bgmTimer = setInterval(() => {
    beep({ freq: p.seq[i % p.seq.length], dur: 0.07, type: "square", gain: 0.07 });
    i++;
  }, stepMs);
}
function updateBgmByScore(){
  if (!playing) return;
  if (score >= 120) startBGM("high");
  else if (score >= 60) startBGM("mid");
  else startBGM("low");
}

// ===== Overlay（321 / ○×）=====
function overlayShow(text, kind = "") {
  const ov = document.getElementById("overlay");
  const panel = ov?.querySelector(".panel");
  if (!ov || !panel) return;

  // ✅ HTMLを解釈させない（タグが見える問題を潰す）
  panel.textContent = String(text ?? "");

  // ✅ classは「panel + 種類」だけ（空はOK）
  panel.className = "panel" + (kind ? " " + kind : "");

  ov.classList.remove("hidden");
}

function overlayHide() {
  const ov = document.getElementById("overlay");
  ov?.classList.add("hidden");
}

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function flashyCountdown(){
  // 3,2,1はゆっくり＆派手
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

 overlayShow("3", "count");
await wait(900);

overlayShow("2", "count");
await wait(900);

overlayShow("1", "count");
await wait(900);

overlayShow("GO!", "go");
await wait(700);

overlayHide();

}

// ===== 出題 =====
async function loadQuestion(){
  const q = await api.fetchLatestQuestion();
  currentQuestion = q;

  const qBox = $("q");
  const cBox = $("choices");
  if (!qBox || !cBox) return;

  qBox.innerHTML = `<h3>${q.word}</h3><div class="prompt">${q.prompt}</div>`;
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
let lock = false;
async function answer(chosen){
  if (!playing || !currentQuestion || lock) return;
  lock = true;

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r){ lock=false; return; }

  if (r.is_correct){
    // コンボ増幅：+ base + min(combo, 20)
    score += r.points + Math.min(combo, 20);
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);

    overlayShow("⭕", "ok");
    sfxCorrect();
  } else {
    combo = 0;
    overlayShow("❌", "ng");
    sfxWrong();
  }

  setText("scoreNow", score);
  setText("comboNow", combo);

  updateBgmByScore();

  await sleep(520);
  overlayHide();

  await loadQuestion();
  lock = false;
}

// ===== 進行（start→battle→result）=====
async function startGame(){
  // ここが「スマホで音が鳴る」ための最重要
  await unlockAudio();

  if (playing) return;
  playing = true;

  hide("startPane");
  hide("resultPane");
  show("battlePane");

  timeLeft = 30;
  score = 0;
  combo = 0;
  maxCombo = 0;

  setText("timeLeft", timeLeft);
  setText("scoreNow", score);
  setText("comboNow", combo);

  startBGM("low");

  await flashyCountdown();
  await loadQuestion();

  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft);

    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame(){
  if (!playing) return;
  playing = false;

  clearInterval(timer);
  stopBGM();
  startBGM("result");

  hide("battlePane");
  show("resultPane");

  setText("finalScore", score);
  setText("finalCombo", maxCombo);
}

// ===== グローバル公開（main.js から呼ぶ）=====
window.startGame = startGame;
window.endGame = endGame;


