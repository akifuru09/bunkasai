const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const API_BASE = "https://163.44.103.65/api";
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || sessionStorage.getItem("currentWorkMode") || "order_only";
const noTicket = mode === "order_accounting_pickup";
const className = document.querySelector("#className");
const productsElement = document.querySelector("#products");
const cartElement = document.querySelector("#cart");
const totalElement = document.querySelector("#total");
const message = document.querySelector("#message");
const completionNotice = document.querySelector("#completionNotice");
const ticketSection = document.querySelector("#ticketSection");
const ticketHelp = document.querySelector("#ticketHelp");
const ticketAuto = document.querySelector("#ticketAuto");
const ticketGrid = document.querySelector("#ticketGrid");
const orderButton = document.querySelector("#orderButton");
const backButton = document.querySelector("#backButton");
let selectedTicket = null;
let settings = null;

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

const cart = [];
const quantityDisplays = new Set();

async function loadTicketState() {
  if (noTicket) {
    ticketSection.hidden = true;
    return;
  }
  const response = await fetch(`${API_BASE}/order-numbers/status`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) { message.textContent = data.message || "注文番号を取得できませんでした"; return; }
  settings = data;
  if (data.auto_cycle) {
    ticketHelp.textContent = "注文番号は注文確定時に自動で割り当てられます。";
    ticketAuto.hidden = false;
    ticketAuto.textContent = `1〜${data.max_ticket_number}を順番に使用します`;
  } else {
    ticketHelp.textContent = "空いている注文番号を選択してください。";
    ticketGrid.hidden = false;
    renderTicketGrid(data.numbers);
  }
}

function renderTicketGrid(numbers) {
  ticketGrid.innerHTML = "";
  for (const item of numbers) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.number;
    button.disabled = !item.available;
    button.className = "ticket-number-button";
    if (!item.available) button.classList.add("is-busy");
    if (selectedTicket === item.number) button.classList.add("is-selected");
    button.title = item.available ? "空き" : (item.state === "paid" ? "会計済み・受取待ち" : "使用中");
    button.addEventListener("click", () => { selectedTicket = item.number; renderTicketGrid(numbers); });
    ticketGrid.appendChild(button);
  }
}

function priceLabel(price) {
  return price === 0 ? "無料" : `${price}円`;
}

function buildOptionControls(product, container) {
  const controls = new Map();

  for (const group of product.option_groups || []) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "order-option-group";

    const legend = document.createElement("legend");
    legend.textContent = group.name;
    fieldset.appendChild(legend);

    const help = document.createElement("p");
    help.className = "option-help";
    help.textContent = group.selection_type === "single"
      ? "1つ選択してください"
      : "複数選択できます";
    fieldset.appendChild(help);

    const inputs = [];
    for (const option of group.options || []) {
      const label = document.createElement("label");
      label.className = "order-option-row";

      const left = document.createElement("span");
      left.className = "order-option-name";

      const input = document.createElement("input");
      input.type = group.selection_type === "single" ? "radio" : "checkbox";
      input.name = group.selection_type === "single" ? `product-${product.id}-group-${group.id}` : "";
      input.value = String(option.id);
      input.dataset.optionName = option.name;
      input.dataset.extraPrice = String(option.extra_price);
      input.dataset.groupName = group.name;

      const optionName = document.createElement("span");
      optionName.textContent = option.name;
      left.appendChild(input);
      left.appendChild(optionName);

      const price = document.createElement("span");
      price.className = "option-price";
      price.textContent = priceLabel(option.extra_price);

      label.appendChild(left);
      label.appendChild(price);
      fieldset.appendChild(label);
      inputs.push(input);
    }

    controls.set(group.id, { group, inputs });
    container.appendChild(fieldset);
  }

  return controls;
}

