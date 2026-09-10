const token = localStorage.getItem("token");
const selectedWork = JSON.parse(
    sessionStorage.getItem("selectedWork")
);
const currentWorker = JSON.parse(
    sessionStorage.getItem("currentWorker")
);
const screens = JSON.parse(
    sessionStorage.getItem("currentWorkScreens") || "[]"
);

const workName = document.querySelector("#workName");
const workerName = document.querySelector("#workerName");
const screenList = document.querySelector("#screenList");
const message = document.querySelector("#message");
const finishButton = document.querySelector("#finishButton");

if (!token || !selectedWork || !currentWorker) {
    window.location.href = "menu.html";
}

workName.textContent = selectedWork.name;
workerName.textContent =
    `${currentWorker.attendance_number}番 ${currentWorker.name}`;

const pageMap = {
    order: "order.html?from=work",
    accounting: "accounting.html?from=work",
    sales: null,
    product_management: "management.html",
    user_management: "user-management.html"
};

if (screens.length === 0) {
    message.textContent =
        "この業務に使用する画面が設定されていません";
}

for (const screen of screens) {
    const button = document.createElement("button");
    button.textContent = screen.display_name;

    const page = pageMap[screen.name];

    button.addEventListener("click", () => {
        if (!page) {
            message.textContent =
                `${screen.display_name}画面はまだ未実装です`;
            return;
        }

        window.location.href = page;
    });

    screenList.appendChild(button);
}

finishButton.addEventListener("click", () => {
    sessionStorage.removeItem("selectedWork");
    sessionStorage.removeItem("currentWorker");
    sessionStorage.removeItem("currentWorkScreens");
    sessionStorage.removeItem("currentWorkRecordId");
    window.location.href = "menu.html";
});
