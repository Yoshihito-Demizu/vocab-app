// docs/js/quiz.js
console.log("[quiz] loaded! (stable overlay+audio)");

/* global api */

// ===== 状態 =====
let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentQuestion = null;
let playing = false;
let lock = false;
let correctCount = 0;
let wrongCount = 0;


// ===== DOM =====
const $ = (id) => document.getElementById(id);
const show = (id) => $(id)?.classList.remove("hidden");
const hide = (id) => $(id)?.classList.add("hidden");
const setText = (id, v, cls) => {
  const el = $(id);
  if (!el) return;
  if (cls) el.className = cls;
  el.textContent = String(v);
};

// ===== Audio（スマホ対応：ユーザー操作で解放）=====
let AC = null, master = null;
let bgmTimer = null, bgmTier = null;

function ensureAudio(){
  if (AC) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = 0.25;
  master.connect(AC.destination);
}
async function unlockAudio(){
  ensureAudio();
  if (AC.state !== "running") await AC.resume();
}
function beep({freq=440,dur=0.12,type="square",gain=0.12}){
  if (!AC || !master) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(gain, AC.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(AC.currentTime + dur + 0.02);
}

// SFX
const sfxCount = (n)=>beep({freq:n===3?440:n===2?523:659,gain:0.16});
const sfxGo = ()=>{beep({freq:988,gain:0.18}); setTimeout(()=>beep({freq:1319,gain:0.16}),90);};
const sfxCorrect = ()=>{beep({freq:880,gain:0.18}); setTimeout(()=>beep({freq:1175,gain:0.16}),90);};
const sfxWrong = ()=>beep({freq:160,type:"sawtooth",dur:0.22,gain:0.22});

// BGM（簡易チップ）
function stopBGM(){
  if (bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; }
  bgmTier = null;
}
function startBGM(tier){
  ensureAudio();
  if (bgmTier === tier) return;
  stopBGM(); bgmTier = tier;
  const P = {
    low:{bpm:140,seq:[659,523,587,523,494,440,494,523]},
    mid:{bpm:160,seq:[784,659,698,659,587,523,587,659]},
    high:{bpm:180,seq:[988,784,880,784,698,659,698,784]},
    result:{bpm:120,seq:[523,659,784,659,523,494,523,659]}
  }[tier] || {bpm:140,seq:[659,523,587,523]};
  const step = Math.floor(60000 / P.bpm / 2);
  let i=0;
  bgmTimer = setInterval(()=>beep({freq:P.seq[i++%P.seq.length],dur:0.07,gain:0.07}), step);
}
function updateBgmByScore(){
  if (!playing) return;
  if (score>=120) startBGM("high");
  else if (score>=60) startBGM("mid");
  else startBGM("low");
}

// ===== Overlay（321 / ○×）=====
function overlayShow(text, kind=""){
  const ov = $("overlay");
  const panel = ov?.querySelector(".panel");
  if (!ov || !panel) return;
  panel.textContent = String(text ?? ""); // ← HTML解釈させない
  panel.className = "panel" + (kind ? " " + kind : "");
  ov.classList.remove("hidden");
}
const overlayHide = ()=> $("overlay")?.classList.add("hidden");

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

async function flashyCountdown(){
  overlayShow("3","count"); sfxCount(3); await sleep(900);
  overlayShow("2","count"); sfxCount(2); await sleep(900);
  overlayShow("1","count"); sfxCount(1); await sleep(900);
  overlayShow("GO!","go");  sfxGo();      await sleep(700);
  overlayHide();
}

// ===== 出題 =====
async function loadQuestion(){
  const q = await api.fetchLatestQuestion();
  currentQuestion = q;
  const qBox = $("q"), cBox = $("choices");
  if (!qBox || !cBox) return;
  qBox.innerHTML = `<h3>${q.word}</h3><div class="prompt">${q.prompt}</div>`;
  cBox.innerHTML = "";
  [["A",q.choice_a],["B",q.choice_b],["C",q.choice_c],["D",q.choice_d]]
    .forEach(([k,txt])=>{
      const b=document.createElement("button");
      b.textContent=`${k}: ${txt}`;
      b.onclick=()=>answer(k);
      cBox.appendChild(b);
    });
}

// ===== 回答 =====
async function answer(chosen){
  if (!playing || !currentQuestion || lock) return;
  lock = true;
  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r){ lock=false; return; }

  if (r.is_correct){
    score += r.points + Math.min(combo,20);
    combo++; maxCombo = Math.max(maxCombo, combo);
    correctCount += 1;

    overlayShow("⭕","ok"); sfxCorrect();
  } else {
    combo = 0;
    wrongCount += 1;

    overlayShow("❌","ng"); sfxWrong();
  }
  setText("scoreNow", score);
  setText("comboNow", combo);
  updateBgmByScore();

  await sleep(520);
  overlayHide();
  await loadQuestion();
  lock = false;
}

// ===== 進行 =====
async function startGame(){
  correctCount = 0;
　wrongCount = 0;

  await unlockAudio(); // スマホ音の鍵
  if (playing) return;
  playing = true;

  hide("startPane"); hide("resultPane"); show("battlePane");
  timeLeft=30; score=0; combo=0; maxCombo=0;
  setText("timeLeft", timeLeft);
  setText("scoreNow", score);
  setText("comboNow", combo);

  startBGM("low");
  await flashyCountdown();
  await loadQuestion();

  clearInterval(timer);
  timer = setInterval(()=>{
    timeLeft--; setText("timeLeft", timeLeft);
    if (timeLeft<=0) endGame();
  },1000);
}

function endGame(){
  if (!playing) return;
  playing = false;
  clearInterval(timer);
  stopBGM(); startBGM("result");
  hide("battlePane"); show("resultPane");
  setText("finalScore", score);
  setText("finalCombo", maxCombo);
// 30秒の結果を保存（端末内）
api.submitRun({
  score,
  correct: correctCount,
  wrong: wrongCount,
  maxCombo
}).catch(() => {});

}

// ===== 公開 =====
window.startGame = startGame;
window.endGame = endGame;

