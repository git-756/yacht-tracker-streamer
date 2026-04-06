let userRole = null; 
const socket = io(); 

let originalCsvLines = null;
let originalCsvFileName = null;
let pointIds = ['v1', 'v2', 'v3'];

const yellowIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('back-to-portal').href = `https://${window.location.hostname}:3000/portal.html`;
    initPoints();
    
    document.getElementById('status').innerText = "追跡停止中 (OFF)";
    document.getElementById('status').style.color = "gray";
});

socket.on('init_csv', (data) => {
    let hasServerBase = !!(data.base && data.base.text);
    let hasServerCheck = !!(data.check && data.check.text);

    if (hasServerBase) {
        processCSV(data.base.text, 'base', data.base.name, false);
    } else {
        const savedBaseText = localStorage.getItem('baseCsvText');
        const savedBaseName = localStorage.getItem('baseCsvName');
        if (savedBaseText && savedBaseName) processCSV(savedBaseText, 'base', savedBaseName, false);
    }

    if (hasServerCheck) {
        processCSV(data.check.text, 'check', data.check.name, false);
    } else {
        const savedCheckText = localStorage.getItem('checkCsvText');
        const savedCheckName = localStorage.getItem('checkCsvName');
        if (savedCheckText && savedCheckName) processCSV(savedCheckText, 'check', savedCheckName, false);
    }
});

socket.on('csv_synced', (data) => {
    processCSV(data.csvText, data.mode, data.fileName, false);
});

function initPoints() {
    const container = document.getElementById('input-container');
    container.innerHTML = '';
    pointIds.forEach(id => createPointElement(id));
}

function createPointElement(id) {
    const container = document.getElementById('input-container');
    if (document.getElementById(`group-${id}`)) return; 

    const upperId = id.toUpperCase();
    const group = document.createElement('div');
    group.className = 'input-group';
    group.id = `group-${id}`;

    group.innerHTML = `
        <button class="record-btn" id="record-${id}" onclick="recordLocation('${id}')">${upperId}</button>
        <input type="text" id="${id}-input" readonly placeholder="${upperId}の座標">
        <button class="copy-btn" onclick="copyToClipboard('${id}-input')">コピー</button>
        <button class="delete-btn" id="del-${id}" onclick="deletePoint('${id}')" style="display: none;">🗑️</button>
    `;
    container.appendChild(group);

    const inputEl = document.getElementById(`${id}-input`);
    inputEl.addEventListener('change', (e) => {
        if (userRole === 'operator') {
            socket.emit('update_coords', { targetId: id, coords: e.target.value });
        }
        updateVPins();
    });
    
    if (userRole) applyRoleToPoint(id);
}

function applyRoleToPoint(id) {
    const recordBtn = document.getElementById(`record-${id}`);
    const inputEl = document.getElementById(`${id}-input`);
    const delBtn = document.getElementById(`del-${id}`);
    if (!recordBtn || !inputEl || !delBtn) return;

    if (userRole === 'operator') {
        recordBtn.disabled = false;
        recordBtn.innerText = id.toUpperCase();
        delBtn.style.display = 'inline-block'; 
        
        const isManual = document.getElementById('manual-mode-switch').checked;
        if (isManual) {
            inputEl.removeAttribute('readonly');
            inputEl.placeholder = `${id.toUpperCase()}の座標 (手動入力可)`;
        } else {
            inputEl.setAttribute('readonly', true);
            inputEl.placeholder = `${id.toUpperCase()}の座標`;
        }
    } else if (userRole === 'viewer') {
        recordBtn.disabled = true;
        recordBtn.innerText = '操作不可';
        delBtn.style.display = 'none'; 
        inputEl.setAttribute('readonly', true);
        inputEl.placeholder = `${id.toUpperCase()}の座標`;
    }
}

function toggleManualMode() {
    if (userRole !== 'operator') return;
    pointIds.forEach(id => applyRoleToPoint(id));
}

