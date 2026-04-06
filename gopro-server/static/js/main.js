// 手振れ補正処理が不要になったため、複雑なOpenCV処理は削除されました。

document.addEventListener('DOMContentLoaded', () => {
    const videoStream = document.getElementById('videoStream');
    const statusText = document.getElementById('status');

    // 映像の読み込みエラー時のハンドリング
    videoStream.addEventListener('error', () => {
        statusText.innerText = '⚠️ 映像の取得に失敗しました。カメラとサーバーを確認してください。';
        statusText.style.color = '#ff4444';
    });

    // 正常に映像が読み込まれているかチェックする簡単なロジック
    let checkInterval = setInterval(() => {
        if (videoStream.complete && videoStream.naturalHeight !== 0) {
            statusText.innerText = '🟢 映像ストリームを正常に受信中';
            statusText.style.color = '#00ff88';
            clearInterval(checkInterval);
        }
    }, 500);
});