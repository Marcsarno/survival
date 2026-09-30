import * as THREE from 'three';

// Falling snow around the camera focus. Flakes wrap inside a box that follows the player.
export class Snowfall {
  constructor(scene, count = 1800) {
    this.box = new THREE.Vector3(70, 34, 70);
    const pos = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.box.x;
      pos[i * 3 + 1] = Math.random() * this.box.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.box.z;
      this.speed[i] = 1.2 + Math.random() * 1.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ size: 0.22, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.85, fog: true });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.t = 0; this.intensity = 1;
  }
  update(dt, focus) {
    this.t += dt;
    const p = this.points.geometry.attributes.position, a = p.array;
    const wind = Math.sin(this.t * 0.2) * 0.8 + 0.6;
    for (let i = 0; i < this.speed.length; i++) {
      a[i * 3 + 1] -= this.speed[i] * dt;
      a[i * 3] += (wind + Math.sin(this.t + i) * 0.3) * dt;
      a[i * 3 + 2] += Math.cos(this.t * 0.7 + i * 0.5) * 0.3 * dt;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] += this.box.y;
      // wrap horizontally around the focus
      const rx = a[i * 3] - focus.x, rz = a[i * 3 + 2] - focus.z;
      if (rx > this.box.x / 2) a[i * 3] -= this.box.x; else if (rx < -this.box.x / 2) a[i * 3] += this.box.x;
      if (rz > this.box.z / 2) a[i * 3 + 2] -= this.box.z; else if (rz < -this.box.z / 2) a[i * 3 + 2] += this.box.z;
    }
    p.needsUpdate = true;
    this.points.position.y = focus.y;
  }
}
