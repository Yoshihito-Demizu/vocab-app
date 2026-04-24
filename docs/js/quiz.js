/* global api */
"use strict";

console.log("[quiz] loaded! (countdown + BGM + SE + wrong-minus-2sec)");

const $ = (id) => document.getElementById(id);

const panes = {
  start: $("startPane"),
  battle: $("battlePane"),
  result: $("resultPane"),
};

const els = {
  q: $("q"),
  choices: $("choices"),
  timeLeft: $("timeLeft"),
  scoreNow: $("scoreNow"),
  comboNow: $("comboNow"),
  finalScore: $("finalScore"),
  finalCombo: $("finalCombo"),
  overlay: $("overlay"),
  overlayPanel: $("overlay") ? $("overlay").querySelector(".panel") : null,
};

function play(id, vol=0.5){
  const a = document.getElementById(id);
  if(!a) return;
  a.currentTime = 0;
  a.volume = vol;
  a.play().catch(()=>{});
}

function stop(id){
  const a = document.getElementById(id);
  if(!a) return;
  a.pause();
  a.currentTime = 0;
}

function playBgm(){ stop("bgmResult"); play("bgm",0.4); }
function stopBgm(){ stop("bgm"); }
function playResult(){ stop("bgm"); play("bgmResult",0.45); }

let playing=false;
let answering=false;
let currentQ=null;

let score=0;
let combo=0;
let maxCombo=0;

let timerId=null;
let msLeft=0;

let qShownAt=0;

const GAME_SECONDS=60;
const WRONG_PENALTY_MS=2000;

function showPane(name){
  Object.values(panes).forEach(p=>p&&p.classList.add("hidden"));
  panes[name]&&panes[name].classList.remove("hidden");
}

function setText(el,v){ if(el) el.textContent=String(v); }

function startTimer(){
  timerId=setInterval(()=>{
    msLeft-=100;
    setText(els.timeLeft,Math.ceil(msLeft/1000));
    if(msLeft<=0) endGame(true);
  },100);
}

function renderQuestion(q){
  els.q.innerHTML=`<h3>${q.word}</h3>`;
  els.choices.innerHTML="";
  ["A","B","C","D"].forEach(k=>{
    const btn=document.createElement("button");
    btn.textContent=q["choice_"+k.toLowerCase()];
    btn.onclick=()=>answer(k);
    els.choices.appendChild(btn);
  });
  qShownAt=performance.now();
}

async function loadQuestion(){
  currentQ=await api.fetchLatestQuestion();
  renderQuestion(currentQ);
}

async function answer(choice){
  if(answering) return;
  answering=true;

  const res=await api.submitAttempt(currentQ.id,choice);
  const ok=res[0].is_correct;

  if(ok){
    play("seCorrect");
    combo++;
    maxCombo=Math.max(maxCombo,combo);
    score+=10;
  }else{
    play("seWrong");
    combo=0;
    msLeft-=WRONG_PENALTY_MS;
  }

  setText(els.scoreNow,score);
  setText(els.comboNow,combo);

  answering=false;
  await loadQuestion();
}

async function startGame(){
  playing=true;
  score=0;
  combo=0;
  maxCombo=0;

  setText(els.scoreNow,0);
  setText(els.comboNow,0);

  showPane("battle");

  msLeft=GAME_SECONDS*1000;
  startTimer();

  playBgm();

  play("seCount3"); await new Promise(r=>setTimeout(r,600));
  play("seCount2"); await new Promise(r=>setTimeout(r,600));
  play("seCount1"); await new Promise(r=>setTimeout(r,600));
  play("seCountGo"); await new Promise(r=>setTimeout(r,700));

  await loadQuestion();
}

async function endGame(){
  playing=false;
  clearInterval(timerId);

  stopBgm();
  playResult();

  setText(els.finalScore,score);
  setText(els.finalCombo,maxCombo);

  showPane("result");

  await api.submitRun(score,maxCombo,true);
}

window.startGame=startGame;
window.endGame=endGame;
