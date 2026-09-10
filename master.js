const token =
  localStorage.getItem("token");

const userData =
  JSON.parse(
    localStorage.getItem("user")
  );

const API_BASE =
  "https://163.44.103.65/api";


const classesElement =
  document.querySelector("#classes");

const message =
  document.querySelector("#message");

const newClassName =
  document.querySelector("#newClassName");

const createClassButton =
  document.querySelector("#createClassButton");

const logoutButton =
  document.querySelector("#logoutButton");


if (
  !token ||
  userData?.is_master !== 1
) {
  window.location.href =
    "index.html";
}


// API
async function api(
  url,
  options = {}
) {

  options.headers = {
    ...(options.headers || {}),
    Authorization:
      `Bearer ${token}`
  };


  const response =
    await fetch(
      `${API_BASE}${url}`,
      options
    );


  const data =
    await response.json();


  if (!response.ok) {
    throw new Error(
      data.message ||
      "処理に失敗しました"
    );
  }


  return data;
}


// 全情報取得
async function loadData() {

  try {

    const data =
      await api(
        "/master/data"
      );


    renderClasses(
      data.classes
    );


  } catch (error) {

    console.error(error);

    message.textContent =
      error.message;
  }
}


// クラス表示
function renderClasses(classes) {

  classesElement.innerHTML = "";


  for (const classInfo of classes) {

    const section =
      document.createElement("section");


    const title =
      document.createElement("h2");

    title.textContent =
      `${classInfo.name}（ID: ${classInfo.id}）`;

    section.appendChild(title);


    /*
     * クラス情報
     */
    const classNameInput =
      document.createElement("input");

    classNameInput.type = "text";

    classNameInput.value =
      classInfo.name;


    const saveClassButton =
      document.createElement("button");

    saveClassButton.textContent =
      "クラス名を保存";


    saveClassButton.addEventListener(
      "click",
      async () => {

        try {

          await api(
            `/master/classes/${classInfo.id}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  name:
                    classNameInput
                      .value
                      .trim()
                })
            }
          );


          message.textContent =
            "クラス名を変更しました";

          await loadData();


        } catch (error) {

          message.textContent =
            error.message;
        }
      }
    );


    section.appendChild(
      classNameInput
    );

    section.appendChild(
      saveClassButton
    );


    const attendance =
      document.createElement("p");

    attendance.textContent =
      `最大出席番号：${
        classInfo.max_attendance_number
        ?? "未設定"
      }`;

    section.appendChild(
      attendance
    );


    /*
     * 一般ログインパスワード
     */
    const generalTitle =
      document.createElement("h3");

    generalTitle.textContent =
      "一般ログイン";

    section.appendChild(
      generalTitle
    );


    if (classInfo.has_password !== 1) {
      const noPassword =
        document.createElement("p");

      noPassword.textContent =
        "（パスワード未設定）";

      section.appendChild(
        noPassword
      );
    }


    const generalPassword =
      document.createElement("input");

    generalPassword.type =
      "password";

    generalPassword.placeholder =
      "新しいパスワード（8文字以上）";


    const generalPasswordButton =
      document.createElement("button");

    generalPasswordButton.textContent =
      "一般パスワードを再設定";


    generalPasswordButton
      .addEventListener(
        "click",
        async () => {

          try {

            await api(
              `/master/classes/${classInfo.id}/password`,
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    password:
                      generalPassword.value
                  })
              }
            );


            generalPassword.value = "";

            message.textContent =
              "一般パスワードを再設定しました";

            await loadData();


          } catch (error) {

            message.textContent =
              error.message;
          }
        }
      );


    section.appendChild(
      generalPassword
    );

    section.appendChild(
      generalPasswordButton
    );


    /*
     * 管理ユーザー
     */
    const managementTitle =
      document.createElement("h3");

    managementTitle.textContent =
      "管理アカウント";

    section.appendChild(
      managementTitle
    );


    const managementUsers =
      classInfo.users.filter(
        user =>
          user.is_management === 1
      );


    for (
      const user
      of managementUsers
    ) {

      const row =
        document.createElement("div");


      const name =
        document.createElement("input");

      name.type = "text";

      name.value =
        user.name;


      const saveNameButton =
        document.createElement("button");

      saveNameButton.textContent =
        "名前を保存";


      saveNameButton.addEventListener(
        "click",
        async () => {

          try {

            await api(
              `/master/users/${user.id}`,
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    name:
                      name.value.trim()
                  })
              }
            );


            message.textContent =
              "管理アカウントを更新しました";


          } catch (error) {

            message.textContent =
              error.message;
          }
        }
      );


      if (user.has_password !== 1) {
        const noPassword =
          document.createElement("p");

        noPassword.textContent =
          "（パスワード未設定）";

        row.appendChild(
          noPassword
        );
      }


      const password =
        document.createElement("input");

      password.type = "password";

      password.placeholder =
        "新しいパスワード";


      const passwordButton =
        document.createElement("button");

      passwordButton.textContent =
        "パスワード再設定";


      passwordButton.addEventListener(
        "click",
        async () => {

          try {

            await api(
              `/master/users/${user.id}/password`,
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    password:
                      password.value
                  })
              }
            );


            password.value = "";

            message.textContent =
              "管理パスワードを再設定しました";

            await loadData();


          } catch (error) {

            message.textContent =
              error.message;
          }
        }
      );


      row.appendChild(name);
      row.appendChild(saveNameButton);
      row.appendChild(password);
      row.appendChild(passwordButton);

      section.appendChild(row);
    }


    /*
     * 一般ユーザー
     */
    const usersTitle =
      document.createElement("h3");

    usersTitle.textContent =
      "一般ユーザー";

    section.appendChild(
      usersTitle
    );


    const generalUsers =
      classInfo.users.filter(
        user =>
          user.is_management !== 1
      );


    for (
      const user
      of generalUsers
    ) {

      const row =
        document.createElement("div");


      const attendanceNumber =
        document.createElement("input");

      attendanceNumber.type =
        "number";

      attendanceNumber.value =
        user.attendance_number;


      const name =
        document.createElement("input");

      name.type = "text";

      name.value =
        user.name;


      const saveButton =
        document.createElement("button");

      saveButton.textContent =
        "保存";


      saveButton.addEventListener(
        "click",
        async () => {

          try {

            await api(
              `/master/users/${user.id}`,
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    name:
                      name.value.trim(),

                    attendanceNumber:
                      Number(
                        attendanceNumber.value
                      )
                  })
              }
            );


            message.textContent =
              "ユーザーを更新しました";


          } catch (error) {

            message.textContent =
              error.message;
          }
        }
      );


      row.appendChild(
        attendanceNumber
      );

      row.appendChild(name);

      row.appendChild(
        saveButton
      );


      section.appendChild(row);
    }


    /*
     * 業務
     */
    const workTitle =
      document.createElement("h3");

    workTitle.textContent =
      "業務";

    section.appendChild(
      workTitle
    );


    for (
      const work
      of classInfo.workAssignments
    ) {

      const p =
        document.createElement("p");

      const screens =
        work.screens
          .map(
            screen =>
              screen.display_name
          )
          .join(" / ");


      p.textContent =
        `${work.name}：${screens}`;

      section.appendChild(p);
    }


    /*
     * 商品
     */
    const productTitle =
      document.createElement("h3");

    productTitle.textContent =
      "商品";

    section.appendChild(
      productTitle
    );


    for (
      const product
      of classInfo.products
    ) {

      const p =
        document.createElement("p");

      p.textContent =
        `${product.name} ¥${product.price} ${
          product.is_active === 1
            ? "販売中"
            : "販売停止"
        }`;

      section.appendChild(p);
    }


    /*
     * クラス削除
     */
    const deleteButton =
      document.createElement("button");

    deleteButton.textContent =
      "このクラスを削除";

    deleteButton.addEventListener(
      "click",
      async () => {

        const confirmed =
          window.confirm(
            `「${classInfo.name}」を削除しますか？\nこのクラスのユーザー・業務・商品・注文なども削除されます。`
          );

        if (!confirmed) {
          return;
        }

        try {

          await api(
            `/master/classes/${classInfo.id}`,
            {
              method: "DELETE"
            }
          );

          message.textContent =
            "クラスを削除しました";

          await loadData();

        } catch (error) {

          message.textContent =
            error.message;
        }
      }
    );

    section.appendChild(
      deleteButton
    );


    classesElement.appendChild(
      section
    );
  }
}


// 新しいクラスを作成
createClassButton.addEventListener(
  "click",
  async () => {

    const name =
      newClassName.value.trim();

    if (!name) {
      message.textContent =
        "クラス名を入力してください";
      return;
    }

    try {

      await api(
        "/master/classes",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              name
            })
        }
      );

      newClassName.value = "";

      message.textContent =
        "クラスを作成しました";

      await loadData();

    } catch (error) {

      message.textContent =
        error.message;
    }
  }
);


// ログアウト
logoutButton.addEventListener(
  "click",
  () => {

    localStorage.clear();
    sessionStorage.clear();

    window.location.href =
      "index.html";
  }
);


loadData();