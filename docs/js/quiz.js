// docs/js/quiz.js
console.log("[quiz] loaded! (best-score+combo-tuning)");

/* global api */

let timer = null;
let timeLeft = 60;   // ✅ 60秒
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentQuestion = null;
let playing = false;

function q$(id) { return document.getElementById(id); }
function show(id) { q$(id)?.classList.remove("hidden"); }
function hide(id) { q$(id)?.classList.add("hidden"); }
function setText(id, v) { const el = q$(id); if (el) el.textContent = String(v); }

// =====================
// ✅ スコア調整（ここだけ触ればOK）
// =====================
// ベース点（DBから返るpointsが10前提でもOK）
const BASE_POINTS = 10;

// コンボボーナス：
// - 伸びるほど加点は増える
// - でも暴れすぎないように上限を置く
// 例：combo=1→0, 5→2, 10→4, 20→7, 30→9 みたいなイメージ
const COMBO_FACTOR = 0.35;     // ← ここを上げると「差」が出やすい
const COMBO_CAP = 12;          // ← 60秒で暴れすぎ防止

function calcComboBonus(c) {
  // c=0のとき0。cが増えるほどゆるやかに増える
  // 直線より「ちょい鈍い」：sqrt
  const raw = Math.floor(Math.sqrt(Math.max(0, c)) / 1.6 + (c * COMBO_FACTOR));
  return Math.min(COMBO_CAP, Math.max(0, raw));
}

// =====================
// Audio（簡易）
// =====================
let AC = null, master = null;
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
  o.start(); o.stop(AC.currentTime + dur + 0.02);
}
function sfxCorrect(){ beep({ freq:880, dur:0.08, gain:0.18 }); setTimeout(()=>beep({ freq:1175, dur:0.10, gain:0.16 }), 90); }
function sfxWrong(){ beep({ freq:160, dur:0.22, type:"sawtooth", gain:0.22 }); }
function sfxCount(n){ beep({ freq:n===3?440:n===2?523:659, dur:0.12, gain:0.16 }); }
function sfxGo(){ beep({ freq:988, dur:0.10, gain:0.18 }); setTimeout(()=>beep({ freq:1319, dur:0.12, gain:0.16 }), 90); }

// =====================
// Overlay
// =====================
function overlayShow(text, kind="") {
  const ov = q$("overlay");
  const panel = ov?.querySelector(".panel");
  if (!ov || !panel) return;
  panel.textContent = String(text ?? "");
  panel.className = "panel" + (kind ? " " + kind : "");
  ov.classList.remove("hidden");
}
function overlayHide(){ q$("overlay")?.classList.add("hidden"); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function flashyCountdown() {
  overlayShow("3", "count"); sfxCount(3); await sleep(900);
  overlayShow("2", "count"); sfxCount(2); await sleep(900);
  overlayShow("1", "count"); sfxCount(1); await sleep(900);
  overlayShow("GO!", "go");  sfxGo();      await sleep(700);
  overlayHide();
}

// =====================
// 問題
// =====================
async function loadQuestion() {
  const q = await api.fetchLatestQuestion();
  if (!q) throw new Error("問題が見つかりません（questionsが空 / is_active=false など）");
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

  try {
    const rows = await api.submitAttempt(currentQuestion.id, chosen);
    const r = rows?.[0];
    if (!r) throw new Error("submitAttempt の返り値が空です");

    if (r.is_correct) {
      // ✅ ここが「差」を出す本体
      const comboBonus = calcComboBonus(combo);
      score += Number(r.points ?? BASE_POINTS) + comboBonus;
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

    await sleep(520);
    overlayHide();
    await loadQuestion();
  } catch (e) {
    const msg = e?.message || "送信に失敗しました。";
    overlayShow(msg, "warn");
    await sleep(1100);
    overlayHide();
    endGame(true);
  } finally {
    lock = false;
  }
}

async function startGame() {
  try {
    await unlockAudio();

    // ✅ 本番はログイン必須
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

    hide("startPane");
    hide("resultPane");
    show("battlePane");

    timeLeft = 60;  // ✅
    score = 0;
    combo = 0;
    maxCombo = 0;

    setText("timeLeft", timeLeft);
    setText("scoreNow", score);
    setText("comboNow", combo);

    await flashyCountdown();
    await loadQuestion();

    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft--;
      setText("timeLeft", timeLeft);
      if (timeLeft <= 0) endGame(false);
    }, 1000);

  } catch (e) {
    console.warn("[startGame] failed:", e);
    overlayShow("開始に失敗（設定/ログイン確認）", "warn");
    await sleep(1100);
    overlayHide();
  }
}

async function endGame(forceToStart) {
  playing = false;
  clearInterval(timer);

  hide("battlePane");

  // 結果表示
  show("resultPane");
  setText("finalScore", score);
  setText("finalCombo", maxCombo);

  // ✅ 本番だけ「1プレイ結果」を保存（ランキングはMAXで出す）
  if (!forceToStart && !api.isMock()) {
    try {
      await api.submitRun(score, maxCombo);
      // 結果画面でランキング更新（あれば）
      window.loadWeekOptions?.();
      window.loadRankings?.();
    } catch (e) {
      console.warn("[endGame] submitRun failed:", e);
    }
  }

  if (forceToStart) {
    hide("resultPane");
    show("startPane");
  }
}

window.startGame = startGame;
window.endGame = endGame;
