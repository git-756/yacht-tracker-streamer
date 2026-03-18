const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const path = require('path');

const options = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt'))
};

const server = https.createServer(options, app);
const io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- 現在地記録アプリ用のデータ（メモリ保存） ---
let latestCoords = { v1: '', v2: '', v3: '', v4: '' };
// ★追加: CSVデータをサーバー側でも記憶しておく変数
let latestBaseCsv = { text: null, name: null };
let latestCheckCsv = { text: null, name: null };

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました ID:', socket.id);

    // 新規接続時に現在の状態を送る
    socket.emit('init_coords', latestCoords);
    // ★追加: あとから参加した人に最新のCSVを配る
    socket.emit('init_csv', { base: latestBaseCsv, check: latestCheckCsv });

    socket.on('update_coords', (data) => {
        console.log(`【位置情報】座標更新を受信: ${data.targetId} -> ${data.coords}`);
        latestCoords[data.targetId] = data.coords;
        socket.broadcast.emit('coords_updated', data); 
    });

    // ★追加: 誰かがCSVをアップロードした時、受け取って全員に配る
    socket.on('sync_csv', (data) => {
        console.log(`【CSV同期】モード: ${data.mode}, ファイル名: ${data.fileName}`);
        if (data.mode === 'base') {
            latestBaseCsv = { text: data.csvText, name: data.fileName };
        } else if (data.mode === 'check') {
            latestCheckCsv = { text: data.csvText, name: data.fileName };
        }
        socket.broadcast.emit('csv_synced', data);
    });

    socket.on('reset_coords', () => {
        console.log("【位置情報】リセットを受信しました");
        latestCoords = {};
        // ★追加: サーバー側のCSV記憶も消去する
        latestBaseCsv = { text: null, name: null };
        latestCheckCsv = { text: null, name: null };
        socket.broadcast.emit('coords_reset');
    });

    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました ID:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPSサーバーが起動しました: https://localhost:${PORT}/portal.html`);
    console.log(`※スマホからアクセスする場合は、このPCのIPアドレスに置き換えてください`);
});