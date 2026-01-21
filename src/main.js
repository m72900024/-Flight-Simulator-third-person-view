import { InputController } from './Input.js';
import { PhysicsEngine } from './Physics.js';
import { GameScene } from './Scene.js';
import { LevelManager } from './LevelManager.js';
import { CONFIG } from './Config.js';

const input = new InputController();
let physics, gameScene, levelManager;
const clock = new THREE.Clock();
let appState = 'SETUP'; 
let isGamepadInit = false; // 避免重複初始化選單

// --- 下拉選單初始化 ---
function initSelects(gamepad) {
    if(isGamepadInit) return;
    isGamepadInit = true;

    document.getElementById('status-msg').innerText = `已連接: ${gamepad.id} (${gamepad.axes.length} 軸)`;
    document.getElementById('status-msg').style.color = '#00ffcc';

    const ids = ['map-t', 'map-r', 'map-e', 'map-a', 'map-arm'];
    const axisCount = gamepad.axes.length;

    ids.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = ''; // 清空
        for(let i=0; i<axisCount; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Axis ${i}`;
            sel.appendChild(opt);
        }
    });

    // 設定預設值 (從 Config.js 讀取)
    document.getElementById('map-t').value = CONFIG.axes.thrust;
    document.getElementById('map-r').value = CONFIG.axes.yaw;
    document.getElementById('map-e').value = CONFIG.axes.pitch;
    document.getElementById('map-a').value = CONFIG.axes.roll;
    document.getElementById('map-arm').value = CONFIG.axes.arm;
}

// 監聽來自 Input.js 的事件
window.addEventListener('gamepad-ready', (e) => {
    initSelects(e.detail.gamepad);
});

// --- UI 更新邏輯 ---
// 綁定給 HTML 的 onchange 函數
window.updateMapping = function() {
    // 讀取所有選單的值
    const newAxes = {
        thrust: parseInt(document.getElementById('map-t').value),
        yaw: parseInt(document.getElementById('map-r').value),
        pitch: parseInt(document.getElementById('map-e').value),
        roll: parseInt(document.getElementById('map-a').value),
        arm: parseInt(document.getElementById('map-arm').value)
    };

    const newInverts = {
        t: document.getElementById('inv-t').checked,
        r: document.getElementById('inv-r').checked,
        e: document.getElementById('inv-e').checked,
        a: document.getElementById('inv-a').checked
    };

    // 更新 InputController
    input.updateConfig(newAxes, newInverts);
};

function updateSetupUI() {
    const state = input.update();
    
    const setBar = (id, pct) => document.getElementById(id).style.width = pct + '%';
    const setTxt = (id, txt) => document.getElementById(id).innerText = txt;

    setBar('bar-thr', state.t * 100);
    setTxt('txt-thr', Math.round(state.t * 100) + '%');

    setBar('bar-yaw', ((state.y + 1) / 2) * 100); setTxt('txt-yaw', state.y.toFixed(2));
    setBar('bar-pit', ((state.p + 1) / 2) * 100); setTxt('txt-pit', state.p.toFixed(2));
    setBar('bar-rol', ((state.r + 1) / 2) * 100); setTxt('txt-rol', state.r.toFixed(2));

    const armTxt = document.getElementById('txt-arm');
    if(state.armed) {
        armTxt.innerText = "已解鎖 (ARMED)"; armTxt.style.color = "#00ffcc";
    } else {
        armTxt.innerText = "未解鎖 (DISARMED)"; armTxt.style.color = "#ff3333";
    }

    // 補救措施：如果進入頁面時搖桿已經插著，input.js 的事件可能已經錯過
    // 所以我們在 setup loop 裡檢查一次
    if(!isGamepadInit) {
        const gps = navigator.getGamepads();
        for(let g of gps) {
            if(g && g.connected) initSelects(g);
        }
    }
}

// --- 遊戲啟動 ---
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

window.addEventListener('resize', () => {
    if(gameScene) {
        gameScene.camera.aspect = window.innerWidth / window.innerHeight;
        gameScene.camera.updateProjectionMatrix();
        gameScene.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// 監聽重置事件 (來自 LevelManager 過關後)
window.addEventListener('reset-drone', () => {
    if(physics) physics.reset();
});

// --- 主迴圈 ---
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
