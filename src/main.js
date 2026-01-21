import { InputController } from './Input.js';
import { PhysicsEngine } from './Physics.js';
import { GameScene } from './Scene.js';
import { LevelManager } from './LevelManager.js';
import { CONFIG } from './Config.js';

const input = new InputController();
let physics, gameScene, levelManager;
const clock = new THREE.Clock();
let appState = 'SETUP'; // SETUP | GAME
let isGamepadInit = false;

// --- 初始化選單與監控 ---
function initSelects(gamepad) {
    if(isGamepadInit) return;
    isGamepadInit = true;

    document.getElementById('status-msg').innerText = `已連接: ${gamepad.id} (${gamepad.axes.length} 軸)`;
    document.getElementById('status-msg').style.color = '#00ffcc';

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

    // 讀取預設值
    document.getElementById('map-t').value = CONFIG.axes.thrust;
    document.getElementById('map-r').value = CONFIG.axes.yaw;
    document.getElementById('map-e').value = CONFIG.axes.pitch;
    document.getElementById('map-a').value = CONFIG.axes.roll;
    document.getElementById('map-arm').value = CONFIG.axes.arm;

    // 初始化原始監控
    const monitor = document.getElementById('raw-monitor');
    monitor.innerHTML = '';
    for(let i=0; i<axisCount; i++) {
        const div = document.createElement('div');
        div.className = 'raw-item';
        div.innerHTML = `Axis ${i} <div class="raw-bar-bg"><div id="raw-bar-${i}" class="raw-bar-fill"></div></div>`;
        monitor.appendChild(div);
    }
}

window.addEventListener('gamepad-ready', (e) => {
    initSelects(e.detail.gamepad);
});

// --- UI 更新與 Mapping ---
window.updateMapping = function() {
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

    input.updateConfig(newAxes, newInverts);
};

function updateSetupUI() {
    // 1. 更新原始訊號監控
    const gamepads = navigator.getGamepads();
    let gp = null;
    for(let g of gamepads) { if(g && g.connected) { gp = g; break; } }

    if(gp) {
        gp.axes.forEach((val, i) => {
            const bar = document.getElementById(`raw-bar-${i}`);
            if(bar) {
                const pct = ((val + 1) / 2) * 100;
                bar.style.width = pct + '%';
                if(Math.abs(val) > 0.1) bar.style.backgroundColor = '#00ff00';
                else bar.style.backgroundColor = '#ffff00';
            }
        });
        if(!isGamepadInit) initSelects(gp);
    }

    // 2. 更新校正後 UI
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
}

// --- 遊戲控制 ---
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

window.addEventListener('reset-drone', () => {
    if(physics) physics.reset();
});

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
