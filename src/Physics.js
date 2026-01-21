import { CONFIG, FLIGHT_MODES } from './Config.js';

export class PhysicsEngine {
    constructor() {
        this.pos = new THREE.Vector3(0, 0.2, 0);
        this.vel = new THREE.Vector3(0, 0, 0);
        this.quat = new THREE.Quaternion();
        this.rotVel = new THREE.Vector3(0, 0, 0); // 角速度
    }

    reset() {
        this.pos.set(0, 0.2, 0);
        this.vel.set(0, 0, 0);
        this.rotVel.set(0, 0, 0);
        this.quat.identity();
    }

    update(dt, input) {
        // --- 1. 推力與重力 (保持不變) ---
        const thrustMag = input.armed ? (Math.pow(input.t, 2) * CONFIG.thrustPower) : 0;
        const force = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat).multiplyScalar(thrustMag);
        force.y -= CONFIG.mass * CONFIG.gravity;
        const drag = this.vel.clone().multiplyScalar(-CONFIG.dragCoeff * this.vel.length());
        force.add(drag);
        const accel = force.divideScalar(CONFIG.mass);
        this.vel.add(accel.multiplyScalar(dt));
        this.pos.add(this.vel.clone().multiplyScalar(dt));

        // 地板碰撞
        if (this.pos.y < CONFIG.hardDeck) {
            this.pos.y = CONFIG.hardDeck;
            this.vel.y = 0;
            this.vel.x *= 0.5; this.vel.z *= 0.5;
        }

        // --- 2. 姿態控制 (核心修改) ---
        const maxRate = THREE.MathUtils.degToRad(600 * CONFIG.rates); // 最大角速度
        
        if (input.flightMode === FLIGHT_MODES.ACRO) {
            // [手動模式] 直接將搖桿映射為目標角速度
            const targetRotVel = new THREE.Vector3(input.p, input.y, -input.r).multiplyScalar(maxRate);
            this.rotVel.lerp(targetRotVel, 10 * dt); // 模擬轉動慣性

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

        } else if (input.flightMode === FLIGHT_MODES.HORIZON) {
            // [半自穩模式] 混合邏輯
            // 搖桿推到底 (deflection = 1) -> 變成 Acro
            // 搖桿在中間 (deflection = 0) -> 變成 Angle
            
            const stickDeflection = Math.max(Math.abs(input.p), Math.abs(input.r));
            const blendFactor = Math.pow(stickDeflection, 3); // 三次方曲線，讓中間更穩，邊緣更靈敏

            // 1. 計算 Acro 想要怎麼轉
            const acroTarget = new THREE.Vector3(input.p, input.y, -input.r).multiplyScalar(maxRate);
            
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

        // 統一正規化，防止數值漂移
        if (input.flightMode === FLIGHT_MODES.ACRO) {
             const theta = this.rotVel.length() * dt;
            if (theta > 0.0001) {
                const axis = this.rotVel.clone().normalize();
                const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
                this.quat.multiply(qStep);
            }
        }
        
        this.quat.normalize();
    }
}
