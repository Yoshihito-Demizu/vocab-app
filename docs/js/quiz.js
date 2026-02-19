// docs/js/quiz.js
console.log("[quiz] loaded! (flow+overlay+auth-safe+comboFX+audioStop+btnFX+screenFlash)");

/* global api */

let timer = null;
let timeLeft = 60;
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentQuestion = null;
let playing = false;

function q$(id) { return document.getElementById(id); }
function show(id) { q$(id)?.classList.remove("hidden"); }
function hide(id) { q$(id)?.classList.add("hidden"); }
function setText(id, v) { const el = q$(id); if (el) el.textContent = String(v); }

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
function sfxCount(n){ beep({ freq:n===3?440:n===2?523:659, dur:0.12, gain:0.16 }); }
function sfxGo(){ beep({ freq:988, dur:0.10, gain:0.18 }); setTimeout(()=>beep({ freq:1319, dur:0.12, gain:0.16 }), 90); }
function sfxCorrect(){ beep({ freq:880, dur:0.08, gain:0.18 }); setTimeout(()=>beep({ freq:1175, dur:0.10, gain:0.16 }), 90); }
function sfxWrong(){ beep({ freq:160, dur:0.22, type:"sawtooth", gain:0.22 }); }

function stopBGM(){ if (bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; } bgmTier=null; }
function startBGM(tier){
  ensureAudio();
  if (bgmTier === tier) return;
  stopBGM();
  bgmTier = tier;
  const patterns = {
    low:{ bpm:140, seq:[659,523,587,523,494,440,494,523] },
    mid:{ bpm:160, seq:[784,659,698,659,587,523,587,659] },
    high:{ bpm:180, seq:[988,784,880,784,698,659,698,784] },
    result:{ bpm:120, seq:[523,659,784,659,523,494,523,659] }
  };
  const p = patterns[tier] || patterns.low;
  const stepMs = Math.floor(60000 / p.bpm / 2);
  let i = 0;
  bgmTimer = setInterval(() => {
    beep({ freq: p.seq[i % p.seq.length], dur: 0.07, gain: 0.07 });
    i++;
  }, stepMs);
}
function updateBgmByScore(){
  if (!playing) return;
  if (score >= 120) startBGM("high");
  else if (score >= 60) startBGM("mid");
  else startBGM("low");
}

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

