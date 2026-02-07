// docs/js/quiz.js
console.log("[quiz] loaded! (screen flow + 2x2 + big ○×)");

let timer = null;
let timeLeft = 30;
let score = 0;
let combo = 0;
let playing = false;
let currentQuestion = null;

function $(id){ return document.getElementById(id); }
function show(id){ $(id)?.classList.remove("hidden"); }
function hide(id){ $(id)?.classList.add("hidden"); }

function showMark(ok){
  const m = $("bigMark");
  if (!m) return;
  m.textContent = ok ? "○" : "×";
  m.className = ok ? "show ok" : "show ng";
  setTimeout(()=>{ m.className = ""; }, 350);
}

async function countdown(){
  const q = $("q");
  const choices = $("choices");
  if (!q || !choices) return;

  choices.innerHTML = "";
  q.innerHTML = `<div style="text-align:center;font-size:64px;font-weight:900;">3</div>`;
  await new Promise(r=>setTimeout(r, 900));
  q.innerHTML = `<div style="text-align:center;font-size:64px;font-weight:900;">2</div>`;
  await new Promise(r=>setTimeout(r, 900));
  q.innerHTML = `<div style="text-align:center;font-size:64px;font-weight:900;">1</div>`;
  await new Promise(r=>setTimeout(r, 900));
  q.innerHTML = `<div style="text-align:center;font-size:64px;font-weight:900;color:#00e08a;">GO!!</div>`;
  await new Promise(r=>setTimeout(r, 650));
}

async function loadQuestion(){
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

  list.forEach(([k, txt])=>{
    const b = document.createElement("button");
    b.textContent = txt; // A/Bは見た目で消して押しやすく
    b.onclick = ()=> answer(k);
    box.appendChild(b);
  });
}

async function answer(chosen){
  if (!playing || !currentQuestion) return;

  const rows = await api.submitAttempt(currentQuestion.id, chosen);
  const r = rows?.[0];
  if (!r) return;

  const ok = !!r.is_correct;

  if (ok) {
    combo += 1;
    // コンボで倍率（例：1.0, 1.1, 1.2... 最大2.0）
    const mult = Math.min(2.0, 1 + combo * 0.1);
    score += Math.round((r.points || 10) * mult);
  } else {
    combo = 0;
  }

  $("scoreNow").textContent = String(score);
  $("comboNow").textContent = String(combo);

  showMark(ok);

  // ちょい待って次
  setTimeout(()=>{ loadQuestion(); }, 450);
}

function startGame(){
  if (playing) return;
  playing = true;

  hide("startPane");
  hide("resultPane");
  show("battlePane");

  timeLeft = 30;
  score = 0;
  combo = 0;

  $("timeLeft").textContent = "30";
  $("scoreNow").textContent = "0";
  $("comboNow").textContent = "0";

  (async ()=>{
    await countdown();
    await loadQuestion();

    timer = setInterval(()=>{
      timeLeft--;
      $("timeLeft").textContent = String(timeLeft);
      if (timeLeft <= 0) endGame();
    }, 1000);
  })();
}

function endGame(){
  if (!playing) return;
  playing = false;
  clearInterval(timer);

  hide("battlePane");
  hide("startPane");
  show("resultPane");

  $("resultSummary").innerHTML = `
    <div style="font-size:28px;font-weight:900;margin-bottom:8px;">🎉 RESULT</div>
    <div style="font-size:20px;">SCORE：<b>${score}</b></div>
    <div style="margin-top:6px;opacity:.85;">最大COMBO：<b>${combo}</b></div>
  `;
}

window.startGame = startGame;
window.endGame = endGame;
