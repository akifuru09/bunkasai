const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const currentWorker = JSON.parse(sessionStorage.getItem("currentWorker") || "null");
const API_BASE = "https://163.44.103.65/api";
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || sessionStorage.getItem("currentWorkMode") || "order_only";

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
const editingOrderIdRaw = Number(params.get("edit_order"));
const editingOrderId = Number.isInteger(editingOrderIdRaw) && editingOrderIdRaw > 0 ? editingOrderIdRaw : null;
const isEditing = editingOrderId !== null;
const noTicket = mode === "order_accounting_pickup";
const pageTitle = document.querySelector("#pageTitle");
const className = document.querySelector("#className");
const productsElement = document.querySelector("#products");
const productsSection = document.querySelector("#productsSection");
const cartSection = document.querySelector("#cartSection");
const inlinePaymentSection = document.querySelector("#inlinePaymentSection");
const inlineCashButton = document.querySelector("#inlineCashButton");
const inlinePayPayButton = document.querySelector("#inlinePayPayButton");
const cartElement = document.querySelector("#cart");
const totalElement = document.querySelector("#total");
const message = document.querySelector("#message");
const completionNotice = document.querySelector("#completionNotice");
const editOrderHelp = document.querySelector("#editOrderHelp");
const ticketSection = document.querySelector("#ticketSection");
const ticketHelp = document.querySelector("#ticketHelp");
const ticketAuto = document.querySelector("#ticketAuto");
const ticketGrid = document.querySelector("#ticketGrid");
const orderButton = document.querySelector("#orderButton");
const backButton = document.querySelector("#backButton");
const correctionButton = document.querySelector("#correctionButton");
const correctionPanel = document.querySelector("#correctionPanel");
const correctionCloseButton = document.querySelector("#correctionCloseButton");
const correctionList = document.querySelector("#correctionList");
const correctionMessage = document.querySelector("#correctionMessage");
let selectedTicket = null;
let settings = null;
const productsById = new Map();
let pendingAllInOneOrderId = null;
const pageRestoreContext = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "_");
let lastRestoreToken = null;
let lastRestoreContext = pageRestoreContext;

const transferredRestoreToken = params.get("restore_token");
const transferredRestoreContext = params.get("restore_context");
if (transferredRestoreToken && transferredRestoreContext && mode === "order_accounting") {
  lastRestoreToken = transferredRestoreToken;
  lastRestoreContext = transferredRestoreContext;
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("restore_token");
  cleanUrl.searchParams.delete("restore_context");
  history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search);
}

if (!token || !classData) window.location.href = "index.html";
applyWorkModeTitle(mode);
className.textContent = classData.name;

function applyRestoreButtonLabel() {
  if (isEditing) {
    correctionButton.hidden = true;
    return;
  }

  if (mode === "order_accounting_pickup") {
    correctionButton.textContent = "直前の注文・会計/受け取りを復元";
  } else if (mode === "order_accounting") {
    correctionButton.textContent = "直前の会計を復元";
  } else {
    correctionButton.textContent = "直前の注文を復元";
  }
}
applyRestoreButtonLabel();

