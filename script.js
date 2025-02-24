// ファイルをDataURL（base64）に変換する関数
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  // 入力値の保存処理
  function saveInput() {
    localStorage.setItem("token", document.getElementById("token").value);
    localStorage.setItem("limit", document.getElementById("limit").value);
    localStorage.setItem("allLeave", document.getElementById("allLeave").checked);
    localStorage.setItem("newGroupName", document.getElementById("newGroupName").value);
  }
  
  // 各入力項目に入力時・変更時のイベントリスナーを追加
  document.getElementById("token").addEventListener("input", saveInput);
  document.getElementById("limit").addEventListener("input", saveInput);
  document.getElementById("allLeave").addEventListener("change", saveInput);
  document.getElementById("newGroupName").addEventListener("input", saveInput);
  
  // ページ読み込み時に保存値を復元
  window.addEventListener("load", () => {
    document.getElementById("token").value = localStorage.getItem("token") || "";
    document.getElementById("limit").value = localStorage.getItem("limit") || "";
    document.getElementById("allLeave").checked = localStorage.getItem("allLeave") === "true";
    document.getElementById("newGroupName").value = localStorage.getItem("newGroupName") || "";
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
  
  // 「実行」ボタン押下時の処理：各グループごとに【更新(任意) → 退出】を直列実行
  document.getElementById('executeBtn').addEventListener('click', async () => {
    const token = document.getElementById('token').value.trim();
    const limitInput = document.getElementById('limit').value.trim();
    const allLeave = document.getElementById('allLeave').checked;
    const newGroupName = document.getElementById('newGroupName').value.trim();
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
  
    if (!token) {
      messageDiv.textContent = 'Tokenを入力してください。';
      return;
    }
  
    try {
      // ユーザー情報取得（userIdが必要）
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
  
      // グループDM（type: 3）のみを抽出
      let groupDMs = channels.filter(channel => channel.type === 3);
      messageDiv.textContent += `グループDM: ${groupDMs.length} 件検出\n\n`;
  
      // 件数指定がある場合、かつ「全てのグループから抜ける」がチェックされていなければ、その件数分のみ処理
      if (!allLeave && limitInput) {
        const limit = parseInt(limitInput);
        if (!isNaN(limit) && limit > 0) {
          groupDMs = groupDMs.slice(0, limit);
        }
      }
      messageDiv.textContent += `処理対象グループ数: ${groupDMs.length} 件\n\n`;
  
      // 各グループごとに直列で【更新 → 退出】を実行
      for (const channel of groupDMs) {
        // ① グループ名／アイコン更新（チェック有効かつ新しいグループ名が入力されている場合）
        if (allLeave && newGroupName) {
          messageDiv.textContent += `グループ ${channel.id} の名前/アイコン更新中...\n`;
          const updateData = { name: newGroupName };
          // ファイル入力から画像を取得（添付ファイル）
          const iconFileInput = document.getElementById('newIconFile');
          if (iconFileInput.files && iconFileInput.files[0]) {
            try {
              const base64Data = await readFileAsDataURL(iconFileInput.files[0]);
              updateData.icon = base64Data;
            } catch (err) {
              messageDiv.textContent += `グループ ${channel.id} のアイコン読み込みエラー: ${err}\n`;
            }
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
        
        // ② 退出処理：指定のAPIエンドポイントに silent=true を付与して通知オフで退出
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
    }
  });
  