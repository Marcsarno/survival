import * as THREE from 'three';

// Fixed-angle isometric tracking camera. It never rotates: it sits south of the player looking north,
// so up-screen is always north, the direction of travel. The framing puts the player below the
// middle of the screen and leads toward north and toward where the player is moving, so there is
// room to see what lies ahead. Portrait and landscape use different distances and FOVs.
// Neighborhood pass: closer and a little lower than pass 2, so doors, windows, posture and the depth
// between houses read. Two candidates were captured on the same views (hub, Opening redesign):
//   pass2  fov 46, dist 17.5, pitch 0.87 (50°)  Marc about 8% of the screen height
//   A      fov 42, dist 14.0, pitch 0.75 (43°)  Marc about 12%
//   B      fov 40, dist 12.0, pitch 0.64 (37°)  Marc about 16%
// ?camset=pass2|a|b picks one; ?cam=fov,dist,pitch,lead overrides the numbers.
const CAMSETS = {
  pass2: { portrait: { fov: 46, dist: 17.5, pitch: 0.87, lead: 1.3 }, landscape: { fov: 34, dist: 24, pitch: 0.87, lead: 1.2 } },
  a: { portrait: { fov: 42, dist: 14.0, pitch: 0.75, lead: 0.45 }, landscape: { fov: 34, dist: 19, pitch: 0.75, lead: 1.5 } },
  b: { portrait: { fov: 40, dist: 12.0, pitch: 0.64, lead: 0.6 }, landscape: { fov: 32, dist: 17, pitch: 0.66, lead: 1.8 } },
};
export const CAMSET = new URLSearchParams(location.search).get('camset') || 'a';
const PORTRAIT = { ...(CAMSETS[CAMSET] || CAMSETS.a).portrait };    // pitch: radians above the horizon
const LANDSCAPE = { ...(CAMSETS[CAMSET] || CAMSETS.a).landscape };
// tuning aid: ?cam=fov,dist,pitch,lead overrides the portrait (or landscape) values
const q = new URLSearchParams(location.search).get('cam');
if (q) { const [fov, dist, pitch, lead] = q.split(',').map(Number); for (const c of [PORTRAIT, LANDSCAPE]) Object.assign(c, { fov: fov || c.fov, dist: dist || c.dist, pitch: pitch || c.pitch, lead: lead ?? c.lead }); }

export class FollowCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(PORTRAIT.fov, aspect, 0.5, 260);
    this.yaw = 0;            // fixed; kept as a field so tools can read the basis
    this.focus = new THREE.Vector3();
    this.lead = new THREE.Vector3();
    this.shake = 0;
    this.zoom = 1; this.zoomTarget = 1;   // authored per area by the game (1 = default distance)
    this.bias = { x: 0, z: 0, w: 0 }; this.biasTarget = null; // authored pull of the focus toward a point (no rotation)
    this.setAspect(aspect);
  }
  setAspect(aspect) {
    this.cfg = aspect < 0.9 ? PORTRAIT : LANDSCAPE;
    this.cam.fov = this.cfg.fov; this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
  }
  /** ground unit vectors for screen-up and screen-right: always north and east */
  basis() { return { forward: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(1, 0, 0) }; }
  get dist() { return this.cfg.dist * this.zoom; }

  /** target: player position; vel: player velocity (m/s) for a small look-ahead in the direction of motion */
  update(dt, target, vel, snap = false) {
    const c = this.cfg;
    // lead: always a little north, plus up to ~1.6–2 m toward the motion (smoothed so stops don't jolt)
    const lx = vel ? Math.max(-2.0, Math.min(2.0, vel.x * 0.45)) : 0;
    const lz = -c.lead + (vel ? Math.max(-1.6, Math.min(1.6, vel.z * 0.4)) : 0);
    const kl = snap ? 1 : 1 - Math.exp(-dt * 1.6);
    this.lead.x += (lx - this.lead.x) * kl; this.lead.z += (lz - this.lead.z) * kl;
    this.zoom += (this.zoomTarget - this.zoom) * (snap ? 1 : 1 - Math.exp(-dt * 0.6));
    const bt = this.biasTarget || { x: this.bias.x, z: this.bias.z, w: 0 }, kb = snap ? 1 : 1 - Math.exp(-dt * 0.9);
    this.bias.x += (bt.x - this.bias.x) * kb; this.bias.z += (bt.z - this.bias.z) * kb; this.bias.w += (bt.w - this.bias.w) * kb;
    const fx = target.x + this.lead.x, fz = target.z + this.lead.z, w = this.bias.w;
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    // mostly sideways framing; only a little forward, so Marc stays above the subtitles and the thumb
    const bx = Math.max(-2.6, Math.min(2.6, (this.bias.x - fx) * w)), bz = Math.max(-1.0, Math.min(1.0, (this.bias.z - fz) * w));
    this.focus.x += (fx + bx - this.focus.x) * k;
    this.focus.z += (fz + bz - this.focus.z) * k;
    this.focus.y += (target.y - this.focus.y) * (snap ? 1 : 1 - Math.exp(-dt * 3));
    const cam = this.cam;
    const d = this.dist;
    cam.position.set(this.focus.x, this.focus.y + Math.sin(c.pitch) * d, this.focus.z + Math.cos(c.pitch) * d);
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake; cam.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 2); }
    cam.lookAt(this.focus.x, this.focus.y + 0.6, this.focus.z);
  }
}
