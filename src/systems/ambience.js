import * as THREE from 'three';

// The world moving on its own: dust drifting in the low sun, a few leaves falling, and now and then a
// small flock of birds crossing high overhead (their shadows sweep the ground). Cheap: one Points
// object, one InstancedMesh of leaves, a handful of bird meshes.
export class Ambience {
  constructor(scene) {
    this.scene = scene; this.t = 0;
    // dust motes around the camera focus
    const N = 160, pos = new Float32Array(N * 3); this.seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = (Math.random() - 0.5) * 22; this.seed[i] = Math.random() * 100; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe2b8', opacity: 0.55 }));
    this.dust.frustumCulled = false; scene.add(this.dust);
    // falling leaves
    const lc = document.createElement('canvas'); lc.width = 32; lc.height = 64; const l = lc.getContext('2d');
    l.fillStyle = '#7a5a2a'; l.beginPath(); l.ellipse(16, 32, 9, 26, 0, 0, Math.PI * 2); l.fill(); l.strokeStyle = '#4f3a1a'; l.lineWidth = 2; l.beginPath(); l.moveTo(16, 8); l.lineTo(16, 58); l.stroke();
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    this.LN = 26;
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.16), new THREE.MeshStandardMaterial({ map: lt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), this.LN);
    this.leaves.castShadow = true; this.leaves.frustumCulled = false; scene.add(this.leaves);
    this.leafState = Array.from({ length: this.LN }, () => this.newLeaf(null, true));
    // birds
    this.birds = []; this.nextFlock = 8 + Math.random() * 10;
    this.birdGeo = (() => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, -0.35, 0, -0.05, 0, 0, -0.08, 0, 0, 0.12, 0, 0, -0.08, 0.35, 0, -0.05], 3)); gg.computeVertexNormals(); return gg; })();
    this.birdMat = new THREE.MeshBasicMaterial({ color: '#2a2420', side: THREE.DoubleSide });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
  }

  newLeaf(focus, scatter = false) {
    const f = focus || { x: 0, z: 0 };
    return { x: f.x + (Math.random() - 0.5) * 18, z: f.z + (Math.random() - 0.5) * 18 - 4, y: scatter ? Math.random() * 7 : 6 + Math.random() * 3, ph: Math.random() * 6.28, sp: 0.35 + Math.random() * 0.35, spin: Math.random() * 6.28, rest: 0 };
  }

  update(dt, focus, wind = 1) {
    this.t += dt;
    // dust: drift and wrap in a box around the focus
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + (Math.sin(this.t * 0.3 + this.seed[i]) * 0.12 + 0.08 * wind) * dt, y = p.getY(i) + Math.sin(this.t * 0.5 + this.seed[i] * 2) * 0.05 * dt, z = p.getZ(i) + Math.cos(this.t * 0.25 + this.seed[i]) * 0.1 * dt;
      if (x > 11) x -= 22; if (x < -11) x += 22; if (z > 11) z -= 22; if (z < -11) z += 22; if (y > 5) y = 0.2; if (y < 0.1) y = 4.8;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true; this.dust.position.set(focus.x, 0, focus.z);
    // leaves: flutter down, rest a while on the ground, then start again above
    for (let i = 0; i < this.LN; i++) {
      const L = this.leafState[i];
      if (L.y > 0.03) { L.y -= L.sp * dt; L.x += (Math.sin(this.t * 1.7 + L.ph) * 0.5 + 0.25 * wind) * dt; L.z += Math.cos(this.t * 1.3 + L.ph) * 0.3 * dt; L.spin += dt * 2.2; }
      else if ((L.rest += dt) > 6 || Math.hypot(L.x - focus.x, L.z - focus.z) > 16) this.leafState[i] = this.newLeaf(focus);
      const flat = L.y <= 0.03;
      this._e.set(flat ? -Math.PI / 2 : Math.sin(L.spin) * 1.2, L.spin, flat ? 0 : Math.cos(L.spin * 0.7));
      this._m.compose(new THREE.Vector3(L.x, Math.max(0.02, L.y), L.z), this._q.setFromEuler(this._e), new THREE.Vector3(1, 1, 1));
      this.leaves.setMatrixAt(i, this._m);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    // birds: a small flock now and then, high, crossing from the west
    if ((this.nextFlock -= dt) < 0) {
      this.nextFlock = 22 + Math.random() * 25;
      const n = 3 + Math.floor(Math.random() * 4), z0 = focus.z - 8 + Math.random() * 10, dir = Math.random() < 0.6 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(this.birdGeo, this.birdMat); m.castShadow = true; m.scale.setScalar(0.9 + Math.random() * 0.4);
        m.userData = { x: focus.x - dir * (26 + Math.random() * 6) - i * 1.2 * dir, y: 10 + Math.random() * 3, z: z0 + (Math.random() - 0.5) * 4, v: (7 + Math.random()) * dir, ph: Math.random() * 6.28 };
        this.scene.add(m); this.birds.push(m);
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i], u = b.userData;
      u.x += u.v * dt; u.z += Math.sin(this.t * 0.7 + u.ph) * 0.6 * dt;
      b.position.set(u.x, u.y + Math.sin(this.t * 2 + u.ph) * 0.15, u.z);
      b.rotation.set(0, u.v > 0 ? Math.PI / 2 : -Math.PI / 2, Math.sin(this.t * 11 + u.ph) * 0.6);
      if (Math.abs(u.x - focus.x) > 40) { this.scene.remove(b); this.birds.splice(i, 1); }
    }
  }
}
