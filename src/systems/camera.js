import * as THREE from 'three';

// Fixed-angle isometric tracking camera. It never rotates: it sits south of the player looking north,
// so up-screen is always north, the direction of travel. The framing puts the player below the
// middle of the screen and leads toward north and toward where the player is moving, so there is
// room to see what lies ahead. Portrait and landscape use different distances and FOVs.
const PORTRAIT = { fov: 52, dist: 22, pitch: 0.86, lead: 6 };   // pitch: radians above the horizon
const LANDSCAPE = { fov: 36, dist: 26, pitch: 0.86, lead: 3.5 };
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
    this.zoom = 1; this.zoomTarget = 1;   // authored per section by the game (1 = default distance)
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
    // lead: always a little north, plus up to ~2.5 m toward the motion (smoothed so stops don't jolt)
    const lx = vel ? Math.max(-2.5, Math.min(2.5, vel.x * 0.55)) : 0;
    const lz = -c.lead + (vel ? Math.max(-2.5, Math.min(2.5, vel.z * 0.55)) : 0);
    const kl = snap ? 1 : 1 - Math.exp(-dt * 1.6);
    this.lead.x += (lx - this.lead.x) * kl; this.lead.z += (lz - this.lead.z) * kl;
    this.zoom += (this.zoomTarget - this.zoom) * (snap ? 1 : 1 - Math.exp(-dt * 0.6));
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.focus.x += (target.x + this.lead.x - this.focus.x) * k;
    this.focus.z += (target.z + this.lead.z - this.focus.z) * k;
    this.focus.y += (target.y - this.focus.y) * (snap ? 1 : 1 - Math.exp(-dt * 3));
    const cam = this.cam;
    const d = this.dist;
    cam.position.set(this.focus.x, this.focus.y + Math.sin(c.pitch) * d, this.focus.z + Math.cos(c.pitch) * d);
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake; cam.position.y += (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 2); }
    cam.lookAt(this.focus.x, this.focus.y + 0.6, this.focus.z);
  }
}