function addPoint() {
    if (userRole !== 'operator') return;
    let maxNum = 0;
    pointIds.forEach(id => {
        const num = parseInt(id.substring(1));
        if (num > maxNum) maxNum = num;
    });
    const newId = `v${maxNum + 1}`;
    pointIds.push(newId);
    createPointElement(newId);
}

function deletePoint(id) {
    if (userRole !== 'operator') return;
    if (pointIds.length <= 1) {
        alert("少なくとも1つの地点は残す必要があります。");
        return;
    }
    if (confirm(`${id.toUpperCase()} を削除しますか？\n（入力されている座標も消去されます）`)) {
        removePointElement(id);
        socket.emit('update_coords', { targetId: id, coords: 'DELETED' });
        updateVPins();
    }
}

function removePointElement(id) {
    const index = pointIds.indexOf(id);
    if (index > -1) pointIds.splice(index, 1);
    const group = document.getElementById(`group-${id}`);
    if (group) group.remove();
}

function selectRole(role) {
    userRole = role;
    document.getElementById('role-modal').style.display = 'none'; 
    
    let roleText = role === 'operator' ? '<span style="color:red; font-weight:bold;">[操作者モード]</span>' : '<span style="color:blue; font-weight:bold;">[閲覧者モード]</span>';
    document.getElementById('current-role-disp').innerHTML = roleText;

    document.getElementById('manual-mode-container').style.display = (role === 'operator') ? 'flex' : 'none';
    document.getElementById('add-point-btn').style.display = (role === 'operator') ? 'block' : 'none';

    ['full-reset-btn', 'coord-reset-btn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (role === 'viewer') {
                btn.disabled = true;
                if (btnId !== 'full-reset-btn') btn.innerText = '操作不可';
            } else {
                btn.disabled = false;
                if (btnId === 'full-reset-btn') btn.innerHTML = '⚠️ 全リセット';
                if (btnId === 'coord-reset-btn') btn.innerHTML = '🗑️ 座標リセット';
            }
        }
    });

    ['base-reset-btn', 'check-reset-btn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🗑️ クリア';
        }
    });

    pointIds.forEach(id => applyRoleToPoint(id));

    if (role === 'operator') {
        const baseText = localStorage.getItem('baseCsvText');
        const baseName = localStorage.getItem('baseCsvName');
        if (baseText && baseName) {
            socket.emit('sync_csv', { mode: 'base', csvText: baseText, fileName: baseName });
        }
        const checkText = localStorage.getItem('checkCsvText');
        const checkName = localStorage.getItem('checkCsvName');
        if (checkText && checkName) {
            socket.emit('sync_csv', { mode: 'check', csvText: checkText, fileName: checkName });
        }
        pointIds.forEach(id => {
            const el = document.getElementById(`${id}-input`);
            if (el && el.value) {
                socket.emit('update_coords', { targetId: id, coords: el.value });
            }
        });
        updateVPins();
    }
}

socket.on('init_coords', (data) => updateFieldsFromSocket(data));
socket.on('coords_updated', (data) => {
    const tempObj = {};
    tempObj[data.targetId] = data.coords;
    updateFieldsFromSocket(tempObj);
});

socket.on('coords_reset', () => {
    clearScreenFull();
    alert("操作者によりすべてのデータが全リセットされました。");
});

function updateFieldsFromSocket(data) {
    for (const [key, val] of Object.entries(data)) {
        if (val === 'DELETED') {
            removePointElement(key);
            continue;
        }
        if (val !== undefined && val !== null && val !== '') {
            if (!pointIds.includes(key)) {
                pointIds.push(key);
                createPointElement(key);
                sortPointElements(); 
            }
            const inputField = document.getElementById(`${key}-input`);
            if (inputField && inputField.value !== val) {
                inputField.value = val;
                inputField.style.backgroundColor = '#d4edda';
                setTimeout(() => { inputField.style.backgroundColor = '#fafafa'; }, 1000);
            }
        } 
        else if (val === '') {
            const inputField = document.getElementById(`${key}-input`);
            if (inputField && inputField.value !== val) {
                inputField.value = val;
            }
        }
    }
    updateVPins();
}

