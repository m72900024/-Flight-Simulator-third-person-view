import { InputController } from './Input.js';
import { PhysicsEngine } from './Physics.js';
import { GameScene } from './Scene.js';
import { LevelManager } from './LevelManager.js';

const input = new InputController();
// 注意：物理和場景等到 startGame 才初始化，避免一開始就跑
let physics, gameScene, levelManager;
const clock = new THREE.Clock();
let appState = 'SETUP'; // 狀態機: SETUP | GAME

// --- 設定介面邏輯 (UI 更新) ---
function updateSetupUI() {
    const state = input.update();
    
    // 更新 HTML 進度條 (寬度 0% ~ 100%)
    const setBar = (id, pct) => document.getElementById(id).style.width = pct + '%';
    const setTxt = (id, txt) => document.getElementById(id).innerText = txt;

    // 油門 (0~1) -> 0%~100%
    setBar('bar-thr', state.t * 100);
    setTxt('txt-thr', Math.round(state.t * 100) + '%');

    // 其他軸 (-1~1) -> 0%~100% (中心點是 50%)
    setBar('bar-yaw', ((state.y + 1) / 2) * 100); setTxt('txt-yaw', state.y.toFixed(2));
    setBar('bar-pit', ((state.p + 1) / 2) * 100); setTxt('txt-pit', state.p.toFixed(2));
    setBar('bar-rol', ((state.r + 1) / 2) * 100); setTxt('txt-rol', state.r.toFixed(2));
}

// 綁定給 HTML Checkbox 用的函數
window.updateInvert = function() {
    const inverts = {
        t: document.getElementById('inv-t').checked,
        r: document.getElementById('inv-r').checked, // Yaw
        e: document.getElementById('inv-e').checked, // Pitch
        a: document.getElementById('inv-a').checked  // Roll
    };
    input.updateInvertSettings(inverts);
};

// --- 遊戲啟動邏輯 ---
window.startGameApp = function() {
    // 1. 切換介面
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    // 2. 初始化遊戲核心模組
    physics = new PhysicsEngine();
    gameScene = new GameScene();
    levelManager = new LevelManager(gameScene);
    
    // 3. 載入第一關
    physics.reset();
    levelManager.loadLevel(1);
    
    // 4. 切換狀態
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

// --- 主迴圈 (State Machine) ---
function animate() {
    requestAnimationFrame(animate);

    if (appState === 'SETUP') {
        // 設定模式：只更新 UI 條
        updateSetupUI();
    } 
    else if (appState === 'GAME') {
        // 遊戲模式：跑物理與 3D
        const dt = Math.min(clock.getDelta(), 0.1);
        const inputState = input.update();
        
        physics.update(dt, inputState);
        gameScene.updateDrone(physics.pos, physics.quat, inputState.t);
        levelManager.checkWinCondition(physics.pos, dt);

        // 更新遊戲內 HUD
        document.getElementById('stat-thr').innerText = `THR: ${Math.round(inputState.t * 100)}%`;
        document.getElementById('stat-time').innerText = clock.getElapsedTime().toFixed(1) + 's';

        gameScene.render();
    }
}

// 啟動迴圈
animate();
