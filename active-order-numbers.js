const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class") || "null");
const currentWorker = JSON.parse(sessionStorage.getItem("currentWorker") || "null");
const API_BASE = "https://163.44.103.65/api";
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const completionNotice = document.querySelector("#completionNotice");
const orderList = document.querySelector("#orderList");
const detailSection = document.querySelector("#detailSection");
const orderElement = document.querySelector("#order");
const totalElement = document.querySelector("#total");
const paymentActions = document.querySelector("#paymentActions");
const pickupActions = document.querySelector("#pickupActions");
const cashButton = document.querySelector("#cashButton");
const paypayButton = document.querySelector("#paypayButton");
const pickupButton = document.querySelector("#pickupButton");
const backButton = document.querySelector("#backButton");
let currentOrder = null;

if (!token || !classData) window.location.href = "index.html";
if (!currentWorker) window.location.href = "worker-confirm.html";
className.textContent = `${classData.name} / ${currentWorker.attendance_number}番 ${currentWorker.name}`;

function parseUtcDate(value) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatTime(value, empty = "未会計") {
  const date = parseUtcDate(value);
  if (!date) return empty;
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
function showCompletion(text) {
  completionNotice.textContent = `✓ ${text}`;
  completionNotice.hidden = false;
  message.textContent = "";
}
function clearCompletion() {
  completionNotice.hidden = true;
  completionNotice.textContent = "";
}
function setPanel(visible) {
  detailSection.hidden = !visible;
  document.body.classList.toggle("has-workflow-action-panel", visible);
  if (!visible) {
    detailSection.classList.remove("is-waiting-payment", "is-waiting-pickup");
    paymentActions.hidden = true;
    pickupActions.hidden = true;
  }
}
function renderDetail(order) {
  clearCompletion();
  currentOrder = order;
  setPanel(true);
  document.querySelectorAll(".workflow-order-card").forEach(card => {
    card.classList.toggle("is-selected", Number(card.dataset.orderId) === Number(order.id));
  });
  orderElement.innerHTML = `<p><strong>注文番号 ${order.ticket_number}</strong></p>`;
  for (const item of order.items || []) {
    const row = document.createElement("div");
    row.textContent = `${item.product_name} × ${item.quantity}　${item.unit_price * item.quantity}円`;
    orderElement.appendChild(row);
  }
  totalElement.textContent = `合計 ${order.total}円`;

  // 会計待ちでは会計操作だけ、受け取り待ちでは受け取り操作だけを表示する。
  const isWaitingPayment = order.status === "unpaid";
  const isWaitingPickup = order.status === "paid";
  paymentActions.hidden = !isWaitingPayment;
  pickupActions.hidden = !isWaitingPickup;

  detailSection.classList.toggle("is-waiting-payment", isWaitingPayment);
  detailSection.classList.toggle("is-waiting-pickup", isWaitingPickup);
}
async function loadOrders() {
  const response = await fetch(`${API_BASE}/order-numbers/active`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "注文を取得できませんでした");
  orderList.innerHTML = "";
  if (!data.orders.length) {
    orderList.innerHTML = '<p class="records-empty">現在使用中の注文番号はありません。</p>';
    setPanel(false);
    return;
  }
  for (const order of data.orders) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workflow-order-card";
    button.dataset.orderId = String(order.id);
    const state = order.status === "paid" ? "受け取り待ち" : "会計待ち";
    const items = order.items.map(item => `${item.product_name} × ${item.quantity}`).join(" / ");
    button.innerHTML = `
      <span class="workflow-card-head"><strong>注文番号 ${order.ticket_number}</strong><span class="workflow-card-state">${state}</span></span>
      <span class="workflow-card-times"><span>注文時刻 ${formatTime(order.created_at, "－")}</span><span>会計時刻 ${formatTime(order.paid_at)}</span></span>
      <span class="workflow-card-items">${items}</span>
      <b class="workflow-card-total">${order.total}円</b>`;
    button.addEventListener("click", () => renderDetail(order));
    orderList.appendChild(button);
  }
}
async function pay(method) {
  if (!currentOrder || currentOrder.status !== "unpaid") return;
  clearCompletion();
  cashButton.disabled = paypayButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/orders/${currentOrder.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method, actor_user_id: currentWorker.id, work_mode: "accounting_only" })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "会計できませんでした");
    showCompletion(`注文番号 ${currentOrder.ticket_number} の会計完了`);
    currentOrder = null;
    setPanel(false);
    await loadOrders();
  } catch (error) { message.textContent = error.message; }
  finally { cashButton.disabled = paypayButton.disabled = false; }
}
async function pickup() {
  if (!currentOrder || currentOrder.status !== "paid") return;
  clearCompletion();
  pickupButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/orders/${currentOrder.id}/handed-over`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actor_user_id: currentWorker.id, work_mode: "pickup_only" })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "受け取り処理に失敗しました");
    showCompletion(`注文番号 ${currentOrder.ticket_number} の受け取り完了`);
    currentOrder = null;
    setPanel(false);
    await loadOrders();
  } catch (error) { message.textContent = error.message; }
  finally { pickupButton.disabled = false; }
}
cashButton.addEventListener("click", () => pay("cash"));
paypayButton.addEventListener("click", () => pay("paypay"));
pickupButton.addEventListener("click", pickup);
backButton.addEventListener("click", () => { window.location.href = "work-select.html"; });
loadOrders().catch(error => { message.textContent = error.message; });
