import { CONFIG } from './Config.js';

export class InputController {
    constructor() {
        this.state = { t: 0, r: 0, p: 0, y: 0, armed: false };
        this.gamepadIndex = null;
        
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
            // 通知 main.js 更新 UI
            window.dispatchEvent(new CustomEvent('gamepad-ready', { detail: { gamepad: e.gamepad } }));
        });
    }

    // 更新映射
    updateConfig(newAxes, newInverts) {
        if(newAxes) CONFIG.axes = newAxes;
        if(newInverts) CONFIG.invert = newInverts;
    }

    update() {
        const gamepads = navigator.getGamepads();
        if (this.gamepadIndex === null || !gamepads[this.gamepadIndex]) return this.state;

        const gp = gamepads[this.gamepadIndex];
        const ax = CONFIG.axes;
        const inv = CONFIG.invert;

        const readAxis = (idx, invert) => {
            if (idx === undefined || idx === null) return 0;
            let val = gp.axes[idx] || 0;
            if (Math.abs(val) < 0.05) val = 0; // 死區
            return invert ? -val : val;
        };

        // 油門處理
        let rawThr = gp.axes[ax.thrust] || 0;
        if (inv.t) rawThr = -rawThr;
        this.state.t = (rawThr + 1) / 2;
        this.state.t = Math.max(0, Math.min(1, this.state.t));

        this.state.r = readAxis(ax.roll, inv.a);
        this.state.p = readAxis(ax.pitch, inv.e);
        this.state.y = readAxis(ax.yaw, inv.r);

        // 解鎖 (大於 0.5 視為開啟)
        const armVal = gp.axes[ax.arm] || -1;
        this.state.armed = armVal > 0.5;

        return this.state;
    }
}
