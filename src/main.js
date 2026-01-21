import { InputController } from './Input.js';
import { PhysicsEngine } from './Physics.js';
import { GameScene } from './Scene.js';
import { LevelManager } from './LevelManager.js';

// 初始化模組
const input = new InputController();
const physics = new PhysicsEngine();
const gameScene = new GameScene(); // 這裡不用傳 ID，預設會 append 到 body
const levelManager = new LevelManager(gameScene);

const clock = new THREE.Clock();
let isRunning = false;

// 綁定全域事件 (給按鈕使用)
window.startGameApp = function() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    physics.reset();
    levelManager.loadLevel(1);
    isRunning = true;
    animate();
};

// 監聽重置事件 (來自 LevelManager)
window.addEventListener('reset-drone', () => {
    physics.reset();
});

// 視窗縮放處理
window.addEventListener('resize', () => {
    gameScene.camera.aspect = window.innerWidth / window.innerHeight;
    gameScene.camera.updateProjectionMatrix();
    gameScene.renderer.setSize(window.innerWidth, window.innerHeight);
});

// 主迴圈
function animate() {
    if (!isRunning) return;
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);

    // 1. 獲取輸入
    const inputState = input.update();

    // 2. 物理更新
    physics.update(dt, inputState);

    // 3. 畫面同步
    gameScene.updateDrone(physics.pos, physics.quat, inputState.t);

    // 4. 關卡判定
    levelManager.checkWinCondition(physics.pos, dt);

    // 5. 更新 HUD (油門與時間)
    document.getElementById('stat-thr').innerText = `THR: ${Math.round(inputState.t * 100)}%`;
    document.getElementById('stat-time').innerText = clock.getElapsedTime().toFixed(1) + 's';

    // 6. 渲染畫面
    gameScene.render();
}
