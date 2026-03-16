import cv2
from flask import Flask, Response, render_template
import threading
import time

app = Flask(__name__, static_folder='static', template_folder='templates')

output_frame_bytes = None
lock = threading.Lock()

# --- 軽量化・低遅延のための設定値 ---
CAMERA_ID = 0       # GoPro WebcamのデバイスID
TARGET_WIDTH = 1280  # 720pの幅
TARGET_HEIGHT = 720  # 720pの高さ
TARGET_FPS = 15      # 配信・処理の目標フレームレート
JPEG_QUALITY = 50    # JPEG圧縮品質

def generate_stream():
    global output_frame_bytes, lock
    while True:
        with lock:
            if output_frame_bytes is None:
                time.sleep(0.1)
                continue
            frame_data = output_frame_bytes

        # ブラウザへMJPEGストリームを送信
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
        
        time.sleep(1.0 / TARGET_FPS)

@app.route('/')
def index():
    # templates/index.html を返す
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_stream(), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_flask():
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    cap = cv2.VideoCapture(CAMERA_ID)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, TARGET_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, TARGET_HEIGHT)
    
    if not cap.isOpened():
        print(f"カメラ（ID: {CAMERA_ID}）が見つかりません。")
        exit()

    print(f"--- サーバー稼働中（{TARGET_HEIGHT}p / {TARGET_FPS}fps / DSHOW指定） ---")
    
    prev_time = time.time()

    while True:
        if not cap.grab():
            print("映像フレームの取得をスキップしました（再試行中...）")
            time.sleep(0.05)
            continue

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