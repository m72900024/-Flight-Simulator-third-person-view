import { CONFIG, FLIGHT_MODES } from './Config.js';

export class InputController {
    constructor() {
        this.state = { 
            t: 0, r: 0, p: 0, y: 0, 
            armed: false,
            flightMode: FLIGHT_MODES.ANGLE // 預設自穩 (適合新手)
        };
        this.gamepadIndex = null;
        
        window.addEventListener("gamepadconnected", (e) => {
            this.gamepadIndex = e.gamepad.index;
            window.dispatchEvent(new CustomEvent('gamepad-ready', { detail: { gamepad: e.gamepad } }));
        });
    }

    updateConfig(newAxes, newInverts) {
        if(newAxes) CONFIG.axes = newAxes;
        if(newInverts) CONFIG.invert = newInverts;
    }

    // [新增] 校正中點：當使用者按下「校正」按鈕時呼叫
    calibrateCenter() {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if(!gp) return;
        
        // 記錄當前搖桿位置作為「零點」
        // 注意：油門通常不需要中點校正，只要校正 R/P/Y
        CONFIG.calibration.roll = gp.axes[CONFIG.axes.roll] || 0;
        CONFIG.calibration.pitch = gp.axes[CONFIG.axes.pitch] || 0;
        CONFIG.calibration.yaw = gp.axes[CONFIG.axes.yaw] || 0;
        
        alert("校正完成！請確認搖桿回中後再試。");
    }

    update() {
        const gamepads = navigator.getGamepads();
        if (this.gamepadIndex === null || !gamepads[this.gamepadIndex]) return this.state;

        const gp = gamepads[this.gamepadIndex];
        const ax = CONFIG.axes;
        const inv = CONFIG.invert;
        const cal = CONFIG.calibration; // 讀取校正值

        // 讀取並扣除校正偏移量
        const readAxis = (idx, invert, offset = 0) => {
            if (idx === undefined || idx === null) return 0;
            let val = gp.axes[idx] || 0;
            
            // 扣除偏移
            val = val - offset;

            if (Math.abs(val) < 0.05) val = 0; // 死區
            return invert ? -val : val;
        };

        // 油門
        let rawThr = gp.axes[ax.thrust] || 0;
        if (inv.t) rawThr = -rawThr;
        this.state.t = (rawThr + 1) / 2;
        this.state.t = Math.max(0, Math.min(1, this.state.t));

        // 姿態 (傳入校正值)
        this.state.r = readAxis(ax.roll, inv.a, cal.roll);
        this.state.p = readAxis(ax.pitch, inv.e, cal.pitch);
        this.state.y = readAxis(ax.yaw, inv.r, cal.yaw);

        // 解鎖
        const armVal = gp.axes[ax.arm] || -1;
        this.state.armed = armVal > 0.5;

        // [新增] 模式切換邏輯 (三段開關)
        // -1.0 ~ -0.3 : Angle (自穩)
        // -0.3 ~  0.3 : Horizon (半自穩)
        //  0.3 ~  1.0 : Acro (手動)
        const modeVal = gp.axes[ax.mode] || -1; 
        if (modeVal < -0.3) {
            this.state.flightMode = FLIGHT_MODES.ANGLE;
        } else if (modeVal > 0.3) {
            this.state.flightMode = FLIGHT_MODES.ACRO;
        } else {
            this.state.flightMode = FLIGHT_MODES.HORIZON;
        }

        return this.state;
    }
}
