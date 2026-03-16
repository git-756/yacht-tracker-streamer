let cvReady = false;
let streaming = false;
let isStabilizationOn = true; // 手振れ補正のON/OFFフラグ

function onOpenCvReady() {
    document.getElementById('status').innerText = 'OpenCV.js を初期化中（WebAssembly展開中）...';
    
    cv['onRuntimeInitialized'] = () => {
        document.getElementById('status').innerText = 'OpenCV.js 準備完了。映像処理を開始します...';
        cvReady = true;
        
        // ボタンのクリックイベントを登録
        const toggleBtn = document.getElementById('toggleBtn');
        toggleBtn.addEventListener('click', function() {
            isStabilizationOn = !isStabilizationOn;
            if (isStabilizationOn) {
                this.textContent = '手振れ補正: ON';
                this.className = 'btn-on';
            } else {
                this.textContent = '手振れ補正: OFF';
                this.className = 'btn-off';
            }
        });

        startStabilization();
    };
}

function startStabilization() {
    const rawImg = document.getElementById('rawVideo');
    const outCanvas = document.getElementById('outputCanvas');
    const ctx = outCanvas.getContext('2d', { willReadFrequently: true });

    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = outCanvas.width;
    hiddenCanvas.height = outCanvas.height;
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

    let prevGray = new cv.Mat();
    let currGray = new cv.Mat();
    
    const smoothingFrames = 30; 
    let trajectoryX = 0;
    let trajectoryY = 0;
    let history = [];

    function processFrame() {
        if (!cvReady) return;

        hiddenCtx.drawImage(rawImg, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        let src = cv.imread(hiddenCanvas);
        cv.cvtColor(src, currGray, cv.COLOR_RGBA2GRAY, 0);

        if (prevGray.empty()) {
            currGray.copyTo(prevGray);
            cv.imshow('outputCanvas', src);
            src.delete();
            setTimeout(processFrame, 1000 / 15);
            return;
        }

        // ▼ OFFの場合は計算をスキップしてそのまま表示
        if (!isStabilizationOn) {
            cv.imshow('outputCanvas', src);
            // 次にONにした時に映像が飛ぶのを防ぐため、prevGrayだけは更新しておく
            currGray.copyTo(prevGray);
            src.delete();
            setTimeout(processFrame, 1000 / 15);
            return;
        }

        // ▼ ONの場合は手振れ補正を実行
        let prevPts = new cv.Mat();
        let currPts = new cv.Mat();
        let status = new cv.Mat();
        let err = new cv.Mat();
        let mask = new cv.Mat();

        cv.goodFeaturesToTrack(prevGray, prevPts, 50, 0.01, 30, mask, 3, false, 0.04);

        if (prevPts.rows > 0) {
            let winSize = new cv.Size(21, 21);
            let maxLevel = 2;
            let criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 10, 0.03);
            cv.calcOpticalFlowPyrLK(prevGray, currGray, prevPts, currPts, status, err, winSize, maxLevel, criteria);

            let dxSum = 0, dySum = 0, count = 0;
            for (let i = 0; i < status.rows; i++) {
                if (status.data[i] === 1) {
                    dxSum += (currPts.data32F[i * 2] - prevPts.data32F[i * 2]);
                    dySum += (currPts.data32F[i * 2 + 1] - prevPts.data32F[i * 2 + 1]);
                    count++;
                }
            }

            if (count > 0) {
                let dx = dxSum / count;
                let dy = dySum / count;

                trajectoryX += dx;
                trajectoryY += dy;
                history.push({x: trajectoryX, y: trajectoryY});

                if (history.length > smoothingFrames) {
                    history.shift();
                }

                let smoothX = history.reduce((sum, p) => sum + p.x, 0) / history.length;
                let smoothY = history.reduce((sum, p) => sum + p.y, 0) / history.length;

                let diffX = smoothX - trajectoryX;
                let diffY = smoothY - trajectoryY;

                let M = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, diffX, 0, 1, diffY]);
                let dst = new cv.Mat();
                let dsize = new cv.Size(src.cols, src.rows);
                
                cv.warpAffine(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 255));
                cv.imshow('outputCanvas', dst);

                dst.delete();
                M.delete();
            } else {
                cv.imshow('outputCanvas', src);
            }
        } else {
             cv.imshow('outputCanvas', src);
        }

        currGray.copyTo(prevGray);
        src.delete(); mask.delete(); prevPts.delete(); currPts.delete(); status.delete(); err.delete();

        setTimeout(processFrame, 1000 / 15); 
    }

    function checkVideoReady() {
        if (rawImg.naturalWidth > 0 && !streaming) {
            streaming = true;
            processFrame();
        } else if (!streaming) {
            setTimeout(checkVideoReady, 100);
        }
    }

    rawImg.onload = checkVideoReady;
    checkVideoReady(); 
}