function updateRestoreButtonState() {
  if (!isEditing) correctionButton.disabled = !lastRestoreToken;
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

function setOrderActionPanelVisible(visible) {
  cartSection.hidden = !visible;
  document.body.classList.toggle("has-order-action-panel", visible);
}

const completedTicketParam = Number(params.get("completed_ticket"));
const flashCompletion = sessionStorage.getItem("workCompletionMessage");
sessionStorage.removeItem("workCompletionMessage");

function showArrivalCompletion() {
  // 注文・会計ではURLで渡された注文番号を最優先する。
  // sessionStorageだけに依存しないので、遷移後も注文番号を確実に表示できる。
  if (mode === "order_accounting" && Number.isFinite(completedTicketParam) && completedTicketParam > 0) {
    showCompletion(`注文・会計完了（注文番号 ${completedTicketParam}）`);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("completed_ticket");
    history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    return;
  }
  if (flashCompletion) showCompletion(flashCompletion);
}

const cart = [];
const quantityDisplays = new Set();

async function loadTicketState() {
  if (isEditing || noTicket) {
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
    button.title = item.available
      ? "空き"
      : item.state === "disabled"
        ? "使用不可"
        : item.state === "paid"
          ? "会計済み・受取待ち"
          : "使用中";
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
    productsById.clear();
    for (const product of data.products) productsById.set(product.id, product);

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
  setOrderActionPanelVisible(cart.length > 0 || isEditing);
}



function putOrderContentsIntoCart(order) {
  cart.length = 0;

  for (const item of order.items || []) {
    const product = productsById.get(item.product_id);
    if (!product) {
      throw new Error(`「${item.product_name}」は現在販売中の商品に存在しないため復元できません`);
    }

    const currentOptions = [];
    for (const savedOption of item.options || []) {
      let found = null;
      for (const group of product.option_groups || []) {
        const option = (group.options || []).find(o => o.id === savedOption.option_id);
        if (option) {
          found = {
            id: option.id,
            name: option.name,
            extra_price: option.extra_price,
            group_name: group.name
          };
          break;
        }
      }
      if (!found) {
        throw new Error(`「${savedOption.option_name}」は現在のオプションに存在しないため復元できません`);
      }
      currentOptions.push(found);
    }

    const extraPrice = currentOptions.reduce((sum, option) => sum + option.extra_price, 0);
    cart.push({
      product_id: product.id,
      name: product.name,
      base_price: product.price,
      price: product.price + extraPrice,
      quantity: item.quantity,
      option_key: optionKey(currentOptions),
      options: currentOptions
    });
  }

  renderCart();
  updateAllQuantityDisplays();
}

async function restoreLastFromOrderPage() {
  clearCompletion();
  correctionButton.disabled = true;
  message.textContent = "直前の操作を復元しています...";

  try {
    if (!lastRestoreToken) throw new Error("この画面で復元できる直前の操作はありません");

    const response = await fetch(`${API_BASE}/restore-last`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        restore_token: lastRestoreToken,
        restore_context_id: lastRestoreContext,
        actor_user_id: currentWorker?.id || null,
        work_mode: mode
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "直前の操作を復元できませんでした");

    lastRestoreToken = null;
    updateRestoreButtonState();

    if (mode === "order_accounting") {
      sessionStorage.setItem("workCompletionMessage", data.message);
      window.location.href = `accounting.html?from=work&mode=order_accounting&order_id=${data.order.id}`;
      return;
    }

    pendingAllInOneOrderId = null;
    inlinePaymentSection.hidden = true;
    productsSection.hidden = false;
    orderButton.hidden = false;

    putOrderContentsIntoCart(data.order);

    if (mode === "order_only" && data.order.ticket_number > 0) {
      selectedTicket = data.order.ticket_number;
      await loadTicketState();
    }

    message.textContent = "";
    showCompletion(data.message);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    updateRestoreButtonState();
  }
}

async function loadEditingOrder() {
  if (!isEditing) return;

  pageTitle.textContent = "注文内容の訂正";
  document.title = "注文内容の訂正 - 文化祭システム";
  editOrderHelp.hidden = false;
  correctionButton.hidden = true;
  ticketSection.hidden = true;
  orderButton.textContent = "注文内容を更新";

  const response = await fetch(`${API_BASE}/orders/id/${editingOrderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "注文を取得できませんでした");
  if (data.order.handed_over) throw new Error("受け取り済みです。先に受け取り完了を取り消してください");

  cart.length = 0;
  for (const item of data.order.items) {
    const product = productsById.get(item.product_id);
    if (!product) {
      throw new Error(`「${item.product_name}」は現在販売中の商品に存在しないため、この画面では訂正できません`);
    }

    const currentOptions = [];
    for (const savedOption of item.options || []) {
      let found = null;
      for (const group of product.option_groups || []) {
        const option = (group.options || []).find(o => o.id === savedOption.option_id);
        if (option) {
          found = { id: option.id, name: option.name, extra_price: option.extra_price, group_name: group.name };
          break;
        }
      }
      if (!found) throw new Error(`「${savedOption.option_name}」は現在のオプションに存在しないため、この画面では訂正できません`);
      currentOptions.push(found);
    }

    const extraPrice = currentOptions.reduce((sum, option) => sum + option.extra_price, 0);
    cart.push({
      product_id: product.id,
      name: product.name,
      base_price: product.price,
      price: product.price + extraPrice,
      quantity: item.quantity,
      option_key: optionKey(currentOptions),
      options: currentOptions
    });
  }

  renderCart();
  updateAllQuantityDisplays();
}

async function submitOrderEdit(allowPaymentReversal = false) {
  if (cart.length === 0) {
    message.textContent = "商品を1つ以上選択してください";
    return;
  }

  const items = cart.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    option_ids: item.options.map(option => option.id)
  }));

  const response = await fetch(`${API_BASE}/orders/${editingOrderId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items,
      allow_payment_reversal: allowPaymentReversal,
      actor_user_id: currentWorker?.id || null,
      work_mode: mode
    })
  });
  const data = await response.json();

  if (response.status === 409 && data.requires_payment_reversal) {
    const ok = window.confirm(
      `合計金額が ${data.old_total}円 → ${data.new_total}円 に変わります。\n会計を取り消して注文内容を訂正しますか？\n\n訂正後は再会計が必要です。`
    );
    if (ok) return submitOrderEdit(true);
    message.textContent = "訂正を中止しました。会計は変更されていません";
    return;
  }

  if (!response.ok) throw new Error(data.message || "注文内容を訂正できませんでした");

  sessionStorage.setItem("workCompletionMessage", data.message);
  if (params.get("from") === "accounting") {
    window.location.href = `accounting.html?mode=${encodeURIComponent(mode)}&from=work&order_id=${editingOrderId}`;
    return;
  }
  window.location.href = `pickup.html?mode=${encodeURIComponent(mode)}&from=work&order_id=${editingOrderId}`;
}

