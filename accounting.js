const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const currentWorker = JSON.parse(sessionStorage.getItem("currentWorker") || "null");
const API_BASE = "https://163.44.103.65/api";
const params = new URLSearchParams(window.location.search);
const requestedMode = params.get("mode") || "accounting_only";

// 「注文・会計・受け取り」は注文画面内で会計まで完結する。
// 古いURLや古い画面遷移で accounting.html に来ても、ここでは扱わない。
if (requestedMode === "order_accounting_pickup") {
  window.location.replace("order.html?from=work&mode=order_accounting_pickup");
}

// 会計画面はURLで明示された会計系モードだけを採用する。
// sessionStorage の古い業務モードで別モードに化けるのを防ぐ。
const mode = ["accounting_only", "accounting_pickup", "order_accounting"].includes(requestedMode)
  ? requestedMode
  : "accounting_only";

const WORK_MODE_TITLES = {
  order_only: "注文のみ",
  accounting_only: "会計のみ",
  pickup_only: "受け取りのみ",
  order_accounting: "注文・会計",
  accounting_pickup: "会計・受け取り",
  order_accounting_pickup: "注文・会計・受け取り"
};

function applyWorkModeTitle(modeValue) {
  const title = WORK_MODE_TITLES[modeValue] || "業務";
  const heading = document.querySelector("#pageTitle");
  if (heading) heading.textContent = title;
  document.title = `${title} - 文化祭システム`;
}
const className = document.querySelector("#className");
const message = document.querySelector("#message");
const completionNotice = document.querySelector("#completionNotice");
const orderList = document.querySelector("#orderList");
const detailSection = document.querySelector("#detailSection");
const orderElement = document.querySelector("#order");
const totalElement = document.querySelector("#total");
const editOrderButton = document.querySelector("#editOrderButton");
const backButton = document.querySelector("#backButton");
const correctionButton = document.querySelector("#correctionButton");
const correctionPanel = document.querySelector("#correctionPanel");
const correctionCloseButton = document.querySelector("#correctionCloseButton");
const correctionList = document.querySelector("#correctionList");
const correctionMessage = document.querySelector("#correctionMessage");
let currentOrder = null;
let selectedOrderId = null;
const pageRestoreContext = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "_");
let lastRestoreToken = null;

if (!token || !classData) window.location.href = "index.html";
applyWorkModeTitle(mode);
className.textContent = classData.name;

function applyRestoreButtonLabel() {
  correctionButton.textContent = mode === "accounting_pickup"
    ? "直前の会計/受け取りを復元"
    : "直前の会計を復元";
}
applyRestoreButtonLabel();
function updateRestoreButtonState() {
  correctionButton.disabled = !lastRestoreToken;
}
updateRestoreButtonState();


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

function setActionPanelVisible(visible) {
  detailSection.hidden = !visible;
  document.body.classList.toggle("has-workflow-action-panel", visible);
}

function markSelectedOrder(orderId) {
  selectedOrderId = orderId;
  document.querySelectorAll(".workflow-order-card").forEach(card => {
    card.classList.toggle("is-selected", Number(card.dataset.orderId) === Number(orderId));
  });
}

function clearSelection() {
  currentOrder = null;
  selectedOrderId = null;
  editOrderButton.hidden = true;
  setActionPanelVisible(false);
  document.querySelectorAll(".workflow-order-card.is-selected").forEach(card => card.classList.remove("is-selected"));
}

function renderDetail(order) {
  clearCompletion();
  currentOrder = order;
  setActionPanelVisible(true);
  markSelectedOrder(order.id);
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
  const canEditBeforePayment = mode === "order_accounting" && order.status === "unpaid" && order.handed_over !== 1;
  editOrderButton.hidden = !canEditBeforePayment;
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
    button.dataset.orderId = String(order.id);
    const state = order.status === "paid" ? "会計済み・受け取りへ" : "未会計";
    const itemsText = order.items.map(i => `${i.product_name} × ${i.quantity}`).join(" / ");
    button.innerHTML = `
      <span class="workflow-card-head">
        <strong>注文番号 ${order.ticket_number}</strong>
        <span class="workflow-card-state">${state}</span>
      </span>
      <span class="workflow-card-items">${itemsText}</span>
      <b class="workflow-card-total">${order.total}円</b>
    `;
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

  if (selectedOrderId !== null) markSelectedOrder(selectedOrderId);
}

