// docs/js/quiz.js
console.log("[quiz] loaded! (flow+overlay+auth-safe)");

/* global api */

let timer = null;
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentQuestion = null;
let playing = false;

// ✅ 秒数は config.js に集約
const TIME_LIMIT = window.APP_CONFIG?.GAME?.TIME_LIMIT ?? 30;
let timeLeft = TIME_LIMIT;

function q$(id) { return document.getElementById(id); }
function show(id) { q$(id)?.classList.remove("hidden"); }
function hide(id) { q$(id)?.classList.add("hidden"); }
function setText(id, v) { const el = q$(id); if (el) el.textContent = String(v); }

// ===== Audio =====
let AC = null, master = null, bgmTimer = null, bgmTier = null;

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
function beep({ freq = 440, dur = 0.12, type = "square", gain = 0.12 }) {
  if (!AC || !master) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(gain, AC.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(AC.currentTime + dur + 0.02);
}
function sfxCount(n) { beep({ freq: n === 3 ? 440 : n === 2 ? 523 : 659, dur: 0.12, gain: 0.16 }); }
function sfxGo() { beep({ freq: 988, dur: 0.10, gain: 0.18 }); setTimeout(() => beep({ freq: 1319, dur: 0.12, gain: 0.16 }), 90); }
function sfxCorrect() { beep({ freq: 880, dur: 0.08, gain: 0.18 }); setTimeout(() => beep({ freq: 1175, dur: 0.10, gain: 0.16 }), 90); }
function sfxWrong() { beep({ freq: 160, dur: 0.22, type: "sawtooth", gain: 0.22 }); }

function stopBGM() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  bgmTier = null;
}
function startBGM(tier) {
  ensureAudio();
  if (bgmTier === tier) return;
  stopBGM();
  bgmTier = tier;

  const patterns = {
    low: { bpm: 140, seq: [659, 523, 587, 523, 494, 440, 494, 523] },
    mid: { bpm: 160, seq: [784, 659, 698, 659, 587, 523, 587, 659] },
    high: { bpm: 180, seq: [988, 784, 880, 784, 698, 659, 698, 784] },
    result: { bpm: 120, seq: [523, 659, 784, 659, 523, 494, 523, 659] }
  };
  const p = patterns[tier] || patterns.low;
  const stepMs = Math.floor(60000 / p.bpm / 2);
  let i = 0;

  bgmTimer = setInterval(() => {
    beep({ freq: p.seq[i % p.seq.length], dur: 0.07, gain: 0.07 });
    i++;
  }, stepMs);
}
function updateBgmByScore() {
  if (!playing) return;
  if (score >= 120) startBGM("high");
  else if (score >= 60) startBGM("mid");
  else startBGM("low");
}

// ===== Overlay =====
function overlayShow(text, kind = "") {
  const ov = q$("overlay");
  const panel = ov?.querySelector(".panel");
  if (!ov || !panel) return;
  panel.textContent = String(text ?? "");
  panel.className = "panel" + (kind ? " " + kind : "");
  ov.classList.remove("hidden");
}
function overlayHide() { q$("overlay")?.classList.add("hidden"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function flashyCountdown() {
  overlayShow("3", "count"); sfxCount(3); await sleep(900);
  overlayShow("2", "count"); sfxCount(2); await sleep(900);
  overlayShow("1", "count"); sfxCount(1); await sleep(900);
  overlayShow("GO!", "go"); sfxGo(); await sleep(700);
  overlayHide();
}

// ===== Question =====
async function loadQuestion() {
  const q = await api.fetchLatestQuestion();
  if (!q) throw new Error("問題が見つかりません（questions が空 / is_active=false など）");
  currentQuestion = q;

  const qBox = q$("q");
  const cBox = q$("choices");
  if (!qBox || !cBox) return;

  qBox.innerHTML = `<h3>${q.word}</h3><div class="prompt">${q.prompt}</div>`;
  cBox.innerHTML = "";

  [
    ["A", q.choice_a],
    ["B", q.choice_b],
    ["C", q.choice_c],
    ["D", q.choice_d],
  ].forEach(([k, txt]) => {
    const b = document.createElement("button");
    b.textContent = `${k}: ${txt}`;
    b.addEventListener("click", () => answer(k), { passive: true });
    cBox.appendChild(b);
  });
}

let lock = false;

async function answer(chosen) {
  if (!playing || !currentQuestion || lock) return;
  lock = true;
  console.log("[answer] chosen=", chosen);

  try {
    const rows = await api.submitAttempt(currentQuestion.id, chosen);
    const r = rows?.[0];
    if (!r) throw new Error("submitAttempt の返り値が空です");

    if (r.is_correct) {
      score += Number(r.points || 0) + Math.min(combo, 20);
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
  } catch (e) {
    console.warn("[answer] failed raw:", e);
    const msg = e?.message || "送信に失敗しました。";
    console.log("[answer] failed json:", JSON.stringify({ message: msg }, null, 2));

    // ✅ 未ログインなどは「安全に止める」
    overlayShow(msg, "warn");
    await sleep(1100);
    overlayHide();
    endGame(true); // force back to start
  } finally {
    lock = false;
  }
}

// ===== Game =====
async function startGame() {
  await unlockAudio();

  // ✅ 本番モードは「ログインしてないと開始しない」
  if (!api.isMock()) {
    const uid = await api.getMyUserId();
    if (!uid) {
      overlayShow("未ログインです。\n先にログインしてね", "warn");
      await sleep(1100);
      overlayHide();
      return;
    }
  }

  if (playing) return;
  playing = true;

  // 念のため：前回のタイマーを確実に止める
  clearInterval(timer);
  timer = null;

  hide("startPane");
  hide("resultPane");
  show("battlePane");

  timeLeft = TIME_LIMIT;
  score = 0;
  combo = 0;
  maxCombo = 0;

  setText("timeLeft", timeLeft);
  setText("scoreNow", score);
  setText("comboNow", combo);

  stopBGM();
  startBGM("low");

  await flashyCountdown();
  await loadQuestion();

  timer = setInterval(() => {
    timeLeft--;
    setText("timeLeft", timeLeft);
    if (timeLeft <= 0) endGame(false);
  }, 1000);
}

function endGame(forceToStart) {
  playing = false;

  clearInterval(timer);
  timer = null;

  stopBGM();

  hide("battlePane");

  // ✅ forceToStart（送信失敗等）なら結果画面に行かず、音も鳴らさない
  if (forceToStart) {
    show("startPane");
    hide("resultPane");
    return;
  }

  show("resultPane");
  setText("finalScore", score);
  setText("finalCombo", maxCombo);

  // ✅ 結果BGMは「短時間だけ」鳴らして自動停止（鳴り続け事故防止）
  startBGM("result");
  setTimeout(() => { if (!playing) stopBGM(); }, 3000);
}

window.startGame = startGame;
window.endGame = endGame;
