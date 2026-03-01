import { InputController } from './Input.js';
import { PhysicsEngine } from './Physics.js';
import { GameScene } from './Scene.js';
import { LevelManager } from './LevelManager.js';
import { CONFIG, FLIGHT_MODES } from './Config.js';
import { touchInput } from './TouchInput.js';

const input = new InputController();
let physics, gameScene, levelManager;
const clock = new THREE.Clock();
let appState = 'SETUP';
let isGamepadInit = false;
let selectedLevel = 1;

// --- 選單初始化 ---
function initSelects(gamepad) {
    if (isGamepadInit) return;
    isGamepadInit = true;
    document.getElementById('status-msg').innerText = `已連接: ${gamepad.id}`;
    document.getElementById('status-msg').style.color = '#00ffcc';

    const monitor = document.getElementById('raw-monitor');
    monitor.innerHTML = '';
    for (let i = 0; i < gamepad.axes.length; i++) {
        const div = document.createElement('div');
        div.className = 'raw-item';
        div.innerHTML = `Axis ${i} <div class="raw-bar-bg"><div id="raw-bar-${i}" class="raw-bar-fill"></div></div>`;
        monitor.appendChild(div);
    }

    const ids = ['map-t','map-r','map-e','map-a','map-arm','map-mode'];
    ids.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '';
        for (let i = 0; i < gamepad.axes.length; i++) {
            const opt = document.createElement('option');
            opt.value = i; opt.innerText = `Axis ${i}`;
            sel.appendChild(opt);
        }
    });
    document.getElementById('map-t').value = CONFIG.axes.thrust;
    document.getElementById('map-r').value = CONFIG.axes.yaw;
    document.getElementById('map-e').value = CONFIG.axes.pitch;
    document.getElementById('map-a').value = CONFIG.axes.roll;
    document.getElementById('map-arm').value = CONFIG.axes.arm;
    document.getElementById('map-mode').value = CONFIG.axes.mode;
}

window.addEventListener('gamepad-ready', (e) => initSelects(e.detail.gamepad));

window.updateMapping = function () {
    input.updateConfig({
        thrust: parseInt(document.getElementById('map-t').value),
        yaw: parseInt(document.getElementById('map-r').value),
        pitch: parseInt(document.getElementById('map-e').value),
        roll: parseInt(document.getElementById('map-a').value),
        arm: parseInt(document.getElementById('map-arm').value),
        mode: parseInt(document.getElementById('map-mode').value)
    }, {
        t: document.getElementById('inv-t').checked,
        r: document.getElementById('inv-r').checked,
        e: document.getElementById('inv-e').checked,
        a: document.getElementById('inv-a').checked
    });
};

window.doCalibration = function () { input.calibrateCenter(); };
window.calibrateEndpoint = function (ch, type) {
    if (type === 'min') input.calibrateMin(ch); else input.calibrateMax(ch);
    const btnMap = { thrust:'cal-t', yaw:'cal-y', pitch:'cal-p', roll:'cal-r' };
    if (btnMap[ch]) document.getElementById(`${btnMap[ch]}-${type}`).classList.add('set');
};

// --- 關卡選擇 ---
function showLevelSelect() {
    appState = 'LEVEL_SELECT';
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('level-select').style.display = 'flex';
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const bestTimes = JSON.parse(localStorage.getItem('flightSimBest') || '{}');
    const unlockedLevel = LevelManager.getUnlockedLevel();
    CONFIG.levels.forEach(lv => {
        const best = bestTimes['L' + lv.id];
        const locked = lv.id > unlockedLevel;
        const div = document.createElement('div');
        div.className = 'level-card';
        div.innerHTML = `
            <div class="level-num">${lv.id}</div>
            <div class="level-name">${lv.name}</div>
            <div class="level-desc">${lv.desc}</div>
            <div class="level-best">${locked ? '🔒' : (best ? '✅ ' + best + 's' : '—')}</div>
        `;
        if (locked) {
            div.style.opacity = '0.4';
            div.style.cursor = 'not-allowed';
        } else {
            div.onclick = () => { selectedLevel = lv.id; startGame(); };
        }
        grid.appendChild(div);
    });
}

window.startKeyboard = function () {
    input.useKeyboard = true;
    input.state.armed = true;
    showLevelSelect();
};

window.startTouch = function () {
    input.useTouch = true;
    input.state.armed = true;
    touchInput.hide(); // hide during level select, show when game starts
    showLevelSelect();
};

window.startGameApp = function () { showLevelSelect(); };

window.goBackToSetup = function () {
    document.getElementById('level-select').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'flex';
    touchInput.hide();
    input.useTouch = false;
    appState = 'SETUP';
};

function startGame() {
    document.getElementById('level-select').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    if (input.useTouch) {
        touchInput.show();
        input.state.armed = true; // auto-arm in touch mode
    }

    if (!physics) {
        physics = new PhysicsEngine();
        gameScene = new GameScene();
        levelManager = new LevelManager(gameScene);
    }
    physics.reset();
    levelManager.loadLevel(selectedLevel);
    appState = 'GAME';
    clock.start();
}

