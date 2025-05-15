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
const fileInput = document.getElementById("newIconFile");
document.getElementById("token").addEventListener("input", saveInput);
document.getElementById("limit").addEventListener("input", saveInput);
document.getElementById("nonOwnerLeave").addEventListener("change", saveInput);
document.getElementById("newGroupName").addEventListener("input", saveInput);

// ファイル選択時にアイコンのBase64データをlocalStorageに保存
fileInput.addEventListener("change", async () => {
  if (fileInput.files && fileInput.files[0]) {
    try {
      const base64Data = await readFileAsDataURL(fileInput.files[0]);
      localStorage.setItem("newIconData", base64Data);
    } catch (err) {
      console.error("アイコンの読み込みエラー", err);
    }
  } else {
    // ファイルがクリアされた場合はlocalStorageから削除（アイコン削除可能）
    localStorage.removeItem("newIconData");
  }
});

// ページ読み込み時に保存値を復元
window.addEventListener("load", () => {
  document.getElementById("token").value = localStorage.getItem("token") || "";
  document.getElementById("limit").value = localStorage.getItem("limit") || "";
  document.getElementById("nonOwnerLeave").checked = localStorage.getItem("nonOwnerLeave") === "true";
  document.getElementById("newGroupName").value = localStorage.getItem("newGroupName") || "";
});

// ボタン要素取得とステータスボックス
const checkBtn = document.getElementById('checkGroupCountBtn');
const executeBtn = document.getElementById('executeBtn');
const messageDiv = document.getElementById('message');

// グループ数確認ボタン押下処理
checkBtn.addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  messageDiv.textContent = '';
  if (!token) {
    messageDiv.textContent = 'Tokenを入力してください。';
    return;
  }
  checkBtn.disabled = true;
  try {
    const res = await fetch('https://discord.com/api/v9/users/@me/channels', { headers: { 'Authorization': token } });
    if (!res.ok) {
      throw new Error('取得失敗');
    }
    const channels = await res.json();
    const groupDMs = channels.filter(c => c.type === 3);
    messageDiv.textContent = `現在、${groupDMs.length} 件のグループDMに参加しています。`;
  } catch (e) {
    messageDiv.textContent = 'DMチャンネル一覧の取得に失敗しました。';
  } finally {
    checkBtn.disabled = false;
  }
});

// 実行ボタン押下処理
executeBtn.addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  const limitInput = document.getElementById('limit').value.trim();
  const nonOwnerLeave = document.getElementById('nonOwnerLeave').checked;
  const newGroupName = document.getElementById('newGroupName').value.trim();
  messageDiv.textContent = '';
  if (!token) {
    messageDiv.textContent = 'Tokenを入力してください。';
    return;
  }
  executeBtn.disabled = true;
  try {
    // 自分のID取得
    const userRes = await fetch('https://discord.com/api/v9/users/@me', { headers: { 'Authorization': token } });
    if (!userRes.ok) throw new Error('無効なToken');
    const userId = (await userRes.json()).id;

    messageDiv.textContent += 'DMチャンネル一覧取得中...\n';
    const chanRes = await fetch('https://discord.com/api/v9/users/@me/channels', { headers: { 'Authorization': token } });
    if (!chanRes.ok) throw new Error('取得失敗');
    let groupDMs = (await chanRes.json()).filter(c => c.type === 3);
    messageDiv.textContent += `全 ${groupDMs.length} 件検出\n`;

    if (nonOwnerLeave) {
      const before = groupDMs.length;
      groupDMs = groupDMs.filter(c => c.owner_id !== userId);
      messageDiv.textContent += `作成者でない: ${before} → ${groupDMs.length} 件\n`;
    }
    if (limitInput) {
      const lim = parseInt(limitInput);
      if (!isNaN(lim) && lim > 0) groupDMs = groupDMs.slice(0, lim);
    }
    messageDiv.textContent += `処理対象: ${groupDMs.length} 件\n\n`;

    // アイコンデータ取得
    let iconData = null;
    if (fileInput.files.length) {
      iconData = await readFileAsDataURL(fileInput.files[0]);
    } else if (localStorage.getItem('newIconData')) {
      iconData = localStorage.getItem('newIconData');
    }

    // 逐次・小休止処理
    for (let i = 0; i < groupDMs.length; i++) {
      const ch = groupDMs[i];
      // 更新
      if (newGroupName || iconData !== null) {
        const upd = {};
        if (newGroupName) upd.name = newGroupName;
        if (iconData !== null) upd.icon = iconData;
        messageDiv.textContent += `更新 ${ch.id}...\n`;
        await fetch(`https://discord.com/api/v9/channels/${ch.id}`, {
          method: 'PATCH', headers: { 'Authorization': token, 'Content-Type': 'application/json' }, body: JSON.stringify(upd)
        });
      }
      // 退出
      messageDiv.textContent += `退出 ${ch.id}...\n`;
      await fetch(`https://discord.com/api/v9/channels/${ch.id}?silent=true`, { method: 'DELETE', headers: { 'Authorization': token } });
      // 10件ごとに100ms休止
      if ((i + 1) % 10 === 0) await new Promise(r => setTimeout(r, 100));
    }
    messageDiv.textContent += `\n全完了 (${groupDMs.length} 件)`;
  } catch (err) {
    messageDiv.textContent += `エラー: ${err.message}\n`;
  } finally {
    executeBtn.disabled = false;
  }
});
