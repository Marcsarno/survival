import * as THREE from 'three';
import { lerp, smoothstep } from '../core/util.js';

// Time of day drives sun/moon light, sky, fog and hemisphere colors.
// One in-game day lasts DAY_SECONDS real seconds.
export const DAY_SECONDS = 24 * 60;

const KEYS = [ // hour, sky, sunColor, sunIntensity, hemiSky, hemiGround, hemiIntensity, fogColor, exposure
  [0, '#0f1728', '#9db3e6', 0.85, '#34466e', '#1d2436', 0.75, '#18213a', 1.0],
  [5, '#1a2338', '#9aa8d0', 0.75, '#3a4872', '#1d2436', 0.75, '#1d2638', 1.0],
  [6.5, '#b99aa2', '#ffc49a', 1.5, '#9fa9cc', '#6a6070', 0.8, '#b8a8b4', 1.0],
  [8, '#bcd0e8', '#ffe2c4', 2.6, '#c6d6ee', '#8a8a96', 1.0, '#c8d6e6', 1.0],
  [12, '#c4d8ee', '#fff4e6', 3.0, '#d2def0', '#8f93a0', 1.05, '#d0dcea', 1.0],
  [16, '#c9cfe0', '#ffe0b8', 2.6, '#c8d0e6', '#8a8490', 0.95, '#cdd2e2', 1.0],
  [18, '#e0a684', '#ffb070', 2.2, '#b8a8c4', '#7a6a6c', 1.0, '#d0a898', 1.0],
  [19.3, '#56507a', '#c090a8', 0.95, '#6470a0', '#34324a', 0.95, '#484a70', 1.0],
  [20.5, '#18223a', '#a8bcec', 1.0, '#44588a', '#252c42', 1.0, '#1e2a48', 1.0],
  [24, '#0f1728', '#9db3e6', 0.85, '#34466e', '#1d2436', 0.75, '#18213a', 1.0],
];
// A muted, overcast late afternoon into dusk (slate-brown and olive): the opening redesign, no snow.
export const MUTED_KEYS = [
  [0, '#1f2128', '#8f97b0', 0.5, '#3a3f50', '#1e1c1a', 0.6, '#24262c', 1.0],
  [16, '#7d776c', '#f0d2a8', 3.0, '#c4bead', '#5d5444', 1.5, '#77716a', 1.0],
  [17.5, '#6e675e', '#efc496', 2.7, '#b8b09e', '#574c3d', 1.45, '#6a645c', 1.0],
  [18.5, '#4d4b50', '#dca682', 1.9, '#9a9aa2', '#463d33', 1.25, '#55524f', 1.0],
  [19.5, '#2f323b', '#a99aa0', 0.6, '#59607a', '#28241f', 0.7, '#34373f', 1.0],
  [24, '#1f2128', '#8f97b0', 0.5, '#3a3f50', '#1e1c1a', 0.6, '#24262c', 1.0],
];
const toCols = (keys) => keys.map((k) => k.map((v) => (typeof v === 'string' ? new THREE.Color(v) : v)));

export class DayNight {
  /** keys: the light table. minSunY: lowest sun elevation factor (a higher sun gives shorter shadows). */
  constructor(scene, renderer, quality, keys = KEYS, { minSunY = 0.45 } = {}) {
    this.scene = scene; this.renderer = renderer; this.cols = toCols(keys); this.minSunY = minSunY;
    this.hour = 8; this.day = 1;
    this.sun = new THREE.DirectionalLight('#fff', 2.5);
    this.sun.castShadow = true;
    const size = quality.low ? 1024 : 2048;
    this.sun.shadow.mapSize.set(size, size);
    const s = this.sun.shadow.camera; s.left = -42; s.right = 42; s.top = 42; s.bottom = -42; s.near = 1; s.far = 160;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfdcf0', '#8a8a96', 1.0);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog('#cdd8e6', 60, 190);
    scene.background = new THREE.Color('#c4d8ee');
    this.nightness = 0;
  }

  /** 0 = full day, 1 = full night */
  get isNight() { return this.nightness > 0.5; }
  timeString() { const h = Math.floor(this.hour), m = Math.floor((this.hour % 1) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

  update(dt, focus) {
    this.hour += (dt / DAY_SECONDS) * 24;
    if (this.hour >= 24) { this.hour -= 24; this.day++; }
    this.apply(focus);
  }

  apply(focus) {
    const h = this.hour, cols = this.cols;
    let i = 0; while (i < cols.length - 2 && cols[i + 1][0] <= h) i++;
    const a = cols[i], b = cols[i + 1];
    const t = (h - a[0]) / (b[0] - a[0]);
    const mix = (k) => a[k].clone().lerp(b[k], t);
    this.scene.background.copy(mix(1));
    this.sun.color.copy(mix(2)); this.sun.intensity = lerp(a[3], b[3], t);
    this.hemi.color.copy(mix(4)); this.hemi.groundColor.copy(mix(5)); this.hemi.intensity = lerp(a[6], b[6], t);
    this.scene.fog.color.copy(mix(7));
    // night factor for gameplay and lights
    this.nightness = h < 6 ? 1 - smoothstep(5, 6.8, h) : smoothstep(18.2, 20.2, h);
    this.scene.fog.near = lerp(60, 26, this.nightness); this.scene.fog.far = lerp(190, 95, this.nightness);
    // sun by day, moon by night: both come from the south-east-ish so shadows read well from the camera
    // the sun swings from south-east to south-south-west but stays on the camera side, so faces read lit;
    // at dusk it hands over smoothly to the moon (no jump in shadow direction)
    const hs = Math.min(19.5, Math.max(6, h)), ang = ((hs - 6) / 13.5) * Math.PI, tday = (hs - 6) / 13.5;
    const sunDir = new THREE.Vector3(lerp(1.0, -0.35, tday), Math.max(this.minSunY, Math.sin(ang)) * 1.1, 0.9).normalize();
    const moonDir = new THREE.Vector3(-0.45, 1.0, 0.6).normalize();
    const toMoon = h > 12 ? smoothstep(19.1, 19.9, h) : 1 - smoothstep(5.2, 6.2, h);
    const dir = sunDir.lerp(moonDir, toMoon).normalize();
    this.sun.position.copy(focus).addScaledVector(dir, 80);
    this.sun.target.position.copy(focus);
  }

  /** jump forward to the next morning (07:00) or evening (20:30) */
  skip() {
    if (this.isNight || this.hour < 7) { if (this.hour > 12) this.day++; this.hour = 7.5; }
    else this.hour = 20.8;
  }
}
