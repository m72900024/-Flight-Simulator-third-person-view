export class GameScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        // LOS 目視飛行：相機在飛手眼睛位置（固定站立點）
        this.pilotEyePos = new THREE.Vector3(0, 1.6, 6);
        this.camera.position.copy(this.pilotEyePos);
        this.camera.lookAt(0, 1, 0);
        this.cameraLookTarget = new THREE.Vector3(0, 1, 0); // 平滑追蹤用

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
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
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(20, 50, 20);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    initEnvironment() {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x335533 }));
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);
        this.scene.add(new THREE.GridHelper(200, 50, 0x111111, 0x111111));
        
        const pilot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardMaterial({color:0x0088ff}));
        pilot.position.set(0, 0.85, 6);
        pilot.castShadow = true;
        this.scene.add(pilot);
    }

    createDrone() {
        const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.8 });
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2, metalness: 0.9 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.4 });
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x0066ff, roughness: 0.4 });
        const batteryMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6 });

        // --- 中央機身（碳纖維板）---
        const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.22), carbonMat);
        topPlate.position.y = 0.03;
        const bottomPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.22), carbonMat);
        bottomPlate.position.y = -0.01;
        // 側板（支撐柱）
        const standoff1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), motorMat);
        standoff1.position.set(0.06, 0.01, 0.08);
        const standoff2 = standoff1.clone(); standoff2.position.set(-0.06, 0.01, 0.08);
        const standoff3 = standoff1.clone(); standoff3.position.set(0.06, 0.01, -0.08);
        const standoff4 = standoff1.clone(); standoff4.position.set(-0.06, 0.01, -0.08);

        this.droneGroup.add(topPlate, bottomPlate, standoff1, standoff2, standoff3, standoff4);

        // --- 4 個機臂 (X 型) ---
        const armPositions = [
            { x: 0.18, z: -0.18, angle: -Math.PI/4 },   // 右前
            { x: -0.18, z: -0.18, angle: Math.PI/4 },    // 左前
            { x: 0.18, z: 0.18, angle: Math.PI/4 },      // 右後
            { x: -0.18, z: 0.18, angle: -Math.PI/4 }     // 左後
        ];
        
        armPositions.forEach((ap, i) => {
            // 機臂
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.03), carbonMat);
            arm.position.set(ap.x / 2, 0.01, ap.z / 2);
            arm.rotation.y = ap.angle;
            this.droneGroup.add(arm);

            // 馬達座（圓柱）
            const motorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.025, 12), motorMat);
            motorBase.position.set(ap.x, 0.02, ap.z);
            this.droneGroup.add(motorBase);

            // 馬達鐘形罩
            const motorBell = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.015, 12), 
                i < 2 ? redMat : blueMat); // 前紅後藍（辨識方向）
            motorBell.position.set(ap.x, 0.04, ap.z);
            this.droneGroup.add(motorBell);

            // 螺旋槳（兩片槳葉 + 旋轉圓盤）
            const propGroup = new THREE.Group();
            propGroup.position.set(ap.x, 0.052, ap.z);

            // 旋轉時的模糊圓盤
            const discMat = new THREE.MeshBasicMaterial({ 
                color: i < 2 ? 0xff4444 : 0x4444ff, 
                transparent: true, opacity: 0.0, side: THREE.DoubleSide 
            });
            const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), discMat);
            disc.rotation.x = -Math.PI / 2;
            disc.userData = { isDisc: true };
            propGroup.add(disc);

            // 兩片槳葉
            const bladeMat = new THREE.MeshStandardMaterial({ 
                color: 0x222222, roughness: 0.5, side: THREE.DoubleSide 
            });
            for (let b = 0; b < 2; b++) {
                const blade = new THREE.Mesh(
                    new THREE.BoxGeometry(0.24, 0.003, 0.02),
                    bladeMat
                );
                blade.rotation.y = b * Math.PI / 2;
                // 槳葉微傾（模擬螺距）
                blade.rotation.z = 0.05;
                blade.userData = { isBlade: true };
                propGroup.add(blade);
            }

            propGroup.userData = { dir: (i % 2 === 0) ? 1 : -1 };
            this.propellers.push(propGroup);
            this.droneGroup.add(propGroup);
        });

        // --- FPV 攝影機 ---
        const camMount = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), carbonMat);
        camMount.position.set(0, 0.02, -0.13);
        camMount.rotation.x = -0.5; // 攝影機傾斜角度
        const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 8), 
            new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 1.0 }));
        camLens.rotation.x = Math.PI / 2;
        camLens.position.set(0, 0, -0.015);
        camMount.add(camLens);
        // 鏡頭反光
        const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.01, 8),
            new THREE.MeshBasicMaterial({ color: 0x3366ff }));
        lensGlass.position.set(0, 0, -0.023);
        lensGlass.rotation.x = 0;
        camMount.add(lensGlass);
        this.droneGroup.add(camMount);

        // --- 電池（綁在底部）---
        const battery = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.14), batteryMat);
        battery.position.set(0, -0.025, 0);
        this.droneGroup.add(battery);
        // 電池貼紙
        const stickerMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), stickerMat);
        sticker.position.set(0, -0.009, 0.05);
        sticker.rotation.x = -Math.PI / 2;
        battery.add(sticker);

        // --- LED 燈（尾部）---
        this.rearLED = new THREE.PointLight(0x00ff00, 0.5, 2);
        this.rearLED.position.set(0, 0, 0.15);
        this.droneGroup.add(this.rearLED);
        const ledBulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.008, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        ledBulb.position.copy(this.rearLED.position);
        this.droneGroup.add(ledBulb);
        this.ledBulb = ledBulb;

        this.droneGroup.traverse(o => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(this.droneGroup);
    }

    updateDrone(pos, quat, throttle) {
        this.droneGroup.position.copy(pos);
        this.droneGroup.quaternion.copy(quat);

        // 螺旋槳效果：轉速越快，槳葉消失、圓盤出現
        this.propellers.forEach(pg => {
            const spinSpeed = 0.5 + throttle * 2.0;
            pg.rotation.y += spinSpeed * pg.userData.dir;
            pg.children.forEach(child => {
                if (child.userData.isDisc) {
                    child.material.opacity = Math.min(0.4, throttle * 0.5);
                }
                if (child.userData.isBlade) {
                    child.material.opacity = Math.max(0.1, 1.0 - throttle * 1.5);
                    child.material.transparent = true;
                }
            });
        });

        // LED 閃爍
        if (this.rearLED) {
            const blink = Math.sin(Date.now() * 0.01) > 0;
            this.rearLED.intensity = blink ? 0.8 : 0.1;
            if (this.ledBulb) this.ledBulb.material.color.setHex(blink ? 0x00ff00 : 0x003300);
        }

        // LOS 目視飛行：眼睛平滑跟隨無人機
        this.cameraLookTarget.lerp(pos, 0.1);
        this.camera.lookAt(this.cameraLookTarget);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
