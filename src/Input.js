import { CONFIG } from './Config.js';

export class InputController {
    constructor() {
        this.state = {
            t: 0, // 油門 0~1
            r: 0, // 滾轉 -1~1
            p: 0, // 俯仰 -1~1
            y: 0, // 偏航 -1~1
            armed: false
        };
        this.gamepadIndex = null;
        
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
        });
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
            if (Math.abs(val) < 0.05) val = 0; // 死區
            return invert ? -val : val;
        };

        // 處理油門 (將 -1~1 轉換為 0~1)
        let rawThr = gp.axes[ax.thrust] || 0;
        if (inv.thrust) rawThr = -rawThr;
        this.state.t = (rawThr + 1) / 2;
        this.state.t = Math.max(0, Math.min(1, this.state.t));

        this.state.r = readAxis(ax.roll, inv.roll);
        this.state.p = readAxis(ax.pitch, inv.pitch);
        this.state.y = readAxis(ax.yaw, inv.yaw);

        // 解鎖開關 (假設大於 0.5 為開)
        const armVal = gp.axes[ax.arm] || -1;
        this.state.armed = armVal > 0.5;

        return this.state;
    }
}