function getSelectedOptions(controls, { validate = true } = {}) {
  const selectedOptions = [];

  for (const { group, inputs } of controls.values()) {
    const selected = inputs.filter(input => input.checked);
    if (validate && group.selection_type === "single" && selected.length !== 1) {
      return { ok: false, message: `「${group.name}」を1つ選択してください`, options: [] };
    }

    for (const input of selected) {
      selectedOptions.push({
        id: Number(input.value),
        name: input.dataset.optionName,
        extra_price: Number(input.dataset.extraPrice),
        group_name: input.dataset.groupName
      });
    }
  }

  return { ok: true, options: selectedOptions };
}

function optionKey(options) {
  return options.map(option => option.id).sort((a, b) => a - b).join(",");
}

function findCartItem(productId, options) {
  const key = optionKey(options);
  return cart.find(item => item.product_id === productId && item.option_key === key);
}

function changeCartQuantity(product, selectedOptions, delta) {
  const key = optionKey(selectedOptions);
  const extraPrice = selectedOptions.reduce((sum, option) => sum + option.extra_price, 0);
  const unitPrice = product.price + extraPrice;
  const existingItem = findCartItem(product.id, selectedOptions);

  if (existingItem) {
    existingItem.quantity += delta;
    if (existingItem.quantity <= 0) {
      cart.splice(cart.indexOf(existingItem), 1);
    }
  } else if (delta > 0) {
    cart.push({
      product_id: product.id,
      name: product.name,
      base_price: product.price,
      price: unitPrice,
      quantity: 1,
      option_key: key,
      options: selectedOptions
    });
  }

  renderCart();
  updateAllQuantityDisplays();
}

function updateAllQuantityDisplays() {
  for (const update of quantityDisplays) update();
}

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/active-products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.message;
      return;
    }

    productsElement.innerHTML = "";
    quantityDisplays.clear();

    for (const product of data.products) {
      const div = document.createElement("section");
      div.className = "order-product-card";

      const heading = document.createElement("div");
      heading.className = "order-product-heading";
      const productName = document.createElement("h4");
      productName.textContent = product.name;
      const basePrice = document.createElement("strong");
      basePrice.textContent = `${product.price}円`;
      heading.appendChild(productName);
      heading.appendChild(basePrice);
      div.appendChild(heading);

      const controls = buildOptionControls(product, div);

      const summary = document.createElement("div");
      summary.className = "order-price-summary";
      const summaryText = document.createElement("span");
      summaryText.textContent = "現在の価格";
      const summaryPrice = document.createElement("strong");
      summaryPrice.textContent = `${product.price}円`;
      summary.appendChild(summaryText);
      summary.appendChild(summaryPrice);
      div.appendChild(summary);

      const quantityControl = document.createElement("div");
      quantityControl.className = "product-quantity-control";

      const minusButton = document.createElement("button");
      minusButton.type = "button";
      minusButton.className = "quantity-button";
      minusButton.textContent = "−";
      minusButton.setAttribute("aria-label", `${product.name}を1個減らす`);

      const quantityValue = document.createElement("strong");
      quantityValue.className = "quantity-value";
      quantityValue.textContent = "0";
      quantityValue.setAttribute("aria-live", "polite");

      const plusButton = document.createElement("button");
      plusButton.type = "button";
      plusButton.className = "quantity-button";
      plusButton.textContent = "＋";
      plusButton.setAttribute("aria-label", `${product.name}を1個増やす`);

      quantityControl.appendChild(minusButton);
      quantityControl.appendChild(quantityValue);
      quantityControl.appendChild(plusButton);
      div.appendChild(quantityControl);

      function currentOptions(validate = false) {
        return getSelectedOptions(controls, { validate });
      }

      function updatePricePreview() {
        const result = currentOptions(false);
        const extra = result.options.reduce((sum, option) => sum + option.extra_price, 0);
        summaryPrice.textContent = `${product.price + extra}円`;
        updateQuantityDisplay();
      }

      function updateQuantityDisplay() {
        const result = currentOptions(false);
        const item = findCartItem(product.id, result.options);
        quantityValue.textContent = String(item?.quantity || 0);
      }

      quantityDisplays.add(updateQuantityDisplay);

      for (const { inputs } of controls.values()) {
        for (const input of inputs) input.addEventListener("change", updatePricePreview);
      }

      plusButton.addEventListener("click", () => {
        clearCompletion();
        const result = currentOptions(true);
        if (!result.ok) {
          message.textContent = result.message;
          return;
        }
        changeCartQuantity(product, result.options, 1);
        message.textContent = "";
      });

      minusButton.addEventListener("click", () => {
        clearCompletion();
        const result = currentOptions(true);
        if (!result.ok) {
          message.textContent = result.message;
          return;
        }
        const item = findCartItem(product.id, result.options);
        if (!item) return;
        changeCartQuantity(product, result.options, -1);
        message.textContent = "";
      });

      productsElement.appendChild(div);
    }
  } catch (error) {
    console.error(error);
    message.textContent = "商品を取得できませんでした";
  }
}

