const token = localStorage.getItem("token");

const API_BASE = "https://163.44.103.65/api";

const numberStep = document.querySelector("#numberStep");
const confirmStep = document.querySelector("#confirmStep");
const attendanceNumber = document.querySelector("#attendanceNumber");
const attendanceKeypad = document.querySelector("#attendanceKeypad");
const checkButton = document.querySelector("#checkButton");
const userName = document.querySelector("#userName");
const continueButton = document.querySelector("#continueButton");
const retryButton = document.querySelector("#retryButton");
const backButton = document.querySelector("#backButton");
const message = document.querySelector("#message");

let selectedUser = null;

function createNumericKeypad(container, input, { maxLength = 3 } = {}) {
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

createNumericKeypad(attendanceKeypad, attendanceNumber, { maxLength: 3 });


if (!token) {
    window.location.href = "index.html";
}

// 業務選択前なので、前回の業務選択情報だけ消しておく
sessionStorage.removeItem("selectedWork");
sessionStorage.removeItem("currentWorkScreens");
sessionStorage.removeItem("currentWorkRecordId");

checkButton.addEventListener("click", async () => {
    const number = Number(attendanceNumber.value);

    if (!Number.isInteger(number) || number <= 0) {
        message.textContent = "出席番号を入力してください";
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/users/by-attendance/${number}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "ユーザーを確認できませんでした";
            return;
        }

        selectedUser = data.user;

        userName.textContent =
            `${selectedUser.attendance_number}番 ${selectedUser.name}`;

        numberStep.hidden = true;
        confirmStep.hidden = false;
        message.textContent = "";
    } catch (error) {
        console.error(error);
        message.textContent = "サーバーに接続できませんでした";
    }
});

retryButton.addEventListener("click", () => {
    selectedUser = null;
    attendanceNumber.value = "";
    confirmStep.hidden = true;
    numberStep.hidden = false;
    message.textContent = "";
    attendanceNumber.focus();
});

continueButton.addEventListener("click", () => {
    if (!selectedUser) {
        return;
    }

    sessionStorage.setItem(
        "currentWorker",
        JSON.stringify(selectedUser)
    );

    window.location.href = "work-select.html";
});

backButton.addEventListener("click", () => {
    sessionStorage.removeItem("currentWorker");
    window.location.href = "menu.html";
});
