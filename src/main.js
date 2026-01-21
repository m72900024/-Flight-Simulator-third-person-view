// --- 修改 initSelects 函數 ---
function initSelects(gamepad) {
    if(isGamepadInit) return;
    isGamepadInit = true;

    document.getElementById('status-msg').innerText = `已連接: ${gamepad.id}`;
    document.getElementById('status-msg').style.color = '#00ffcc';

    // 1. 初始化下拉選單 (保持原本邏輯)
    const ids = ['map-t', 'map-r', 'map-e', 'map-a', 'map-arm'];
    const axisCount = gamepad.axes.length;

    ids.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = ''; 
        for(let i=0; i<axisCount; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Axis ${i}`;
            sel.appendChild(opt);
        }
    });

    // 設定預設值
    document.getElementById('map-t').value = CONFIG.axes.thrust;
    document.getElementById('map-r').value = CONFIG.axes.yaw;
    document.getElementById('map-e').value = CONFIG.axes.pitch;
    document.getElementById('map-a').value = CONFIG.axes.roll;
    document.getElementById('map-arm').value = CONFIG.axes.arm;

    // 2. [新增] 初始化原始訊號監控區
    const monitor = document.getElementById('raw-monitor');
    monitor.innerHTML = ''; // 清空
    for(let i=0; i<axisCount; i++) {
        // 建立 Axis 0, Axis 1... 的小格子
        const div = document.createElement('div');
        div.className = 'raw-item';
        div.innerHTML = `
            <div style="color:#aaa">Axis ${i} <span id="raw-val-${i}" style="float:right; color:#fff">0.0</span></div>
            <div class="raw-bar-bg"><div id="raw-bar-${i}" class="raw-bar-fill"></div></div>
        `;
        monitor.appendChild(div);
    }
}
