@echo off
REM コマンドプロンプトの文字コードをUTF-8に変更（> nul で実行結果のメッセージを隠す）
chcp 65001 > nul

echo GoPro Streamerを起動しています...

REM 指定されたディレクトリへ移動（ドライブが違う場合も考慮して /d を付与）
cd /d C:\Users\TagBoat\Desktop\GoPro-webcam

REM Rye経由でスクリプトを実行
rye run python .\src\gopro_webcam\gp_streamer.py

REM エラー時や終了時にコマンドプロンプトが勝手に閉じないように待機
pause