function sortPointElements() {
    const container = document.getElementById('input-container');
    const groups = Array.from(container.children);
    groups.sort((a, b) => {
        const numA = parseInt(a.id.replace('group-v', ''));
        const numB = parseInt(b.id.replace('group-v', ''));
        return numA - numB;
    });
    groups.forEach(g => container.appendChild(g));
}

function fullReset() {
    if (userRole !== 'operator') return;
    if (confirm("記録した座標、追加したV地点、読み込んだCSVなど、\nすべてのデータを完全にリセットしますか？")) {
        clearScreenFull(); 
        socket.emit('reset_coords'); 
    }
}

function resetSingleCsv(mode) {
    const targetName = mode === 'base' ? 'ベースCSV（青枠線）' : '確認用CSV（黄色ピン）';
    
    if (confirm(`読み込んだ${targetName}をクリアしますか？\n（現在記録中のV地点の座標はそのまま残ります）`)) {
        processCSV('', mode, '');
        // ★変更箇所：役割に関わらず、クリアした情報を他端末に同期する
        socket.emit('sync_csv', { mode: mode, csvText: '', fileName: '' });
    }
}

function coordReset() {
    if (userRole !== 'operator') return;
    if (confirm("記録したV1〜Vnの座標のみをリセットしますか？\n（追加したV地点も消去され、初期状態に戻ります）")) {
        const idsToRemove = pointIds.filter(id => parseInt(id.substring(1)) > 3);
        
        idsToRemove.forEach(id => {
             removePointElement(id);
             socket.emit('update_coords', { targetId: id, coords: 'DELETED' });
        });

        pointIds.forEach(id => {
            const el = document.getElementById(`${id}-input`);
            if (el) {
                el.value = '';
                el.style.backgroundColor = '#f8d7da';
                setTimeout(() => { el.style.backgroundColor = '#fafafa'; }, 1000);
                socket.emit('update_coords', { targetId: id, coords: '' });
            }
        });
        updateVPins();
    }
}

function clearScreenFull() {
    const idsToRemove = pointIds.filter(id => parseInt(id.substring(1)) > 3);
    idsToRemove.forEach(id => removePointElement(id));
    pointIds.forEach(id => {
        const el = document.getElementById(`${id}-input`);
        if (el) { el.value = ''; el.style.backgroundColor = '#f8d7da'; setTimeout(() => { el.style.backgroundColor = '#fafafa'; }, 1000); }
    });
    
    if(loadedMarkersLayer) loadedMarkersLayer.clearLayers();
    if(checkMarkersLayer) checkMarkersLayer.clearLayers();
    
    originalCsvLines = null;
    originalCsvFileName = null;
    localStorage.removeItem('baseCsvText');
    localStorage.removeItem('baseCsvName');
    localStorage.removeItem('checkCsvText');
    localStorage.removeItem('checkCsvName');
    document.getElementById('base-csv-name').innerText = '未選択';
    document.getElementById('check-csv-name').innerText = '未選択';
    
    updateVPins();
}

let currentLat = null;
let currentLng = null;
const statusEl = document.getElementById('status');
const coordsEl = document.getElementById('current-coords');

const map = L.map('map').setView([35.6895, 139.6917], 5); 
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let currentMarker = null;
let loadedMarkersLayer = L.layerGroup().addTo(map);
let checkMarkersLayer = L.layerGroup().addTo(map);
let vMarkersLayer = L.layerGroup().addTo(map);

function updateVPins() {
    vMarkersLayer.clearLayers(); 
    
    pointIds.forEach(id => {
        const inputEl = document.getElementById(`${id}-input`);
        if (inputEl && inputEl.value && inputEl.value.trim() !== '') {
            const parts = inputEl.value.split(',');
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng], {icon: redIcon}).bindPopup(`<b>${id.toUpperCase()}</b>`);
                vMarkersLayer.addLayer(marker);
            }
        }
    });
}

let watchId = null;
let locationTimer = null;
let lastUpdate = 0;

