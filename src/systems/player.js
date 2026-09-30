import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/util.js';
import { groundHeight } from '../world/ground.js';
import { PAL } from '../palette.js';
import { Assets } from '../core/assets.js';

// Stand-in locomotion for Marc. The Quaternius Adventurer is a placeholder until a final model exists;
// re-measure and retune when it is replaced.
//
// - Speed comes from the ground under the feet (pavement > packed trail > snow > deep snow).
//   Jog (Shift / touch toggle) is a modest step up, not a sprint.
// - Velocity accelerates and decelerates; sharp direction changes slow you until you have turned.
// - Collisions slide along walls, and the velocity keeps only what actually moved, so no momentum
//   builds against a wall.
// - Idle, Walk and Run play together with speed-driven weights. Walk and Run are phase-locked and
//   play at the rate whose stride matches the ground speed. Each clip's stride and foot-contact
//   timing are measured from the foot bones at load time, which keeps foot sliding low.
// - Footprints are footfall-driven: when the gait phase passes a measured contact point, a print is
//   placed under that foot bone. onFootfall() is the single integration point; a final rig with
//   proper contact events can call it directly. A distance-based stepper is kept as a fallback
//   when the foot bones are missing.
export const SPEED = { paved: 3.2, trail: 2.95, snow: 2.6, ice: 2.4, deepTrail: 2.3, deep: 1.95 };
const JOG = 1.42, ACCEL = 8, DECEL = 11, TURN_RATE = 10, RADIUS = 0.34, HEIGHT = 1.8;
const RUN_BLEND = [2.2, 3.4];   // m/s: walk → run blend range

export class Player {
  constructor(game) {
    this.game = game;
    const { root, mixer, actions } = game.assets.rigged('player');
    this.root = root; this.mixer = mixer; this.actions = actions;
    Assets.fitHeight(root, mixer, actions, HEIGHT);
    // The Adventurer rig faces -z. An inner pivot turns it around so yaw 0 faces +z, the direction
    // used by atan2(dir.x, dir.z). (The baseline build skipped this, so Marc walked backwards.)
    this.pivot = new THREE.Group(); this.pivot.rotation.y = Math.PI; this.pivot.add(root);
    this.obj = new THREE.Group(); this.obj.add(this.pivot); game.scene.add(this.obj);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.feet = { L: root.getObjectByName('FootL'), R: root.getObjectByName('FootR') };
    this.lantern = game.assets.clone('lantern');
    this.lanternLight = new THREE.PointLight(PAL.lanternLight, 0, 13, 1.6);
    this.lanternLight.position.set(0, -0.22, 0);
    this.lantern.add(this.lanternLight);
    this.attach(this.lantern, root.getObjectByName('WristL'), [0, -0.05, 0.03]);
    // soft fill so the character reads at dusk (tiny radius, no shadows)
    this.fill = new THREE.PointLight('#b8c8ff', 0, 7, 1.6); game.scene.add(this.fill);
    // faint ground ring that stays visible through canopies
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 24), new THREE.MeshBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.22, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 10; ring.position.y = 0.05; this.obj.add(ring);

