const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const API_BASE = "https://163.44.103.65/api";
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || sessionStorage.getItem("currentWorkMode") || "accounting_only";
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const orderList = document.querySelector("#orderList");
const detailSection = document.querySelector("#detailSection");
const orderElement = document.querySelector("#order");
const totalElement = document.querySelector("#total");
const backButton = document.querySelector("#backButton");
let currentOrder = null;
if (!token || !classData) window.location.href = "index.html";
className.textContent = classData.name;

function renderDetail(order) {
  currentOrder = order; detailSection.hidden = false; orderElement.innerHTML = "";
  const head = document.createElement("p");
  head.innerHTML = order.ticket_number > 0 ? `<strong>注文番号 ${order.ticket_number}</strong>` : `<strong>番号なし</strong>`;
  orderElement.appendChild(head);
  for (const item of order.items) { const div = document.createElement("div"); div.textContent = `${item.product_name} × ${item.quantity}　${item.unit_price * item.quantity}円`; orderElement.appendChild(div); }
  totalElement.textContent = `合計 ${order.total}円`;
}

async function loadOrders() {
  const directId = Number(params.get("order_id"));
  if (Number.isInteger(directId) && directId > 0) {
    const response = await fetch(`${API_BASE}/orders/id/${directId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) { message.textContent = data.message; return; }
    orderList.hidden = true; renderDetail(data.order); return;
  }
  const endpoint = mode === "accounting_pickup" ? "unreceived" : "unpaid";
  const response = await fetch(`${API_BASE}/orders/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) { message.textContent = data.message || "注文を取得できませんでした"; return; }
  orderList.innerHTML = "";
  const targets = data.orders;
  if (targets.length === 0) {
    orderList.innerHTML = `<p>${mode === "accounting_pickup" ? "会計・受け取り待ち" : "未会計"}の注文はありません。</p>`;
    return;
  }
  for (const order of targets) {
    const button = document.createElement("button");
    button.className = "workflow-order-card";
    const state = order.status === "paid" ? "会計済み・受け取りへ" : "未会計";
    button.innerHTML = `<strong>注文番号 ${order.ticket_number}</strong><span>${state}　${order.items.map(i => `${i.product_name} × ${i.quantity}`).join(" / ")}</span><b>${order.total}円</b>`;
    button.addEventListener("click", () => {
      if (mode === "accounting_pickup" && order.status === "paid") {
        window.location.href = `pickup.html?from=work&mode=accounting_pickup&order_id=${order.id}`;
        return;
      }
      renderDetail(order);
    });
    orderList.appendChild(button);
  }
}

async function pay(method) {
  if (!currentOrder) { message.textContent = "注文を選択してください"; return; }
  try {
    const completesPickup = mode === "accounting_pickup" || mode === "order_accounting_pickup";
    const endpoint = completesPickup
      ? `${API_BASE}/orders/${currentOrder.id}/pay-and-handover`
      : `${API_BASE}/orders/${currentOrder.id}/pay`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ method })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "支払い処理に失敗しました");

    if (completesPickup) {
      message.textContent = "会計/受け取り完了";
      currentOrder = null;
      detailSection.hidden = true;
      orderList.hidden = false;
      if (mode === "accounting_pickup") await loadOrders();
      return;
    }

    if (mode === "order_accounting") { window.location.href = "work-select.html"; return; }
    message.textContent = "会計完了"; currentOrder = null; detailSection.hidden = true; orderList.hidden = false; await loadOrders();
  } catch (error) { message.textContent = error.message; }
}
document.querySelector("#cashButton").addEventListener("click", () => pay("cash"));
document.querySelector("#paypayButton").addEventListener("click", () => pay("paypay"));
backButton.addEventListener("click", () => { window.location.href = params.get("from") === "work" ? "work-select.html" : "menu.html"; });
loadOrders();
