const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const userData = JSON.parse(localStorage.getItem("user"));
const API_BASE = "https://163.44.103.65/api";

const className = document.querySelector("#className");
const productsElement = document.querySelector("#products");
const message = document.querySelector("#message");
const backButton = document.querySelector("#backButton");
const productName = document.querySelector("#productName");
const productPrice = document.querySelector("#productPrice");
const addButton = document.querySelector("#addButton");

if (!token || !classData || !userData) {
  window.location.href = "index.html";
}
if (userData.is_management !== 1) {
  window.location.href = "menu.html";
}

className.textContent = classData.name;

function priceLabel(price) {
  return price === 0 ? "無料" : `${price}円`;
}

function selectionLabel(type) {
  return type === "single" ? "1つ選択" : "複数選択";
}

function createPreview(group) {
  const preview = document.createElement("div");
  preview.className = "option-preview";

  const title = document.createElement("div");
  title.className = "option-preview-title";
  title.textContent = group.name;
  preview.appendChild(title);

  const help = document.createElement("div");
  help.className = "option-help";
  help.textContent = group.selection_type === "single"
    ? "1つ選択してください"
    : "複数選択できます";
  preview.appendChild(help);

  if (!group.options || group.options.length === 0) {
    const empty = document.createElement("div");
    empty.className = "option-empty";
    empty.textContent = "まだ選択肢がありません";
    preview.appendChild(empty);
    return preview;
  }

  for (const option of group.options) {
    const row = document.createElement("label");
    row.className = "option-preview-row";

    const input = document.createElement("input");
    input.type = group.selection_type === "single" ? "radio" : "checkbox";
    input.disabled = true;

    const name = document.createElement("span");
    name.textContent = option.name;

    const price = document.createElement("span");
    price.className = "option-price";
    price.textContent = priceLabel(option.extra_price);

    row.appendChild(input);
    row.appendChild(name);
    row.appendChild(price);
    preview.appendChild(row);
  }

  return preview;
}

function createPriceInput() {
  const wrapper = document.createElement("div");
  wrapper.className = "paid-price-input";

  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "1";
  priceInput.value = "0";
  priceInput.placeholder = "0";
  priceInput.setAttribute("aria-label", "追加料金");

  const yen = document.createElement("span");
  yen.textContent = "円";

  wrapper.appendChild(priceInput);
  wrapper.appendChild(yen);

  const help = document.createElement("small");
  help.className = "option-help";
  help.textContent = "0円なら「無料」と表示されます";
  wrapper.appendChild(help);

  return {
    element: wrapper,
    getPrice() {
      return Number(priceInput.value);
    },
    focusPrice() {
      priceInput.focus();
    }
  };
}

