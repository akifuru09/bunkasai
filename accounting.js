const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const API_BASE = "https://163.44.103.65/api";
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || sessionStorage.getItem("currentWorkMode") || "accounting_only";
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const completionNotice = document.querySelector("#completionNotice");
const orderList = document.querySelector("#orderList");
const detailSection = document.querySelector("#detailSection");
const orderElement = document.querySelector("#order");
const totalElement = document.querySelector("#total");
const backButton = document.querySelector("#backButton");
let currentOrder = null;

if (!token || !classData) window.location.href = "index.html";
className.textContent = classData.name;

function showCompletion(text) {
  completionNotice.textContent = text;
  completionNotice.hidden = false;
  message.textContent = "";
}

function clearCompletion() {
  completionNotice.hidden = true;
  completionNotice.textContent = "";
}

const flashCompletion = sessionStorage.getItem("workCompletionMessage");
if (flashCompletion) {
  showCompletion(flashCompletion);
  sessionStorage.removeItem("workCompletionMessage");
}

function renderDetail(order) {
  clearCompletion();
  currentOrder = order;
  detailSection.hidden = false;
  orderElement.innerHTML = "";
  const head = document.createElement("p");
  head.innerHTML = order.ticket_number > 0
    ? `<strong>注文番号 ${order.ticket_number}</strong>`
    : `<strong>番号なし</strong>`;
  orderElement.appendChild(head);
  for (const item of order.items) {
    const div = document.createElement("div");
    div.textContent = `${item.product_name} × ${item.quantity}　${item.unit_price * item.quantity}円`;
    orderElement.appendChild(div);
  }
  totalElement.textContent = `合計 ${order.total}円`;
}

async function getJson(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${fallbackMessage}（HTTP ${response.status}）`);
  }
  return response.json();
}

async function loadOrders() {
  const directId = Number(params.get("order_id"));
  if (Number.isInteger(directId) && directId > 0) {
    const response = await fetch(`${API_BASE}/orders/id/${directId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await getJson(response, "注文を取得できませんでした");
    if (!response.ok) {
      message.textContent = data.message || "注文を取得できませんでした";
      return;
    }
    orderList.hidden = true;
    renderDetail(data.order);
    return;
  }

  const endpoint = mode === "accounting_pickup" ? "unreceived" : "unpaid";
  const response = await fetch(`${API_BASE}/orders/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await getJson(response, "注文を取得できませんでした");
  if (!response.ok) {
    message.textContent = data.message || "注文を取得できませんでした";
    return;
  }

  orderList.hidden = false;
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
      clearCompletion();
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
  if (!currentOrder) {
    message.textContent = "注文を選択してください";
    return;
  }

  clearCompletion();
  const paidOrderId = currentOrder.id;

  try {
    const completesPickup = mode === "accounting_pickup" || mode === "order_accounting_pickup";
    const response = await fetch(`${API_BASE}/orders/${paidOrderId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        method,
        complete_handover: completesPickup
      })
    });

    const data = await getJson(response, "支払い処理でサーバーエラーが発生しました");
    if (!response.ok) throw new Error(data.message || "支払い処理に失敗しました");

    if (completesPickup) {
      const verifyResponse = await fetch(`${API_BASE}/orders/id/${paidOrderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const verifyData = await getJson(verifyResponse, "注文状態を確認できませんでした");
      if (!verifyResponse.ok) throw new Error(verifyData.message || "注文状態を確認できませんでした");

      if (!verifyData.order.handed_over) {
        const handoverResponse = await fetch(`${API_BASE}/orders/${paidOrderId}/handed-over`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        const handoverData = await getJson(handoverResponse, "受け取り処理でサーバーエラーが発生しました");
        if (!handoverResponse.ok) throw new Error(handoverData.message || "受け取り完了にできませんでした");
      }

      if (mode === "order_accounting_pickup") {
        sessionStorage.setItem("workCompletionMessage", "注文・会計/受け取り完了");
        window.location.href = "order.html?from=work&mode=order_accounting_pickup";
        return;
      }

      showCompletion("会計/受け取り完了");
      currentOrder = null;
      detailSection.hidden = true;
      orderList.hidden = false;
      await loadOrders();
      return;
    }

    if (mode === "order_accounting") {
      sessionStorage.setItem("workCompletionMessage", "注文・会計完了");
      window.location.href = "order.html?from=work&mode=order_accounting";
      return;
    }

    showCompletion("会計完了");
    currentOrder = null;
    detailSection.hidden = true;
    orderList.hidden = false;
    await loadOrders();
  } catch (error) {
    message.textContent = error.message;
  }
}

document.querySelector("#cashButton").addEventListener("click", () => pay("cash"));
document.querySelector("#paypayButton").addEventListener("click", () => pay("paypay"));
backButton.addEventListener("click", () => {
  window.location.href = params.get("from") === "work" ? "work-select.html" : "menu.html";
});

loadOrders().catch(error => {
  message.textContent = error.message || "注文を取得できませんでした";
});
