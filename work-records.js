const token = localStorage.getItem("token");
const classData = JSON.parse(
    localStorage.getItem("class")
);

const API_BASE = "https://163.44.103.65/api";

const className = document.querySelector("#className");
const message = document.querySelector("#message");
const recordList = document.querySelector("#recordList");
const backButton = document.querySelector("#backButton");

if (!token || !classData) {
    window.location.href = "index.html";
}

className.textContent = classData.name;

function formatDate(value) {
    if (!value) return "";

    const normalized =
        value.includes("T")
            ? value
            : value.replace(" ", "T") + "Z";

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function loadRecords() {
    try {
        const response = await fetch(
            `${API_BASE}/work-records`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message ||
                "記録の取得に失敗しました";
            return;
        }

        recordList.innerHTML = "";

        if (!data.records || data.records.length === 0) {
            message.textContent =
                "まだ業務記録はありません";
            return;
        }

        message.textContent = "";

        for (const record of data.records) {
            const div = document.createElement("div");

            const title = document.createElement("strong");
            title.textContent = record.work_name;

            const user = document.createElement("p");
            user.textContent =
                `${record.attendance_number}番 ${record.user_name}`;

            const time = document.createElement("p");
            time.textContent =
                `開始：${formatDate(record.started_at)}`;

            div.appendChild(title);
            div.appendChild(user);
            div.appendChild(time);
            recordList.appendChild(div);
        }
    } catch (error) {
        console.error(error);
        message.textContent =
            "サーバーに接続できませんでした";
    }
}

backButton.addEventListener("click", () => {
    window.location.href = "menu.html";
});

loadRecords();
