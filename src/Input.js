import { CONFIG, FLIGHT_MODES } from './Config.js';

export class InputController {
    constructor() {
        this.state = { 
            t: 0, r: 0, p: 0, y: 0, 
            armed: false,
            flightMode: FLIGHT_MODES.ANGLE
        };
        this.gamepadIndex = null;
        this.useKeyboard = false; // 鍵盤模式開關

        // --- 鍵盤狀態 ---
        this.keys = {};
        this.keyThrottle = 0; // 油門需要累加，不是瞬間的

        const onKey = (e) => {
            this.keys[e.code] = true;

            // Space 切換解鎖
            if (e.code === 'Space') {
                this.state.armed = !this.state.armed;
                e.preventDefault();
            }
            // 1/2/3 切換飛行模式
            if (e.code === 'Digit1') this.state.flightMode = FLIGHT_MODES.ANGLE;
            if (e.code === 'Digit2') this.state.flightMode = FLIGHT_MODES.HORIZON;
            if (e.code === 'Digit3') this.state.flightMode = FLIGHT_MODES.ACRO;
            // K 切換鍵盤/搖桿模式
            if (e.code === 'KeyK') {
                this.useKeyboard = !this.useKeyboard;
                const msg = this.useKeyboard ? '⌨️ 鍵盤模式' : '🎮 搖桿模式';
                window.dispatchEvent(new CustomEvent('input-mode-change', { detail: msg }));
            }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        // --- 搖桿連接 ---
        window.addEventListener("gamepadconnected", (e) => {
            this.gamepadIndex = e.gamepad.index;
            window.dispatchEvent(new CustomEvent('gamepad-ready', { detail: { gamepad: e.gamepad } }));
        });
    }

    updateConfig(newAxes, newInverts) {
        if(newAxes) CONFIG.axes = newAxes;
        if(newInverts) CONFIG.invert = newInverts;
    }

    calibrateCenter() {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if(!gp) return;
        CONFIG.calibration.roll = gp.axes[CONFIG.axes.roll] || 0;
        CONFIG.calibration.pitch = gp.axes[CONFIG.axes.pitch] || 0;
        CONFIG.calibration.yaw = gp.axes[CONFIG.axes.yaw] || 0;
        alert("校正完成！請確認搖桿回中後再試。");
    }

    calibrateMin(channel) {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if(!gp) return;
        const axisIdx = CONFIG.axes[channel];
        if(axisIdx === undefined) return;
        CONFIG.endpoints[channel].min = gp.axes[axisIdx] || 0;
    }

    calibrateMax(channel) {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if(!gp) return;
        const axisIdx = CONFIG.axes[channel];
        if(axisIdx === undefined) return;
        CONFIG.endpoints[channel].max = gp.axes[axisIdx] || 0;
    }

    mapToRange(val, min, max) {
        if(max === min) return 0;
        return ((val - min) / (max - min)) * 2 - 1;
    }

    // --- 鍵盤輸入更新 ---
    updateKeyboard() {
        const k = this.keys;

        // W 按住就飛，放開油門快速歸零（模擬真實：鬆油門 = 斷電墜落）
        if (k['KeyW']) {
            this.keyThrottle = Math.min(1, this.keyThrottle + 0.04);
        } else {
            this.keyThrottle *= 0.85; // 指數衰減，快速歸零
            if (this.keyThrottle < 0.01) this.keyThrottle = 0;
        }
        // S 直接油門歸零
        if (k['KeyS']) this.keyThrottle = 0;
        this.state.t = this.keyThrottle;

        // 方向鍵：俯仰/橫滾（按住有值，放開回零）
        let pitch = 0, roll = 0, yaw = 0;
        if (k['ArrowUp'])    pitch = -0.6;
        if (k['ArrowDown'])  pitch =  0.6;
        if (k['ArrowLeft'])  roll  = -0.6;
        if (k['ArrowRight']) roll  =  0.6;

        // A/D 轉向
        if (k['KeyA']) yaw = -0.6;
        if (k['KeyD']) yaw =  0.6;

        // Shift 加速（按住全量）
        if (k['ShiftLeft'] || k['ShiftRight']) {
            pitch *= 1.6;
            roll *= 1.6;
            yaw *= 1.6;
        }

        // 限制範圍
        this.state.p = Math.max(-1, Math.min(1, pitch));
        this.state.r = Math.max(-1, Math.min(1, roll));
        this.state.y = Math.max(-1, Math.min(1, yaw));

        return this.state;
    }

    // --- 搖桿輸入更新 ---
    updateGamepad() {
        const gamepads = navigator.getGamepads();
        if (this.gamepadIndex === null || !gamepads[this.gamepadIndex]) return this.state;

        const gp = gamepads[this.gamepadIndex];
        const ax = CONFIG.axes;
        const inv = CONFIG.invert;
        const cal = CONFIG.calibration;
        const ep = CONFIG.endpoints;

        const readAxis = (idx, invert, offset = 0, channel = null) => {
            if (idx === undefined || idx === null) return 0;
            let val = gp.axes[idx] || 0;
            if (channel && ep[channel]) {
                val = this.mapToRange(val, ep[channel].min, ep[channel].max);
            }
            val = val - offset;
            val = Math.max(-1, Math.min(1, val));
            if (Math.abs(val) < 0.05) val = 0;
            return invert ? -val : val;
        };

        // 油門
        let rawThr = gp.axes[ax.thrust] || 0;
        let mappedThr = this.mapToRange(rawThr, ep.thrust.min, ep.thrust.max);
        if (inv.t) mappedThr = -mappedThr;
        this.state.t = Math.max(0, Math.min(1, (mappedThr + 1) / 2));

        // 姿態
        this.state.r = readAxis(ax.roll, inv.a, cal.roll, 'roll');
        this.state.p = readAxis(ax.pitch, inv.e, cal.pitch, 'pitch');
        this.state.y = readAxis(ax.yaw, inv.r, cal.yaw, 'yaw');

        // 解鎖
        const armVal = gp.axes[ax.arm] || -1;
        this.state.armed = armVal > 0.5;

        // 模式切換（三段開關）
        const modeVal = gp.axes[ax.mode] || -1; 
        if (modeVal < -0.3) this.state.flightMode = FLIGHT_MODES.ANGLE;
        else if (modeVal > 0.3) this.state.flightMode = FLIGHT_MODES.ACRO;
        else this.state.flightMode = FLIGHT_MODES.HORIZON;

        return this.state;
    }

    update() {
        if (this.useKeyboard) {
            return this.updateKeyboard();
        } else {
            return this.updateGamepad();
        }
    }
}
