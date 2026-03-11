"use strict";

const api = {};

function getWeekIdNow() {

  const d = new Date();

  const year = d.getFullYear();

  const onejan = new Date(year,0,1);

  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);

  return year + "-W" + week;
}

api.getWeekIdNow = getWeekIdNow;

api.fetchLatestQuestion = async function() {

  const res = await fetch("./vocab.csv");

  const text = await res.text();

  const lines = text.split("\n").slice(1);

  const vocab = lines.map(l => {

    const [word,meaning] = l.split(",");

    return {word,meaning};

  });

  const q = vocab[Math.floor(Math.random()*vocab.length)];

  const choices = vocab
    .sort(()=>0.5-Math.random())
    .slice(0,3)
    .map(v=>v.meaning);

  choices.push(q.meaning);

  choices.sort(()=>0.5-Math.random());

  const label = ["A","B","C","D"];

  const obj = {};

  label.forEach((l,i)=>{

    obj["choice_"+l.toLowerCase()] = choices[i];

    if (choices[i]===q.meaning){
      window.__LAST_CORRECT = l;
    }

  });

  return {
    id:Date.now(),
    word:q.word,
    prompt:"意味として正しいものは？",
    ...obj
  };
};

api.submitAttempt = async function(_,choice){

  const ok = choice===window.__LAST_CORRECT;

  return [{
    is_correct:ok,
    points: ok ? 10 : 0,
    out_week_id:getWeekIdNow()
  }];
};

api.submitRun = async function(score,maxCombo){

  const userId = getPlayerId();

  const week = getWeekIdNow();

  await client.from("runs").insert([{

    user_id:userId,
    week_id:week,
    score:score,
    max_combo:maxCombo

  }]);

};

api.fetchWeeklyTop = async function(week){

  const {data} = await client
    .from("runs")
    .select("*")
    .eq("week_id",week)
    .order("score",{ascending:false})
    .limit(10);

  return data || [];
};

api.fetchMyWeeklyRank = async function(week){

  const user = getPlayerId();

  const {data} = await client
    .from("runs")
    .select("*")
    .eq("week_id",week)
    .order("score",{ascending:false});

  const rank = data.findIndex(r=>r.user_id===user)+1;

  const me = data.find(r=>r.user_id===user);

  if (!me) return null;

  return {
    rank:rank,
    points:me.score
  };

};

window.api = api;
