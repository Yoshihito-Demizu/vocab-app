// docs/js/ranking.js
console.log("[ranking] loaded!");

/* global api */

function $(id) { return document.getElementById(id); }

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = String(text ?? "");
}

function clearList(id) {
  const ol = $(id);
  if (!ol) return;
  ol.innerHTML = "";
}

function addItem(id, text) {
  const ol = $(id);
  if (!ol) return;
  const li = document.createElement("li");
  li.textContent = text;
  ol.appendChild(li);
}

// 週セレクトを作る
async function loadWeekOptions() {
  const sel = $("weekSelect");
  if (!sel) return;

  const weeks = await api.fetchWeekOptions();
  sel.innerHTML = "";
  weeks.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    sel.appendChild(opt);
  });
}

// ランキング描画（今週Top10 + 自分の順位）
async function loadRanking() {
  const sel = $("weekSelect");
  if (!sel) return;

  const weekId = sel.value || api.getWeekIdNow();

  setText("rankMsg", "読み込み中…");

  // Top10
  const top = await api.fetchPersonalWeeklyTop(weekId);
  clearList("weeklyTop");

  // 名前解決
  const ids = top.map(r => r.user_id);
  const users = await api.fetchPublicUsers(ids);
  const nameOf = (uid) => users.find(u => u.id === uid)?.nickname || uid;

  top.forEach((r, i) => {
    addItem("weeklyTop", `${i+1}. ${nameOf(r.user_id)}  ${r.points}点（○${r.correct}/×${r.wrong}）`);
  });

  // 自分の順位
  const my = await api.fetchMyRank(weekId);
  if ($("myRank")) {
    if (my.rank == null) {
      $("myRank").textContent = `（${weekId}：まだ記録なし）`;
    } else {
      $("myRank").textContent = `（${weekId}：あなたは ${my.total}人中 ${my.rank}位）`;
    }
  }

  setText("rankMsg", "OK");
}

// グローバル公開（main.js から呼ぶ）
window.loadWeekOptions = loadWeekOptions;
window.loadRanking = loadRanking;