function toggleLocationMode() {
    const isEnabled = document.getElementById('location-mode-switch').checked;
    if (isEnabled) {
        startLocationTracking();
        locationTimer = setTimeout(() => {
            document.getElementById('location-mode-switch').checked = false;
            stopLocationTracking();
            alert("バッテリー保護のため、現在地のリアルタイム表示を自動でオフにしました。");
        }, 3600000);
    } else {
        stopLocationTracking();
        if (locationTimer) {
            clearTimeout(locationTimer);
            locationTimer = null;
        }
    }
}

function startLocationTracking() {
    if (navigator.geolocation) {
        statusEl.innerText = "GPS待機中...";
        statusEl.style.color = "blue";
        
        if (watchId) navigator.geolocation.clearWatch(watchId);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const now = Date.now();
                if (now - lastUpdate < 3000) return;
                lastUpdate = now;

                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
                statusEl.innerText = "取得完了（3秒更新）";
                statusEl.style.color = "green";
                coordsEl.innerText = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
                
                const newLatLng = [currentLat, currentLng];
                if (currentMarker) {
                    currentMarker.setLatLng(newLatLng);
                } else {
                    currentMarker = L.circleMarker(newLatLng, {
                        radius: 8,
                        fillColor: "#007bff",
                        color: "#ffffff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(map).bindPopup('現在地');
                    map.setView(newLatLng, 15);
                }
            },
            (error) => {
                statusEl.innerText = `エラー: ${error.message}`;
                statusEl.style.color = "red";
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    } else {
        alert("お使いのブラウザは位置情報に対応していません。");
        document.getElementById('location-mode-switch').checked = false;
    }
}

function stopLocationTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    statusEl.innerText = "追跡停止 (OFF)";
    statusEl.style.color = "gray";
    coordsEl.innerText = "--";
    
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
    }
    currentLat = null;
    currentLng = null;
}

