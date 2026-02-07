// js/quiz.js
/* global api */

console.log("[quiz] loaded! (SFX+BGM+countdown+big OX+auto-next)");

"use strict";

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

// =====================
// Audio（WebAudio）
// =====================
let AC = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let musicOn = false;

function audioReady() {
  return !!(AC && master && musicGain && sfxGain);
}

function initAudio() {
  // ★必ず「ユーザー操作（STARTボタン）」の中で呼ぶ
  if (audioReady()) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    console.warn("[audio] AudioContext not supported");
    return;
  }

  AC = new Ctx();

  master = AC.createGain();
  master.gain.value = 0.85;
  master.connect(AC.destination);

  musicGain = AC.createGain();
  musicGain.gain.value = 0.22; // BGM音量
  musicGain.connect(master);

  sfxGain = AC.createGain();
  sfxGain.gain.value = 0.9; // 効果音音量
  sfxGain.connect(master);

  console.log("[audio] initialized", AC.sampleRate);
}

async function resumeAudioIfNeeded() {
  if (!AC) return;
  if (AC.state === "suspended") {
    try { await AC.resume(); } catch (e) { /* ignore */ }
  }
}

function stopAllMusic() {
  musicOn = false;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
}

function oscBeep({ freq=440, dur=0.12, type="sine", gain=0.5, to="sfx", slideTo=null }) {
  if (!audioReady()) return;
  const g = AC.createGain();
  const o = AC.createOscillator();

  o.type = type;
  o.frequency.setValueAtTime(freq, AC.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, AC.currentTime + dur);

  // エンベロープ
  g.gain.setValueAtTime(0.0001, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, AC.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);

  o.connect(g);
  g.connect(to === "music" ? musicGain : sfxGain);

  o.start();
  o.stop(AC.currentTime + dur + 0.02);
}

function noiseBoom({ dur=0.22, gain=0.55 }) {
  if (!audioReady()) return;

  const bufferSize = Math.floor(AC.sampleRate * dur);
  const buffer = AC.createBuffer(1, bufferSize, AC.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

  const src = AC.createBufferSource();
  src.buffer = buffer;

  const filter = AC.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(180, AC.currentTime);

  const g = AC.createGain();
  g.gain.setValueAtTime(gain, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);

  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);

  src.start();
  src.stop(AC.currentTime + dur + 0.02);
}

function sfxCountTick(n) {
  // 3,2,1 の「ピッ」
  const base = n === 3 ? 880 : n === 2 ? 990 : 1100;
  oscBeep({ freq: base, dur: 0.09, type: "square", gain: 0.35, to: "sfx" });
}
function sfxGo() {
  // GO の「ピロリン」
  oscBeep({ freq: 880, dur: 0.08, type: "triangle", gain: 0.35, to: "sfx", slideTo: 1320 });
  oscBeep({ freq: 1320, dur: 0.12, type: "triangle", gain: 0.35, to: "sfx", slideTo: 1760 });
}
function sfxCorrect() {
  // ピンポン（2音）
  oscBeep({ freq: 1175, dur: 0.09, type: "sine", gain: 0.6, to: "sfx" });
  setTimeout(() => oscBeep({ freq: 1568, dur: 0.12, type: "sine", gain: 0.55, to: "sfx" }), 90);
}
function sfxWrong() {
  // ブー（低い音＋ノイズ）
  oscBeep({ freq: 110, dur: 0.25, type: "sawtooth", gain: 0.35, to: "sfx", slideTo: 80 });
  noiseBoom({ dur: 0.18, gain: 0.25 });
}
function sfxResult() {
  // リザルトの短いジングル
  oscBeep({ freq: 784, dur: 0.10, type: "triangle", gain: 0.4, to: "sfx" });
  setTimeout(() => oscBeep({ freq: 988, dur: 0.12, type: "triangle", gain: 0.42, to: "sfx" }), 110);
  setTimeout(() => oscBeep({ freq: 1319, dur: 0.18, type: "triangle", gain: 0.45, to: "sfx" }), 240);
}

// --- テトリス“っぽい”簡易ループ（著作権曲そのものではない）---
const MUSIC = {
  // D minor-ish の短いループ
  battle: [
    { f: 587, ms: 180 }, { f: 659, ms: 180 }, { f: 698, ms: 180 }, { f: 659, ms: 180 },
    { f: 587, ms: 180 }, { f: 523, ms: 180 }, { f: 494, ms: 180 }, { f: 523, ms: 180 },
    { f: 587, ms: 180 }, { f: 659, ms: 180 }, { f: 784, ms: 220 }, { f: 698, ms: 160 },
    { f: 659, ms: 180 }, { f: 587, ms: 180 }, { f: 523, ms: 200 }, { f: 494, ms: 200 },
  ],
  result: [
    { f: 784, ms: 160 }, { f: 988, ms: 160 }, { f: 1175, ms: 220 }, { f: 1568, ms: 360 },
    { f: 1175, ms: 220 }, { f: 988, ms: 220 },
  ],
};