async function pay(method) {
  if (!currentOrder) {
    message.textContent = "注文を選択してください";
    return;
  }

  clearCompletion();
  const paidOrderId = currentOrder.id;

  try {
    const completesPickup = mode === "accounting_pickup";
    const response = await fetch(`${API_BASE}/orders/${paidOrderId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        method,
        complete_handover: completesPickup,
        actor_user_id: currentWorker?.id || null,
        work_mode: mode,
        restore_context_id: pageRestoreContext
      })
    });

    const data = await getJson(response, "支払い処理でサーバーエラーが発生しました");
    if (!response.ok) throw new Error(data.message || "支払い処理に失敗しました");
    lastRestoreToken = data.restore_token || null;
    updateRestoreButtonState();

    if (completesPickup) {
      const verifyResponse = await fetch(`${API_BASE}/orders/id/${paidOrderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const verifyData = await getJson(verifyResponse, "注文状態を確認できませんでした");
      if (!verifyResponse.ok) throw new Error(verifyData.message || "注文状態を確認できませんでした");

      if (!verifyData.order.handed_over) {
        const handoverResponse = await fetch(`${API_BASE}/orders/${paidOrderId}/handed-over`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ actor_user_id: currentWorker?.id || null, work_mode: mode })
        });
        const handoverData = await getJson(handoverResponse, "受け取り処理でサーバーエラーが発生しました");
        if (!handoverResponse.ok) throw new Error(handoverData.message || "受け取り完了にできませんでした");
      }

      showCompletion("会計/受け取り完了");
      clearSelection();
      orderList.hidden = false;
      await loadOrders();
      return;
    }

    if (mode === "order_accounting") {
      // 非同期処理後でも確実に同じ注文番号を使えるよう、会計直前の注文番号を明示的に渡す。
      const completedTicketNumber = Number(currentOrder.ticket_number);
      sessionStorage.setItem("workCompletionMessage", `注文・会計完了（注文番号 ${completedTicketNumber}）`);
      const restorePart = lastRestoreToken
        ? `&restore_token=${encodeURIComponent(lastRestoreToken)}&restore_context=${encodeURIComponent(pageRestoreContext)}`
        : "";
      const ticketPart = Number.isFinite(completedTicketNumber) && completedTicketNumber > 0
        ? `&completed_ticket=${encodeURIComponent(completedTicketNumber)}`
        : "";
      window.location.href = `order.html?from=work&mode=order_accounting${ticketPart}${restorePart}`;
      return;
    }

    showCompletion("会計完了");
    clearSelection();
    orderList.hidden = false;
    await loadOrders();
  } catch (error) {
    message.textContent = error.message;
  }
}

editOrderButton.addEventListener("click", () => {
  if (!currentOrder || mode !== "order_accounting" || currentOrder.status !== "unpaid") return;
  window.location.href = `order.html?edit_order=${currentOrder.id}&mode=order_accounting&from=accounting`;
});

document.querySelector("#cashButton").addEventListener("click", () => pay("cash"));
document.querySelector("#paypayButton").addEventListener("click", () => pay("paypay"));


async function restoreLastAccounting() {
  clearCompletion();
  correctionButton.disabled = true;
  message.textContent = "直前の操作を復元しています...";

  try {
    if (!lastRestoreToken) throw new Error("この画面で復元できる直前の会計はありません");
    const response = await fetch(`${API_BASE}/restore-last`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        restore_token: lastRestoreToken,
        restore_context_id: pageRestoreContext,
        actor_user_id: currentWorker?.id || null,
        work_mode: mode
      })
    });
    const data = await getJson(response, "復元処理でサーバーエラーが発生しました");
    if (!response.ok) throw new Error(data.message || "直前の操作を復元できませんでした");

    lastRestoreToken = null;
    updateRestoreButtonState();
    orderList.hidden = false;
    await loadOrders();
    renderDetail(data.order);
    showCompletion(data.message);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    updateRestoreButtonState();
  }
}

