import * as THREE from 'three';
import { footprintTexture, pawprintTexture } from '../world/textures.js';

// Instanced footprint decals. Each print fades from a shadow-blue toward the snow color over time
// (instance color multiplies the texture), so old tracks disappear without transparency sorting.
// The pool is bounded (max prints); the oldest print is reused when it is full.
export class Footprints {
  constructor(scene, max = 900, paw = false, life = paw ? 90 : 150) {
    this.max = max; this.i = 0; this.life = life;
    const g = new THREE.PlaneGeometry(paw ? 0.2 : 0.2, paw ? 0.2 : 0.36);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({
      map: paw ? pawprintTexture() : footprintTexture(), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: true, side: THREE.DoubleSide,
    });
    // instance color red channel = print opacity; rgb comes from the material tint
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>',
        '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR_ALPHA )\n diffuseColor.a *= vColor.r;\n#endif');
    };
    this.mesh = new THREE.InstancedMesh(g, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < max; k++) { this.mesh.setMatrixAt(k, zero); this.mesh.setColorAt(k, new THREE.Color(0, 0, 0)); }
    this.born = new Float32Array(max).fill(-1e9);
    this.strength = new Float32Array(max);
    scene.add(this.mesh);
    this.time = 0;
    this.tint = new THREE.Color('#7f8fb3'); this.clear = new THREE.Color(1, 1, 1);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._c = new THREE.Color();
    this.count = 0;
  }

  /** place a print; strength 0..1+ (lighter on pavement, darker in deep snow); side -1 mirrors a left foot */
  add(x, y, z, yaw, strength = 1, side = 1, scale = 1) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this._m.compose(new THREE.Vector3(x, y + 0.02, z), this._q, new THREE.Vector3(side < 0 ? -scale : scale, 1, scale));
    this.mesh.setMatrixAt(k, this._m);
    this.born[k] = this.time; this.strength[k] = strength;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.count++;
  }

  reset() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < this.max; k++) { this.mesh.setMatrixAt(k, zero); this.born[k] = -1e9; }
    this.mesh.instanceMatrix.needsUpdate = true; this.i = 0; this.count = 0;
  }

  update(dt, night) {
    this.time += dt;
    this._accum = (this._accum || 0) + dt;
    if (this._accum < 0.25) return; // colors don't need per-frame updates
    this._accum = 0;
    const tint = this._c;
    for (let k = 0; k < this.max; k++) {
      const age = this.time - this.born[k];
      if (age > this.life + 1) continue;
      const f = Math.min(1, Math.max(0, 1 - age / this.life) * this.strength[k] * 0.75);
      tint.setRGB(f, f, f);
      this.mesh.setColorAt(k, tint);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.material.color.copy(night ? new THREE.Color('#4a5878') : this.tint);
  }
}
