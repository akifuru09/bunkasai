const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const currentWorker = JSON.parse(sessionStorage.getItem("currentWorker"));
const API_BASE = "https://163.44.103.65/api";
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const workList = document.querySelector("#workList");
const backButton = document.querySelector("#backButton");

if (!token || !classData) window.location.href = "index.html";
if (!currentWorker) window.location.href = "worker-confirm.html";
className.textContent = `${classData.name} / ${currentWorker.attendance_number}番 ${currentWorker.name}`;

const modes = [
  ["order_only", "注文のみ", "注文を受け付ける"],
  ["accounting_only", "会計のみ", "未会計の注文を会計する"],
  ["pickup_only", "受け取りのみ", "会計済みの商品を渡す"],
  ["order_accounting", "注文・会計", "注文して、そのまま会計する"],
  ["accounting_pickup", "会計・受け取り", "会計から受け取りまで行う"],
  ["order_accounting_pickup", "注文・会計・受け取り", "その場で注文から受け取りまで完了する"]
];

async function startWork(key, name, button) {
  button.disabled = true;
  message.textContent = "業務を開始しています...";
  try {
    const response = await fetch(`${API_BASE}/work-records/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ workMode: key, userId: currentWorker.id })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "業務を開始できませんでした");
    sessionStorage.setItem("currentWorkMode", key);
    sessionStorage.setItem("selectedWork", JSON.stringify({ key, name }));
    sessionStorage.setItem("currentWorkRecordId", String(data.recordId));
    window.location.href = data.work.page;
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
}

for (const [key, name, description] of modes) {
  const button = document.createElement("button");
  button.className = "work-mode-button";
  button.innerHTML = `<strong>${name}</strong><span>${description}</span>`;
  button.addEventListener("click", () => startWork(key, name, button));
  workList.appendChild(button);
}

backButton.addEventListener("click", () => {
  sessionStorage.removeItem("currentWorker");
  window.location.href = "worker-confirm.html";
});
