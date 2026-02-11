// docs/js/ranking.js
console.log("[ranking] loaded! (local ranking v1)");

/* global api */

(function () {
  "use strict";

  // ===== DOM =====
  function $(id) { return document.getElementById(id); }
  function setText(id, text, cls = "") {
    const el = $(id);
    if (!el) return;
    if (cls) el.className = cls;
    el.textContent = String(text ?? "");
  }

  // ===== week_id（2026-W06形式）=====
  function getISOWeekId(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    const yyyy = date.getUTCFullYear();
    const ww = String(weekNo).padStart(2, "0");
    return `${yyyy}-W${ww}`;
  }

  // ===== localStorage keys =====
  const KEY = "vocabTA_v1";
  function loadDB() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  }
  function saveDB(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  // db format:
  // {
  //   users: { [userId]: { nickname, grade, class_no } },
  //   weekly: { [weekId]: { [userId]: { points, correct, wrong } } },
  //   total: { [userId]: { points, correct, wrong } }
  // }

  function ensureUser(db, userId) {
    db.users = db.users || {};
    if (!db.users[userId]) {
      db.users[userId] = { nickname: `user-${userId}`, grade: 0, class_no: 0 };
    }
  }

  function ensureWeekly(db, weekId) {
    db.weekly = db.weekly || {};
    db.weekly[weekId] = db.weekly[weekId] || {};
  }

  function ensureTotal(db, userId) {
    db.total = db.total || {};
    db.total[userId] = db.total[userId] || { points: 0, correct: 0, wrong: 0 };
  }

  // ===== API：ゲームから呼ぶ（重要）=====
  async function recordAttempt({ userId, weekId, is_correct, points }) {
    const db = loadDB();
    ensureUser(db, userId);
    ensureWeekly(db, weekId);
    ensureTotal(db, userId);

    const w = (db.weekly[weekId][userId] ||= { points: 0, correct: 0, wrong: 0 });
    if (is_correct) {
      w.points += Number(points || 0);
      w.correct += 1;
    } else {
      w.wrong += 1;
    }

    const t = db.total[userId];
    if (is_correct) {
      t.points += Number(points || 0);
      t.correct += 1;
    } else {
      t.wrong += 1;
    }

    saveDB(db);
  }

  // ===== weekSelect =====
  async function loadWeekOptions() {
    const sel = $("weekSelect");
    if (!sel) return;

    let weeks = [];
    try {
      weeks = await api.fetchWeekOptions();
    } catch {
      // fallback: localの週を使う
      const db = loadDB();
      weeks = Object.keys(db.weekly || {});
    }

    const now = getISOWeekId();
    if (!weeks.includes(now)) weeks.unshift(now);

    // 重複除去 & 降順
    weeks = Array.from(new Set(weeks)).sort().reverse();

    sel.innerHTML = "";
    weeks.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    });
  }

  function toArrayWeekly(db, weekId) {
    const m = (db.weekly && db.weekly[weekId]) ? db.weekly[weekId] : {};
    return Object.entries(m).map(([user_id, v]) => ({ user_id, ...v }));
  }
  function toArrayTotal(db) {
    const m = db.total || {};
    return Object.entries(m).map(([user_id, v]) => ({ user_id, ...v }));
  }

  function renderTop10(list, usersMap, olId) {
    const ol = $(olId);
    if (!ol) return;
    ol.innerHTML = "";

    const top = list
      .slice()
      .sort((a, b) => (b.points - a.points) || (b.correct - a.correct))
      .slice(0, 10);

    if (top.length === 0) {
      const li = document.createElement("li");
      li.textContent = "（まだデータなし）";
      ol.appendChild(li);
      return;
    }

    top.forEach((r, i) => {
      const u = usersMap[r.user_id] || { nickname: r.user_id };
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${u.nickname} — ${r.points}点（○${r.correct} / ×${r.wrong}）`;
      ol.appendChild(li);
    });
  }

  function renderMyRank(list, usersMap, userId, boxId) {
    const box = $(boxId);
    if (!box) return;

    const sorted = list
      .slice()
      .sort((a, b) => (b.points - a.points) || (b.correct - a.correct));

    const idx = sorted.findIndex(x => x.user_id === userId);
    if (idx < 0) {
      box.textContent = "（まだデータなし）";
      return;
    }
    const me = sorted[idx];
    const u = usersMap[userId] || { nickname: userId };
    box.innerHTML = `あなた：<b>${u.nickname}</b>　順位：<b>${idx + 1}</b>位　スコア：<b>${me.points}</b>点（○${me.correct} / ×${me.wrong}）`;
  }

  async function loadRanking() {
    setText("rankMsg", "読み込み中…", "muted");

    const sel = $("weekSelect");
    const weekId = sel?.value || getISOWeekId();
    const db = loadDB();

    // usersMap（localを優先）
    const usersMap = db.users || {};

    const weeklyList = toArrayWeekly(db, weekId);
    renderTop10(weeklyList, usersMap, "weeklyTop");

    // 自分
    const myId = await api.getMyUserId();
    renderMyRank(weeklyList, usersMap, myId, "myRank");

    setText("rankMsg", `OK（${weekId}）`, "muted");
  }

  // ===== グローバル公開（main.js / quiz.jsから呼ぶ）=====
  window.loadWeekOptions = loadWeekOptions;
  window.loadRanking = loadRanking;
  window.__recordAttempt = recordAttempt;

})();
