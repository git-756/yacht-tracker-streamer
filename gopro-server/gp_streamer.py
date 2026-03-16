import cv2
from flask import Flask, Response, render_template
import threading
import time
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

output_frame_bytes = None
lock = threading.Lock()

CAMERA_ID = 0
TARGET_WIDTH = 1280
TARGET_HEIGHT = 720
TARGET_FPS = 15
JPEG_QUALITY = 50

def generate_stream():
    global output_frame_bytes, lock
    while True:
        with lock:
            if output_frame_bytes is None:
                time.sleep(0.1)
                continue
            frame_data = output_frame_bytes

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
        
        time.sleep(1.0 / TARGET_FPS)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_stream(), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_flask():
    # 実行しているファイルの位置を基準に、certsフォルダを探す
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cert_path = os.path.abspath(os.path.join(base_dir, '../certs/server.crt'))
    key_path = os.path.abspath(os.path.join(base_dir, '../certs/server.key'))

    # 証明書の有無をチェックして、HTTPSかHTTPを自動で切り替える
    if os.path.exists(cert_path) and os.path.exists(key_path):
        print(f"\n✅ SSL証明書を発見しました。HTTPS(暗号化)で起動します。")
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False, ssl_context=(cert_path, key_path))
    else:
        print(f"\n⚠️ SSL証明書が見つかりません。探した場所: {cert_path}")
        print(f"⚠️ 一時的に HTTP (暗号化なし) で起動します。\n")
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    print(f"--- 映像配信サーバー起動処理 ---")
    
    # カメラが接続されていなくても、サーバーは落とさずに再試行し続けるループ
    while True:
        cap = cv2.VideoCapture(CAMERA_ID)
        
        if not cap.isOpened():
            print(f"⚠️ カメラ（ID: {CAMERA_ID}）が見つかりません。5秒後に再試行します...")
            time.sleep(5)
            continue # exit()せず、ループの先頭に戻る

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, TARGET_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, TARGET_HEIGHT)
        print(f"\n--- 📷 カメラ接続成功！（{TARGET_HEIGHT}p / {TARGET_FPS}fps） ---")
        
        prev_time = time.time()

        while True:
            if not cap.grab():
                print("⚠️ 映像フレームの取得に失敗しました。カメラを再接続します...")
                break # 内側のループを抜けてカメラを再オープンする

            current_time = time.time()
            if (current_time - prev_time) >= (1.0 / TARGET_FPS):
                ret, frame = cap.retrieve()
                if ret:
                    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                    ret_enc, buffer = cv2.imencode('.jpg', frame, encode_param)
                    if ret_enc:
                        with lock:
                            output_frame_bytes = buffer.tobytes()
                prev_time = current_time

        cap.release()
        time.sleep(2) # 再接続前のクールダウン