async function correctionRequest(orderId, action, extra = {}) {
  correctionMessage.textContent = "処理しています...";
  const response = await fetch(`${API_BASE}/corrections/${orderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...extra, actor_user_id: currentWorker?.id || null, work_mode: mode })
  });
  const data = await getJson(response, "訂正処理でサーバーエラーが発生しました");
  if (!response.ok) throw new Error(data.message || "訂正できませんでした");
  correctionMessage.textContent = data.message;
  await loadCorrections();
  await loadOrders();
}

function addCorrectionAction(container, text, action, order, extra = {}, destructive = false) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = text;
  b.className = destructive ? "correction-action destructive" : "correction-action";
  b.addEventListener("click", async () => {
    try { await correctionRequest(order.id, action, extra); }
    catch (error) { correctionMessage.textContent = error.message; }
  });
  container.appendChild(b);
}

async function loadCorrections() {
  correctionList.innerHTML = "<p>読み込み中...</p>";
  const response = await fetch(`${API_BASE}/corrections/recent?work_mode=${encodeURIComponent(mode)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await getJson(response, "最近の操作を取得できませんでした");
  if (!response.ok) throw new Error(data.message || "最近の操作を取得できませんでした");
  correctionList.innerHTML = "";
  if (!data.orders.length) { correctionList.innerHTML = "<p>訂正できる最近の操作はまだありません。</p>"; return; }

  for (const order of data.orders) {
    const card = document.createElement("article"); card.className = "correction-card";
    const actor = order.latest_operation?.attendance_number ? `${order.latest_operation.attendance_number}番 ${order.latest_operation.user_name}` : "担当者記録なし";
    const method = order.payment?.method === "cash" ? "現金" : order.payment?.method === "paypay" ? "PayPay" : "未会計";
    card.innerHTML = `<div class="correction-card-head"><strong>注文番号 ${order.ticket_number}</strong><span>${method}</span></div><p>${order.items.map(i => `${i.product_name} × ${i.quantity}`).join(" / ")}</p><small>${actor}</small>`;
    const actions = document.createElement("div"); actions.className = "correction-actions";

    if (order.payment && order.status === "paid") {
      const nextMethod = order.payment.method === "cash" ? "paypay" : "cash";
      addCorrectionAction(actions, `支払いを${nextMethod === "cash" ? "現金" : "PayPay"}に訂正`, "change_payment_method", order, { new_method: nextMethod });
    }
    if (mode === "accounting_only" && order.status === "paid" && !order.handed_over) {
      addCorrectionAction(actions, "会計を取り消す", "undo_payment", order, {}, true);
    }
    if (mode === "accounting_pickup" && order.status === "paid" && order.handed_over) {
      const latestType = order.latest_operation?.action_type;
      if (latestType === "handover_completed") addCorrectionAction(actions, "受け取り完了を取り消す", "undo_handover", order, {}, true);
      else addCorrectionAction(actions, "会計/受け取りを取り消す", "undo_payment_handover", order, {}, true);
    }
    if (!actions.children.length) { const n=document.createElement("p"); n.className="correction-none"; n.textContent="現在この画面から行える訂正はありません。"; actions.appendChild(n); }
    card.appendChild(actions); correctionList.appendChild(card);
  }
}

correctionButton.addEventListener("click", restoreLastAccounting);
correctionCloseButton.addEventListener("click", () => { correctionPanel.hidden = true; });
correctionPanel.addEventListener("click", event => { if (event.target === correctionPanel) correctionPanel.hidden = true; });

window.addEventListener("pagehide", () => {
  lastRestoreToken = null;
});

backButton.addEventListener("click", () => {
  window.location.href = params.get("from") === "work" ? "work-select.html" : "menu.html";
});

loadOrders().catch(error => {
  message.textContent = error.message || "注文を取得できませんでした";
});
