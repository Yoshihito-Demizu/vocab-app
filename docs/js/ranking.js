// docs/js/ranking.js
console.log("[ranking] loaded!");

/* global api */

function $(id) { return document.getElementById(id); }

function setMsg(text, cls="muted") {
  const el = $("rankMsg");
  if (!el) return;
  el.className = cls;
  el.textContent = text;
}

function li(text) {
  const el = document.createElement("li");
  el.textContent = text;
  return el;
}

// 週選択を作る
async function loadWeekOptions() {
  try {
    setMsg("週を取得中…");
    const weeks = await api.fetchWeekOptions();

    const sel = $("weekSelect");
    if (!sel) return;

    sel.innerHTML = "";
    for (const w of weeks) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    }
    setMsg("OK", "ok");
  } catch (e) {
    console.error(e);
    setMsg("週の取得に失敗: " + (e?.message || e), "ng");
  }
}

// Top表示（端末内は自分だけでもOK）
async function loadRanking() {
  try {
    setMsg("ランキング取得中…");

    const weekId = $("weekSelect")?.value;
    if (!weekId) {
      setMsg("weekSelectが空です（loadWeekOptionsが先）", "ng");
      return;
    }

    const weekly = await api.fetchPersonalWeeklyTop(weekId);
    const total = await api.fetchPersonalTotalTop();

    // 表示名
    const ids = Array.from(new Set([...weekly, ...total].map(x => x.user_id)));
    const users = await api.fetchPublicUsers(ids);
    const nameById = new Map(users.map(u => [u.id, u.nickname]));

    const weeklyTop = $("weeklyTop");
    const totalTop = $("totalTop");
    if (weeklyTop) weeklyTop.innerHTML = "";
    if (totalTop) totalTop.innerHTML = "";

    weekly.forEach((r, i) => {
      const nm = nameById.get(r.user_id) || r.user_id;
      weeklyTop?.appendChild(li(`${i+1}. ${nm}：${r.points}点（○${r.correct}/×${r.wrong}）`));
    });

    total.forEach((r, i) => {
      const nm = nameById.get(r.user_id) || r.user_id;
      totalTop?.appendChild(li(`${i+1}. ${nm}：${r.points}点（○${r.correct}/×${r.wrong}）`));
    });

    // 自分の順位（端末内は1位表示でOK）
    const myRank = $("myRank");
    if (myRank) myRank.textContent = `今は「端末内保存」なので、この端末の記録が出ます。`;

    setMsg("OK", "ok");
  } catch (e) {
    console.error(e);
    setMsg("ランキング取得に失敗: " + (e?.message || e), "ng");
  }
}

window.loadWeekOptions = loadWeekOptions;
window.loadRanking = loadRanking;