orderButton.addEventListener("click", async () => {
  clearCompletion();
  if (isEditing) {
    try {
      orderButton.disabled = true;
      await submitOrderEdit(false);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      orderButton.disabled = false;
    }
    return;
  }
  if (cart.length === 0) { message.textContent = "商品を1つ以上選択してください"; return; }
  if (!noTicket && settings && !settings.auto_cycle && !selectedTicket) { message.textContent = "注文番号を選択してください"; return; }
  const items = cart.map(item => ({ product_id: item.product_id, quantity: item.quantity, option_ids: item.options.map(option => option.id) }));
  try {
    orderButton.disabled = true;
    const response = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ticket_number: selectedTicket, no_ticket: noTicket, items, actor_user_id: currentWorker?.id || null, work_mode: mode, restore_context_id: pageRestoreContext })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "注文を送信できませんでした");

    if (mode === "order_only") {
      lastRestoreToken = data.restore_token || null;
      lastRestoreContext = pageRestoreContext;
      updateRestoreButtonState();
    }

    if (mode === "order_accounting") {
      window.location.href = `accounting.html?from=work&mode=${mode}&order_id=${data.order_id}`;
      return;
    }

    if (mode === "order_accounting_pickup") {
      pendingAllInOneOrderId = data.order_id;
      productsSection.hidden = true;
      orderButton.hidden = true;
      setOrderActionPanelVisible(false);
      inlinePaymentSection.hidden = false;
      message.textContent = "";
      inlinePaymentSection.scrollIntoView({ behavior: "smooth", block: "center" });
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

async function completeAllInOnePayment(method) {
  if (!pendingAllInOneOrderId) {
    message.textContent = "会計する注文がありません";
    return;
  }

  inlineCashButton.disabled = true;
  inlinePayPayButton.disabled = true;
  message.textContent = "";

  try {
    const response = await fetch(`${API_BASE}/orders/${pendingAllInOneOrderId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        method,
        complete_handover: true,
        actor_user_id: currentWorker?.id || null,
        work_mode: mode,
        restore_context_id: pageRestoreContext
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "会計処理に失敗しました");
    lastRestoreToken = data.restore_token || null;
    lastRestoreContext = pageRestoreContext;
    updateRestoreButtonState();

    const verifyResponse = await fetch(`${API_BASE}/orders/id/${pendingAllInOneOrderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const verifyData = await verifyResponse.json();
    if (!verifyResponse.ok) throw new Error(verifyData.message || "注文状態を確認できませんでした");

    if (!verifyData.order.handed_over) {
      const handoverResponse = await fetch(`${API_BASE}/orders/${pendingAllInOneOrderId}/handed-over`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actor_user_id: currentWorker?.id || null,
          work_mode: mode
        })
      });
      const handoverData = await handoverResponse.json();
      if (!handoverResponse.ok) throw new Error(handoverData.message || "受け取り完了にできませんでした");
    }

    pendingAllInOneOrderId = null;
    inlinePaymentSection.hidden = true;
    productsSection.hidden = false;
    orderButton.hidden = false;
    cart.length = 0;
    selectedTicket = null;
    renderCart();
    await loadProducts();
    showCompletion("注文・会計/受け取り完了");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    inlineCashButton.disabled = false;
    inlinePayPayButton.disabled = false;
  }
}

inlineCashButton.addEventListener("click", () => completeAllInOnePayment("cash"));
inlinePayPayButton.addEventListener("click", () => completeAllInOnePayment("paypay"));


function correctionStatus(order) {
  if (order.status === "cancelled") return "取消済み";
  if (order.status === "unpaid") return "会計待ち";
  if (order.handed_over) return "完了";
  return "受け取り待ち";
}

