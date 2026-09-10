const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const currentWorker = JSON.parse(sessionStorage.getItem("currentWorker") || "null");
const API_BASE = "https://163.44.103.65/api";
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || sessionStorage.getItem("currentWorkMode") || "pickup_only";
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const completionNotice = document.querySelector("#completionNotice");
const orderList = document.querySelector("#orderList");
const detailSection = document.querySelector("#detailSection");
const orderElement = document.querySelector("#order");
const totalElement = document.querySelector("#total");
const editOrderButton = document.querySelector("#editOrderButton");
const pickupButton = document.querySelector("#pickupButton");
const backButton = document.querySelector("#backButton");
const correctionButton = document.querySelector("#correctionButton");
const correctionPanel = document.querySelector("#correctionPanel");
const correctionCloseButton = document.querySelector("#correctionCloseButton");
const correctionList = document.querySelector("#correctionList");
const correctionMessage = document.querySelector("#correctionMessage");
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
  const h = document.createElement("p");
  h.innerHTML = order.ticket_number > 0
    ? `<strong>注文番号 ${order.ticket_number}</strong>`
    : `<strong>番号なし</strong>`;
  orderElement.appendChild(h);
  for (const item of order.items) {
    const d = document.createElement("div");
    d.textContent = `${item.product_name} × ${item.quantity}`;
    orderElement.appendChild(d);
  }
  totalElement.textContent = `合計 ${order.total}円`;
  const canEditFromPickup = order.status === "paid" && order.handed_over !== 1;
  editOrderButton.disabled = !canEditFromPickup;
  editOrderButton.textContent = canEditFromPickup ? "注文内容を訂正" : "会計完了後に訂正できます";
  pickupButton.disabled = order.status !== "paid";
  pickupButton.textContent = order.status === "paid" ? "受け取り完了" : "会計が完了していません";
}

async function loadOrders() {
  const directId = Number(params.get("order_id"));
  if (Number.isInteger(directId) && directId > 0) {
    const r = await fetch(`${API_BASE}/orders/id/${directId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    if (!r.ok) {
      message.textContent = d.message;
      return;
    }
    orderList.hidden = true;
    renderDetail(d.order);
    return;
  }

  const r = await fetch(`${API_BASE}/orders/unreceived`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const d = await r.json();
  if (!r.ok) {
    message.textContent = d.message;
    return;
  }

  orderList.hidden = false;
  orderList.innerHTML = "";
  if (d.orders.length === 0) {
    orderList.innerHTML = "<p>未受け取りの注文はありません。</p>";
    return;
  }

  for (const order of d.orders) {
    const b = document.createElement("button");
    b.className = "workflow-order-card";
    const state = order.status === "paid" ? "会計済み" : "会計待ち";
    b.innerHTML = `<strong>注文番号 ${order.ticket_number}</strong><span>${state}</span><span>${order.items.map(i => `${i.product_name} × ${i.quantity}`).join(" / ")}</span>`;
    b.addEventListener("click", () => renderDetail(order));
    orderList.appendChild(b);
  }
}

editOrderButton.addEventListener("click", () => {
  if (!currentOrder) return;
  window.location.href = `order.html?edit_order=${currentOrder.id}&mode=${encodeURIComponent(mode)}&from=pickup`;
});

pickupButton.addEventListener("click", async () => {
  if (!currentOrder || currentOrder.status !== "paid") return;

  clearCompletion();
  pickupButton.disabled = true;

  try {
    const r = await fetch(`${API_BASE}/orders/${currentOrder.id}/handed-over`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actor_user_id: currentWorker?.id || null, work_mode: mode })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || "受け取り処理に失敗しました");

    if (mode === "accounting_pickup") {
      sessionStorage.setItem("workCompletionMessage", "受け取り完了");
      window.location.href = "accounting.html?from=work&mode=accounting_pickup";
      return;
    }

    showCompletion("受け取り完了");
    currentOrder = null;
    detailSection.hidden = true;
    orderList.hidden = false;
    await loadOrders();
  } catch (e) {
    message.textContent = e.message;
    pickupButton.disabled = false;
  }
});


async function correctionRequest(orderId, action) {
  correctionMessage.textContent = "処理しています...";
  const r = await fetch(`${API_BASE}/corrections/${orderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, actor_user_id: currentWorker?.id || null, work_mode: mode })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "訂正できませんでした");
  correctionMessage.textContent = d.message;
  await loadCorrections();
  await loadOrders();
}

async function loadCorrections() {
  correctionList.innerHTML = "<p>読み込み中...</p>";
  const r = await fetch(`${API_BASE}/corrections/recent?work_mode=${encodeURIComponent(mode)}`, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "最近の操作を取得できませんでした");
  correctionList.innerHTML = "";
  if (!d.orders.length) { correctionList.innerHTML = "<p>訂正できる最近の操作はまだありません。</p>"; return; }
  for (const order of d.orders) {
    const card = document.createElement("article"); card.className = "correction-card";
    const actor = order.latest_operation?.attendance_number ? `${order.latest_operation.attendance_number}番 ${order.latest_operation.user_name}` : "担当者記録なし";
    card.innerHTML = `<div class="correction-card-head"><strong>注文番号 ${order.ticket_number}</strong><span>${order.handed_over ? "受け取り済み" : "未受け取り"}</span></div><p>${order.items.map(i => `${i.product_name} × ${i.quantity}`).join(" / ")}</p><small>${actor}</small>`;
    const actions = document.createElement("div"); actions.className = "correction-actions";
    if (order.status === "paid" && !order.handed_over) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "correction-action";
      edit.textContent = "注文内容を訂正";
      edit.addEventListener("click", () => {
        window.location.href = `order.html?edit_order=${order.id}&mode=${encodeURIComponent(mode)}&from=pickup`;
      });
      actions.appendChild(edit);
    }
    if (order.status === "paid" && order.handed_over) {
      const b=document.createElement("button"); b.type="button"; b.className="correction-action destructive"; b.textContent="受け取り完了を取り消す";
      b.addEventListener("click", async()=>{ try { await correctionRequest(order.id,"undo_handover"); } catch(e){ correctionMessage.textContent=e.message; } }); actions.appendChild(b);
    }
    if (!actions.children.length) {
      const n=document.createElement("p"); n.className="correction-none"; n.textContent="現在この画面から行える訂正はありません。"; actions.appendChild(n);
    }
    card.appendChild(actions); correctionList.appendChild(card);
  }
}

correctionButton.addEventListener("click", async () => {
  correctionPanel.hidden = false; correctionMessage.textContent = "";
  try { await loadCorrections(); } catch (error) { correctionMessage.textContent = error.message; }
});
correctionCloseButton.addEventListener("click", () => { correctionPanel.hidden = true; });
correctionPanel.addEventListener("click", event => { if (event.target === correctionPanel) correctionPanel.hidden = true; });

backButton.addEventListener("click", () => {
  window.location.href = params.get("from") === "work" ? "work-select.html" : "menu.html";
});

loadOrders();
