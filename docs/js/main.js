"use strict";

/**
 * ID入力方式 main.js
 * - loginBox をプレイヤーID入力として使う
 * - パスワード欄は隠す
 * - 現在のID表示 / ID変更ボタン
 */

console.log("[main] loaded! (id-mode)");

(() => {
  const byId = (id) => document.getElementById(id);

  const setLoginMsg = (t) => {
    const el = byId("loginMsg");
    if (el) el.textContent = t || "";
  };

  const refreshLoginBox = async () => {
    const box = byId("loginBox");
    if (!box) return;
    box.classList.remove("hidden");

    const uid = await window.api.getMyUserId();
    setLoginMsg(uid ? `現在のID：${uid}` : "プレイヤーIDを入れてください");
  };

  const refreshRanking = async () => {
    try {
      if (typeof window.loadWeekOptions !== "function") return;
      if (typeof window.loadRankings !== "function") return;
      await window.loadWeekOptions();
      await window.loadRankings();
    } catch (e) {
      console.warn("[main] refreshRanking failed:", e);
      const msg = byId("rankMsg");
      if (msg) msg.textContent = "ランキング取得に失敗";
    }
  };

  function prepareIdUi() {
    const title = byId("loginBox")?.querySelector("div");
    if (title) title.textContent = "プレイヤーID（iPhone対応版）";

    const pwInput = byId("loginPw");
    if (pwInput) {
      pwInput.value = "";
      pwInput.closest("div").style.display = "none";
    }

    const idLabel = byId("loginId")?.previousElementSibling;
    if (idLabel) idLabel.textContent = "プレイヤーID（例：2-3-01-k9f2）";

    const idInput = byId("loginId");
    if (idInput) idInput.placeholder = "2-3-01-k9f2";

    const loginBtn = byId("loginBtn");
    if (loginBtn) loginBtn.textContent = "ID保存";

    const logoutBtn = byId("logoutBtn");
    if (logoutBtn) logoutBtn.textContent = "ID変更";
  }

  byId("startBtn")?.addEventListener("click", async () => {
    const uid = await window.api.getMyUserId();
    if (!uid) {
      setLoginMsg("先にプレイヤーIDを保存してください");
      return;
    }
    window.startGame?.();
  });

  byId("retryBtn")?.addEventListener("click", async () => {
    const uid = await window.api.getMyUserId();
    if (!uid) {
      setLoginMsg("先にプレイヤーIDを保存してください");
      return;
    }
    window.startGame?.();
  });

  byId("stopBtn")?.addEventListener("click", () => window.endGame?.());

  byId("rankReloadBtn")?.addEventListener("click", async () => {
    await refreshRanking();
  });

  byId("weekSelect")?.addEventListener("change", async () => {
    if (typeof window.loadRankings === "function") {
      await window.loadRankings();
    }
  });

  byId("loginBtn")?.addEventListener("click", async () => {
    try {
      const playerId = byId("loginId")?.value || "";
      const res = await window.api.signIn(playerId);

      if (!res?.ok) {
        setLoginMsg(res?.message || "ID保存失敗");
        return;
      }

      setLoginMsg("IDを保存しました");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ID保存失敗");
    }
  });

  byId("logoutBtn")?.addEventListener("click", async () => {
    try {
      await window.api.signOut();
      const idInput = byId("loginId");
      if (idInput) idInput.value = "";
      setLoginMsg("IDを消しました");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ID変更失敗");
    }
  });

  (async () => {
    prepareIdUi();

    const currentId = await window.api.getMyUserId();
    const idInput = byId("loginId");
    if (idInput && currentId) idInput.value = currentId;

    await refreshLoginBox();
    await refreshRanking();

    window.onResultShown = async () => {
      await refreshRanking();
    };
  })();
})();
