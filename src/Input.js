import { CONFIG } from './Config.js';

export class InputController {
    constructor() {
        this.state = { t: 0, r: 0, p: 0, y: 0, armed: false };
        this.gamepadIndex = null;
        
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
            // 發送事件通知 UI 搖桿已連接，可以更新下拉選單了
            window.dispatchEvent(new CustomEvent('gamepad-ready', { detail: { gamepad: e.gamepad } }));
        });
    }

    // 讓外部可以更新設定
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

        // 讀取並處理死區
        const readAxis = (idx, invert) => {
            // 安全檢查：如果還沒設定好通道，預設為 0
            if (idx === undefined || idx === null) return 0;
            
            let val = gp.axes[idx] || 0;
            if (Math.abs(val) < 0.05) val = 0;
            return invert ? -val : val;
        };

        // 油門
        let rawThr = gp.axes[ax.thrust] || 0;
        if (inv.t) rawThr = -rawThr;
        this.state.t = (rawThr + 1) / 2;
        this.state.t = Math.max(0, Math.min(1, this.state.t));

        // 姿態 (注意這裡使用的 key 要對應 Config.js)
        this.state.r = readAxis(ax.roll, inv.a); // Aileron
        this.state.p = readAxis(ax.pitch, inv.e); // Elevator
        this.state.y = readAxis(ax.yaw, inv.r);   // Rudder

        // 解鎖
        const armVal = gp.axes[ax.arm] || -1;
        this.state.armed = armVal > 0.5;

        return this.state;
    }
}
