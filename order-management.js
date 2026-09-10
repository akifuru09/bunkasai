const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));

const orderList = document.querySelector("#orderList");
const reloadButton = document.querySelector("#reloadButton");
const backButton = document.querySelector("#backButton");

const API_BASE = "https://163.44.103.65/api";

// ログインしていなければログイン画面へ
if (!token || !classData) {
  window.location.href = "index.html";
}


// 注文一覧を取得
async function loadOrders() {
  orderList.innerHTML = "<p>読み込み中...</p>";

  try {
    const response = await fetch(`${API_BASE}/orders/pending`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "注文の取得に失敗しました");
    }

    displayOrders(data.orders);

  } catch (error) {
    console.error(error);

    orderList.innerHTML = `
      <p>注文の取得に失敗しました。</p>
      <p>${error.message}</p>
    `;
  }
}


// 注文を画面に表示
function displayOrders(orders) {
  orderList.innerHTML = "";

  if (orders.length === 0) {
    orderList.innerHTML = "<p>受け渡し待ちの注文はありません。</p>";
    return;
  }

  for (const order of orders) {
    const card = document.createElement("div");
    card.className = "order-card";

    const items = order.items
      .map(item => `
        <div>
          ${item.product_name} × ${item.quantity}
        </div>
      `)
      .join("");

    card.innerHTML = `
      <h3>注文 #${order.ticket_number}</h3>

      <div class="order-items">
        ${items}
      </div>

      <p class="order-total">
        合計 ${order.total}円
      </p>

      <button class="handed-over-button">
        受け渡し済み
      </button>
    `;

    const button = card.querySelector(".handed-over-button");

    button.addEventListener("click", () => {
      handOverOrder(order.id, button);
    });

    orderList.appendChild(card);
  }
}


// 受け渡し済みにする
async function handOverOrder(orderId, button) {
  button.disabled = true;
  button.textContent = "処理中...";

  try {
    const response = await fetch(
      `${API_BASE}/orders/${orderId}/handed-over`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "処理に失敗しました");
    }

    // 一覧を更新
    await loadOrders();

  } catch (error) {
    console.error(error);

    alert(error.message);

    button.disabled = false;
    button.textContent = "受け渡し済み";
  }
}


// 更新
reloadButton.addEventListener("click", loadOrders);


// メニューに戻る
backButton.addEventListener("click", () => {
  window.location.href = "menu.html";
});


// 初回読み込み
loadOrders();