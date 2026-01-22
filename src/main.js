import { InputController } from './Input.js';
import { PhysicsEngine } from './Physics.js';
import { GameScene } from './Scene.js';
import { LevelManager } from './LevelManager.js';
import { CONFIG, FLIGHT_MODES } from './Config.js';

const input = new InputController();
let physics, gameScene, levelManager;
const clock = new THREE.Clock();
let appState = 'SETUP'; // SETUP | GAME
let isGamepadInit = false;

// 1. 初始化選單
function initSelects(gamepad) {
    if(isGamepadInit) return;
    isGamepadInit = true;

    document.getElementById('status-msg').innerText = `已連接: ${gamepad.id} (${gamepad.axes.length} 軸)`;
    document.getElementById('status-msg').style.color = '#00ffcc';

    // 建立監控區
    const monitor = document.getElementById('raw-monitor');
    monitor.innerHTML = '';
    for(let i=0; i<gamepad.axes.length; i++) {
        const div = document.createElement('div');
        div.className = 'raw-item';
        div.innerHTML = `Axis ${i} <div class="raw-bar-bg"><div id="raw-bar-${i}" class="raw-bar-fill"></div></div>`;
        monitor.appendChild(div);
    }

    // 建立下拉選單 (包含 Mode)
    const ids = ['map-t', 'map-r', 'map-e', 'map-a', 'map-arm', 'map-mode'];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = ''; 
        for(let i=0; i<gamepad.axes.length; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Axis ${i}`;
            sel.appendChild(opt);
        }
    });

    // 讀取預設值
    document.getElementById('map-t').value = CONFIG.axes.thrust;
    document.getElementById('map-r').value = CONFIG.axes.yaw;
    document.getElementById('map-e').value = CONFIG.axes.pitch;
    document.getElementById('map-a').value = CONFIG.axes.roll;
    document.getElementById('map-arm').value = CONFIG.axes.arm;
    document.getElementById('map-mode').value = CONFIG.axes.mode;
}

// 2. 監聽搖桿連接
window.addEventListener('gamepad-ready', (e) => {
    initSelects(e.detail.gamepad);
});

// 3. UI 互動函數
window.updateMapping = function() {
    const newAxes = {
        thrust: parseInt(document.getElementById('map-t').value),
        yaw: parseInt(document.getElementById('map-r').value),
        pitch: parseInt(document.getElementById('map-e').value),
        roll: parseInt(document.getElementById('map-a').value),
        arm: parseInt(document.getElementById('map-arm').value),
        mode: parseInt(document.getElementById('map-mode').value)
    };
    const newInverts = {
        t: document.getElementById('inv-t').checked,
        r: document.getElementById('inv-r').checked,
        e: document.getElementById('inv-e').checked,
        a: document.getElementById('inv-a').checked
    };
    input.updateConfig(newAxes, newInverts);
};

window.doCalibration = function() {
    input.calibrateCenter();
};

// 端點校正
window.calibrateEndpoint = function(channel, type) {
    if(type === 'min') {
        input.calibrateMin(channel);
    } else {
        input.calibrateMax(channel);
    }
    // 更新按鈕樣式表示已校正
    const btnId = {
        thrust: 'cal-t',
        yaw: 'cal-y',
        pitch: 'cal-p',
        roll: 'cal-r'
    }[channel];
    if(btnId) {
        document.getElementById(`${btnId}-${type}`).classList.add('set');
    }
};

window.startGameApp = function() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    physics = new PhysicsEngine();
    gameScene = new GameScene();
    levelManager = new LevelManager(gameScene);
    
    physics.reset();
    levelManager.loadLevel(1);
    
    appState = 'GAME';
    clock.start();
};

// 4. 更新設定介面
function updateSetupUI() {
    // 原始訊號
    const gamepads = navigator.getGamepads();
    let gp = null;
    for(let g of gamepads) { if(g && g.connected) { gp = g; break; } }

    if(gp) {
        if(!isGamepadInit) initSelects(gp);
        gp.axes.forEach((val, i) => {
            const bar = document.getElementById(`raw-bar-${i}`);
            if(bar) {
                const pct = ((val + 1) / 2) * 100;
                bar.style.width = pct + '%';
                bar.style.backgroundColor = Math.abs(val)>0.1 ? '#00ff00' : '#ffff00';
            }
        });
    }

    // 校正後數值
    const state = input.update();
    const setBar = (id, pct) => document.getElementById(id).style.width = pct + '%';
    const setTxt = (id, txt) => document.getElementById(id).innerText = txt;

    setBar('bar-thr', state.t * 100); setTxt('txt-thr', Math.round(state.t * 100) + '%');
    setBar('bar-yaw', ((state.y + 1) / 2) * 100); setTxt('txt-yaw', state.y.toFixed(2));
    setBar('bar-pit', ((state.p + 1) / 2) * 100); setTxt('txt-pit', state.p.toFixed(2));
    setBar('bar-rol', ((state.r + 1) / 2) * 100); setTxt('txt-rol', state.r.toFixed(2));

    const armTxt = document.getElementById('txt-arm');
    if(state.armed) {
        armTxt.innerText = "已解鎖 (ARMED)"; armTxt.style.color = "#00ffcc";
    } else {
        armTxt.innerText = "未解鎖 (DISARMED)"; armTxt.style.color = "#ff3333";
    }

    // 顯示當前模式
    const modeTxt = document.getElementById('mode-display');
    const modeChTxt = document.getElementById('txt-mode');
    let mStr = "UNKNOWN";
    if (state.flightMode === FLIGHT_MODES.ANGLE) mStr = "ANGLE (自穩)";
    else if (state.flightMode === FLIGHT_MODES.HORIZON) mStr = "HORIZON (半自穩)";
    else if (state.flightMode === FLIGHT_MODES.ACRO) mStr = "ACRO (手動)";
    modeTxt.innerText = mStr;
    modeChTxt.innerText = mStr;
}

// 5. 主迴圈
window.addEventListener('resize', () => {
    if(gameScene) {
        gameScene.camera.aspect = window.innerWidth / window.innerHeight;
        gameScene.camera.updateProjectionMatrix();
        gameScene.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
window.addEventListener('reset-drone', () => { if(physics) physics.reset(); });

function animate() {
    requestAnimationFrame(animate);

    if (appState === 'SETUP') {
        updateSetupUI();
    } 
    else if (appState === 'GAME') {
        const dt = Math.min(clock.getDelta(), 0.1);
        const inputState = input.update();
        
        physics.update(dt, inputState);
        gameScene.updateDrone(physics.pos, physics.quat, inputState.t);
        levelManager.checkWinCondition(physics.pos, dt);

        document.getElementById('stat-thr').innerText = `THR: ${Math.round(inputState.t * 100)}%`;
        document.getElementById('stat-time').innerText = clock.getElapsedTime().toFixed(1) + 's';
        gameScene.render();
    }
}
animate();