async function correctionRequest(orderId, action, extra = {}) {
  correctionMessage.textContent = "処理しています...";
  const response = await fetch(`${API_BASE}/corrections/${orderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...extra, actor_user_id: currentWorker?.id || null, work_mode: mode })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "訂正できませんでした");
  correctionMessage.textContent = data.message;
  await loadCorrections();
  if (!noTicket) await loadTicketState();
}

function addCorrectionAction(container, text, action, order, extra = {}, destructive = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = destructive ? "correction-action destructive" : "correction-action";
  button.addEventListener("click", async () => {
    try { await correctionRequest(order.id, action, extra); }
    catch (error) { correctionMessage.textContent = error.message; }
  });
  container.appendChild(button);
}

async function loadCorrections() {
  correctionList.innerHTML = "<p>読み込み中...</p>";
  const response = await fetch(`${API_BASE}/corrections/recent?work_mode=${encodeURIComponent(mode)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "最近の操作を取得できませんでした");
  correctionList.innerHTML = "";
  if (!data.orders.length) {
    correctionList.innerHTML = "<p>訂正できる最近の操作はまだありません。</p>";
    return;
  }

  for (const order of data.orders) {
    const card = document.createElement("article");
    card.className = "correction-card";
    const title = order.ticket_number > 0 ? `注文番号 ${order.ticket_number}` : "番号なし注文";
    const actor = order.latest_operation?.attendance_number
      ? `${order.latest_operation.attendance_number}番 ${order.latest_operation.user_name}` : "担当者記録なし";
    card.innerHTML = `<div class="correction-card-head"><strong>${title}</strong><span>${correctionStatus(order)}</span></div>
      <p>${order.items.map(i => `${i.product_name} × ${i.quantity}`).join(" / ")}</p>
      <small>${actor}</small>`;
    const actions = document.createElement("div");
    actions.className = "correction-actions";

    if (mode === "order_only") {
      if (order.status === "unpaid" && !order.handed_over) addCorrectionAction(actions, "注文を取り消す", "cancel_order", order, {}, true);
    } else if (mode === "order_accounting") {
      if (order.status === "unpaid" && !order.handed_over) {
        addCorrectionAction(actions, "注文を取り消す", "cancel_order", order, {}, true);
      } else if (order.status === "paid") {
        const nextMethod = order.payment?.method === "cash" ? "paypay" : "cash";
        addCorrectionAction(actions, `支払いを${nextMethod === "cash" ? "現金" : "PayPay"}に訂正`, "change_payment_method", order, { new_method: nextMethod });
        if (!order.handed_over) addCorrectionAction(actions, "会計を取り消す", "undo_payment", order, {}, true);
      }
    } else if (mode === "order_accounting_pickup") {
      if (order.status === "paid" && order.payment) {
        const nextMethod = order.payment.method === "cash" ? "paypay" : "cash";
        addCorrectionAction(actions, `支払いを${nextMethod === "cash" ? "現金" : "PayPay"}に訂正`, "change_payment_method", order, { new_method: nextMethod });
      }
      if (order.status !== "cancelled") addCorrectionAction(actions, "一連の処理を取り消す", "cancel_all_in_one", order, {}, true);
    }

    if (!actions.children.length) {
      const none = document.createElement("p"); none.className = "correction-none"; none.textContent = "現在この画面から行える訂正はありません。"; actions.appendChild(none);
    }
    card.appendChild(actions);
    correctionList.appendChild(card);
  }
}

correctionButton.addEventListener("click", restoreLastFromOrderPage);
correctionCloseButton.addEventListener("click", () => { correctionPanel.hidden = true; });
correctionPanel.addEventListener("click", event => { if (event.target === correctionPanel) correctionPanel.hidden = true; });

backButton.addEventListener("click", () => {
  if (isEditing) {
    if (params.get("from") === "accounting") {
      window.location.href = `accounting.html?mode=${encodeURIComponent(mode)}&from=work&order_id=${editingOrderId}`;
      return;
    }
    window.location.href = `pickup.html?mode=${encodeURIComponent(mode)}&from=work&order_id=${editingOrderId}`;
    return;
  }
  window.location.href = params.get("from") === "work" ? "work-select.html" : "menu.html";
});

window.addEventListener("pagehide", () => {
  lastRestoreToken = null;
});

async function initializeOrderPage() {
  renderCart();
  await loadTicketState();
  await loadProducts();
  if (isEditing) {
    try {
      await loadEditingOrder();
    } catch (error) {
      message.textContent = error.message;
      orderButton.disabled = true;
    }
  }
}

initializeOrderPage().then(() => {
  showArrivalCompletion();
}).catch(error => {
  message.textContent = error.message;
});
