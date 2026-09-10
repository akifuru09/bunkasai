const token =
  localStorage.getItem("token");

const classData =
  JSON.parse(
    localStorage.getItem("class")
  );

const userData =
  JSON.parse(
    localStorage.getItem("user")
  );


const className =
  document.querySelector("#className");

const menu =
  document.querySelector("#menu");

const logoutButton =
  document.querySelector("#logoutButton");


if (!token || !classData || !userData) {
  window.location.href =
    "index.html";
}


className.textContent =
  classData.name;


function addMenuButton(
  text,
  page
) {
  const button =
    document.createElement("button");

  button.textContent = text;

  button.addEventListener(
    "click",
    () => {
      window.location.href = page;
    }
  );

  menu.appendChild(button);
}


// ======================
// 管理
// ======================
if (userData.is_management === 1) {
  addMenuButton(
    "ユーザー管理",
    "user-management.html"
  );

  addMenuButton(
    "業務設定",
    "work-management.html"
  );

  addMenuButton(
    "商品管理",
    "management.html"
  );
}

// ======================
// 一般
// ======================
else {
  addMenuButton(
    "業務",
    "worker-confirm.html"
  );

  addMenuButton(
    "記録を見る",
    "work-records.html"
  );
}


logoutButton.addEventListener(
  "click",
  () => {
    localStorage.removeItem("token");
    localStorage.removeItem("class");
    localStorage.removeItem("user");

    sessionStorage.removeItem("selectedWork");
    sessionStorage.removeItem("currentWorker");
    sessionStorage.removeItem("currentWorkScreens");

    window.location.href =
      "index.html";
  }
);
