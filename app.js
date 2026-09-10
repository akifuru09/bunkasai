const loginButton =
  document.querySelector("#loginButton");

const generalButton =
  document.querySelector("#generalButton");

const managementButton =
  document.querySelector("#managementButton");

const classSelect =
  document.querySelector("#classSelect");

const passwordInput =
  document.querySelector("#password");

const loginMessage =
  document.querySelector("#message");


let loginType = "general";

const API_BASE =
  "https://163.44.103.65/api";


// 一般
generalButton.addEventListener(
  "click",
  () => {

    loginType = "general";

    generalButton.disabled = true;
    managementButton.disabled = false;

    loginMessage.textContent = "";
  }
);


// 管理
managementButton.addEventListener(
  "click",
  () => {

    loginType = "management";

    managementButton.disabled = true;
    generalButton.disabled = false;

    loginMessage.textContent = "";
  }
);


// クラス一覧
async function loadClasses() {

  try {

    const response = await fetch(
      `${API_BASE}/classes`
    );

    const data =
      await response.json();


    if (!response.ok) {

      loginMessage.textContent =
        data.message ||
        "クラスの取得に失敗しました";

      return;
    }


    classSelect.innerHTML =
      '<option value="">クラスを選択</option>';


    for (const classItem of data.classes) {

      const option =
        document.createElement("option");

      option.value =
        classItem.id;

      option.textContent =
        classItem.name;

      classSelect.appendChild(option);
    }


  } catch (error) {

    console.error(error);

    loginMessage.textContent =
      "サーバーに接続できませんでした";
  }
}


// ログイン
loginButton.addEventListener(
  "click",
  async () => {

    const classId =
      classSelect.value;

    const password =
      passwordInput.value;


    if (!password) {

      loginMessage.textContent =
        "パスワードを入力してください";

      return;
    }


    /*
     * 一般ログインだけは
     * 必ずクラス選択が必要。
     *
     * 管理＋クラス未選択の場合は
     * サーバーへ送りmaster判定させる。
     */
    if (
      loginType === "general" &&
      !classId
    ) {

      loginMessage.textContent =
        "クラスを選択してください";

      return;
    }


    try {

      const body = {
        loginType,
        password
      };


      if (classId) {
        body.classId =
          Number(classId);
      }


      const response = await fetch(
        `${API_BASE}/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(body)
        }
      );


      const data =
        await response.json();


      if (!response.ok) {

        loginMessage.textContent =
          data.message ||
          "ログインに失敗しました";

        return;
      }


      // 古いログイン情報を消す
      localStorage.removeItem("token");
      localStorage.removeItem("class");
      localStorage.removeItem("user");

      sessionStorage.clear();


      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );


      // MASTER
      if (data.master === true) {

        window.location.href =
          "master.html";

        return;
      }


      // 通常ログイン
      localStorage.setItem(
        "class",
        JSON.stringify(data.class)
      );


      window.location.href =
        "menu.html";


    } catch (error) {

      console.error(error);

      loginMessage.textContent =
        "サーバーに接続できませんでした";
    }
  }
);


generalButton.disabled = true;
managementButton.disabled = false;

loadClasses();