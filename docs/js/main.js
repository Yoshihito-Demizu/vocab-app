// docs/js/main.js
console.log("[main] loaded! (buttons+login+ranking)");

/* global api */

function $(id){ return document.getElementById(id); }

function setLoginMsg(t){
  const el = $("loginMsg");
  if (el) el.textContent = t || "";
}

async function refreshLoginBox(){
  const box = $("loginBox");
  if (!box) return;

  if (api?.isMock?.()) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  const uid = await api.getMyUserId();
  setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
}

// ===== ランキングを読み込む（存在しない時は何もしない）=====
async function refreshRanking(){
  try{
    // ranking.js が読み込まれていない / DOMが無い なら静かに終わる
    if (typeof window.loadWeekOptions !== "function") return;
    if (typeof window.loadRankings !== "function") return;

    await window.loadWeekOptions();
    await window.loadRankings();
  } catch(e){
    console.warn("[main] refreshRanking failed:", e);
    // rankMsg があるなら一言だけ
    const msg = $("rankMsg");
    if (msg) msg.textContent = "ランキング取得に失敗";
  }
}

// ===== ボタン =====
$("startBtn")?.addEventListener("click", () => window.startGame?.());
$("retryBtn")?.addEventListener("click", () => window.startGame?.());
$("stopBtn")?.addEventListener("click", () => window.endGame?.());

// ランキングの更新ボタン
$("rankReloadBtn")?.addEventListener("click", async () => {
  await refreshRanking();
});

// 週を変えたら自動更新
$("weekSelect")?.addEventListener("change", async () => {
  if (typeof window.loadRankings === "function") await window.loadRankings();
});

// ===== ログイン =====
$("loginBtn")?.addEventListener("click", async () => {
  try{
    const loginId = $("loginId")?.value || "";
    const pw = $("loginPw")?.value || "";
    if (!loginId || !pw) { setLoginMsg("ログインIDとパスワードを入れてね"); return; }
    const res = await api.signIn(loginId, pw);
    setLoginMsg(res.message || "");
    await refreshLoginBox();
  } catch(e){
    setLoginMsg(e?.message || "ログイン失敗");
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  try{
    await api.signOut();
    setLoginMsg("ログアウトしました");
    await refreshLoginBox();
  } catch(e){
    setLoginMsg(e?.message || "ログアウト失敗");
  }
});

// ===== 初期化 =====
(async () => {
  await refreshLoginBox();

  // ページ起動時に結果画面が表示されている場合もあるので、ここで一度試す
  //（rankPaneが無ければ何もしない）
  await refreshRanking();

  // ✅ 結果画面が表示されたタイミングでも更新できるように
  // quiz.js 側から window.onResultShown() を呼べるようにする
  window.onResultShown = async () => {
    await refreshRanking();
  };
})();
