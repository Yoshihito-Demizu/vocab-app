// docs/js/quiz.js
console.log("[quiz] loaded! (flow+overlay+auth-safe+guarded-start)");

/* global api */

let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentQuestion = null;
let playing = false;

function q$(id) { return document.getElementById(id); }
function show(id) { q$(id)?.classList.remove("hidden"); }
function hide(id) { q$(id)?.classList.add("hidden"); }
function setText(id, v) { const el = q$(id); if (el) el.textContent = String(v); }

const TIME_LIMIT = 30;

// ===== Overlay =====
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
  overlayShow("3", "count"); await sleep(800);
  overlayShow("2", "count"); await sleep(800);
  overlayShow("1", "count"); await sleep(800);
  overlayShow("GO!", "go");  await sleep(600);
  overlayHide();
}

// ===== Question =====
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
      score += Number(r.points || 0) + Math.min(combo, 20);
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      overlayShow("⭕", "ok");
    } else {
      combo = 0;
      overlayShow("❌", "ng");
    }

    setText("scoreNow", score);
    setText("comboNow", combo);

    await sleep(450);
    overlayHide();
    await loadQuestion();
  } catch (e) {
    const msg = e?.message || "送信に失敗しました。";
    overlayShow(msg, "warn");
    await sleep(1200);
    overlayHide();
    endGame(true);
  } finally {
    lock = false;
  }
}

// ===== START (必ずcatchして Uncaught を潰す) =====
async function startGame() {
  try {
    if (!window.api) {
      overlayShow("APIが初期化されていません。再読み込みしてください。", "warn");
      await sleep(1200);
      overlayHide();
      return;
    }

    // ✅ 本番モードはログイン必須
    if (!api.isMock()) {
      const uid = await api.getMyUserId();
      if (!uid) {
        overlayShow("未ログインです。\n先にログインしてね", "warn");
        await sleep(1200);
        overlayHide();
        return;
      }
    }

    if (playing) return;
    playing = true;

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
    const msg = e?.message || "開始に失敗しました（本番設定/ログイン/DBを確認）";
    overlayShow(msg, "warn");
    await sleep(1400);
    overlayHide();

    // 安全に戻す
    playing = false;
    clearInterval(timer);
    hide("battlePane");
    hide("resultPane");
    show("startPane");
  }
}

// ===== END（これが無いと endGame is not defined になる）=====
function endGame(forceToStart) {
  playing = false;
  clearInterval(timer);

  hide("battlePane");
  show("resultPane");

  setText("finalScore", score);
  setText("finalCombo", maxCombo);

  if (forceToStart) {
    hide("resultPane");
    show("startPane");
  }
}

window.startGame = startGame;
window.endGame = endGame;
