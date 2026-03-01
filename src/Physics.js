import { CONFIG, FLIGHT_MODES } from './Config.js';

export class PhysicsEngine {
    constructor() {
        this.pos = new THREE.Vector3(0, 0.2, 0);
        this.vel = new THREE.Vector3(0, 0, 0);
        this.quat = new THREE.Quaternion();
        this.rotVel = new THREE.Vector3(0, 0, 0); // 角速度
        this.crashIntensity = 0;
        this.altHoldTarget = null;
    }

    reset() {
        this.pos.set(0, 0.2, 0);
        this.vel.set(0, 0, 0);
        this.rotVel.set(0, 0, 0);
        this.quat.identity();
        this.crashIntensity = 0;
        this.altHoldTarget = null;
    }

    update(dt, input) {
        // --- 1. 推力與重力 ---
        // 油門指數曲線：低油門更細膩，高油門更猛
        const expo = CONFIG.thrustExpo || 0;
        const tLin = input.t;
        const tExp = Math.pow(input.t, 3);
        const tCurve = tLin * (1 - expo) + tExp * expo;

        let thrustMag = input.armed ? (tCurve * CONFIG.thrustPower) : 0;

        // ALT_HOLD: override thrust to maintain altitude when throttle is centered
        if (input.flightMode === FLIGHT_MODES.ALT_HOLD && input.armed) {
            const hoverThrust = CONFIG.mass * CONFIG.gravity;
            if (input.t >= 0.4 && input.t <= 0.6) {
                // Deadzone: PID-like altitude hold
                if (this.altHoldTarget === null) {
                    this.altHoldTarget = this.pos.y;
                }
                const kP = 8;
                const kD = 5 * CONFIG.mass;
                thrustMag = hoverThrust + kP * (this.altHoldTarget - this.pos.y) - kD * this.vel.y;
            } else if (input.t > 0.6) {
                this.altHoldTarget = null;
                // Climb: hover thrust + extra proportional to stick above deadzone
                const climbInput = (input.t - 0.6) / 0.4; // 0..1
                thrustMag = hoverThrust + climbInput * CONFIG.thrustPower * 0.5;
            } else {
                this.altHoldTarget = null;
                // Descend: hover thrust - reduction proportional to stick below deadzone
                const descendInput = (0.4 - input.t) / 0.4; // 0..1
                thrustMag = hoverThrust * (1 - descendInput * 0.8);
            }
        }

        const thrustDir = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
        const force = thrustDir.multiplyScalar(thrustMag);

        // 重力
        force.y -= CONFIG.mass * CONFIG.gravity;
        
        // 空氣阻力 (二次方阻力，速度越快阻力越大)
        const speed = this.vel.length();
        if (speed > 0.01) {
            const drag = this.vel.clone().normalize().multiplyScalar(-CONFIG.dragCoeff * speed * speed);
            force.add(drag);
        }
        
        const accel = force.divideScalar(CONFIG.mass);
        this.vel.add(accel.multiplyScalar(dt));
        this.pos.add(this.vel.clone().multiplyScalar(dt));

        // Decay crash intensity (frame-rate independent)
        this.crashIntensity *= Math.pow(0.92, dt * 60);

        // 地板碰撞 (更真實的彈跳)
        if (this.pos.y < CONFIG.hardDeck) {
            this.pos.y = CONFIG.hardDeck;
            if (this.vel.y < -2) {
                // 高速撞地 → 彈跳 + 大幅減速（模擬炸機）
                const impactSpeed = Math.abs(this.vel.y);
                this.crashIntensity = Math.min(1.0, impactSpeed * 0.15);
                this.vel.y *= -0.3;
                this.vel.x *= 0.3; this.vel.z *= 0.3;
                // 撞擊造成隨機旋轉
                this.rotVel.x += (Math.random() - 0.5) * 5;
                this.rotVel.z += (Math.random() - 0.5) * 5;
            } else {
                this.vel.y = 0;
                this.vel.x *= 0.7; this.vel.z *= 0.7;
            }
        }

        // --- 2. 姿態控制 ---
        // Betaflight 風格的 rates：末端加速
        const baseRate = THREE.MathUtils.degToRad(600 * CONFIG.rates);
        const superRate = CONFIG.superRate || 0;
        const calcRate = (stick) => {
            const absStick = Math.abs(stick);
            // 基礎 rate + SuperRate 在末端疊加
            return baseRate * absStick + baseRate * superRate * absStick * absStick * absStick;
        };
        const maxRate = baseRate; // 用於自穩模式
        
        if (input.flightMode === FLIGHT_MODES.ACRO) {
            // [手動模式] Betaflight 風格角速度控制
            const targetRotVel = new THREE.Vector3(
                Math.sign(input.p) * calcRate(input.p),
                Math.sign(input.y) * calcRate(input.y),
                -Math.sign(input.r) * calcRate(input.r)
            );
            // 角速度阻尼：鬆桿後自然停轉
            const angDrag = CONFIG.angularDrag || 5;
            this.rotVel.lerp(targetRotVel, angDrag * dt);

        } else if (input.flightMode === FLIGHT_MODES.ANGLE) {
            // [自穩模式] Spring-damper attitude control
            const maxTilt = THREE.MathUtils.degToRad(CONFIG.maxTiltAngle);
            const targetPitch = input.p * maxTilt;
            const targetRoll = -input.r * maxTilt;

            const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');

            // Spring-damper: angVel = kP * error - kD * currentAngVel
            const kP = 12.0, kD = 0.6;
            const pitchError = targetPitch - euler.x;
            const rollError  = targetRoll  - euler.z;
            this.rotVel.x = kP * pitchError - kD * this.rotVel.x;
            this.rotVel.z = kP * rollError  - kD * this.rotVel.z;

            // Yaw: rate control
            this.rotVel.y = input.y * maxRate * 0.7;

            // Apply rotation via rotVel (same as ACRO)
            const theta = this.rotVel.length() * dt;
            if (theta > 0.0001) {
                const axis = this.rotVel.clone().normalize();
                const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
                this.quat.multiply(qStep);
            }

        } else if (input.flightMode === FLIGHT_MODES.ALT_HOLD) {
            // [定高模式] Spring-damper attitude (same as ANGLE)
            const maxTilt = THREE.MathUtils.degToRad(CONFIG.maxTiltAngle);
            const targetPitch = input.p * maxTilt;
            const targetRoll = -input.r * maxTilt;

            const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');

            const kP = 12.0, kD = 0.6;
            const pitchError = targetPitch - euler.x;
            const rollError  = targetRoll  - euler.z;
            this.rotVel.x = kP * pitchError - kD * this.rotVel.x;
            this.rotVel.z = kP * rollError  - kD * this.rotVel.z;

            this.rotVel.y = input.y * maxRate * 0.7;

            const theta = this.rotVel.length() * dt;
            if (theta > 0.0001) {
                const axis = this.rotVel.clone().normalize();
                const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
                this.quat.multiply(qStep);
            }

        } else if (input.flightMode === FLIGHT_MODES.HORIZON) {
            // [半自穩模式] Betaflight-style HORIZON blend
            const maxTilt = THREE.MathUtils.degToRad(CONFIG.maxTiltAngle);

            // 1. Acro target rates (with SuperRate)
            const acroTarget = new THREE.Vector3(
                Math.sign(input.p) * calcRate(input.p),
                Math.sign(input.y) * calcRate(input.y),
                -Math.sign(input.r) * calcRate(input.r)
            );

            // 2. Angle correction targets stick-commanded angle (not zero!)
            const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
            const targetPitch = input.p * maxTilt;
            const targetRoll  = -input.r * maxTilt;
            const angleCorrectP = (targetPitch - euler.x) * 8.0;
            const angleCorrectR = (targetRoll  - euler.z) * 8.0;

            // 3. Per-axis Betaflight-style threshold + ramp
            const horizonTransition = 0.75;
            const calcLevelStrength = (deflection) => {
                if (deflection <= horizonTransition) return 1.0;
                return 1.0 - (deflection - horizonTransition) / (1.0 - horizonTransition);
            };
            const levelP = calcLevelStrength(Math.abs(input.p));
            const levelR = calcLevelStrength(Math.abs(input.r));

            // 4. Blend per-axis
            this.rotVel.x = THREE.MathUtils.lerp(acroTarget.x, angleCorrectP, levelP);
            this.rotVel.z = THREE.MathUtils.lerp(acroTarget.z, angleCorrectR, levelR);
            this.rotVel.y = acroTarget.y; // Yaw always manual

            // Apply rotation
            const theta = this.rotVel.length() * dt;
            if (theta > 0.0001) {
                const axis = this.rotVel.clone().normalize();
                const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
                this.quat.multiply(qStep);
            }
        }

        // ACRO 模式：套用旋轉（只在這裡做一次）
        if (input.flightMode === FLIGHT_MODES.ACRO) {
            const theta = this.rotVel.length() * dt;
            if (theta > 0.0001) {
                const axis = this.rotVel.clone().normalize();
                const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
                this.quat.multiply(qStep);
            }
        }

        // 高度軟限制（超過最大高度後推力遞減）
        if (this.pos.y > CONFIG.maxHeight) {
            this.vel.y *= 0.95; // 逐漸減速
        }
        
        this.quat.normalize();
    }
}
