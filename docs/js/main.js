// docs/js/main.js
console.log("[main] loaded! (buttons+login+sw-update)");

/* global api */

function $(id){ return document.getElementById(id); }

function setLoginMsg(t){
  const el = $("loginMsg");
  if (el) el.textContent = t || "";
}

async function refreshLoginBox(){
  const box = $("loginBox");
  if (!box) return;

  if (api.isMock()) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  const uid = await api.getMyUserId();
  setLoginMsg(uid ? `ログイン中：${uid}` : "未ログイン（本番送信にはログインが必要）");
}

$("startBtn")?.addEventListener("click", () => window.startGame?.());
$("retryBtn")?.addEventListener("click", () => window.startGame?.());
$("stopBtn")?.addEventListener("click", () => window.endGame?.());

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

refreshLoginBox();

// ========= PWA 更新通知 =========
function ensureUpdateBanner(){
  let bar = document.getElementById("updateBar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "updateBar";
  bar.style.position = "fixed";
  bar.style.left = "10px";
  bar.style.right = "10px";
  bar.style.bottom = "12px";
  bar.style.zIndex = "99999";
  bar.style.padding = "12px 12px";
  bar.style.borderRadius = "14px";
  bar.style.border = "1px solid rgba(255,255,255,.18)";
  bar.style.background = "rgba(10,16,36,.92)";
  bar.style.backdropFilter = "blur(8px)";
  bar.style.color = "white";
  bar.style.display = "none";
  bar.style.boxShadow = "0 18px 50px rgba(0,0,0,.35)";

  bar.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
      <div style="font-weight:900;">新しいバージョンがあります</div>
      <div style="display:flex; gap:8px;">
        <button id="updateBtn" style="border:none;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer;background:#ff3b30;color:white;">更新</button>
        <button id="updateHideBtn" style="border:none;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer;background:rgba(255,255,255,.12);color:white;">あとで</button>
      </div>
    </div>
  `;
  document.body.appendChild(bar);

  document.getElementById("updateHideBtn")?.addEventListener("click", () => {
    bar.style.display = "none";
  });

  return bar;
}

function showUpdateBanner(waitingSW){
  const bar = ensureUpdateBanner();
  bar.style.display = "block";

  document.getElementById("updateBtn")?.addEventListener("click", () => {
    try {
      waitingSW?.postMessage({ type: "SKIP_WAITING" });
    } catch {}

    // controllerchange でリロード
  }, { once: true });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    // すでに待機中のSWがいるなら出す
    if (reg.waiting) showUpdateBanner(reg.waiting);

    // 更新が見つかったら
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // 新SWが入った（ただしまだ待機）→ 更新ボタン出す
          showUpdateBanner(newWorker);
        }
      });
    });

    // 新SWが有効化されたらリロード
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      location.reload();
    });
  }).catch(() => null);
}
