export class GameScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 6);
        this.camera.lookAt(0, 1, 0);

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
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), mat);
        const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.04), mat); arm1.rotation.y = Math.PI/4;
        const arm2 = arm1.clone(); arm2.rotation.y = -Math.PI/4;
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        nose.position.z = -0.15;

        this.droneGroup.add(body, arm1, arm2, nose);
        
        const propGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.01, 8);
        const propMat = new THREE.MeshBasicMaterial({color:0x00ffff, transparent:true, opacity:0.6});
        const positions = [[0.2, -0.2], [-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]];
        
        positions.forEach((p, i) => {
            const prop = new THREE.Mesh(propGeo, propMat);
            prop.position.set(p[0], 0.05, p[1]);
            prop.userData = { dir: (i%2===0)?1:-1 };
            this.propellers.push(prop);
            this.droneGroup.add(prop);
        });

        this.droneGroup.traverse(o => { if(o.isMesh) o.castShadow = true; });
        this.scene.add(this.droneGroup);
    }

    updateDrone(pos, quat, throttle) {
        this.droneGroup.position.copy(pos);
        this.droneGroup.quaternion.copy(quat);
        const speed = 0.5 + throttle * 1.5;
        this.propellers.forEach(p => p.rotation.y += speed * p.userData.dir);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
