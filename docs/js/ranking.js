// js/ranking.js
/* global api */

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function setText(id, text, cls = "") {
    const el = $(id);
    if (!el) return;
    el.className = cls || "";
    el.textContent = text;
  }

  function clearList(id) {
    const el = $(id);
    if (el) el.innerHTML = "";
  }

  function appendLi(id, text) {
    const ol = $(id);
    if (!ol) return;
    const li = document.createElement("li");
    li.textContent = text;
    ol.appendChild(li);
  }

  async function loadWeekOptions() {
    const sel = $("weekSelect");
    if (!sel) return;

    sel.innerHTML = "";
    const weeks = await api.fetchWeekOptions();

    if (!weeks || weeks.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "（週がまだありません）";
      sel.appendChild(opt);
      return;
    }

    weeks.forEach((wid, i) => {
      const opt = document.createElement("option");
      opt.value = wid;
      opt.textContent = wid;
      if (i === 0) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  async function loadRanking() {
    setText("rankMsg", "");

    const weekId = $("weekSelect")?.value || "";
    if (!weekId) {
      setText("rankMsg", "週がありません（まず1問解いてね）", "muted");
      return;
    }

    const w = await api.fetchPersonalWeeklyTop(weekId);
    const t = await api.fetchPersonalTotalTop();

    const userIds = Array.from(new Set([...(w ?? []).map(x => x.user_id), ...(t ?? []).map(x => x.user_id)]));
    const u = await api.fetchPublicUsers(userIds);

    const userMap = new Map();
    (u ?? []).forEach(x => userMap.set(x.id, x.nickname || `G${x.grade}-C${String(x.class_no).padStart(2, "0")}`));
    const nameOf = (id) => userMap.get(id) || id.slice(0, 8);

    clearList("weeklyTop");
    (w ?? []).forEach(row => appendLi("weeklyTop", `${nameOf(row.user_id)}：${row.points}点（○${row.correct}/×${row.wrong}）`));

    clearList("totalTop");
    (t ?? []).forEach(row => appendLi("totalTop", `${nameOf(row.user_id)}：${row.points}点（○${row.correct}/×${row.wrong}）`));

    setText("rankMsg", `表示中の週: ${weekId}`, "muted");

    // 自分の順位（MOCKは配列内から簡易に算出）
    const myId = await api.getMyUserId();
    if (!myId) {
      setText("myRank", "ログインしてね", "muted");
    } else {
      const myWeeklyPoints = (w ?? []).find(x => x.user_id === myId)?.points ?? 0;
      const myTotalPoints = (t ?? []).find(x => x.user_id === myId)?.points ?? 0;

      const weeklyRank = (w ?? []).slice().sort((a, b) => b.points - a.points).findIndex(x => x.user_id === myId) + 1;
      const totalRank = (t ?? []).slice().sort((a, b) => b.points - a.points).findIndex(x => x.user_id === myId) + 1;

      const weeklyRankSafe = weeklyRank > 0 ? weeklyRank : "?";
      const totalRankSafe = totalRank > 0 ? totalRank : "?";

      setText(
        "myRank",
        `週：${nameOf(myId)} は ${weeklyRankSafe}位（今週${myWeeklyPoints}点） / 累計：${totalRankSafe}位（累計${myTotalPoints}点）`,
        "muted"
      );
    }

    // クラス対抗
    const { cw, ct, cwa, cta } = await api.fetchClassRankings(weekId);

    clearList("classWeeklyTop");
    (cw ?? []).forEach(row => appendLi("classWeeklyTop", `${row.grade}年${row.class_no}組：${row.class_points}点（参加${row.players}人）`));

    clearList("classTotalTop");
    (ct ?? []).forEach(row => appendLi("classTotalTop", `${row.grade}年${row.class_no}組：${row.class_points}点（参加${row.players}人）`));

    clearList("classWeeklyAvgTop");
    (cwa ?? []).forEach(row => appendLi("classWeeklyAvgTop", `${row.grade}年${row.class_no}組：平均${row.avg_points}点（参加${row.players}人）`));

    clearList("classTotalAvgTop");
    (cta ?? []).forEach(row => appendLi("classTotalAvgTop", `${row.grade}年${row.class_no}組：平均${row.avg_points}点（参加${row.players}人）`));
  }

  // グローバルに出す（quiz/main が呼ぶ）
  window.loadWeekOptions = loadWeekOptions;
  window.loadRanking = loadRanking;

  console.log("[ranking] loaded!");
})();
