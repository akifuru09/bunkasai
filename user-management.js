const token =
    localStorage.getItem("token");

const classData =
    JSON.parse(
        localStorage.getItem("class")
    );

const API_BASE =
    "https://163.44.103.65/api";


const className =
    document.querySelector("#className");

const message =
    document.querySelector("#message");

const maxAttendanceNumberInput =
    document.querySelector(
        "#maxAttendanceNumber"
    );

const setMaxButton =
    document.querySelector("#setMaxButton");

const userList =
    document.querySelector("#userList");

const editButton =
    document.querySelector("#editButton");

const saveButton =
    document.querySelector("#saveButton");

const cancelButton =
    document.querySelector("#cancelButton");

const backButton =
    document.querySelector("#backButton");


let currentUsers = [];

let maxAttendanceNumber = 0;

let editing = false;


// ログイン確認
if (!token || !classData) {
    window.location.href = "index.html";
}


className.textContent =
    classData.name;


// 名簿を取得
async function loadRoster() {

    try {

        const response = await fetch(
            `${API_BASE}/admin/class-roster`,
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
                "ユーザー情報の取得に失敗しました";

            return;
        }


        currentUsers =
            data.users || [];

        maxAttendanceNumber =
            data.class
                ?.max_attendance_number || 0;


        maxAttendanceNumberInput.value =
            maxAttendanceNumber || "";


        renderUsers();


    } catch (error) {

        console.error(error);

        message.textContent =
            "サーバーに接続できませんでした";
    }
}


// 一覧表示
function renderUsers() {

    userList.innerHTML = "";

    if (!maxAttendanceNumber) {

        userList.textContent =
            "最大出席番号を設定してください";

        editButton.hidden = true;

        return;
    }


    editButton.hidden = editing;


    for (
        let number = 1;
        number <= maxAttendanceNumber;
        number++
    ) {

        const row =
            document.createElement("div");

        const numberText =
            document.createElement("span");

        numberText.textContent =
            `${number}番 `;

        row.appendChild(numberText);


        const user =
            currentUsers.find(
                user =>
                    user.attendance_number
                    === number
            );


        if (editing) {

            const input =
                document.createElement("input");

            input.type = "text";

            input.dataset.attendanceNumber =
                number;

            input.value =
                user?.name || "";

            input.placeholder =
                "名前";

            row.appendChild(input);

        } else {

            const name =
                document.createElement("span");

            name.textContent =
                user?.name || "未登録";

            row.appendChild(name);
        }


        userList.appendChild(row);
    }
}


// 最大番号設定
// 出席番号の範囲を変更
setMaxButton.addEventListener(
    "click",
    async () => {

        const value =
            Number(
                maxAttendanceNumberInput.value
            );

        if (
            !Number.isInteger(value) ||
            value <= 0
        ) {
            message.textContent =
                "正しい番号を入力してください";

            return;
        }


        try {

            // まず確認なしで変更を要求
            let response = await fetch(
                `${API_BASE}/admin/class/max-attendance-number`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        maxAttendanceNumber: value,
                        confirmDelete: false
                    })
                }
            );


            let data =
                await response.json();


            // 登録済みユーザーが削除される場合
            if (
                response.status === 409 &&
                data.requiresConfirmation
            ) {

                const userText =
                    data.users
                        .map(
                            user =>
                                `${user.attendance_number}番 ${user.name}`
                        )
                        .join("\n");


                const confirmed = confirm(
                    `次のユーザーが削除されます。\n\n` +
                    `${userText}\n\n` +
                    `本当に${value}番までに変更しますか？`
                );


                if (!confirmed) {

                    // 入力値を元に戻す
                    maxAttendanceNumberInput.value =
                        maxAttendanceNumber;

                    message.textContent =
                        "変更をキャンセルしました";

                    return;
                }


                // OKされたので削除を許可して再送信
                response = await fetch(
                    `${API_BASE}/admin/class/max-attendance-number`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        },

                        body: JSON.stringify({
                            maxAttendanceNumber: value,
                            confirmDelete: true
                        })
                    }
                );


                data =
                    await response.json();
            }


            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "変更に失敗しました";

                return;
            }


            if (value > maxAttendanceNumber) {

                message.textContent =
                    `${value}番まで追加しました`;

            } else if (
                value < maxAttendanceNumber
            ) {

                message.textContent =
                    `${value}番までに変更しました`;

            } else {

                message.textContent =
                    "変更はありません";
            }


            await loadRoster();


        } catch (error) {

            console.error(error);

            message.textContent =
                "サーバーに接続できませんでした";
        }
    }
);

// 編集開始
editButton.addEventListener(
    "click",
    () => {

        editing = true;

        editButton.hidden = true;
        saveButton.hidden = false;
        cancelButton.hidden = false;

        renderUsers();
    }
);


// キャンセル
cancelButton.addEventListener(
    "click",
    () => {

        editing = false;

        saveButton.hidden = true;
        cancelButton.hidden = true;
        editButton.hidden = false;

        renderUsers();
    }
);


// 一括保存
saveButton.addEventListener(
    "click",
    async () => {

        const inputs =
            userList.querySelectorAll(
                "input[data-attendance-number]"
            );


        const users =
            Array.from(inputs).map(
                input => ({
                    attendanceNumber:
                        Number(
                            input.dataset
                                .attendanceNumber
                        ),

                    name:
                        input.value.trim()
                })
            );


        try {

            const response = await fetch(
                `${API_BASE}/admin/class-roster`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        users
                    })
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "保存に失敗しました";

                return;
            }


            message.textContent =
                "ユーザー情報を保存しました";


            editing = false;

            saveButton.hidden = true;
            cancelButton.hidden = true;
            editButton.hidden = false;


            await loadRoster();


        } catch (error) {

            console.error(error);

            message.textContent =
                "サーバーに接続できませんでした";
        }
    }
);


// 戻る
backButton.addEventListener(
    "click",
    () => {

        window.location.href =
            "menu.html";
    }
);


// 初期表示
loadRoster();