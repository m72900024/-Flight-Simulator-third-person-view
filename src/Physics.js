import { CONFIG } from './Config.js';

export class PhysicsEngine {
    constructor() {
        this.pos = new THREE.Vector3(0, 0.2, 0);
        this.vel = new THREE.Vector3(0, 0, 0);
        this.quat = new THREE.Quaternion();
        this.rotVel = new THREE.Vector3(0, 0, 0);
    }

    reset() {
        this.pos.set(0, 0.2, 0);
        this.vel.set(0, 0, 0);
        this.rotVel.set(0, 0, 0);
        this.quat.identity();
    }

    update(dt, input) {
        // 1. 計算推力 (Thrust)
        const thrustMag = input.armed ? (Math.pow(input.t, 2) * CONFIG.thrustPower) : 0;
        const force = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat).multiplyScalar(thrustMag);

        // 2. 加入重力 (Gravity)
        force.y -= CONFIG.mass * CONFIG.gravity;

        // 3. 加入空氣阻力 (Drag)
        const drag = this.vel.clone().multiplyScalar(-CONFIG.dragCoeff * this.vel.length());
        force.add(drag);

        // 4. 線性運動積分 (F=ma)
        const accel = force.divideScalar(CONFIG.mass);
        this.vel.add(accel.multiplyScalar(dt));
        this.pos.add(this.vel.clone().multiplyScalar(dt));

        // 5. 地板碰撞與邊界檢查
        if (this.pos.y < CONFIG.hardDeck) {
            this.pos.y = CONFIG.hardDeck;
            this.vel.y = 0;
            this.vel.x *= 0.5; // 摩擦力
            this.vel.z *= 0.5;
        }
        
        // 簡單邊界防止飛丟 (例如飛出 30公尺外)
        if(this.pos.length() > 50) {
            this.reset();
        }

        // 6. 旋轉運動 (Acro Mode)
        const maxRate = THREE.MathUtils.degToRad(600 * CONFIG.rates);
        const targetRotVel = new THREE.Vector3(input.p, input.y, -input.r).multiplyScalar(maxRate);
        
        // 簡單的慣性模擬
        this.rotVel.lerp(targetRotVel, 10 * dt);

        const theta = this.rotVel.length() * dt;
        if (theta > 0.0001) {
            const axis = this.rotVel.clone().normalize();
            const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
            this.quat.multiply(qStep).normalize();
        }
    }
}
