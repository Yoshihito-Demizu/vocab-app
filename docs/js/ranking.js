"use strict";

function byId2(id){ return document.getElementById(id); }

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function rankIcon(i){
  if(i===0) return "👑";
  if(i===1) return "🥈";
  if(i===2) return "🥉";
  return i+1;
}

function scoreLabel(p){
  p=Number(p)||0;
  if(p>=300) return "LEGEND";
  if(p>=240) return "EXCELLENT";
  if(p>=180) return "GREAT";
  return "TRY";
}

/* ===== 共通：全体スケール底上げ ===== */
const BASE_SCALE = "1.4em"; // ←ここが全体倍率（調整可）

/* ===== 個人ランキング ===== */
function fmtTopRowHtml(i,row){
  const name=row.nickname||row.player_id||"-";
  const pts=Number(row.points??row.score??0);
  const combo=Number(row.max_combo??0);

  const is1=i===0;

  return `
    <div style="
      display:grid;
      grid-template-columns:${is1?"100px":"80px"} 1fr auto;
      align-items:center;
      padding:${is1?"26px":"20px"};
      border-radius:18px;
      margin-bottom:14px;
      background:${is1?"linear-gradient(90deg,rgba(255,215,0,.25),rgba(255,215,0,.08))":"rgba(255,255,255,.07)"};
      transform:scale(1);
      animation:pop .3s ease;
    ">

      <div style="
        font-size:${is1?"64px":"48px"};
        font-weight:1000;
        text-align:center;
      ">
        ${rankIcon(i)}
      </div>

      <div>
        <div style="
          font-size:${is1?"46px":"36px"};
          font-weight:1000;
          line-height:1.1;
        ">
          ${escapeHtml(name)}
        </div>

        <div style="
          font-size:${is1?"22px":"18px"};
          opacity:.8;
          margin-top:6px;
        ">
          COMBO ${combo} ・ ${scoreLabel(pts)}
        </div>
      </div>

      <div style="
        font-size:${is1?"56px":"44px"};
        font-weight:1000;
        background:linear-gradient(180deg,#fff,#ffd54a);
        -webkit-background-clip:text;
        color:transparent;
        text-shadow:0 0 18px rgba(255,215,0,.4);
      ">
        ${pts}点
      </div>

    </div>
  `;
}

/* ===== クラスランキング ===== */
function fmtClassRowHtml(i,row){
  const avg=Number(row.avg_score??0);

  return `
    <div style="
      padding:18px;
      border-radius:16px;
      margin-bottom:12px;
      background:rgba(255,255,255,.06);
      animation:pop .3s ease;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <div style="
          font-size:32px;
          font-weight:1000;
        ">
          ${rankIcon(i)} ${row.class_code}
        </div>

        <div style="
          font-size:36px;
          font-weight:1000;
          background:linear-gradient(180deg,#fff,#9ecbff);
          -webkit-background-clip:text;
          color:transparent;
        ">
          ${avg.toFixed(1)}点
        </div>
      </div>

    </div>
  `;
}

/* ===== 自分カード ===== */
function renderMyCard(mine){
  if(!mine) return "<div>データなし</div>";

  return `
    <div style="
      padding:20px;
      border-radius:18px;
      background:linear-gradient(135deg,rgba(255,215,0,.25),rgba(255,255,255,.05));
      text-align:center;
      animation:pop .3s ease;
    ">
      <div style="font-size:48px;font-weight:1000;">
        ${mine.rank}位
      </div>
      <div style="
        font-size:36px;
        font-weight:1000;
        margin-top:10px;
        color:#ffd54a;
        text-shadow:0 0 12px rgba(255,215,0,.5);
      ">
        ${mine.points}点
      </div>
    </div>
  `;
}

/* ===== アニメーション ===== */
const style=document.createElement("style");
style.innerHTML=`
@keyframes pop{
  0%{transform:scale(.95);opacity:.6;}
  100%{transform:scale(1);opacity:1;}
}
`;
document.head.appendChild(style);

/* ===== ロード ===== */
async function loadRankings(){
  const week=api.getWeekIdNow();

  const top=await api.fetchWeeklyTop(week);
  const mine=await api.fetchMyWeeklyRank(week);
  const klass=await api.fetchClassWeeklyRanking(week,10);

  byId2("weeklyTop").innerHTML=
    top?.slice(0,5).map((r,i)=>fmtTopRowHtml(i,r)).join("")||"";

  byId2("myRank").innerHTML=renderMyCard(mine);

  byId2("classRank").innerHTML=
    klass?.slice(0,5).map((r,i)=>fmtClassRowHtml(i,r)).join("")||"";
}

document.addEventListener("DOMContentLoaded",()=>{
  const t=setInterval(()=>{
    if(!window.api)return;
    clearInterval(t);
    loadRankings();
  },50);
});
