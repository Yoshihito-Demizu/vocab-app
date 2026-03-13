"use strict";

console.log("★★★★★ NEW RANKING SYSTEM LOADED ★★★★★");

function byId2(id){
  return document.getElementById(id);
}

function rankIcon(i){
  if(i===0) return "👑";
  if(i===1) return "🥈";
  if(i===2) return "🥉";
  return i+1;
}

function rankColor(i){
  if(i===0) return "linear-gradient(135deg,#ffd700,#ffb700)";
  if(i===1) return "linear-gradient(135deg,#dfe6ee,#bfc7d1)";
  if(i===2) return "linear-gradient(135deg,#d08945,#9b6233)";
  return "rgba(255,255,255,.05)";
}

function fmtTopRowHtml(i,row){

  const name=row.nickname||row.user_id||"-";
  const pts=row.points??0;

  return `
  <div style="
    display:grid;
    grid-template-columns:40px 1fr auto;
    gap:10px;
    align-items:center;
    padding:8px 10px;
    border-radius:12px;
    background:${rankColor(i)};
    color:${i<=2?"#000":"#fff"};
    margin-bottom:6px;
    font-weight:800;
  ">
    <div style="font-size:18px;text-align:center;">
      ${rankIcon(i)}
    </div>

    <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;">
      ${name}
    </div>

    <div style="font-size:16px;">
      ${pts}点
    </div>
  </div>
  `;
}

function renderMyCard(mine){

  if(!mine){
    return `<div>データなし</div>`;
  }

  const r=mine.rank??"-";
  const p=mine.points??0;

  let bg="rgba(255,255,255,.05)";
  let title="あなた";

  if(r===1){
    bg="linear-gradient(135deg,#ffd700,#ffb700)";
    title="👑 今週の王者";
  }

  return `
  <div style="
    padding:12px;
    border-radius:14px;
    background:${bg};
    text-align:center;
    font-weight:900;
  ">

    <div style="font-size:14px;margin-bottom:6px;">
      ${title}
    </div>

    <div style="font-size:34px;">
      ${r}位
    </div>

    <div style="font-size:18px;">
      ${p}点
    </div>

  </div>
  `;
}

function renderClassGoal(row){

  if(!row) return "";

  const avg=row.avg_score??0;
  const players=row.players??0;

  let medal="🎯";
  let title="挑戦中";

  if(avg>=300){
    medal="🥇";
    title="金ランク";
  }
  else if(avg>=240){
    medal="🥈";
    title="銀ランク";
  }
  else if(avg>=180){
    medal="🥉";
    title="銅ランク";
  }

  return `
  <div style="
    padding:12px;
    border-radius:14px;
    background:rgba(255,255,255,.06);
    margin-bottom:8px;
  ">

    <div style="
      display:flex;
      justify-content:space-between;
      font-weight:900;
      margin-bottom:8px;
    ">
      <div>${medal} クラス平均</div>
      <div>${avg.toFixed(1)}点</div>
    </div>

    <div style="
      display:flex;
      justify-content:space-between;
      font-size:12px;
      opacity:.8;
    ">
      <span>${title}</span>
      <span>${players}人</span>
    </div>

    <div style="
      margin-top:8px;
      font-size:11px;
      opacity:.7;
    ">
      目標：🥉180 / 🥈240 / 🥇300
    </div>

  </div>
  `;
}

async function loadWeekOptions(){

  const weekSelect=byId2("weekSelect");
  if(!weekSelect) return;

  const now=api.getWeekIdNow();

  const weeks=await api.fetchWeekOptions();

  weekSelect.innerHTML="";

  weeks.forEach(w=>{
    const o=document.createElement("option");
    o.value=w;
    o.textContent=w;
    if(w===now)o.selected=true;
    weekSelect.appendChild(o);
  });

}

async function loadRankings(){

  const weekSelect=byId2("weekSelect");
  const weeklyTop=byId2("weeklyTop");
  const myRank=byId2("myRank");
  const classGoal=byId2("classGoal");
  const classRank=byId2("classRank");

  const weekId=weekSelect.value;

  const top=await api.fetchWeeklyTop(weekId);

  weeklyTop.innerHTML=
    top.slice(0,5).map((r,i)=>fmtTopRowHtml(i,r)).join("");

  const mine=await api.fetchMyWeeklyRank(weekId);

  myRank.innerHTML=renderMyCard(mine);

  const classes=await api.fetchClassWeeklyRanking(weekId,20);

  classGoal.innerHTML=renderClassGoal(classes[0]);

  classRank.innerHTML=
    classes.slice(0,5).map((r,i)=>`
      <div style="font-size:12px;margin-bottom:3px;">
        ${rankIcon(i)} ${r.class_code} 平均${r.avg_score.toFixed(1)}
      </div>
    `).join("");

}

window.loadWeekOptions=loadWeekOptions;
window.loadRankings=loadRankings;

document.addEventListener("DOMContentLoaded",()=>{

  const tick=setInterval(async()=>{
    if(!window.api)return;
    clearInterval(tick);

    await loadWeekOptions();
    await loadRankings();

  },50);

});
