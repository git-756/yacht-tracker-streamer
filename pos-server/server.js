const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. 証明書の読み込み（一つ上の階層の certs フォルダから読み込む）
const options = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt'))
};

// 2. HTTPSサーバーの作成
const server = https.createServer(options, app);
const io = require('socket.io')(server);

// 3. 画面のファイル（HTML等）は public フォルダから配信する設定
app.use(express.static(path.join(__dirname, 'public')));

// --- 現在地記録アプリ用のデータ（メモリ保存） ---
let latestCoords = { v1: '', v2: '', v3: '', v4: '' };

// --- クライアント接続時の処理（Socket.IO） ---
io.on('connection', (socket) => {
    console.log('ユーザーが接続しました ID:', socket.id);

    // 新規接続時に現在の状態を送る
    socket.emit('init_coords', latestCoords);

    // 座標更新を受け取った時
    socket.on('update_coords', (data) => {
        console.log(`【位置情報】座標更新を受信: ${data.targetId} -> ${data.coords}`);
        latestCoords[data.targetId] = data.coords;
        socket.broadcast.emit('coords_updated', data); // 他の全員に転送
    });

    // リセットを受け取った時
    socket.on('reset_coords', () => {
        console.log("【位置情報】リセットを受信しました");
        latestCoords = { v1: '', v2: '', v3: '', v4: '' };
        socket.broadcast.emit('coords_reset');
    });

    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました ID:', socket.id);
    });
});

// 4. サーバーの起動
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPSサーバーが起動しました: https://localhost:${PORT}/portal.html`);
    console.log(`※スマホからアクセスする場合は、このPCのIPアドレスに置き換えてください`);
});