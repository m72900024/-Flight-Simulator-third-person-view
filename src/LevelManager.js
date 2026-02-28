import { CONFIG } from './Config.js';

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.currentLevel = 1;
        this.isComplete = false;
        this.timer = 0;
        this.elapsed = 0;
        this.waypoints = [];
        this.wpIndex = 0;
        this.wpMeshes = [];
        this.checkpoints = [];
        this.cpIndex = 0;

        // localStorage best times
        this.bestTimes = JSON.parse(localStorage.getItem('flightSimBest') || '{}');
    }

    saveBest(level, time) {
        const key = 'L' + level;
        if (!this.bestTimes[key] || time < this.bestTimes[key]) {
            this.bestTimes[key] = Math.round(time * 10) / 10;
            localStorage.setItem('flightSimBest', JSON.stringify(this.bestTimes));
        }
    }

    getBest(level) {
        return this.bestTimes['L' + level] || null;
    }

    loadLevel(levelIndex) {
        this.currentLevel = levelIndex;
        this.isComplete = false;
        this.timer = 0;
        this.elapsed = 0;
        this.wpIndex = 0;
        this.cpIndex = 0;
        this.waypoints = [];
        this.wpMeshes = [];
        this.checkpoints = [];

        const grp = this.scene.levelGroup;
        while (grp.children.length > 0) grp.remove(grp.children[0]);

        const lvl = CONFIG.levels[levelIndex - 1];
        document.getElementById('level-title').innerText = `第 ${levelIndex} 關：${lvl.name}`;
        document.getElementById('instruction').innerText = lvl.desc;
        document.getElementById('progress-fill').style.width = '0%';

        const best = this.getBest(levelIndex);
        document.getElementById('stat-best').innerText = best ? `最佳: ${best}s` : '最佳: --';

        switch (levelIndex) {
            case 1: this._setupAltitudeHold(grp); break;
            case 2: this._setupHoverBox(grp); break;
            case 3: this._setupWaypoints(grp, [[0,3,-10],[0,3,0]]); break;
            case 4: this._setupWaypoints(grp, [[-8,3,0],[8,3,0]]); break;
            case 5: this._setupWaypoints(grp, [[5,3,-5],[5,3,5],[-5,3,5],[-5,3,-5]]); break;
            case 6: this._setupGate(grp); break;
            case 7: this._setupFigure8(grp); break;
            case 8: this._setupChallenge(grp); break;
        }
    }

    _makeWpSphere(pos, color = 0x00ff88) {
        const m = new THREE.Mesh(
            new THREE.SphereGeometry(0.6, 16, 16),
            new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
        );
        m.position.set(...pos);
        return m;
    }

    _makeGate(pos, lookAt) {
        const g = new THREE.Mesh(
            new THREE.TorusGeometry(2, 0.25, 8, 30),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff4400, emissiveIntensity: 0.4 })
        );
        g.position.set(...pos);
        if (lookAt) g.lookAt(...lookAt);
        g.castShadow = true;
        return g;
    }

    _setupAltitudeHold(grp) {
        // 半透明綠色平面在 2.5m 高
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(6, 6),
            new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 2.5;
        grp.add(plane);
        // 邊框
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(2.8, 3, 32),
            new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 2.5;
        grp.add(ring);
        this._altPlane = plane;
    }

    _setupHoverBox(grp) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 2.5, 2.5),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.3 })
        );
        box.position.set(0, 3, 0);
        grp.add(box);
        this._hoverBox = box;
    }

    _setupWaypoints(grp, points) {
        this.waypoints = points;
        this.wpMeshes = [];
        this.wpIndex = 0;
        points.forEach((p, i) => {
            const m = this._makeWpSphere(p, i === 0 ? 0x00ff88 : 0x444488);
            grp.add(m);
            this.wpMeshes.push(m);
        });
        this._highlightWp(0);
    }

    _highlightWp(idx) {
        this.wpMeshes.forEach((m, i) => {
            if (i === idx) {
                m.material.color.setHex(0x00ff88);
                m.material.emissive.setHex(0x00ff88);
                m.material.opacity = 0.8;
            } else if (i < idx) {
                m.material.opacity = 0.15;
            } else {
                m.material.color.setHex(0x444488);
                m.material.emissive.setHex(0x222244);
                m.material.opacity = 0.4;
            }
        });
    }

    _setupGate(grp) {
        const gate = this._makeGate([0, 3, -15], [0, 3, 0]);
        grp.add(gate);
        this._gate = gate;
    }

    _setupFigure8(grp) {
        // 兩根柱子
        const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 6, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0x441100 });
        const p1 = new THREE.Mesh(poleGeo, poleMat);
        p1.position.set(-6, 3, -10); p1.castShadow = true; grp.add(p1);
        const p2 = new THREE.Mesh(poleGeo, poleMat);
        p2.position.set(6, 3, -10); p2.castShadow = true; grp.add(p2);

        // 6 個檢查點 (8字形路徑)
        const cps = [
            [0, 3, -10], [-6, 3, -16], [-6, 3, -4],
            [0, 3, -10], [6, 3, -4], [6, 3, -16]
        ];
        this.checkpoints = cps;
        this.cpIndex = 0;
        cps.forEach((cp, i) => {
            const m = this._makeWpSphere(cp, i === 0 ? 0xffaa00 : 0x664400);
            m.scale.setScalar(0.6);
            grp.add(m);
            this.wpMeshes.push(m);
        });
        this._highlightCp(0);
    }

    _highlightCp(idx) {
        this.wpMeshes.forEach((m, i) => {
            if (i === idx) {
                m.material.color.setHex(0xffaa00);
                m.material.emissive.setHex(0xffaa00);
                m.material.opacity = 0.8;
            } else if (i < idx) {
                m.material.opacity = 0.1;
            } else {
                m.material.color.setHex(0x664400);
                m.material.emissive.setHex(0x332200);
                m.material.opacity = 0.35;
            }
        });
    }

    _setupChallenge(grp) {
        // 3 個門 + 航點 + 回降落場
        const gates = [[0,3,-12],[8,3,-20],[-8,3,-20]];
        gates.forEach(g => { grp.add(this._makeGate(g, [0,3,0])); });
        const wps = [[0,3,-12],[8,3,-20],[-8,3,-20],[0,3,0]];
        this.waypoints = wps;
        this.wpMeshes = [];
        this.wpIndex = 0;
        wps.forEach((p,i) => {
            const m = this._makeWpSphere(p, 0x444488);
            grp.add(m); this.wpMeshes.push(m);
        });
        this._highlightWp(0);
    }

    checkWinCondition(dronePos, dt) {
        if (this.isComplete) return true;
        this.elapsed += dt;
        document.getElementById('stat-time').innerText = this.elapsed.toFixed(1) + 's';

        const pFill = document.getElementById('progress-fill');
        const L = this.currentLevel;

        if (L === 1) {
            // 高度 2~3m
            if (dronePos.y >= 2 && dronePos.y <= 3) {
                this.timer += dt;
                if (this._altPlane) this._altPlane.material.color.setHex(0xffff00);
            } else {
                this.timer = Math.max(0, this.timer - dt * 2);
                if (this._altPlane) this._altPlane.material.color.setHex(0x00ff44);
            }
            pFill.style.width = Math.min(100, this.timer / 3 * 100) + '%';
            if (this.timer >= 3) this._complete();

        } else if (L === 2) {
            const b = this._hoverBox.position;
            if (Math.abs(dronePos.x-b.x)<1.25 && Math.abs(dronePos.y-b.y)<1.25 && Math.abs(dronePos.z-b.z)<1.25) {
                this.timer += dt;
                this._hoverBox.material.color.setHex(0xffff00);
            } else {
                this.timer = Math.max(0, this.timer - dt * 2);
                this._hoverBox.material.color.setHex(0x00ff00);
            }
            pFill.style.width = Math.min(100, this.timer / 3 * 100) + '%';
            if (this.timer >= 3) this._complete();

        } else if (L >= 3 && L <= 5 || L === 8) {
            const wp = this.waypoints[this.wpIndex];
            const dist = dronePos.distanceTo(new THREE.Vector3(...wp));
            if (dist < 1.8) {
                this.wpIndex++;
                if (this.wpIndex >= this.waypoints.length) {
                    this._complete();
                } else {
                    this._highlightWp(this.wpIndex);
                }
            }
            pFill.style.width = (this.wpIndex / this.waypoints.length * 100) + '%';

        } else if (L === 6) {
            const dist = dronePos.distanceTo(this._gate.position);
            if (dist < 2) this._complete();
            pFill.style.width = Math.max(0, 100 - dist * 5) + '%';

        } else if (L === 7) {
            const cp = this.checkpoints[this.cpIndex];
            const dist = dronePos.distanceTo(new THREE.Vector3(...cp));
            if (dist < 2.5) {
                this.cpIndex++;
                if (this.cpIndex >= this.checkpoints.length) {
                    this._complete();
                } else {
                    this._highlightCp(this.cpIndex);
                }
            }
            pFill.style.width = (this.cpIndex / this.checkpoints.length * 100) + '%';
        }
    }

    _complete() {
        this.isComplete = true;
        this.saveBest(this.currentLevel, this.elapsed);
        document.getElementById('msg-overlay').style.display = 'block';
        document.getElementById('msg-time').innerText = `用時: ${this.elapsed.toFixed(1)}s`;
        const best = this.getBest(this.currentLevel);
        document.getElementById('msg-best').innerText = best ? `最佳: ${best}s` : '';

        document.getElementById('btn-next').onclick = () => {
            document.getElementById('msg-overlay').style.display = 'none';
            const next = this.currentLevel < 8 ? this.currentLevel + 1 : 1;
            this.loadLevel(next);
            window.dispatchEvent(new Event('reset-drone'));
        };
    }
}