function playMusicLoop(seq, { type="square", vol=0.22, gap=20 } = {}) {
  if (!audioReady()) return;
  stopAllMusic();
  musicOn = true;
  musicGain.gain.value = vol;

  let i = 0;
  const tick = () => {
    if (!musicOn) return;
    const n = seq[i % seq.length];
    // 短い音＋ちょいパーカッシブ
    oscBeep({ freq: n.f, dur: Math.max(0.06, n.ms / 1000), type, gain: 0.20, to: "music" });
    i++;
    musicTimer = setTimeout(tick, n.ms + gap);
  };
  tick();
}

// =====================
// 画面中央「〇×」オーバーレイ
// =====================
function ensureOverlay() {
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
      font-size: 128px;
      font-weight: 900;
      padding: 24px 34px;
      border-radius: 28px;
      background: rgba(0,0,0,0.55);
      color: #fff;
      text-shadow:
        0 0 6px rgba(0,0,0,0.95),
        0 10px 22px rgba(0,0,0,0.95),
        0 18px 40px rgba(0,0,0,0.95);
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

  requestAnimationFrame(() => {
    mark.style.opacity = "1";
    mark.style.transform = "scale(1.08)";
  });
  await sleep(240);
  mark.style.transform = "scale(0.98)";
  await sleep(260);

  mark.style.opacity = "0";
  mark.style.transform = "scale(0.92)";
  await sleep(200);
  overlay.style.display = "none";
}

// =====================
// 321カウント（派手＋ゆっくり）
// =====================
async function showCountdown() {
  const q = $("q");
  const choices = $("choices");
  if (!q) return;
  if (choices) choices.innerHTML = "";

  const render = (txt, color) => {
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

  render("3", "#FFE066"); sfxCountTick(3); await sleep(1000);
  render("2", "#FFE066"); sfxCountTick(2); await sleep(1000);
  render("1", "#FFE066"); sfxCountTick(1); await sleep(1000);
  render("GO!", "#7CFF6B"); sfxGo(); await sleep(750);

  q.innerHTML = "";
}

// =====================
// ゲーム本体
// =====================
async function startGame() {
  // ★ここが超重要：ユーザー操作の中で audio 初期化&resume
  initAudio();
  await resumeAudioIfNeeded();

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

  // BGM開始（バトル）
  playMusicLoop(MUSIC.battle, { type: "square", vol: 0.22, gap: 18 });

  await showCountdown();
  await loadQuestion();

  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft, timeLeft <= 5 ? "danger big" : "big");
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  clearInterval(timer);
  playing = false;
  locked = false;

  // BGM停止 → リザルト音
  stopAllMusic();
  sfxResult();
  // ちょい後に結果用BGM（短いループ）
  setTimeout(() => playMusicLoop(MUSIC.result, { type: "triangle", vol: 0.18, gap: 40 }), 250);

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

async function answer(chosen) {
  if (!currentQuestion || !playing) return;
  if (locked) return;
  locked = true;

  // iOS/Android対策：クリックしたら毎回resumeしておくと安定
  await resumeAudioIfNeeded();

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r) {
    locked = false;
    return;
  }

  // コンボ倍率（最大2.0倍）
  const mult = Math.min(2.0, 1.0 + combo * 0.1);

  if (r.is_correct) {
    streak += 1;
    combo += 1;

    const add = Math.floor((r.points ?? 10) * mult);
    score += add;

    sfxCorrect();
    setText("effect", `🎉 正解！ +${add}点（x${mult.toFixed(1)}）`, "ok");
    await flashJudge(true);
  } else {
    streak = 0;
    combo = 0;

    sfxWrong();
    setText("effect", "💥 不正解…", "ng");
    await flashJudge(false);
  }

  setText("scoreNow", score, "big");
  setText("comboNow", combo, "big");
  setText("streak", streak);

  await sleep(650);
  setText("effect", "");

  locked = false;
  await loadQuestion();
}

// ===== リトライ時：結果BGM止めてから再開 =====
async function retryGame() {
  stopAllMusic();
  await startGame();
}

// ===== グローバル公開（main.js から呼ばれる）=====
window.startGame = startGame;
window.endGame = endGame;
// main.js が retryBtn→startGame のままでも動くけど、置き換えたいなら使える
window.retryGame = retryGame;

// iOSで「一回押さないと音が鳴らない」を少しでも減らす（タップで初期化）
document.addEventListener("pointerdown", () => {
  // まだ初期化してなければ準備だけしておく（ただし実際の再生はstartGameで）
  if (!audioReady()) initAudio();
}, { once: true });
