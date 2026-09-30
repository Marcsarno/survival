import * as THREE from 'three';
import { clamp, lerp, angleLerp } from '../core/util.js';

// Elevated three-quarter follow camera. Height is adjustable (wheel, +/-, touch buttons),
// yaw rotates in 45° steps (Z/X). Pitch rises slightly as the camera goes higher.
export const CAM_LEVELS = [9, 12, 15, 19, 24, 30];

export class FollowCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(38, aspect, 0.5, 400);
    this.level = aspect < 0.8 ? 3 : 2; this.height = CAM_LEVELS[this.level];
    this.yaw = Math.PI / 4; this.targetYaw = this.yaw;
    this.focus = new THREE.Vector3();
    this.shake = 0;
  }
  zoom(d) { this.cinematic = false; this.level = clamp(this.level + d, 0, CAM_LEVELS.length - 1); }
  toggleCinematic() { this.cinematic = !this.cinematic; }
  rotate(d) { this.targetYaw += d * Math.PI / 4; }
  /** unit vectors on the ground for screen-up and screen-right */
  basis() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return { forward: f, right: r };
  }
  update(dt, target, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.focus.lerp(target, k);
    this.height = lerp(this.height, this.cinematic ? 4.2 : CAM_LEVELS[this.level], snap ? 1 : 1 - Math.exp(-dt * 5));
    this.yaw = angleLerp(this.yaw, this.targetYaw, snap ? 1 : 1 - Math.exp(-dt * 7));
    // radians above the horizon: steeper as the camera rises; the cinematic view sits low and close
    const pitch = this.height < 8 ? lerp(0.32, 0.82, (this.height - 4.2) / 4.8) : lerp(0.82, 1.0, (this.height - 9) / 21);
    const dist = this.height / Math.tan(pitch);
    const c = this.cam;
    c.position.set(this.focus.x + Math.sin(this.yaw) * dist, this.focus.y + this.height, this.focus.z + Math.cos(this.yaw) * dist);
    if (this.shake > 0) { c.position.x += (Math.random() - 0.5) * this.shake; c.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 2); }
    c.lookAt(this.focus.x, this.focus.y + 0.8, this.focus.z);
  }
}