function recordLocation(targetId) {
    if (userRole !== 'operator') return;

    if (currentLat !== null && currentLng !== null) {
        const inputField = document.getElementById(`${targetId}-input`);
        const coordsStr = `${currentLat}, ${currentLng}`;
        inputField.value = coordsStr;
        socket.emit('update_coords', { targetId: targetId, coords: coordsStr });
        updateVPins();
    } else {
        statusEl.innerText = "単発でGPSを取得中...";
        statusEl.style.color = "orange";
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const coordsStr = `${lat}, ${lng}`;
                
                const inputField = document.getElementById(`${targetId}-input`);
                inputField.value = coordsStr;
                socket.emit('update_coords', { targetId: targetId, coords: coordsStr });
                updateVPins();
                
                statusEl.innerText = "記録完了";
                statusEl.style.color = "green";
                
                setTimeout(() => {
                    const isEnabled = document.getElementById('location-mode-switch').checked;
                    if (!isEnabled) {
                        statusEl.innerText = "追跡停止 (OFF)";
                        statusEl.style.color = "gray";
                    }
                }, 2000);
            },
            (error) => {
                alert(`現在地の取得に失敗しました: ${error.message}`);
                statusEl.innerText = `エラー: ${error.message}`;
                statusEl.style.color = "red";
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

function copyToClipboard(inputId) {
    const copyText = document.getElementById(inputId).value;
    if (!copyText) return alert("コピーする座標がありません。");
    navigator.clipboard.writeText(copyText).then(() => alert("コピーしました: " + copyText)).catch(err => console.error(err));
}

function saveToCSV() {
    const sortedIds = [...pointIds].sort((a, b) => parseInt(a.substring(1)) - parseInt(b.substring(1)));
    
    const validVals = sortedIds
        .map(id => document.getElementById(`${id}-input`).value)
        .filter(val => val && val.trim() !== '');
    
    let finalCsvContent = "";
    
    if (originalCsvLines && originalCsvLines.length > 0) {
        let newLines = [];
        let waysInserted = false;
        
        for (let i = 0; i < originalCsvLines.length; i++) {
            let line = originalCsvLines[i];
            let firstCol = line.split(',')[0].trim();
            
            if (firstCol === 'way') {
                if (!waysInserted) {
                    const commaCount = (line.match(/,/g) || []).length;
                    const trailingCommas = ",".repeat(Math.max(0, commaCount - 2));
                    
                    validVals.forEach(val => {
                        const coords = val.split(', ');
                        newLines.push(`way,${coords[0]},${coords[1]}${trailingCommas}`);
                    });
                    waysInserted = true;
                }
                continue;
            }
            newLines.push(line);
        }
        finalCsvContent = newLines.join('\n');
    } else {
        finalCsvContent = "Point,Latitude,Longitude\n";
        let count = 1;
        sortedIds.forEach((id) => {
            const val = document.getElementById(`${id}-input`).value;
            if (val && val.trim() !== '') {
                const parts = val.split(', ');
                finalCsvContent += `V${count},${parts[0]},${parts[1]}\n`;
                count++;
            }
        });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datetimeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    let defaultName = originalCsvFileName ? `updated_${originalCsvFileName}` : `${datetimeStr}_V-pos.csv`;
    const fileName = prompt("保存するファイル名を入力してください", defaultName);
    
    if (!fileName) return; 
    const finalFileName = fileName.endsWith('.csv') ? fileName : fileName + '.csv';

    const blob = new Blob([finalCsvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function loadFromCSV(event, mode) {
    const file = event.target.files[0];
    if (!file) return;
    const fileName = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const csvText = e.target.result;
        processCSV(csvText, mode, fileName, true);

        // ★変更箇所：閲覧者・操作者に関わらず、CSVを読み込んだら全体に同期を指示する
        socket.emit('sync_csv', { mode: mode, csvText: csvText, fileName: fileName });
    };
    reader.readAsText(file);
    event.target.value = '';
}

function processCSV(csvText, mode, fileName, isManualLoad = true) {
    if (!csvText) {
        if (mode === 'base') {
            if (loadedMarkersLayer) loadedMarkersLayer.clearLayers();
            originalCsvLines = null;
            originalCsvFileName = null;
            localStorage.removeItem('baseCsvText');
            localStorage.removeItem('baseCsvName');
            document.getElementById('base-csv-name').innerText = '未選択';
        } else if (mode === 'check') {
            if (checkMarkersLayer) checkMarkersLayer.clearLayers();
            localStorage.removeItem('checkCsvText');
            localStorage.removeItem('checkCsvName');
            document.getElementById('check-csv-name').innerText = '未選択';
        }
        return;
    }

    const lines = csvText.split(/\r?\n/);
    let bounds = [];
    
    if (mode === 'base') {
        loadedMarkersLayer.clearLayers();
        originalCsvLines = lines; 
        originalCsvFileName = fileName;
        
        localStorage.setItem('baseCsvText', csvText);
        localStorage.setItem('baseCsvName', fileName);
        document.getElementById('base-csv-name').innerText = fileName;

        let edgePoints = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            
            if (parts[0] === 'edge') {
                const lat = parseFloat(parts[1]);
                const lng = parseFloat(parts[2]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    edgePoints.push([lat, lng]);
                    bounds.push([lat, lng]);
                }
            }
        }
        if (edgePoints.length > 0) {
            L.polyline(edgePoints, {color: '#007bff', weight: 3, opacity: 0.6}).addTo(loadedMarkersLayer);
        }
        
    } else if (mode === 'check') {
        checkMarkersLayer.clearLayers();
        
        localStorage.setItem('checkCsvText', csvText);
        localStorage.setItem('checkCsvName', fileName);
        document.getElementById('check-csv-name').innerText = fileName;

        let wayIndex = 1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            let firstCol = line.split(',')[0].trim();
            
            if (firstCol === 'way') {
                const parts = line.split(',');
                const lat = parseFloat(parts[1]);
                const lng = parseFloat(parts[2]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const marker = L.marker([lat, lng], {icon: yellowIcon}).bindPopup(`<b>確認用: V${wayIndex}</b>`);
                    checkMarkersLayer.addLayer(marker);
                    bounds.push([lat, lng]);
                }
                wayIndex++;
            }
        }
    }

    if (bounds.length > 1) map.fitBounds(bounds);
    else if (bounds.length === 1) map.setView(bounds[0], 15);
}