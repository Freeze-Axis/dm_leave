// ファイルをDataURL（base64）に変換する関数
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 入力値の保存処理（履歴を残す）
function saveInput() {
  localStorage.setItem("token", document.getElementById("token").value);
  localStorage.setItem("limit", document.getElementById("limit").value);
  localStorage.setItem("nonOwnerLeave", document.getElementById("nonOwnerLeave").checked);
  localStorage.setItem("newGroupName", document.getElementById("newGroupName").value);
}

// 各入力項目のイベントリスナー
document.getElementById("token").addEventListener("input", saveInput);
document.getElementById("limit").addEventListener("input", saveInput);
document.getElementById("nonOwnerLeave").addEventListener("change", saveInput);
document.getElementById("newGroupName").addEventListener("input", saveInput);

// ファイル選択時にアイコンのBase64データをlocalStorageに保存（履歴として残す）
document.getElementById("newIconFile").addEventListener("change", async () => {
  const fileInput = document.getElementById("newIconFile");
  if (fileInput.files && fileInput.files[0]) {
    try {
      const base64Data = await readFileAsDataURL(fileInput.files[0]);
      localStorage.setItem("newIconData", base64Data);
    } catch (err) {
      console.error("アイコンの読み込みエラー", err);
    }
  }
});

// ページ読み込み時に保存値を復元
window.addEventListener("load", () => {
  document.getElementById("token").value = localStorage.getItem("token") || "";
  document.getElementById("limit").value = localStorage.getItem("limit") || "";
  document.getElementById("nonOwnerLeave").checked = localStorage.getItem("nonOwnerLeave") === "true";
  document.getElementById("newGroupName").value = localStorage.getItem("newGroupName") || "";
  // ※ファイル入力自体は復元できませんが、過去に読み込んだアイコンのBase64は localStorage に保持されます。
});

// グループ数確認ボタン押下時の処理
document.getElementById('checkGroupCountBtn').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = '';
  if (!token) {
    messageDiv.textContent = 'Tokenを入力してください。';
    return;
  }
  try {
    const channelsResponse = await fetch('https://discord.com/api/v9/users/@me/channels', {
      headers: { 'Authorization': token }
    });
    if (!channelsResponse.ok) {
      messageDiv.textContent = 'DMチャンネル一覧の取得に失敗しました。';
      return;
    }
    const channels = await channelsResponse.json();
    // グループDMのみ抽出（type: 3）
    const groupDMs = channels.filter(channel => channel.type === 3);
    messageDiv.textContent = `現在、${groupDMs.length} 件のグループDMに参加しています。`;
  } catch (error) {
    messageDiv.textContent = 'エラーが発生しました。';
  }
});

// 「実行」ボタン押下時の処理：各グループに対して、更新（任意）→退出処理を直列実行
document.getElementById('executeBtn').addEventListener('click', async () => {
  const executeBtn = document.getElementById('executeBtn');
  executeBtn.disabled = true; // ボタンを物理的に無効化

  const token = document.getElementById('token').value.trim();
  const limitInput = document.getElementById('limit').value.trim();
  const nonOwnerLeave = document.getElementById('nonOwnerLeave').checked;
  const newGroupName = document.getElementById('newGroupName').value.trim();
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = '';

  try {
    if (!token) {
      messageDiv.textContent = 'Tokenを入力してください。';
      return;
    }

    // ユーザー情報取得（自分のIDが必要）
    const userResponse = await fetch('https://discord.com/api/v9/users/@me', {
      headers: { 'Authorization': token }
    });
    if (!userResponse.ok) {
      messageDiv.textContent = '無効なTokenです。';
      return;
    }
    const userData = await userResponse.json();
    const userId = userData.id;

    // DMチャンネル一覧取得
    messageDiv.textContent += 'DMチャンネル一覧取得中...\n';
    const channelsResponse = await fetch('https://discord.com/api/v9/users/@me/channels', {
      headers: { 'Authorization': token }
    });
    if (!channelsResponse.ok) {
      messageDiv.textContent += 'DMチャンネル一覧の取得に失敗しました。\n';
      return;
    }
    const channels = await channelsResponse.json();
    messageDiv.textContent += `DMチャンネル一覧取得完了: ${channels.length} 件\n`;

    // グループDM（type: 3）のみ抽出
    let groupDMs = channels.filter(channel => channel.type === 3);
    const originalCount = groupDMs.length;
    if (nonOwnerLeave) {
      groupDMs = groupDMs.filter(channel => channel.owner_id !== userId);
      messageDiv.textContent += `全 ${originalCount} 件中、作成者でないグループ: ${groupDMs.length} 件を対象とします。\n\n`;
    } else {
      messageDiv.textContent += `対象のグループDM: ${groupDMs.length} 件検出\n\n`;
    }

    // グループ数が指定されている場合は、その件数分のみ処理
    if (limitInput) {
      const limit = parseInt(limitInput);
      if (!isNaN(limit) && limit > 0) {
        groupDMs = groupDMs.slice(0, limit);
      }
    }
    messageDiv.textContent += `処理対象グループ数: ${groupDMs.length} 件\n\n`;

    // アイコンのBase64データをファイル入力または localStorage から取得
    let iconData = null;
    const fileInput = document.getElementById("newIconFile");
    if (fileInput.files && fileInput.files[0]) {
      try {
        iconData = await readFileAsDataURL(fileInput.files[0]);
      } catch (err) {
        messageDiv.textContent += `アイコン読み込みエラー: ${err}\n`;
      }
    } else {
      iconData = localStorage.getItem("newIconData") || null;
    }

    // 各グループに対して、更新（任意）→退出処理を実行
    for (const channel of groupDMs) {
      if (newGroupName || iconData) {
        messageDiv.textContent += `グループ ${channel.id} の名前/アイコン更新中...\n`;
        const updateData = {};
        if (newGroupName) {
          updateData.name = newGroupName;
        }
        if (iconData) {
          updateData.icon = iconData;
        }
        const updateResponse = await fetch(`https://discord.com/api/v9/channels/${channel.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        if (updateResponse.ok) {
          messageDiv.textContent += `グループ ${channel.id} の更新成功。\n`;
        } else {
          messageDiv.textContent += `グループ ${channel.id} の更新失敗。\n`;
        }
      }
      
      messageDiv.textContent += `DMグループ ${channel.id} の退出処理を実行中...\n`;
      const leaveResponse = await fetch(`https://discord.com/api/v9/channels/${channel.id}?silent=true`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      });
      if (!leaveResponse.ok) {
        messageDiv.textContent += `DMグループ ${channel.id} からの退出に失敗しました。\n`;
      } else {
        messageDiv.textContent += `DMグループ ${channel.id} から退出しました。\n`;
      }
    }
    messageDiv.textContent += `\n全ての処理が完了しました。（${groupDMs.length} 件）`;
  } catch (error) {
    messageDiv.textContent += 'エラーが発生しました。\n';
  } finally {
    executeBtn.disabled = false; // 処理終了後にボタンを再度有効化
  }
});
