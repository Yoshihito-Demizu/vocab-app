// docs/js/main.js
/* global api */
"use strict";

console.log("[main] loaded! (buttons+login+ranking+B-id-classcode)");

(() => {
  const byId = (id) => document.getElementById(id);

  const setLoginMsg = (t) => {
    const el = byId("loginMsg");
    if (el) el.textContent = t || "";
  };

  // ===== B方式：loginId から class_code を抽出 =====
  // 形式: "2-3-k9f2" -> classCode="2-3"
  function parseClassCodeFromLoginId(loginId) {
    const s = String(loginId || "").trim().toLowerCase();

    // 2-3-k9f2 / 12-1-zz9x みたいなのを許可
    const m = s.match(/^(\d{1,2}-\d{1,2}-\d{1,2})-([a-z0-9]{4})$/);
    if (!m) return null;

    const classCode = m[1].split("-").slice(0,2).join("-");
    const rand = m[2];

    // 念のため classCode を再検査
    if (!/^\d{1,2}-\d{1,2}$/.test(classCode)) return null;
    if (!/^[a-z0-9]{4,8}$/.test(rand)) return null;

    return classCode;
  }

  const refreshLoginBox = async () => {
    const box = byId("loginBox");
    if (!box) return;

    // mock ならログインUIは隠す
    if (api?.isMock?.()) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");

    try {
      const uid = await api.getMyUserId();
      setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
    } catch (e) {
      setLoginMsg("未ログイン（本番送信にはログインが必要）");
    }
  };

  // ===== ランキングを読み込む（存在しない時は何もしない）=====
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

  // ===== ボタン配線 =====
  byId("startBtn")?.addEventListener("click", () => window.startGame?.());
  byId("retryBtn")?.addEventListener("click", () => window.startGame?.());
  byId("stopBtn")?.addEventListener("click", () => window.endGame?.());

  // ランキング更新
  byId("rankReloadBtn")?.addEventListener("click", async () => {
    await refreshRanking();
  });

  // 週変更で更新
  byId("weekSelect")?.addEventListener("change", async () => {
    if (typeof window.loadRankings === "function") await window.loadRankings();
  });

  // ===== ログイン =====
  byId("loginBtn")?.addEventListener("click", async () => {
    try {
      const loginId = byId("loginId")?.value || "";
      const pw = byId("loginPw")?.value || "";

      if (!loginId || !pw) {
        setLoginMsg("ログインIDとパスワードを入れてね");
        return;
      }

      // ✅ B方式チェック：IDフォーマットが違うなら弾く（荒らし対策）
      const classCode = parseClassCodeFromLoginId(loginId);
      if (!classCode) {
        setLoginMsg("ログインID形式が違います（例：2-3-k9f2）");
        return;
      }

      const res = await api.signIn(loginId, pw);
      if (!res?.ok) {
        setLoginMsg(res?.message || "ログイン失敗");
        return;
      }

      // ✅ ログイン成功後：class_code を自動保存（入力無し）
      try {
        // nicknameは任意。空ならnull。
        const nickname = loginId; // とりあえずID表示（嫌なら後で変更可能）
        const up = await api.upsertProfile({ nickname, classCode });
        if (!up?.ok) {
          console.warn("[main] upsertProfile failed:", up?.error || up);
        }
      } catch (e) {
        console.warn("[main] upsertProfile exception:", e);
      }

      setLoginMsg("ログイン成功");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ログイン失敗");
    }
  });

  byId("logoutBtn")?.addEventListener("click", async () => {
    try {
      await api.signOut();
      setLoginMsg("ログアウトしました");
      await refreshLoginBox();
      await refreshRanking();
    } catch (e) {
      setLoginMsg(e?.message || "ログアウト失敗");
    }
  });

  // ===== 初期化 =====
  (async () => {
    await refreshLoginBox();
    await refreshRanking();

    // quiz.js が結果画面表示タイミングで呼べるように
    window.onResultShown = async () => {
      await refreshRanking();
    };
  })();
})();


