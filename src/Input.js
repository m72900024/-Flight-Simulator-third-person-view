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

    // 校正端點 (最小值)
    calibrateMin(channel) {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if(!gp) return;

        const axisIdx = CONFIG.axes[channel];
        if(axisIdx === undefined) return;

        const val = gp.axes[axisIdx] || 0;
        CONFIG.endpoints[channel].min = val;
    }

    // 校正端點 (最大值)
    calibrateMax(channel) {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if(!gp) return;

        const axisIdx = CONFIG.axes[channel];
        if(axisIdx === undefined) return;

        const val = gp.axes[axisIdx] || 0;
        CONFIG.endpoints[channel].max = val;
    }

    // 將原始值映射到校正後的範圍
    mapToRange(val, min, max) {
        // 避免除以零
        if(max === min) return 0;
        // 映射到 [-1, 1]
        return ((val - min) / (max - min)) * 2 - 1;
    }

    update() {
        const gamepads = navigator.getGamepads();
        if (this.gamepadIndex === null || !gamepads[this.gamepadIndex]) return this.state;

        const gp = gamepads[this.gamepadIndex];
        const ax = CONFIG.axes;
        const inv = CONFIG.invert;
        const cal = CONFIG.calibration; // 讀取校正值

        // 讀取並扣除校正偏移量 (加入端點校正)
        const readAxis = (idx, invert, offset = 0, channel = null) => {
            if (idx === undefined || idx === null) return 0;
            let val = gp.axes[idx] || 0;

            // 端點校正：映射到 [-1, 1]
            if (channel && ep[channel]) {
                val = this.mapToRange(val, ep[channel].min, ep[channel].max);
            }

            // 扣除中點偏移
            val = val - offset;

            // 限制範圍
            val = Math.max(-1, Math.min(1, val));

            if (Math.abs(val) < 0.05) val = 0; // 死區
            return invert ? -val : val;
        };

        // 油門 (使用端點校正)
        const ep = CONFIG.endpoints;
        let rawThr = gp.axes[ax.thrust] || 0;
        // 先映射到校正後的 [-1, 1] 範圍
        let mappedThr = this.mapToRange(rawThr, ep.thrust.min, ep.thrust.max);
        if (inv.t) mappedThr = -mappedThr;
        this.state.t = (mappedThr + 1) / 2;
        this.state.t = Math.max(0, Math.min(1, this.state.t));

        // 姿態 (傳入校正值與通道名稱)
        this.state.r = readAxis(ax.roll, inv.a, cal.roll, 'roll');
        this.state.p = readAxis(ax.pitch, inv.e, cal.pitch, 'pitch');
        this.state.y = readAxis(ax.yaw, inv.r, cal.yaw, 'yaw');

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
