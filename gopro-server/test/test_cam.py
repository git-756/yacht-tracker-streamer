import cv2

def scan_cameras():
    print("--- カメラIDスキャンを開始します ---")
    print("映像が表示されたら、ウィンドウ上で操作してください。")
    print(" [n] キー : 次のカメラIDへ進む")
    print(" [q] キー : スキャンを終了する\n")

    # 0番から9番までのIDを順番にテスト
    for i in range(10):
        cap = cv2.VideoCapture(i)
        
        if not cap.isOpened():
            continue

        # フレームが取得できるかテスト
        ret, frame = cap.read()
        if ret:
            print(f"✅ カメラID: {i} 番の映像を取得しました。")
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # 映像の左上に現在のカメラIDをわかりやすくデカデカと表示
                cv2.putText(frame, f"CURRENT CAMERA ID: {i}", (20, 70), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
                cv2.putText(frame, "Press 'n' for Next, 'q' to Quit", (20, 130), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 255), 2)

                cv2.imshow('Camera Scanner', frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('n'):
                    # 'n'が押されたら今のカメラを閉じて次のIDへ
                    print(f"カメラID {i} をスキップします...")
                    break
                elif key == ord('q'):
                    # 'q'が押されたら完全に終了
                    print("スキャンを中断します。")
                    cap.release()
                    cv2.destroyAllWindows()
                    return

        cap.release()

    cv2.destroyAllWindows()
    print("--- スキャンが完了しました ---")

if __name__ == "__main__":
    scan_cameras()