// ===== ④-2: FX用のスタイルを注入（HTML編集不要）=====
let fxStyleInjected = false;
function injectFxStyle() {
  if (fxStyleInjected) return;
  fxStyleInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    /* screen flash */
    #screenFlash {
      position: fixed; inset: 0; z-index: 99997; pointer-events: none;
      opacity: 0; transition: opacity 120ms ease;
    }
    #screenFlash.ok { background: rgba(0, 211, 138, .18); }
    #screenFlash.ng { background: rgba(255, 77, 125, .22); }

    /* choice button FX */
    .choice-ok {
      outline: 2px solid rgba(0, 211, 138, .85);
      box-shadow: 0 0 0 3px rgba(0, 211, 138, .22), 0 18px 44px rgba(0,0,0,.35);
      transform: translateY(-1px) scale(1.01);
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .choice-ng {
      outline: 2px solid rgba(255, 77, 125, .90);
      box-shadow: 0 0 0 3px rgba(255, 77, 125, .20), 0 18px 44px rgba(0,0,0,.35);
      animation: shake2 .22s ease-in-out;
    }
    @keyframes shake2 {
      0%,100%{ transform: translateX(0); }
      25%{ transform: translateX(-8px); }
      50%{ transform: translateX(8px); }
      75%{ transform: translateX(-5px); }
    }
  `;
  document.head.appendChild(style);
}

let screenFlashEl = null;
let screenFlashTimer = null;
function ensureScreenFlash() {
  injectFxStyle();
  if (screenFlashEl) return screenFlashEl;
  const el = document.createElement("div");
  el.id = "screenFlash";
  document.body.appendChild(el);
  screenFlashEl = el;
  return el;
}
function flashScreen(kind) {
  const el = ensureScreenFlash();
  if (screenFlashTimer) clearTimeout(screenFlashTimer);

  el.className = "";
  el.classList.add(kind === "ok" ? "ok" : "ng");
  el.style.opacity = "1";

  screenFlashTimer = setTimeout(() => { el.style.opacity = "0"; }, 140);
}

function pulseChoiceButton(btn, ok) {
  if (!btn) return;
  btn.classList.remove("choice-ok", "choice-ng");
  btn.classList.add(ok ? "choice-ok" : "choice-ng");
  setTimeout(() => btn.classList.remove("choice-ok", "choice-ng"), ok ? 220 : 320);
}

// ===== COMBO FX（④-1）=====
let comboFxEl = null;
let comboFxTimer = null;

function ensureComboFxEl() {
  injectFxStyle();
  if (comboFxEl) return comboFxEl;

  const el = document.createElement("div");
  el.id = "comboFx";
  el.style.position = "fixed";
  el.style.right = "14px";
  el.style.top = "66px";
  el.style.zIndex = "99998";
  el.style.pointerEvents = "none";
  el.style.fontWeight = "1000";
  el.style.letterSpacing = "0.5px";
  el.style.textShadow = "0 12px 40px rgba(0,0,0,.55)";
  el.style.transform = "translateY(-8px) scale(0.92)";
  el.style.opacity = "0";
  el.style.transition = "transform 180ms ease, opacity 180ms ease";
  document.body.appendChild(el);

  comboFxEl = el;
  return el;
}

function showComboFX(n) {
  const el = ensureComboFxEl();
  if (comboFxTimer) clearTimeout(comboFxTimer);

  const milestone = (n > 0 && n % 10 === 0);
  const text = milestone ? `COMBO ${n}!!` : `COMBO ${n}`;

  el.textContent = text;
  el.style.fontSize = milestone ? "44px" : "26px";
  el.style.color = milestone ? "#ffd54a" : "rgba(234,240,255,.92)";

  el.style.opacity = "1";
  el.style.transform = "translateY(-8px) scale(1)";

  if (milestone) {
    beep({ freq: 1047, dur: 0.08, gain: 0.10 });
    setTimeout(() => beep({ freq: 1319, dur: 0.10, gain: 0.10 }), 80);
  }

  comboFxTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-16px) scale(0.98)";
  }, milestone ? 700 : 520);
}

function resetComboFX() {
  if (!comboFxEl) return;
  if (comboFxTimer) clearTimeout(comboFxTimer);
  comboFxEl.style.opacity = "0";
  comboFxEl.style.transform = "translateY(-16px) scale(0.98)";
}

// ===== audio stop =====
function stopAllAudio() {
  stopBGM();
  try { if (AC && AC.state !== "closed") AC.suspend(); } catch {}
}

async function flashyCountdown() {
  overlayShow("3", "count"); sfxCount(3); await sleep(900);
  overlayShow("2", "count"); sfxCount(2); await sleep(900);
  overlayShow("1", "count"); sfxCount(1); await sleep(900);
  overlayShow("GO!", "go");  sfxGo();      await sleep(700);
  overlayHide();
}

async function loadQuestion() {
  const q = await api.fetchLatestQuestion();
  if (!q) throw new Error("問題が見つかりません（CSVが空/4件未満など）");
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
    // ✅ ボタン要素も渡す
    b.addEventListener("click", () => answer(k, b), { passive: true });
    cBox.appendChild(b);
  });
}

let lock = false;

async function answer(chosen, btnEl) {
  if (!playing || !currentQuestion || lock) return;
  lock = true;

  try {
    const rows = await api.submitAttempt(currentQuestion.id, chosen);
    const r = rows?.[0];
    if (!r) throw new Error("submitAttempt の返り値が空です");

    if (r.is_correct) {
      score += Number(r.points || 0) + Math.min(combo, 20);
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);

      // ✅ ④-2：正解FX
      pulseChoiceButton(btnEl, true);
      flashScreen("ok");
      if (navigator.vibrate) navigator.vibrate(12);

      overlayShow("⭕", "ok");
      sfxCorrect();

      // ✅ ④-1：COMBO演出
      showComboFX(combo);
    } else {
      combo = 0;

      // ✅ ④-2：不正解FX
      pulseChoiceButton(btnEl, false);
      flashScreen("ng");
      if (navigator.vibrate) navigator.vibrate([20, 20, 20]);

      overlayShow("❌", "ng");
      sfxWrong();

      resetComboFX();
    }

    setText("scoreNow", score);
    setText("comboNow", combo);
    updateBgmByScore();

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
  injectFxStyle();

  try { await unlockAudio(); }
  catch (e) { console.warn("[startGame] audio unlock failed:", e); }

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

  timeLeft = 60;
  score = 0;
  combo = 0;
  maxCombo = 0;

  resetComboFX();

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
    if (timeLeft <= 0) endGame(false);
  }, 1000);
}

function endGame(forceToStart) {
  playing = false;
  clearInterval(timer);
  stopBGM();
  startBGM("result");

  hide("battlePane");
  show("resultPane");

  setText("finalScore", score);
  setText("finalCombo", maxCombo);

  // ✅ 結果画面を出した瞬間にランキング更新（失敗してもゲームは止めない）
  try {
    Promise.resolve()
      .then(() => window.loadWeekOptions?.())
      .then(() => window.loadRankings?.())
      .catch(() => null);
  } catch (_) {}

  if (forceToStart) {
    hide("resultPane");
    show("startPane");
  }
}


window.addEventListener("pagehide", stopAllAudio);
window.addEventListener("beforeunload", stopAllAudio);

window.startGame = startGame;
window.endGame = endGame;


