console.log("### NEW main.js loaded ###");

// js/main.js
/* global api, USE_MOCK, startGame, endGame, loadWeekOptions, loadRanking */

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function setText(id, text, cls = "") {
    const el = $(id);
    if (!el) return;
    el.className = cls || el.className;
    el.textContent = text;
  }

  function setLoginUI(isLoggedIn) {
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-block" : "none";

    const rankBtn = $("rankBtn");
    const weekSelect = $("weekSelect");
    if (rankBtn) rankBtn.disabled = !isLoggedIn;
    if (weekSelect) weekSelect.disabled = !isLoggedIn;

    // ダミーでも本番でもゲームは押せる（本番はログイン推奨だが遊びは可能に）
    const startBtn = $("startBtn");
    if (startBtn) startBtn.disabled = false;
  }

  function setModeBadge() {
    const el = $("modeBadge");
    if (!el) return;
    el.textContent = USE_MOCK
      ? "🟥 ダミーモード（ネット復旧後にUSE_MOCK=false）"
      : "🟩 本番モード";
  }

  async function login() {
    const loginId = $("loginId")?.value.trim() || "";
    const password = $("password")?.value || "";

    setText("loginMsg", "ログイン中…", "muted");

    try {
      const r = await api.signIn(loginId, password);
      if (!r.ok) {
        setText("loginMsg", "ログイン失敗: " + r.message, "ng");
        setLoginUI(false);
        return;
      }

      setText("loginMsg", r.message, "ok");
      setLoginUI(true);

      await loadWeekOptions();
      await loadRanking();
    } catch (e) {
      setText("loginMsg", "例外: " + (e?.message || e), "ng");
    }
  }

  async function logout() {
    await api.signOut();
    setText("loginMsg", "ログアウトしました", "muted");
    setLoginUI(false);
  }

  function bindUI() {
    $("loginBtn")?.addEventListener("click", login);
    $("logoutBtn")?.addEventListener("click", logout);

    $("rankBtn")?.addEventListener("click", () => loadRanking());
    $("weekSelect")?.addEventListener("change", () => loadRanking());

    $("startBtn")?.addEventListener("click", () => startGame());
    $("retryBtn")?.addEventListener("click", () => startGame());
    $("stopBtn")?.addEventListener("click", () => endGame());

    $("goRankBtn")?.addEventListener("click", () => {
      $("rankBox")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // 起動
  (async () => {
    setModeBadge();
    bindUI();

    if (USE_MOCK) {
      setLoginUI(true);
      setText("loginMsg", "（ダミーモード：ログイン不要）", "muted");
      await loadWeekOptions();
      await loadRanking();
    } else {
      setLoginUI(false);
    }
  })();

})();
