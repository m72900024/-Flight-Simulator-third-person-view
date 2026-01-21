export class LevelManager {
    constructor(scene) {
        this.scene = scene; // GameScene 實例
        this.currentLevel = 1;
        this.isComplete = false;
        
        // Level 1 變數
        this.hoverTimer = 0;
        this.targetTime = 3.0;
        this.hoverBox = null;

        // Level 2 變數
        this.gate = null;
    }

    loadLevel(levelIndex) {
        this.currentLevel = levelIndex;
        this.isComplete = false;
        this.hoverTimer = 0;
        
        // 清除舊物件
        const grp = this.scene.levelGroup;
        while(grp.children.length > 0) grp.remove(grp.children[0]);

        // 更新 UI 文字
        document.getElementById('level-title').innerText = `LEVEL ${levelIndex}`;

        if (levelIndex === 1) {
            this.setupLevel1(grp);
        } else if (levelIndex === 2) {
            this.setupLevel2(grp);
        }
    }

    setupLevel1(group) {
        document.getElementById('instruction').innerText = "目標：保持在綠色方框內 3 秒";
        
        // 建立半透明綠色方框
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.3 });
        this.hoverBox = new THREE.Mesh(geo, mat);
        this.hoverBox.position.set(0, 3, 0); // 懸停高度 3米
        group.add(this.hoverBox);
    }

    setupLevel2(group) {
        document.getElementById('instruction').innerText = "目標：穿越前方拱門";
        
        // 建立拱門
        const geo = new THREE.TorusGeometry(1.5, 0.2, 8, 30);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff4400, emissiveIntensity: 0.5 });
        this.gate = new THREE.Mesh(geo, mat);
        this.gate.position.set(0, 3, -15); // 前方 15米
        this.gate.lookAt(0, 3, 0); // 面對起點
        group.add(this.gate);
    }

    checkWinCondition(dronePos, dt) {
        if (this.isComplete) return true;
        const progressFill = document.getElementById('progress-fill');

        if (this.currentLevel === 1) {
            // Level 1: 判定是否在盒子內 (簡單 AABB 距離判定)
            const dx = Math.abs(dronePos.x - this.hoverBox.position.x);
            const dy = Math.abs(dronePos.y - this.hoverBox.position.y);
            const dz = Math.abs(dronePos.z - this.hoverBox.position.z);
            const halfSize = 1.0; // 盒子大小的一半

            if (dx < halfSize && dy < halfSize && dz < halfSize) {
                this.hoverTimer += dt;
                // 變更盒子顏色提示
                this.hoverBox.material.color.setHex(0xffff00); 
            } else {
                this.hoverTimer = Math.max(0, this.hoverTimer - dt * 2); // 離開會快速扣分
                this.hoverBox.material.color.setHex(0x00ff00);
            }

            // 更新 UI 進度條
            const pct = Math.min(100, (this.hoverTimer / this.targetTime) * 100);
            progressFill.style.width = pct + '%';

            if (this.hoverTimer >= this.targetTime) {
                this.completeLevel();
            }

        } else if (this.currentLevel === 2) {
            // Level 2: 簡單距離判定 (接近門中心 < 1.5米)
            const dist = dronePos.distanceTo(this.gate.position);
            
            // 顯示距離提示
            const pct = Math.max(0, 100 - (dist * 2));
            progressFill.style.width = pct + '%';

            if (dist < 1.5) {
                this.completeLevel();
            }
        }

        return this.isComplete;
    }

    completeLevel() {
        this.isComplete = true;
        document.getElementById('msg-overlay').style.display = 'block';
        
        // 下一關按鈕邏輯
        const btn = document.getElementById('btn-next');
        btn.onclick = () => {
            document.getElementById('msg-overlay').style.display = 'none';
            if(this.currentLevel === 1) {
                this.loadLevel(2);
                // 重置飛機位置 (通常需要呼叫 Physics 的 reset，這裡暫時簡化)
                // 理想狀況是透過事件通知 Main 重置物理
                window.dispatchEvent(new Event('reset-drone'));
            } else {
                alert("全數通關！回到第一關");
                this.loadLevel(1);
                window.dispatchEvent(new Event('reset-drone'));
            }
        };
    }
}
