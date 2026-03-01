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
            // [自穩模式] 將搖桿映射為目標角度 (Euler Angles)
            const maxTilt = THREE.MathUtils.degToRad(CONFIG.maxTiltAngle);
            const targetPitch = input.p * maxTilt;
            const targetRoll = -input.r * maxTilt;
            
            // 取得當前 Yaw (我們不希望自穩改變機頭方向，只改平穩)
            const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
            const targetEuler = new THREE.Euler(targetPitch, euler.y, targetRoll, 'YXZ');
            const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);
            
            // 使用 Slerp 平滑插值回到目標角度
            this.quat.slerp(targetQuat, 5.0 * dt);
            
            // 在自穩模式下，Yaw 依然是角速度控制
            const yawRate = input.y * maxRate * 0.5;
            const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yawRate * dt);
            this.quat.premultiply(qYaw);
            
            this.rotVel.set(0,0,0); // 自穩時不累積物理角速度

        } else if (input.flightMode === FLIGHT_MODES.ALT_HOLD) {
            // [定高模式] 姿態控制與 ANGLE 模式相同（自穩）
            const maxTilt = THREE.MathUtils.degToRad(CONFIG.maxTiltAngle);
            const targetPitch = input.p * maxTilt;
            const targetRoll = -input.r * maxTilt;

            const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
            const targetEuler = new THREE.Euler(targetPitch, euler.y, targetRoll, 'YXZ');
            const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);

            this.quat.slerp(targetQuat, 5.0 * dt);

            const yawRate = input.y * maxRate * 0.5;
            const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yawRate * dt);
            this.quat.premultiply(qYaw);

            this.rotVel.set(0,0,0);

        } else if (input.flightMode === FLIGHT_MODES.HORIZON) {
            // [半自穩模式] 混合邏輯
            // 搖桿推到底 (deflection = 1) -> 變成 Acro
            // 搖桿在中間 (deflection = 0) -> 變成 Angle
            
            const stickDeflection = Math.max(Math.abs(input.p), Math.abs(input.r));
            const blendFactor = Math.pow(stickDeflection, 3); // 三次方曲線，讓中間更穩，邊緣更靈敏

            // 1. 計算 Acro 想要怎麼轉 (使用 SuperRate)
            const acroTarget = new THREE.Vector3(
                Math.sign(input.p) * calcRate(input.p),
                Math.sign(input.y) * calcRate(input.y),
                -Math.sign(input.r) * calcRate(input.r)
            );
            
            // 2. 計算 Angle 想要怎麼轉 (簡單模擬回正力)
            const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
            const angleCorrectP = (0 - euler.x) * 5.0; // P 回正
            const angleCorrectR = (0 - euler.z) * 5.0; // R 回正
            
            // 3. 混合
            // 如果 blendFactor 是 0 (中間)，完全用回正力
            // 如果 blendFactor 是 1 (推到底)，完全用 Acro 力
            this.rotVel.x = THREE.MathUtils.lerp(angleCorrectP, acroTarget.x, blendFactor);
            this.rotVel.z = THREE.MathUtils.lerp(angleCorrectR, acroTarget.z, blendFactor);
            this.rotVel.y = acroTarget.y; // Yaw 始終是手動

            // 應用旋轉
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
