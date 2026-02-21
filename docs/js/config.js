// ===== 強化モードバッジ =====
window.addEventListener("DOMContentLoaded", () => {
  const badge = document.createElement("div");

  function render() {
    const mode = window.USE_MOCK ? "MOCK" : "PROD";
    badge.textContent = `MODE: ${mode}`;
    badge.style.background =
      window.USE_MOCK ? "rgba(0,211,138,.25)" : "rgba(255,59,48,.25)";
  }

  badge.style.position = "fixed";
  badge.style.top = "10px";
  badge.style.right = "10px";
  badge.style.zIndex = "99999";
  badge.style.padding = "8px 14px";
  badge.style.borderRadius = "999px";
  badge.style.fontWeight = "900";
  badge.style.fontSize = "13px";
  badge.style.border = "1px solid rgba(255,255,255,.25)";
  badge.style.color = "white";
  badge.style.backdropFilter = "blur(8px)";
  badge.style.cursor = "pointer";
  badge.title = "クリックでモード切替（完全リロード）";

  badge.addEventListener("click", () => {
    const next = window.USE_MOCK ? "prod" : "mock";

    // localStorage完全クリア（事故防止）
    localStorage.removeItem("vocab_mode");

    localStorage.setItem("vocab_mode", next);

    alert(`モードを ${next.toUpperCase()} に変更します。完全リロードします。`);

    location.href = location.pathname + `?mode=${next}&t=${Date.now()}`;
  });

  render();
  document.body.appendChild(badge);
});