// --- Setup UI 更新 ---
function updateSetupUI() {
    const gamepads = navigator.getGamepads();
    let gp = null;
    for (let g of gamepads) { if (g && g.connected) { gp = g; break; } }
    if (gp) {
        if (!isGamepadInit) initSelects(gp);
        gp.axes.forEach((val, i) => {
            const bar = document.getElementById(`raw-bar-${i}`);
            if (bar) {
                bar.style.width = ((val+1)/2)*100 + '%';
                bar.style.backgroundColor = Math.abs(val) > 0.1 ? '#00ff00' : '#ffff00';
            }
        });
    }
    const state = input.update();
    document.getElementById('bar-thr').style.width = state.t*100+'%';
    document.getElementById('txt-thr').innerText = Math.round(state.t*100)+'%';
    document.getElementById('bar-yaw').style.width = ((state.y+1)/2)*100+'%';
    document.getElementById('txt-yaw').innerText = state.y.toFixed(2);
    document.getElementById('bar-pit').style.width = ((state.p+1)/2)*100+'%';
    document.getElementById('txt-pit').innerText = state.p.toFixed(2);
    document.getElementById('bar-rol').style.width = ((state.r+1)/2)*100+'%';
    document.getElementById('txt-rol').innerText = state.r.toFixed(2);

    const armTxt = document.getElementById('txt-arm');
    armTxt.innerText = state.armed ? '已解鎖' : '未解鎖';
    armTxt.style.color = state.armed ? '#00ffcc' : '#ff3333';

    const mStr = {[FLIGHT_MODES.ANGLE]:'自穩',[FLIGHT_MODES.HORIZON]:'半自穩',[FLIGHT_MODES.ACRO]:'手動',[FLIGHT_MODES.ALT_HOLD]:'定高'}[state.flightMode]||'?';
    document.getElementById('mode-display').innerText = mStr;
    document.getElementById('txt-mode').innerText = mStr;
}

// --- ESC 返回 ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (appState === 'GAME') {
            appState = 'SETUP';
            document.getElementById('ui-layer').style.display = 'none';
            document.getElementById('msg-overlay').style.display = 'none';
            if (physics) physics.reset();
            input.keyThrottle = 0;
            touchInput.hide();
            showLevelSelect();
        } else if (appState === 'LEVEL_SELECT') {
            document.getElementById('level-select').style.display = 'none';
            document.getElementById('setup-screen').style.display = 'flex';
            touchInput.hide();
            input.useTouch = false;
            appState = 'SETUP';
        }
    }
});
window.addEventListener('resize', () => {
    if (gameScene) {
        gameScene.camera.aspect = window.innerWidth / window.innerHeight;
        gameScene.camera.updateProjectionMatrix();
        gameScene.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
window.addEventListener('reset-drone', () => { if (physics) physics.reset(); });

// --- 主迴圈 ---
function animate() {
    requestAnimationFrame(animate);
    if (appState === 'SETUP') {
        updateSetupUI();
    } else if (appState === 'GAME') {
        const dt = Math.min(clock.getDelta(), 0.1);
        const inp = input.update();
        physics.update(dt, inp);
        gameScene.updateDrone(physics.pos, physics.quat, inp.t, physics.crashIntensity);
        levelManager.checkWinCondition(physics.pos, dt);

        document.getElementById('stat-thr').innerText = `THR: ${Math.round(inp.t*100)}%`;
        document.getElementById('stat-alt').innerText = `ALT: ${physics.pos.y.toFixed(1)}m`;

        const modeNames = {[FLIGHT_MODES.ANGLE]:'自穩',[FLIGHT_MODES.HORIZON]:'半自穩',[FLIGHT_MODES.ACRO]:'手動',[FLIGHT_MODES.ALT_HOLD]:'定高'};
        document.getElementById('stat-mode').innerText = 'MODE: '+(modeNames[inp.flightMode]||'?');
        document.getElementById('stat-armed').innerText = inp.armed ? 'ARMED' : 'DISARMED';
        document.getElementById('stat-armed').style.color = inp.armed ? '#00ff00' : '#ff3333';
        document.getElementById('stat-input').innerText = input.useTouch ? '📱 觸控' : input.useKeyboard ? '⌨️ 鍵盤' : '🎮 搖桿';

        // 高度警告
        const altEl = document.getElementById('stat-alt');
        if (physics.pos.y > CONFIG.maxHeight*0.8) { altEl.style.color='#ff3333'; altEl.innerText+=' ⚠️'; }
        else if (physics.pos.y > CONFIG.maxHeight*0.5) altEl.style.color='#ffaa00';
        else altEl.style.color='#aaa';

        gameScene.render();
    }
}
animate();
