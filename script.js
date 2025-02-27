// 「実行」ボタン押下時の処理：各グループに対して、更新（任意）→退出処理を直列実行
document.getElementById('executeBtn').addEventListener('click', async () => {
  const executeButton = document.getElementById('executeBtn');
  executeButton.disabled = true; // クリック直後にボタンを無効化

  const token = document.getElementById('token').value.trim();
  const limitInput = document.getElementById('limit').value.trim();
  const nonOwnerLeave = document.getElementById('nonOwnerLeave').checked;
  const newGroupName = document.getElementById('newGroupName').value.trim();
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = '';

  if (!token) {
    messageDiv.textContent = 'Tokenを入力してください。';
    executeButton.disabled = false; // トークン未入力の場合はすぐにボタンを再有効化
    return;
  }

  try {
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
      // グループ名またはアイコンが指定されていれば更新
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
      
      // 退出処理：silent=true を付与して通知オフで退出
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
    executeButton.disabled = false; // 最終的にボタンを再度有効化
  }
});
