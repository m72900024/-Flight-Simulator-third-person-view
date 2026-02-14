export class GameScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 500);
        this.pilotEyePos = new THREE.Vector3(0, 1.6, 6);
        this.camera.position.copy(this.pilotEyePos);
        this.camera.lookAt(0, 1, 0);
        this.cameraLookTarget = new THREE.Vector3(0, 1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // 關閉抗鋸齒提升效能
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 限制像素比
        document.body.appendChild(this.renderer.domElement);

        this.droneGroup = new THREE.Group();
        this.propellers = [];
        this.levelGroup = new THREE.Group();

        this.initLights();
        this.initEnvironment();
        this.createDrone();
        this.scene.add(this.levelGroup);
    }

    initLights() {
        // 只用環境光 + 一個方向光，不開陰影
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(20, 50, 20);
        // 不開 castShadow — 大幅提升效能
        this.scene.add(dirLight);
    }

    initEnvironment() {
        // 簡化地面
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshLambertMaterial({ color: 0x335533 }) // Lambert 比 Standard 快
        );
        plane.rotation.x = -Math.PI / 2;
        this.scene.add(plane);
        this.scene.add(new THREE.GridHelper(200, 20, 0x222222, 0x222222)); // 格線減少到 20

        // 飛手（簡化）
        const pilot = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.7, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x0088ff })
        );
        pilot.position.set(0, 0.85, 6);
        this.scene.add(pilot);
    }

    createDrone() {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const redMat = new THREE.MeshLambertMaterial({ color: 0xff2200 });
        const blueMat = new THREE.MeshLambertMaterial({ color: 0x0066ff });

        // 中央機身
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.22), mat);
        this.droneGroup.add(body);

        // X 型機臂 + 馬達 + 螺旋槳
        const armPositions = [
            { x: 0.18, z: -0.18, angle: -Math.PI/4 },
            { x: -0.18, z: -0.18, angle: Math.PI/4 },
            { x: 0.18, z: 0.18, angle: Math.PI/4 },
            { x: -0.18, z: 0.18, angle: -Math.PI/4 }
        ];

        // 共用幾何體（重用減少 GPU 記憶體）
        const armGeo = new THREE.BoxGeometry(0.32, 0.015, 0.03);
        const motorGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.03, 8);
        const propGeo = new THREE.BoxGeometry(0.24, 0.003, 0.02);
        const discGeo = new THREE.CircleGeometry(0.12, 12); // 減少面數

        armPositions.forEach((ap, i) => {
            // 機臂
            const arm = new THREE.Mesh(armGeo, mat);
            arm.position.set(ap.x / 2, 0.01, ap.z / 2);
            arm.rotation.y = ap.angle;
            this.droneGroup.add(arm);

            // 馬達（前紅後藍）
            const motor = new THREE.Mesh(motorGeo, i < 2 ? redMat : blueMat);
            motor.position.set(ap.x, 0.03, ap.z);
            this.droneGroup.add(motor);

            // 螺旋槳組
            const propGroup = new THREE.Group();
            propGroup.position.set(ap.x, 0.05, ap.z);

            // 模糊圓盤
            const discMat = new THREE.MeshBasicMaterial({
                color: i < 2 ? 0xff4444 : 0x4444ff,
                transparent: true, opacity: 0.0, side: THREE.DoubleSide
            });
            const disc = new THREE.Mesh(discGeo, discMat);
            disc.rotation.x = -Math.PI / 2;
            disc.userData = { isDisc: true };
            propGroup.add(disc);

            // 兩片槳葉
            const bladeMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
            for (let b = 0; b < 2; b++) {
                const blade = new THREE.Mesh(propGeo, bladeMat);
                blade.rotation.y = b * Math.PI / 2;
                blade.userData = { isBlade: true };
                propGroup.add(blade);
            }

            propGroup.userData = { dir: (i % 2 === 0) ? 1 : -1 };
            this.propellers.push(propGroup);
            this.droneGroup.add(propGroup);
        });

        // FPV 攝影機（簡化）
        const cam = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.04, 0.03),
            new THREE.MeshBasicMaterial({ color: 0x111111 })
        );
        cam.position.set(0, 0.02, -0.13);
        cam.rotation.x = -0.5;
        this.droneGroup.add(cam);
        // 鏡頭（一個小圓點）
        const lens = new THREE.Mesh(
            new THREE.CircleGeometry(0.01, 6),
            new THREE.MeshBasicMaterial({ color: 0x3366ff })
        );
        lens.position.set(0, 0.02, -0.155);
        lens.rotation.x = -0.5;
        this.droneGroup.add(lens);

        // 電池
        const battery = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.025, 0.12),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        battery.position.set(0, -0.02, 0);
        this.droneGroup.add(battery);

        // LED（用 MeshBasic 不用 PointLight，省效能）
        this.ledMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.01, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        this.ledMesh.position.set(0, 0, 0.15);
        this.droneGroup.add(this.ledMesh);

        this.scene.add(this.droneGroup);
    }

    updateDrone(pos, quat, throttle) {
        this.droneGroup.position.copy(pos);
        this.droneGroup.quaternion.copy(quat);

        // 螺旋槳旋轉 + 模糊效果
        for (let i = 0; i < this.propellers.length; i++) {
            const pg = this.propellers[i];
            pg.rotation.y += (0.5 + throttle * 2.0) * pg.userData.dir;
            const children = pg.children;
            for (let j = 0; j < children.length; j++) {
                const child = children[j];
                if (child.userData.isDisc) {
                    child.material.opacity = Math.min(0.35, throttle * 0.5);
                } else if (child.userData.isBlade) {
                    child.material.opacity = Math.max(0.1, 1.0 - throttle * 1.5);
                    child.material.transparent = true;
                }
            }
        }

        // LED 閃爍（簡化計算）
        if (this.ledMesh) {
            this.ledMesh.material.color.setHex((Date.now() & 256) ? 0x00ff00 : 0x002200);
        }

        // LOS 目視飛行
        this.cameraLookTarget.lerp(pos, 0.1);
        this.camera.lookAt(this.cameraLookTarget);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
