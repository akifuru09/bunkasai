const token =
  localStorage.getItem("token");

const classData =
  JSON.parse(
    localStorage.getItem("class")
  );


const API_BASE =
  "https://163.44.103.65/api";


const className =
  document.querySelector("#className");

const ticketNumber =
  document.querySelector("#ticketNumber");

const searchButton =
  document.querySelector("#searchButton");

const ticketKeypad =
  document.querySelector("#ticketKeypad");

const orderElement =
  document.querySelector("#order");

const totalElement =
  document.querySelector("#total");

const paymentSection =
  document.querySelector("#paymentSection");

const message =
  document.querySelector("#message");

const backButton =
  document.querySelector("#backButton");


let currentOrder = null;

function createNumericKeypad(container, input, { maxLength = 2 } = {}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"];

  for (const key of keys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "keypad-key";

    if (key === "clear") {
      button.textContent = "消去";
      button.classList.add("keypad-key-secondary");
    } else if (key === "backspace") {
      button.textContent = "⌫";
      button.setAttribute("aria-label", "1文字削除");
      button.classList.add("keypad-key-secondary");
    } else {
      button.textContent = key;
    }

    button.addEventListener("click", () => {
      if (key === "clear") {
        input.value = "";
      } else if (key === "backspace") {
        input.value = input.value.slice(0, -1);
      } else if (input.value.length < maxLength) {
        input.value += key;
      }
    });

    container.appendChild(button);
  }
}

createNumericKeypad(ticketKeypad, ticketNumber, { maxLength: 2 });


// ログイン確認
if (!token || !classData) {
  window.location.href =
    "index.html";
}


className.textContent =
  classData.name;


// 注文検索
searchButton.addEventListener(
  "click",
  async () => {

    const ticket =
      Number(ticketNumber.value);


    if (
      !Number.isInteger(ticket) ||
      ticket < 1 ||
      ticket > 50
    ) {

      message.textContent =
        "チケット番号は1〜50で入力してください";

      return;
    }


    try {

      const response = await fetch(
        `${API_BASE}/orders/ticket/${ticket}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );


      const data =
        await response.json();


      if (!response.ok) {

        message.textContent =
          data.message ||
          "注文を取得できませんでした";

        orderElement.innerHTML = "";
        totalElement.textContent = "";
        paymentSection.style.display =
          "none";

        currentOrder = null;

        return;
      }


      currentOrder =
        data.order;


      orderElement.innerHTML = "";


      for (
        const item
        of currentOrder.items
      ) {

        const div =
          document.createElement("div");

        div.textContent =
          `${item.product_name} × ${item.quantity}　¥${item.unit_price * item.quantity}`;

        orderElement.appendChild(div);
      }


      totalElement.textContent =
        `合計 ¥${currentOrder.total}`;

      paymentSection.style.display =
        "block";

      message.textContent = "";


    } catch (error) {

      console.error(error);

      message.textContent =
        "注文を取得できませんでした";
    }
  }
);


// 支払い
async function pay(method) {

  if (!currentOrder) {

    message.textContent =
      "先に注文を検索してください";

    return;
  }


  try {

    const response = await fetch(
      `${API_BASE}/orders/${currentOrder.id}/pay`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body: JSON.stringify({
          method
        })
      }
    );


    const data =
      await response.json();


    if (!response.ok) {

      message.textContent =
        data.message ||
        "支払い処理に失敗しました";

      return;
    }


    message.textContent =
      `支払い完了（${
        method === "cash"
          ? "現金"
          : "PayPay"
      }）`;


    paymentSection.style.display =
      "none";

    orderElement.innerHTML = "";
    totalElement.textContent = "";

    ticketNumber.value = "";

    currentOrder = null;


  } catch (error) {

    console.error(error);

    message.textContent =
      "支払い処理に失敗しました";
  }
}


document
  .querySelector("#cashButton")
  .addEventListener(
    "click",
    () => {
      pay("cash");
    }
  );


document
  .querySelector("#paypayButton")
  .addEventListener(
    "click",
    () => {
      pay("paypay");
    }
  );


// 戻る
// 業務画面から来た場合は、直前の業務画面へ戻る。
// 通常利用の場合はメニューへ戻る。
backButton.addEventListener(
  "click",
  () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("from") === "work") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "work-screen.html";
      }
      return;
    }

    window.location.href = "menu.html";
  }
);
