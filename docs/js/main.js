"use strict";

console.log("[main] loaded");

const $ = id => document.getElementById(id);

function showPane(name){

  ["startPane","battlePane","resultPane"]
  .forEach(p=>$(p).classList.add("hidden"));

  $(name).classList.remove("hidden");

}

async function startGame(){

  showPane("battlePane");

  window.startGame();

}

$("startBtn").onclick=startGame;

$("retryBtn").onclick=startGame;

$("stopBtn").onclick=window.endGame;

async function refreshRanking(){

  await loadWeekOptions();

  await loadRankings();

}

window.onResultShown=refreshRanking;

refreshRanking();
