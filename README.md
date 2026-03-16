# Yacht Tracker Streamer

作業船（Tug）からの「映像モニタリング」と「現在地・座標のリアルタイム記録」を統合して行うためのWebアプリケーションシステムです。ローカルネットワーク（またはTailscale等のVPN環境）での運用を想定しています。

## 構成と機能

本システムは、用途に応じて2つの独立したサーバーで構成されており、統合ポータル画面から各機能へアクセスします。

### 1. 統合ポータル & 位置情報サーバー (`pos-server/`)
- **技術スタック:** Node.js, Express, Socket.IO, Leaflet.js
- **主な機能:**
  - 各アプリへのリンクをまとめた統合ポータルの配信 (HTTPS)
  - ブラウザのGeolocation APIを用いたGPS座標の取得とマップ表示
  - 「操作者」と「閲覧者」間でのV1〜V4座標データのリアルタイム同期
  - 記録した座標のCSVエクスポートおよびインポート（過去ピンの復元）機能

### 2. 映像モニタリングサーバー (`gopro-server/`)
- **技術スタック:** Python (Rye), Flask, OpenCV
- **主な機能:**
  - GoProを用いた低遅延のMotion JPEGストリーミング配信
  - ブラウザ上(OpenCV.js)での映像のリアルタイム処理・手振れ補正機能

## ディレクトリ構成
yacht-tracker-streamer/
├── certs/                 # SSL証明書と秘密鍵を配置するディレクトリ
├── gopro-server/          # 映像配信サーバー (Python)
├── pos-server/            # 位置情報・ポータルサーバー (Node.js)
├── start_system.bat       # Windows用 一括起動バッチスクリプト
├── README.md              # 本ファイル
├── NOTICE.md              # サードパーティライセンス表記
└── LICENSE                # MITライセンス

## セットアップ手順
1. SSL証明書の作成 (HTTPS化)
スマホのブラウザで位置情報(GPS)を取得するため、ローカル環境でもHTTPS化が必須です。リポジトリ直下で以下のコマンドを実行し、オレオレ証明書を作成します。

Bash
`mkdir -p certs`
`cd certs`
`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '//CN=localhost' -keyout server.key -out server.crt -days 3650`
2. 位置情報サーバー (Node.js) の準備
Bash
`cd pos-server`
`npm install`
3. 映像モニタリングサーバー (Python) の準備
パッケージマネージャーとして Rye を使用しています。

Bash
`cd gopro-server`
`rye sync`
起動方法
Windows環境の場合
リポジトリ直下にある start_system.bat をダブルクリックすることで、2つのサーバーがバックグラウンドで同時に起動します。

## 手動で起動する場合 (ターミナルを2つ開きます)
Bash
### ターミナル1: ポータル・位置情報サーバー
cd pos-server
node server.js

### ターミナル2: 映像モニタリングサーバー
`cd gopro-server`
`rye run python gp_streamer.py`
利用方法
サーバー起動後、同じネットワーク（またはTailscale等）に接続された端末のブラウザから、以下のURLにアクセスしてください。
https://<サーバーPCのIPアドレス>:3000/portal.html

※自己署名証明書を使用しているため、初回アクセス時にブラウザでセキュリティ警告が表示されます。「詳細設定」等からアクセスを許可して進んでください。

## ライセンス
このプロジェクトは [MIT](LICENCE) ライセンス のもとで公開されています。