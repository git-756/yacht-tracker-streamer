@echo off
echo =========================================
echo 映像配信＆座標測定 サーバー起動ツール
echo =========================================

:: 【安全対策】バッチファイルがあるフォルダを確実に基準（カレントディレクトリ）にする
cd /d "%~dp0"

echo [1/2] 位置情報・ポータルサーバー(Node.js)を起動します...
start cmd /k "cd pos-server && node server.js"

echo [2/2] 映像配信サーバー(Python/Rye)を起動します...
start cmd /k "cd gopro-server && rye run python gp_streamer.py"

echo.
echo すべての起動コマンドを送信しました！
echo 開いた2つの黒い画面にエラーが出ていないか確認してください。
pause