function renderCart() {
  cartElement.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    const empty = document.createElement("p");
    empty.className = "option-empty";
    empty.textContent = "まだ商品が選択されていません";
    cartElement.appendChild(empty);
  }

  for (const item of cart) {
    const div = document.createElement("div");
    div.className = "cart-row";

    const details = document.createElement("div");
    details.className = "cart-item-details";
    const name = document.createElement("strong");
    name.textContent = item.name;
    details.appendChild(name);

    if (item.options.length > 0) {
      const optionText = document.createElement("small");
      optionText.textContent = item.options.map(option => `${option.group_name}: ${option.name}`).join(" / ");
      details.appendChild(optionText);
    }

    const price = document.createElement("span");
    price.className = "cart-price";
    price.textContent = `${item.price}円 × ${item.quantity}`;

    const controls = document.createElement("div");
    controls.className = "cart-controls";
    const minusButton = document.createElement("button");
    minusButton.type = "button";
    minusButton.textContent = "−";
    minusButton.addEventListener("click", () => {
      item.quantity--;
      if (item.quantity <= 0) cart.splice(cart.indexOf(item), 1);
      renderCart();
      updateAllQuantityDisplays();
    });
    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.textContent = "＋";
    plusButton.addEventListener("click", () => {
      item.quantity++;
      renderCart();
      updateAllQuantityDisplays();
    });
    controls.appendChild(minusButton);
    controls.appendChild(plusButton);

    div.appendChild(details);
    div.appendChild(price);
    div.appendChild(controls);
    cartElement.appendChild(div);
    total += item.price * item.quantity;
  }

  totalElement.textContent = `合計 ${total}円`;
}


orderButton.addEventListener("click", async () => {
  clearCompletion();
  if (cart.length === 0) { message.textContent = "商品を1つ以上選択してください"; return; }
  if (!noTicket && settings && !settings.auto_cycle && !selectedTicket) { message.textContent = "注文番号を選択してください"; return; }
  const items = cart.map(item => ({ product_id: item.product_id, quantity: item.quantity, option_ids: item.options.map(option => option.id) }));
  try {
    orderButton.disabled = true;
    const response = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ticket_number: selectedTicket, no_ticket: noTicket, items })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "注文を送信できませんでした");

    if (mode === "order_accounting" || mode === "order_accounting_pickup") {
      window.location.href = `accounting.html?from=work&mode=${mode}&order_id=${data.order_id}`;
      return;
    }

    showCompletion(`注文完了（注文番号 ${data.ticket_number}）`);
    cart.length = 0;
    selectedTicket = null;
    renderCart();
    await loadTicketState();
    await loadProducts();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    orderButton.disabled = false;
  }
});

backButton.addEventListener("click", () => {
  window.location.href = params.get("from") === "work" ? "work-select.html" : "menu.html";
});

renderCart();
loadTicketState();
loadProducts();
