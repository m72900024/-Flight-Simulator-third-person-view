import { CONFIG } from './Config.js';

export class InputController {
    constructor() {
        this.state = { t: 0, r: 0, p: 0, y: 0, armed: false };
        this.gamepadIndex = null;
        
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
        });
    }

    // 提供給外部呼叫，更新反轉設定
    updateInvertSettings(inverts) {
        CONFIG.invert = inverts;
    }

    update() {
        const gamepads = navigator.getGamepads();
        if (this.gamepadIndex === null || !gamepads[this.gamepadIndex]) return this.state;

        const gp = gamepads[this.gamepadIndex];
        const ax = CONFIG.axes;
        const inv = CONFIG.invert;

        // 讀取並處理死區
        const readAxis = (idx, invert) => {
            let val = gp.axes[idx] || 0;
            if (Math.abs(val) < 0.05) val = 0;
            return invert ? -val : val;
        };

        // 油門處理 (有些搖桿是 -1~1，有些是 0~1，這裡假設標準是 -1~1 需轉為 0~1)
        let rawThr = gp.axes[ax.thrust] || 0;
        // 如果勾選反轉，先把原始值反過來
        if (inv.t) rawThr = -rawThr; 
        
        // 轉換為 0~1
        this.state.t = (rawThr + 1) / 2;
        this.state.t = Math.max(0, Math.min(1, this.state.t));

        this.state.r = readAxis(ax.roll, inv.a); // 注意 UI 的 id 是 a (Aileron) 對應 roll
        this.state.p = readAxis(ax.pitch, inv.e); // e (Elevator) 對應 pitch
        this.state.y = readAxis(ax.yaw, inv.r);   // r (Rudder) 對應 yaw

        // 解鎖開關
        const armVal = gp.axes[ax.arm] || -1;
        this.state.armed = armVal > 0.5;

        return this.state;
    }
}
