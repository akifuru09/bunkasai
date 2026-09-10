const token = localStorage.getItem("token");
const classData = JSON.parse(localStorage.getItem("class"));
const currentWorker = JSON.parse(
    sessionStorage.getItem("currentWorker")
);

const API_BASE = "https://163.44.103.65/api";

const className = document.querySelector("#className");
const message = document.querySelector("#message");
const workList = document.querySelector("#workList");
const backButton = document.querySelector("#backButton");

if (!token || !classData) {
    window.location.href = "index.html";
}

if (!currentWorker) {
    window.location.href = "worker-confirm.html";
}

className.textContent =
    `${classData.name} / ${currentWorker.attendance_number}番 ${currentWorker.name}`;

async function startWork(work, button) {
    button.disabled = true;
    message.textContent = "業務を開始しています...";

    try {
        const response = await fetch(
            `${API_BASE}/work-records/start`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    workAssignmentId: work.id,
                    userId: currentWorker.id
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "業務を開始できませんでした";
            button.disabled = false;
            return;
        }

        sessionStorage.setItem(
            "selectedWork",
            JSON.stringify(work)
        );

        sessionStorage.setItem(
            "currentWorkScreens",
            JSON.stringify(data.screens || [])
        );

        sessionStorage.setItem(
            "currentWorkRecordId",
            String(data.recordId)
        );

        window.location.href = "work-screen.html";
    } catch (error) {
        console.error(error);
        message.textContent = "サーバーに接続できませんでした";
        button.disabled = false;
    }
}

async function loadWorkAssignments() {
    try {
        const response = await fetch(
            `${API_BASE}/work-assignments`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "業務の取得に失敗しました";
            return;
        }

        workList.innerHTML = "";

        if (!data.workAssignments || data.workAssignments.length === 0) {
            message.textContent = "現在設定されている業務はありません";
            return;
        }

        for (const work of data.workAssignments) {
            const button = document.createElement("button");
            button.textContent = work.name;

            button.addEventListener("click", () => {
                startWork(work, button);
            });

            workList.appendChild(button);
        }
    } catch (error) {
        console.error(error);
        message.textContent = "サーバーに接続できませんでした";
    }
}

backButton.addEventListener("click", () => {
    sessionStorage.removeItem("currentWorker");
    window.location.href = "worker-confirm.html";
});

loadWorkAssignments();
