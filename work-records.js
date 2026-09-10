const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));

const API_BASE = "https://163.44.103.65/api";
const AUTO_REFRESH_MS = 3000;

const className = document.querySelector("#className");
const message = document.querySelector("#message");
const recordList = document.querySelector("#recordList");
const reloadButton = document.querySelector("#reloadButton");
const backButton = document.querySelector("#backButton");

if (!token || !classData) {
  window.location.href = "index.html";
}

className.textContent = classData.name;

function parseUtcDate(value) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  const date = parseUtcDate(value);
  if (!date) return "－";
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPaymentMethod(method) {
  if (method === "cash") return "現金";
  if (method === "paypay") return "PayPay";
  return "－";
}

function getStateInfo(record) {
  if (record.state === "completed") {
    return { label: "完了", className: "is-completed" };
  }
  if (record.state === "waiting_pickup") {
    return { label: "受け取り待ち", className: "is-waiting-pickup" };
  }
  return { label: "会計待ち", className: "is-waiting-payment" };
}

function renderRecords(records) {
  recordList.innerHTML = "";

  if (!records.length) {
    recordList.innerHTML = '<p class="records-empty">注文番号付きの注文はまだありません。</p>';
    return;
  }

  for (const record of records) {
    const state = getStateInfo(record);
    const card = document.createElement("article");
    card.className = "order-status-card";

    const header = document.createElement("div");
    header.className = "order-status-card-header";

    const number = document.createElement("h2");
    number.textContent = `注文番号 ${record.ticket_number}`;

    const badge = document.createElement("span");
    badge.className = `order-status-badge ${state.className}`;
    badge.textContent = state.label;

    header.append(number, badge);

    const itemList = document.createElement("div");
    itemList.className = "order-status-items";
    for (const item of record.items) {
      const row = document.createElement("div");
      row.className = "order-status-item";
      row.innerHTML = `<span>${escapeHtml(item.product_name)}</span><strong>× ${item.quantity}</strong>`;
      itemList.appendChild(row);
    }

    const meta = document.createElement("dl");
    meta.className = "order-status-meta";
    meta.innerHTML = `
      <div><dt>注文時刻</dt><dd>${formatTime(record.created_at)}</dd></div>
      <div><dt>会計時刻</dt><dd>${formatTime(record.paid_at)}</dd></div>
      <div><dt>受け取り時刻</dt><dd>${formatTime(record.handed_over_at)}</dd></div>
      <div><dt>支払い方法</dt><dd>${formatPaymentMethod(record.payment_method)}</dd></div>
    `;

    const total = document.createElement("p");
    total.className = "order-status-total";
    total.textContent = `合計 ${record.total}円`;

    card.append(header, itemList, meta, total);
    recordList.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadRecords({ silent = false } = {}) {
  if (!silent) message.textContent = "更新中...";
  reloadButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/orders/status-records`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`サーバーからJSON以外の応答が返りました（HTTP ${response.status}）`);
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "注文状況の取得に失敗しました");
    }

    renderRecords(data.records || []);
    message.textContent = "";
  } catch (error) {
    console.error(error);
    message.textContent = error.message || "サーバーに接続できませんでした";
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener("click", () => loadRecords());
backButton.addEventListener("click", () => {
  window.location.href = "menu.html";
});

loadRecords();
const refreshTimer = setInterval(() => loadRecords({ silent: true }), AUTO_REFRESH_MS);
window.addEventListener("beforeunload", () => clearInterval(refreshTimer));