function createOptionEditor(product) {
  const wrapper = document.createElement("div");
  wrapper.className = "option-editor";

  const title = document.createElement("h4");
  title.textContent = "オプション設定";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "option-help";
  intro.textContent = "トッピングや温度など、注文時に選んでもらう項目を設定できます。";
  wrapper.appendChild(intro);

  for (const group of product.option_groups || []) {
    const groupBox = document.createElement("section");
    groupBox.className = "option-group-card";

    const header = document.createElement("div");
    header.className = "option-group-header";

    const headerText = document.createElement("div");
    const heading = document.createElement("h5");
    heading.textContent = group.name;
    const badge = document.createElement("span");
    badge.className = "option-type-badge";
    badge.textContent = selectionLabel(group.selection_type);
    headerText.appendChild(heading);
    headerText.appendChild(badge);

    const deleteGroupButton = document.createElement("button");
    deleteGroupButton.className = "danger-button compact-button";
    deleteGroupButton.textContent = "項目を削除";
    deleteGroupButton.addEventListener("click", async () => {
      if (!confirm(`「${group.name}」を削除しますか？`)) return;
      const response = await fetch(`${API_BASE}/product-option-groups/${group.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      message.textContent = response.ok ? "項目を削除しました" : (data.message || "削除できませんでした");
      if (response.ok) await loadProducts();
    });

    header.appendChild(headerText);
    header.appendChild(deleteGroupButton);
    groupBox.appendChild(header);

    const choiceList = document.createElement("div");
    choiceList.className = "option-choice-list";

    for (const option of group.options || []) {
      const row = document.createElement("div");
      row.className = "option-choice-row";

      const text = document.createElement("div");
      text.innerHTML = `<strong>${option.name}</strong><span>${priceLabel(option.extra_price)}</span>`;

      const deleteOptionButton = document.createElement("button");
      deleteOptionButton.className = "danger-button compact-button";
      deleteOptionButton.textContent = "削除";
      deleteOptionButton.addEventListener("click", async () => {
        if (!confirm(`「${option.name}」を削除しますか？`)) return;
        const response = await fetch(`${API_BASE}/product-options/${option.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        message.textContent = response.ok ? "選択肢を削除しました" : (data.message || "削除できませんでした");
        if (response.ok) await loadProducts();
      });

      row.appendChild(text);
      row.appendChild(deleteOptionButton);
      choiceList.appendChild(row);
    }

    if ((group.options || []).length === 0) {
      const empty = document.createElement("p");
      empty.className = "option-empty";
      empty.textContent = "まだ選択肢がありません。下から追加してください。";
      choiceList.appendChild(empty);
    }
    groupBox.appendChild(choiceList);

    const addChoice = document.createElement("div");
    addChoice.className = "option-add-choice";

    const addChoiceTitle = document.createElement("strong");
    addChoiceTitle.textContent = "＋ 選択肢を追加";

    const optionName = document.createElement("input");
    optionName.type = "text";
    optionName.placeholder = "例：チーズ";

    const priceInput = createPriceInput();

    const addOptionButton = document.createElement("button");
    addOptionButton.textContent = "追加";
    addOptionButton.addEventListener("click", async () => {
      const name = optionName.value.trim();
      const extraPrice = priceInput.getPrice();

      if (!name) {
        message.textContent = "選択肢名を入力してください";
        optionName.focus();
        return;
      }
      if (!Number.isInteger(extraPrice) || extraPrice < 0) {
        message.textContent = "料金は0円以上の整数で入力してください";
        priceInput.focusPrice();
        return;
      }

      const response = await fetch(`${API_BASE}/product-option-groups/${group.id}/options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, extra_price: extraPrice })
      });
      const data = await response.json();
      message.textContent = response.ok ? "選択肢を追加しました" : (data.message || "追加できませんでした");
      if (response.ok) await loadProducts();
    });

    addChoice.appendChild(addChoiceTitle);
    addChoice.appendChild(optionName);
    addChoice.appendChild(priceInput.element);
    addChoice.appendChild(addOptionButton);
    groupBox.appendChild(addChoice);

    const previewTitle = document.createElement("strong");
    previewTitle.className = "preview-label";
    previewTitle.textContent = "注文画面ではこう見えます";
    groupBox.appendChild(previewTitle);
    groupBox.appendChild(createPreview(group));

    wrapper.appendChild(groupBox);
  }

  const newGroupBox = document.createElement("section");
  newGroupBox.className = "new-option-group";

  const newLegend = document.createElement("h5");
  newLegend.textContent = "＋ 新しい項目を追加";
  newGroupBox.appendChild(newLegend);

  const groupNameLabel = document.createElement("label");
  groupNameLabel.className = "field-label";
  groupNameLabel.textContent = "項目名";
  const groupName = document.createElement("input");
  groupName.type = "text";
  groupName.placeholder = "例：トッピング、温度";
  groupNameLabel.appendChild(groupName);

  const typeTitle = document.createElement("div");
  typeTitle.className = "field-label-text";
  typeTitle.textContent = "選び方";

  const typeChoices = document.createElement("div");
  typeChoices.className = "selection-type-choices";
  const radioName = `group-type-${product.id}`;

  const multipleLabel = document.createElement("label");
  multipleLabel.className = "selection-type-card";
  const multipleRadio = document.createElement("input");
  multipleRadio.type = "radio";
  multipleRadio.name = radioName;
  multipleRadio.value = "multiple";
  multipleRadio.checked = true;
  const multipleText = document.createElement("span");
  multipleText.innerHTML = `<strong>複数選択</strong><small>いくつでも選べます<br>例：トッピング</small>`;
  multipleLabel.appendChild(multipleRadio);
  multipleLabel.appendChild(multipleText);

  const singleLabel = document.createElement("label");
  singleLabel.className = "selection-type-card";
  const singleRadio = document.createElement("input");
  singleRadio.type = "radio";
  singleRadio.name = radioName;
  singleRadio.value = "single";
  const singleText = document.createElement("span");
  singleText.innerHTML = `<strong>1つ選択</strong><small>どれか1つを選びます<br>例：冷ため / 普通 / 暖かめ</small>`;
  singleLabel.appendChild(singleRadio);
  singleLabel.appendChild(singleText);

  typeChoices.appendChild(multipleLabel);
  typeChoices.appendChild(singleLabel);

  const addGroupButton = document.createElement("button");
  addGroupButton.textContent = "この項目を作成";
  addGroupButton.addEventListener("click", async () => {
    const name = groupName.value.trim();
    if (!name) {
      message.textContent = "項目名を入力してください";
      groupName.focus();
      return;
    }

    const selectionType = singleRadio.checked ? "single" : "multiple";
    const response = await fetch(`${API_BASE}/products/${product.id}/option-groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, selection_type: selectionType })
    });
    const data = await response.json();
    message.textContent = response.ok ? "項目を追加しました" : (data.message || "追加できませんでした");
    if (response.ok) await loadProducts();
  });

  newGroupBox.appendChild(groupNameLabel);
  newGroupBox.appendChild(typeTitle);
  newGroupBox.appendChild(typeChoices);
  newGroupBox.appendChild(addGroupButton);
  wrapper.appendChild(newGroupBox);

  return wrapper;
}

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.message || "商品を取得できませんでした";
      return;
    }

    productsElement.innerHTML = "";

    for (const product of data.products) {
      const row = document.createElement("section");
      row.className = "management-product-card";

      const productTitle = document.createElement("div");
      productTitle.className = "management-product-title";
      productTitle.textContent = `${product.name} / ${product.price}円`;
      row.appendChild(productTitle);

      const productFields = document.createElement("div");
      productFields.className = "management-product-fields";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = product.name;
      nameInput.setAttribute("aria-label", "商品名");

      const priceInput = document.createElement("input");
      priceInput.type = "number";
      priceInput.min = "0";
      priceInput.value = product.price;
      priceInput.setAttribute("aria-label", "商品価格");

      productFields.appendChild(nameInput);
      productFields.appendChild(priceInput);
      row.appendChild(productFields);

      const actions = document.createElement("div");
      actions.className = "management-product-actions";

      const saveButton = document.createElement("button");
      saveButton.textContent = "保存";
      const statusButton = document.createElement("button");
      statusButton.textContent = product.active ? "販売停止" : "販売再開";
      const deleteButton = document.createElement("button");
      deleteButton.className = "danger-button";
      deleteButton.textContent = "削除";

      const optionEditor = createOptionEditor(product);

      saveButton.addEventListener("click", async () => {
        const name = nameInput.value.trim();
        const price = Number(priceInput.value);
        if (!name) {
          message.textContent = "商品名を入力してください";
          return;
        }
        if (!Number.isInteger(price) || price < 0) {
          message.textContent = "価格を正しく入力してください";
          return;
        }
        const response = await fetch(`${API_BASE}/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, price })
        });
        const data = await response.json();
        message.textContent = response.ok ? "商品を更新しました" : (data.message || "商品の更新に失敗しました");
        if (response.ok) await loadProducts();
      });

      statusButton.addEventListener("click", async () => {
        const response = await fetch(`${API_BASE}/products/${product.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ active: !product.active })
        });
        const data = await response.json();
        message.textContent = response.ok
          ? (product.active ? "販売を停止しました" : "販売を再開しました")
          : (data.message || "販売状態を変更できませんでした");
        if (response.ok) await loadProducts();
      });

      deleteButton.addEventListener("click", async () => {
        if (!confirm(`「${product.name}」を削除しますか？`)) return;
        const response = await fetch(`${API_BASE}/products/${product.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        message.textContent = response.ok ? "商品を削除しました" : (data.message || "商品の削除に失敗しました");
        if (response.ok) await loadProducts();
      });

      actions.appendChild(saveButton);
      actions.appendChild(statusButton);
      actions.appendChild(deleteButton);
      row.appendChild(actions);
      row.appendChild(optionEditor);
      productsElement.appendChild(row);
    }
  } catch (error) {
    console.error(error);
    message.textContent = "商品を取得できませんでした";
  }
}

addButton.addEventListener("click", async () => {
  const name = productName.value.trim();
  const price = Number(productPrice.value);
  if (!name) {
    message.textContent = "商品名を入力してください";
    return;
  }
  if (!Number.isInteger(price) || price < 0) {
    message.textContent = "価格を正しく入力してください";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, price })
    });
    const data = await response.json();
    if (!response.ok) {
      message.textContent = data.message || "商品の追加に失敗しました";
      return;
    }
    message.textContent = "商品を追加しました。商品一覧からオプションを設定できます";
    productName.value = "";
    productPrice.value = "";
    await loadProducts();
  } catch (error) {
    console.error(error);
    message.textContent = "商品を追加できませんでした";
  }
});

backButton.addEventListener("click", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") === "work") {
    window.location.href = "work-screen.html";
    return;
  }
  window.location.href = "menu.html";
});

loadProducts();
