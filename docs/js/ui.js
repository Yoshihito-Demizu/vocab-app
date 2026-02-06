function $(id) {
  return document.getElementById(id);
}

function setText(id, text, cls = "") {
  const el = $(id);
  if (!el) return;
  el.className = cls ? cls : "";
  el.textContent = text;
}

function clearList(id) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = "";
}

function appendLi(id, text) {
  const el = $(id);
  if (!el) return;
  const li = document.createElement("li");
  li.textContent = text;
  el.appendChild(li);
}

function setModeBadge() {
  const el = $("modeBadge");
  if (!el) return;
  if (api?.isMock?.()) {
    el.textContent = "ダミーモード";
    el.className = "badge mock";
  } else {
    el.textContent = "本番モード";
    el.className = "badge prod";
  }
}
