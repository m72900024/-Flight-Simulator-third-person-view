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
        // 推力
        const thrustMag = input.armed ? (Math.pow(input.t, 2) * CONFIG.thrustPower) : 0;
        const force = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat).multiplyScalar(thrustMag);

        // 重力
        force.y -= CONFIG.mass * CONFIG.gravity;

        // 阻力
        const drag = this.vel.clone().multiplyScalar(-CONFIG.dragCoeff * this.vel.length());
        force.add(drag);

        // 運動方程
        const accel = force.divideScalar(CONFIG.mass);
        this.vel.add(accel.multiplyScalar(dt));
        this.pos.add(this.vel.clone().multiplyScalar(dt));

        // 地板碰撞
        if (this.pos.y < CONFIG.hardDeck) {
            this.pos.y = CONFIG.hardDeck;
            this.vel.y = 0;
            this.vel.x *= 0.5;
            this.vel.z *= 0.5;
        }

        // 旋轉 (Acro)
        const maxRate = THREE.MathUtils.degToRad(600 * CONFIG.rates);
        const targetRotVel = new THREE.Vector3(input.p, input.y, -input.r).multiplyScalar(maxRate);
        this.rotVel.lerp(targetRotVel, 10 * dt);

        const theta = this.rotVel.length() * dt;
        if (theta > 0.0001) {
            const axis = this.rotVel.clone().normalize();
            const qStep = new THREE.Quaternion().setFromAxisAngle(axis, theta);
            this.quat.multiply(qStep).normalize();
        }
    }
}