    this.pos = this.obj.position; this.vel = new THREE.Vector3(); this.yaw = 0; this.speed = 0;
    this.lanternOn = false; this.frozen = false;
    this.stepAcc = 0; this.side = 1; this.footfalls = 0; this.phase = 0;
    this.gait = { Walk: this.measureGait('Walk'), Run: this.measureGait('Run') };
    this.footDriven = !!(this.feet.L && this.feet.R && this.gait.Walk.measured && this.gait.Run.measured);
    for (const n of ['Idle', 'Walk', 'Run']) { const a = actions[n]; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveWeight(n === 'Idle' ? 1 : 0); a.play(); }
  }

  attach(obj, bone, p = [0, 0, 0], r = [0, 0, 0]) {
    const ws = new THREE.Vector3(); this.root.updateMatrixWorld(true); bone.getWorldScale(ws);
    obj.scale.setScalar(1 / ws.x); obj.position.set(p[0] / ws.x, p[1] / ws.x, p[2] / ws.x); obj.rotation.set(...r);
    bone.add(obj);
  }

  /**
   * Measure an in-place loop from its foot bones: the planted (lower) foot's speed backward is the
   * clip's natural ground speed (median over the loop); `cycle` is the distance covered per loop; `contact` is the loop
   * phase (0..1) at which the left foot plants (the right foot plants half a cycle later).
   */
  measureGait(name) {
    const a = this.actions[name], { L, R } = this.feet;
    const dur = a?.getClip().duration || 1;
    const fallback = name === 'Run' ? { speed: 4.2, dur, cycle: 4.2 * dur, contact: 0, measured: false } : { speed: 1.4, dur, cycle: 1.4 * dur, contact: 0, measured: false };
    if (!a || !L || !R) return fallback;
    const N = 120, pl = new THREE.Vector3(), pr = new THREE.Vector3();
    for (const x of Object.values(this.actions)) x.stop();
    a.reset().play(); a.setEffectiveWeight(1);
    let prev = null, contact = null; const v = [];
    for (let i = 0; i <= N; i++) {
      a.time = (i / N) * dur; this.mixer.update(0); this.root.updateMatrixWorld(true);
      L.getWorldPosition(pl); R.getWorldPosition(pr);
      const stance = pl.y < pr.y ? 'L' : 'R', z = stance === 'L' ? pl.z : pr.z;
      if (prev && prev.stance === stance) v.push(Math.abs(z - prev.z) / (dur / N));
      if (prev && prev.stance === 'R' && stance === 'L' && contact === null) contact = i / N;
      prev = { stance, z };
    }
    a.stop();
    // median speed of the planted foot (robust to the frames where the feet swap)
    v.sort((p, q) => p - q);
    const speed = v.length ? v[Math.floor(v.length / 2)] : 0;
    if (!(speed > 0.3 && speed < 12)) return fallback;
    return { speed, dur, cycle: speed * dur, contact: contact ?? 0, measured: true };
  }

  setPosition(x, z, yaw) {
    this.pos.set(x, groundHeight(x, z), z); this.vel.set(0, 0, 0); this.speed = 0; this.stepAcc = 0;
    if (yaw !== undefined) { this.yaw = yaw; this.obj.rotation.y = yaw; }
  }

  update(dt, input, cam) {
    const g = this.game;
    // ---- desired motion (screen-relative with a fixed camera: up = north)
    const mv = this.frozen || g.ui.modal ? { x: 0, y: 0, len: 0 } : input.moveVector();
    const { forward, right } = cam.basis();
    const dir = new THREE.Vector3().addScaledVector(right, mv.x).addScaledVector(forward, -mv.y);
    const hasInput = mv.len > 0.12;
    if (hasInput) dir.normalize();
    const ground = g.groundAt(this.pos.x, this.pos.z);
    const jog = hasInput && (input.down('shift') || input.touch.jogToggle);
    let target = hasInput ? SPEED[ground] * (jog ? (ground.startsWith('deep') ? 1.25 : JOG) : 1) * Math.min(1, (mv.len - 0.12) / 0.7) : 0;
    if (hasInput) {
      // turning: moving against the way you face is slow until you have turned
      const want = Math.atan2(dir.x, dir.z);
      const diff = Math.abs(wrap(want - this.yaw));
      target *= 0.35 + 0.65 * Math.max(0, Math.cos(diff * 0.9));
      // uphill costs a little
      const ahead = groundHeight(this.pos.x + dir.x * 0.6, this.pos.z + dir.z * 0.6) - this.pos.y;
      target *= clamp(1 - Math.max(0, ahead / 0.6) * 0.9, 0.7, 1);
      this.yaw = turnToward(this.yaw, want, TURN_RATE * dt, 1 - Math.exp(-dt * 14));
    }
    // ---- accelerate toward the target velocity
    const tvx = dir.x * target, tvz = dir.z * target;
    const dvx = tvx - this.vel.x, dvz = tvz - this.vel.z, dl = Math.hypot(dvx, dvz);
    const maxDv = (target > Math.hypot(this.vel.x, this.vel.z) ? ACCEL : DECEL) * dt;
    if (dl > maxDv) { this.vel.x += (dvx / dl) * maxDv; this.vel.z += (dvz / dl) * maxDv; } else { this.vel.x = tvx; this.vel.z = tvz; }
    if (!hasInput && Math.hypot(this.vel.x, this.vel.z) < 0.05) this.vel.set(0, 0, 0);
    // ---- move with collision; keep only the velocity that actually happened
    const ox = this.pos.x, oz = this.pos.z;
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.2));
    let x = ox, z = oz;
    for (let i = 0; i < steps; i++) {
      let r = g.col.resolve(x + (this.vel.x * dt) / steps, z + (this.vel.z * dt) / steps, RADIUS);
      r = g.clampToRoute(r.x, r.z, RADIUS);
      x = r.x; z = r.z;
    }
    const moved = Math.hypot(x - ox, z - oz);
    if (dt > 0) { this.vel.x = (x - ox) / dt; this.vel.z = (z - oz) / dt; }
    this.pos.x = x; this.pos.z = z; this.pos.y = groundHeight(x, z);
    if (!hasInput && moved > 0.01) this.yaw = turnToward(this.yaw, Math.atan2(this.vel.x, this.vel.z), TURN_RATE * dt * 0.5, 0.2);
    this.obj.rotation.y = this.yaw;
    const inst = dt > 0 ? moved / dt : 0;
    this.speed += (inst - this.speed) * (1 - Math.exp(-dt * 12)); // smoothed for animation weights

    // ---- animation: phase-locked walk/run blend at the stride that matches ground speed
    const v = this.speed, W = this.gait.Walk, Rn = this.gait.Run, a = this.actions;
    const wr = smoothstep(RUN_BLEND[0], RUN_BLEND[1], v), move = smoothstep(0.06, 0.5, v);
    const cycle = lerp(W.cycle, Rn.cycle, wr);             // meters per loop at this blend
    const prevPhase = this.phase;
    this.phase = (this.phase + (v * dt) / cycle) % 1;      // one shared gait phase
    a.Walk.time = ((this.phase + W.contact) % 1) * W.dur;  // phase 0 = left foot plants, in both clips
    a.Run.time = ((this.phase + Rn.contact) % 1) * Rn.dur;
    a.Walk.setEffectiveTimeScale(0); a.Run.setEffectiveTimeScale(0);  // time is driven directly
    a.Idle.setEffectiveWeight(1 - move); a.Walk.setEffectiveWeight(move * (1 - wr)); a.Run.setEffectiveWeight(move * wr);
    this.mixer.update(dt);

    // ---- footprints
    if (this.footDriven) {
      // contacts at phase 0 (left) and 0.5 (right); handle wrap-around and several contacts in one long frame
      const travelled = (v * dt) / cycle;
      if (v > 0.2 && travelled > 0) {
        for (const [ph, side] of [[0, -1], [0.5, 1]]) {
          const d = ((ph - prevPhase) % 1 + 1) % 1;
          if (d > 0 && d <= travelled) this.footfallFromBone(side, ground, v > 3.3);
        }
      }
    } else if (moved > 0) {
      // fallback: distance-based, one print per half cycle
      const ux = (x - ox) / moved, uz = (z - oz) / moved, step = cycle / 2;
      this.stepAcc += moved;
      while (this.stepAcc >= step) { this.stepAcc -= step; this.side *= -1; const along = moved - this.stepAcc; this.onFootfall(this.side, ox + ux * along, oz + uz * along, Math.atan2(ux, uz), ground, v > 3.3); }
    }

    // ---- lantern and night fill
    if ((input.hit('l') || input.tHit('lantern')) && !g.ui.modal) { this.lanternOn = !this.lanternOn; g.audio?.click(); }
    this.lantern.visible = this.lanternOn;
    const night = g.daynight.nightness;
    this.fill.intensity = 1.5 + 4 * night;
    this.fill.position.set(this.pos.x, this.pos.y + 2.3, this.pos.z + 1.6);
    const flick = 1 + Math.sin(performance.now() * 0.013) * 0.05 + Math.sin(performance.now() * 0.031) * 0.04;
    this.lanternLight.intensity = this.lanternOn ? (6 + 12 * night) * flick : 0;
    this.lantern.traverse((o) => { if (o.isMesh && o.material.name === 'LanternGlow') o.material.emissiveIntensity = this.lanternOn ? 3 : 0.05; });
  }

  footfallFromBone(side, ground, jogging) {
    const bone = side < 0 ? this.feet.L : this.feet.R, p = new THREE.Vector3();
    this.obj.updateMatrixWorld(true); bone.getWorldPosition(p);
    // the ankle bone sits behind the middle of the sole: nudge the print a little toward the toes
    this.onFootfall(side, p.x + Math.sin(this.yaw) * 0.06, p.z + Math.cos(this.yaw) * 0.06, this.yaw, ground, jogging, true);
  }

  /**
   * A foot touched the ground. side: -1 left, +1 right. atFoot: (x, z) is already the foot position;
   * otherwise it is the body position and the print is offset sideways by half the stance width.
   */
  onFootfall(side, x, z, yaw, ground, jogging, atFoot = false) {
    const g = this.game;
    let fx = x, fz = z;
    if (!atFoot) { fx += Math.cos(yaw) * 0.13 * side + Math.sin(yaw) * 0.12; fz += -Math.sin(yaw) * 0.13 * side + Math.cos(yaw) * 0.12; }
    const deep = ground.startsWith('deep');
    const strength = ground === 'paved' ? 0.3 : ground === 'ice' ? 0.25 : deep ? 1.25 : ground === 'trail' ? 0.85 : 1;
    g.footprints.add(fx, groundHeight(fx, fz), fz, yaw, strength, side, deep ? 1.18 : 1);
    g.audio?.step(ground === 'paved' || ground === 'ice' ? 'paved' : 'snow', jogging);
    this.footfalls++;
  }
}

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
/** turn toward `to` by at most `maxStep` radians, eased by factor k */
function turnToward(from, to, maxStep, k) {
  const d = wrap(to - from);
  return from + clamp(d * k, -maxStep, maxStep);
}
