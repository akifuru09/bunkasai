const token = localStorage.getItem("token");
const classData = JSON.parse(
    localStorage.getItem("class")
);

const className =
    document.querySelector("#className");

const workAssignmentList =
    document.querySelector("#workAssignmentList");

const workAssignmentName =
    document.querySelector("#workAssignmentName");

const screenSelect =
    document.querySelector("#screenSelect");

const addButton =
    document.querySelector("#addButton");

const backButton =
    document.querySelector("#backButton");

const message =
    document.querySelector("#message");

const API_BASE =
    "https://163.44.103.65/api";


/*
 * ログイン確認
 */
if (!token || !classData) {
    window.location.href = "index.html";
}


/*
 * クラス名表示
 */
className.textContent =
    classData.name;


/*
 * 業務一覧を取得
 */
async function loadWorkAssignments() {
    try {
        const response = await fetch(
            `${API_BASE}/admin/work-assignments`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok) {
            message.textContent =
                data.message ||
                "業務の取得に失敗しました";

            return;
        }

        workAssignmentList.innerHTML = "";

        for (
            const work
            of data.workAssignments
        ) {
            const div =
                document.createElement("div");

            const name =
                document.createElement("span");

            name.textContent =
                work.name;

            div.appendChild(name);

            for (
                const screen
                of work.screens
            ) {
                const screenSpan =
                    document.createElement("span");

                screenSpan.textContent =
                    ` → ${screen.display_name}`;

                div.appendChild(
                    screenSpan
                );
            }

            workAssignmentList.appendChild(
                div
            );
        }

    } catch (error) {
        console.error(error);

        message.textContent =
            "サーバーに接続できませんでした";
    }
}


/*
 * 業務を追加
 */
addButton.addEventListener(
    "click",
    async () => {

        const name =
            workAssignmentName.value.trim();

        const checkboxes =
            document.querySelectorAll(
                '#screenSelect input[type="checkbox"]'
            );

        const screenIds = [];

        for (
            const checkbox
            of checkboxes
        ) {
            if (checkbox.checked) {
                screenIds.push(
                    Number(checkbox.value)
                );
            }
        }

        if (!name) {
            message.textContent =
                "業務名を入力してください";

            return;
        }

        if (screenIds.length === 0) {
            message.textContent =
                "使用する画面を1つ以上選択してください";

            return;
        }

        try {
            const response =
                await fetch(
                    `${API_BASE}/admin/work-assignments`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        },

                        body: JSON.stringify({
                            name,
                            screenIds
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                message.textContent =
                    data.message ||
                    "業務の追加に失敗しました";

                return;
            }

            message.textContent =
                "業務を追加しました";

            workAssignmentName.value = "";

            for (
                const checkbox
                of checkboxes
            ) {
                checkbox.checked = false;
            }

            await loadWorkAssignments();

        } catch (error) {
            console.error(error);

            message.textContent =
                "サーバーに接続できませんでした";
        }
    }
);


/*
 * 戻る
 */
backButton.addEventListener(
    "click",
    () => {
        window.location.href =
            "menu.html";
    }
);


/*
 * 初期読み込み
 */
loadWorkAssignments();