const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class") || "null");
const currentWorker = JSON.parse(sessionStorage.getItem("currentWorker") || "null");
const API_BASE = "https://163.44.103.65/api";
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const numberList = document.querySelector("#numberList");
const numberPanel = document.querySelector("#numberPanel");
const numberDetail = document.querySelector("#numberDetail");
const numberActions = document.querySelector("#numberActions");
const backButton = document.querySelector("#backButton");
let currentNumber = null;

if (!token || !classData) window.location.href = "index.html";
if (!currentWorker) window.location.href = "worker-confirm.html";
className.textContent = `${classData.name} / ${currentWorker.attendance_number}番 ${currentWorker.name}`;

const STATE_LABELS = {
  available: "空き",
  waiting_payment: "会計待ち",
  waiting_pickup: "受け取り待ち",
  disabled: "使用不可"
};
function setPanel(visible) {
  numberPanel.hidden = !visible;
  document.body.classList.toggle("has-workflow-action-panel", visible);
}
function renderPanel(item) {
  currentNumber = item;
  setPanel(true);
  document.querySelectorAll(".all-ticket-card").forEach(card => {
    card.classList.toggle("is-selected", Number(card.dataset.number) === Number(item.number));
  });
  numberDetail.innerHTML = `<p><strong>注文番号 ${item.number}</strong></p><p>状態：${STATE_LABELS[item.state]}</p>`;
  if (item.order) {
    for (const product of item.order.items || []) {
      const row = document.createElement("div");
      row.textContent = `${product.product_name} × ${product.quantity}`;
      numberDetail.appendChild(row);
    }
  }
  numberActions.innerHTML = "";
  if (item.state === "available" || item.state === "disabled") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.state === "available" ? "使用不可にする" : "使用可能に戻す";
    if (item.state === "available") button.classList.add("destructive-secondary");
    button.addEventListener("click", () => updateAvailability(item.number, item.state === "available"));
    numberActions.appendChild(button);
  } else {
    const note = document.createElement("p");
    note.className = "ticket-busy-note";
    note.textContent = "使用中の番号は使用不可へ変更できません。会計・受け取り操作は「使用中の注文番号」から行えます。";
    numberActions.appendChild(note);
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "使用中の注文番号を開く";
    open.addEventListener("click", () => { window.location.href = "active-order-numbers.html"; });
    numberActions.appendChild(open);
  }
}
async function loadNumbers() {
  const response = await fetch(`${API_BASE}/order-numbers/all`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "注文番号を取得できませんでした");
  numberList.innerHTML = "";
  for (const item of data.numbers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `all-ticket-card is-${item.state}`;
    button.dataset.number = String(item.number);
    button.innerHTML = `<strong>${item.number}</strong><span>${STATE_LABELS[item.state]}</span>`;
    button.addEventListener("click", () => renderPanel(item));
    numberList.appendChild(button);
  }
}
async function updateAvailability(number, disabled) {
  message.textContent = disabled ? "使用不可に設定しています..." : "使用可能に戻しています...";
  try {
    const response = await fetch(`${API_BASE}/order-numbers/${number}/availability`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ disabled, actor_user_id: currentWorker.id })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "変更できませんでした");
    message.textContent = disabled ? `注文番号 ${number} を使用不可にしました` : `注文番号 ${number} を使用可能に戻しました`;
    currentNumber = null;
    setPanel(false);
    await loadNumbers();
  } catch (error) { message.textContent = error.message; }
}
backButton.addEventListener("click", () => { window.location.href = "work-select.html"; });
loadNumbers().catch(error => { message.textContent = error.message; });
