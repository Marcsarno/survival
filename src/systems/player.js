import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/util.js';
import { Assets } from '../core/assets.js';

// Marc: the Tripo model with its Mixamo-style rig (public/assets/models/marc.glb, blender/build_marc.py).
//
// - One pace: a methodical walk at the walk clip's own speed (about 1.25 m/s), a little slower on
//   sand. No run. Slow to start, slow to turn: he is searching, and it should feel heavy.
// - The clips carry root motion. At load the Hips position track is made in-place (the forward part
//   is removed; the bob and sway stay), and the game moves Marc itself.
// - Idle is the first frame of the Frustrated clip (a neutral stand) plus breathing and a head that
//   turns toward things that matter (lookAt()).
// - The gate: tryGate() plays Frustrated (a kick at the latch while the gate rattles); climbGate()
//   plays the first part of Climb (hands up, haul up) while Marc moves onto the gate line, then he
//   drops down the far side.
// - Step sounds come from foot contacts measured in the walk clip. Prints: distance-based, on sand
//   and leaf litter only.
const HEIGHT = 1.8, ACCEL = 3.2, DECEL = 5.5, TURN_RATE = 4.2, RADIUS = 0.32;
const PACE = { concrete: 1.3, leaves: 1.22, grass: 1.22, sand: 1.05 };
const PRINT_STEP = 0.66;

export class Player {
  constructor(game) {
    this.game = game;
    const { root, mixer, actions } = game.assets.rigged('marc');
    this.root = root; this.mixer = mixer; this.actions = actions;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.roughness = 0.82; o.material.metalness = 0; } } });
    this.bone = (n) => root.getObjectByName('mixamorig' + n) || root.getObjectByName('mixamorig:' + n);
    this.hips = this.bone('Hips'); this.head = this.bone('Head'); this.neck = this.bone('Neck'); this.spine = this.bone('Spine1');
    this.hand = this.bone('LeftHand'); this.feet = { L: this.bone('LeftFoot'), R: this.bone('RightFoot') };
    // the rig faces +z, the direction atan2(dir.x, dir.z) uses (checked against a close camera)
    this.obj = new THREE.Group(); this.obj.add(root); game.scene.add(this.obj);
    this.pos = this.obj.position; this.vel = new THREE.Vector3(); this.yaw = 0; this.speed = 0;

    // clips: measure the walk's natural speed and contacts, then make every clip in-place
    this.clipInfo = {};
    for (const [n, a] of Object.entries(actions)) this.clipInfo[n] = this.measure(a);
    Assets.fitHeight(root, mixer, actions, HEIGHT, 'Frustrated');
    this.scale = root.scale.x;
    for (const [n, a] of Object.entries(actions)) this.inPlace(a.getClip(), this.clipInfo[n], n === 'Climb' ? 0.78 : 1);   // the climb was made for a ledge about 2.2 m high; the gate is 1.75 m
    this.walkSpeed = this.clipInfo.Walk.speed * this.scale;          // m/s at timeScale 1
    this.contacts = this.footContacts(actions.Walk);

    const A = actions;
    A.Idle = mixer.clipAction(poseClip(A.Frustrated.getClip(), 0, 'Idle'), root);   // the neutral stand that opens Frustrated
    for (const n of ['Idle', 'Walk']) { const a = A[n]; a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.play(); a.setEffectiveWeight(n === 'Idle' ? 1 : 0); }
    A.Idle.setEffectiveTimeScale(0.15);
    for (const n of ['Frustrated', 'Climb']) { A[n].setLoop(THREE.LoopOnce, 1); A[n].clampWhenFinished = true; }
    this.frozen = false; this.carrying = null; this.seq = null; this.look = null; this.lookW = 0;
    this.footfalls = 0; this.stepAcc = 0; this.printSide = 1; this.lastGround = 'concrete'; this.walkPrev = 0;
    this.breath = 0;
  }

  /** Root motion of a clip in the hips track: which axis is up and which are horizontal, and the forward speed. */
  measure(action) {
    const clip = action.getClip(), tr = clip.tracks.find((t) => /Hips\.position$/.test(t.name));
    if (!tr) return { speed: 1, up: 1, horiz: [0, 2] };
    const v = tr.values, n = v.length / 3, first = [v[0], v[1], v[2]], last = [v[(n - 1) * 3], v[(n - 1) * 3 + 1], v[(n - 1) * 3 + 2]];
    const mean = [0, 1, 2].map((k) => { let s = 0; for (let i = 0; i < n; i++) s += v[i * 3 + k]; return s / n; });
    // the up axis: the one the hips sit high on at the start (feet at 0); horizontal: the other two
    const up = [0, 1, 2].reduce((a, k) => (Math.abs(first[k]) > Math.abs(first[a]) && Math.abs(mean[k]) > 0.2 ? k : a), 1);
    const horiz = [0, 1, 2].filter((k) => k !== up);
    const d = Math.hypot(...horiz.map((k) => last[k] - first[k]));
    return { speed: d / clip.duration, up, horiz, first, track: tr.name };
  }

  /** Remove horizontal root motion (keep the bob). Walk keeps its side-to-side sway around the trend. rise scales the vertical travel. */
  inPlace(clip, info, rise = 1) {
    const tr = clip.tracks.find((t) => /Hips\.position$/.test(t.name)); if (!tr) return;
    const v = tr.values, n = v.length / 3, times = tr.times, T = times[n - 1] || 1;
    if (rise !== 1) { const y0 = v[info.up]; for (let i = 0; i < n; i++) v[i * 3 + info.up] = y0 + (v[i * 3 + info.up] - y0) * rise; }
    for (const k of info.horiz) {
      const a = v[k], b = v[(n - 1) * 3 + k];
      for (let i = 0; i < n; i++) v[i * 3 + k] -= a + (b - a) * (times[i] / T);
    }
  }

  /** Foot contact times in the (in-place) walk: when each foot is lowest. */
  footContacts(action) {
    const clip = action.getClip(), N = 72, L = this.feet.L, R = this.feet.R, out = [];
    if (!L || !R) return [0, clip.duration / 2];
    const p = new THREE.Vector3(), hl = [], hr = [];
    for (const a of Object.values(this.actions)) a.stop();
    action.reset().play(); action.setEffectiveWeight(1);
    for (let i = 0; i < N; i++) { action.time = (i / N) * clip.duration; this.mixer.update(0); this.root.updateMatrixWorld(true); hl.push(L.getWorldPosition(p).y); hr.push(R.getWorldPosition(p).y); }
    action.stop();
    for (const h of [hl, hr]) { let best = 0; for (let i = 0; i < N; i++) if (h[i] < h[best]) best = i; out.push((best / N) * clip.duration); }
    return out;
  }

  setPosition(x, z, yaw) {
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.speed = 0; this.seq = null; this.stepAcc = 0;
    if (yaw !== undefined) { this.yaw = yaw; this.obj.rotation.y = yaw; }
    for (const n of ['Frustrated', 'Climb']) this.actions[n].stop();
  }

  carry(obj) {
    this.carrying = obj;
    const ws = new THREE.Vector3(); this.root.updateMatrixWorld(true); this.hand.getWorldScale(ws);
    obj.scale.setScalar(1 / ws.x); obj.position.set(0, -0.06 / ws.x, 0.05 / ws.x); obj.rotation.set(Math.PI, 0, 0.4);
    this.hand.add(obj);
  }

  /** Look at a world point (x, z) or stop (null). The head and neck turn, limited. */
  lookAt(p) { this.look = p; }

  // ---------------------------------------------------------------- the gate
  tryGate(onKick, onDone) {
    const A = this.actions, f = A.Frustrated;
    this.seq = { kind: 'try', t: 0, dur: f.getClip().duration * 0.92, onKick, onDone, kicked: false };
    f.reset(); f.setEffectiveTimeScale(1); f.setEffectiveWeight(1); f.fadeIn(0.25); f.play();
  }
  climbGate(gateZ, gateX, dir, onTop, onDone) {
    const A = this.actions, c = A.Climb, clip = c.getClip();
    const t0 = clip.duration * (8 / 84), t1 = clip.duration * (47 / 84);
    this.yaw = dir < 0 ? Math.PI : 0; this.obj.rotation.y = this.yaw;
    this.seq = { kind: 'climb', t: 0, dur: (t1 - t0) / 0.95, t0, t1, from: new THREE.Vector3(gateX, 0, gateZ - dir * 0.55), over: new THREE.Vector3(gateX, 0, gateZ), to: new THREE.Vector3(gateX, 0, gateZ + dir * 0.85), onTop, onDone, phase: 'up' };
    this.pos.copy(this.seq.from); this.vel.set(0, 0, 0);
    c.reset(); c.time = t0; c.setEffectiveTimeScale(0.95); c.setEffectiveWeight(1); c.fadeIn(0.2); c.play();
  }

  update(dt, input, cam) {
    const g = this.game, A = this.actions;
    if (this.seq) this.updateSeq(dt);
    else {
      const mv = this.frozen || g.ui.modal ? { x: 0, y: 0, len: 0 } : input.moveVector();
      const dir = new THREE.Vector3(mv.x, 0, mv.y);
      const hasInput = mv.len > 0.12;
      if (hasInput) dir.normalize();
      const ground = g.groundAt(this.pos.x, this.pos.z);
      let target = hasInput ? PACE[ground] * Math.min(1, 0.35 + (mv.len - 0.12) / 0.6) : 0;
      if (hasInput) {
        const want = Math.atan2(dir.x, dir.z), diff = Math.abs(wrap(want - this.yaw));
        target *= 0.25 + 0.75 * Math.max(0, Math.cos(diff * 0.85));
        this.yaw = turnToward(this.yaw, want, TURN_RATE * dt, 1 - Math.exp(-dt * 7));
      }
      const tvx = dir.x * target, tvz = dir.z * target;
      const dvx = tvx - this.vel.x, dvz = tvz - this.vel.z, dl = Math.hypot(dvx, dvz);
      const maxDv = (target > Math.hypot(this.vel.x, this.vel.z) ? ACCEL : DECEL) * dt;
      if (dl > maxDv) { this.vel.x += (dvx / dl) * maxDv; this.vel.z += (dvz / dl) * maxDv; } else { this.vel.x = tvx; this.vel.z = tvz; }
      if (!hasInput && Math.hypot(this.vel.x, this.vel.z) < 0.04) this.vel.set(0, 0, 0);
      const ox = this.pos.x, oz = this.pos.z;
      let x = ox, z = oz;
      const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.15));
      for (let i = 0; i < steps; i++) { let r = g.col.resolve(x + (this.vel.x * dt) / steps, z + (this.vel.z * dt) / steps, RADIUS); r = g.clampToRoute(r.x, r.z, RADIUS); x = r.x; z = r.z; }
      const moved = Math.hypot(x - ox, z - oz);
      if (dt > 0) { this.vel.x = (x - ox) / dt; this.vel.z = (z - oz) / dt; }
      this.pos.set(x, 0, z);
      this.speed += ((dt > 0 ? moved / dt : 0) - this.speed) * (1 - Math.exp(-dt * 10));
      this.lastGround = ground;
      // prints on soft ground
      if ((ground === 'sand' || ground === 'leaves') && moved > 0) {
        this.stepAcc += moved;
        while (this.stepAcc >= PRINT_STEP) {
          this.stepAcc -= PRINT_STEP; this.printSide *= -1;
          const ux = (x - ox) / moved, uz = (z - oz) / moved, yaw = Math.atan2(ux, uz);
          g.footprints.add(x + Math.cos(yaw) * 0.11 * this.printSide, 0.0, z - Math.sin(yaw) * 0.11 * this.printSide, yaw, ground === 'sand' ? 0.9 : 0.55, this.printSide, 1.05);
        }
      }
      // blend idle and walk; walk plays at the rate that matches the ground speed
      const w = smoothstep(0.05, 0.45, this.speed);
      A.Walk.setEffectiveWeight(w); A.Idle.setEffectiveWeight(1 - w);
      A.Walk.setEffectiveTimeScale(Math.max(0.3, this.speed / this.walkSpeed));
      // footsteps on contacts
      const wt = A.Walk.time;
      if (w > 0.5) for (const c of this.contacts) if ((this.walkPrev < c && wt >= c) || (wt < this.walkPrev && (c > this.walkPrev || c <= wt))) { g.audio?.step(ground); this.footfalls++; }
      this.walkPrev = wt;
    }
    this.obj.rotation.y = this.yaw;
    // undo last frame's procedural offsets first: the mixer does not rewrite a bone whose pose is unchanged
    for (const m of this._mods || []) m.bone.quaternion.copy(m.base);
    this.mixer.update(dt);
    this.postPose(dt);
  }

  updateSeq(dt) {
    const s = this.seq, A = this.actions, g = this.game;
    s.t += dt;
    A.Walk.setEffectiveWeight(0);
    if (s.kind === 'try') {
      A.Idle.setEffectiveWeight(Math.max(0, 1 - s.t / 0.25) * 0 + 0.0001);
      if (!s.kicked && s.t > s.dur * 0.3) { s.kicked = true; s.onKick?.(); }
      if (s.t >= s.dur) { A.Frustrated.fadeOut(0.35); A.Idle.setEffectiveWeight(1); this.seq = null; s.onDone?.(); }
      return;
    }
    // climb: up the gate (clip), forward onto the gate line (game); then the drop
    if (s.phase === 'up') {
      const k = Math.min(1, s.t / s.dur), e = k * k * (3 - 2 * k);
      this.pos.lerpVectors(s.from, s.over, e); this.pos.y = 0;
      A.Idle.setEffectiveWeight(0.0001);
      if (k >= 1) {
        // keep the body where it is while the pose changes, then fall to the ground on the far side
        this.root.updateMatrixWorld(true); const hy = this.hips.getWorldPosition(new THREE.Vector3()).y;
        s.phase = 'drop'; s.t = 0; s.hipsTop = hy; s.y0 = null;
        A.Climb.fadeOut(0.3); A.Idle.reset().play(); A.Idle.setEffectiveWeight(1); A.Idle.fadeIn(0.3);
        s.onTop?.();
      }
      return;
    }
    if (s.phase === 'drop') {
      if (s.y0 == null) { // after one frame in the new pose: lift Marc so the hips start where they were
        this.root.updateMatrixWorld(true); const hy = this.hips.getWorldPosition(new THREE.Vector3()).y - this.pos.y;
        s.y0 = Math.max(0, s.hipsTop - hy); s.t = 0;
      }
      const D = 0.55, k = Math.min(1, s.t / D);
      this.pos.lerpVectors(s.over, s.to, Math.sin(k * Math.PI / 2));
      this.pos.y = s.y0 * (1 - k * k) - (k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.12 : 0);
      if (k >= 1) { this.pos.y = 0; this.seq = null; g.audio?.step('grass'); g.audio?.thud?.(); s.onDone?.(); }
    }
  }

  /** After the mixer: breathing, the head turning toward what matters. */
  postPose(dt) {
    this.breath += dt;
    this._mods = [this.spine, this.neck, this.head].filter(Boolean).map((bone) => ({ bone, base: bone.quaternion.clone() }));
    const idle = this.actions.Idle.getEffectiveWeight();
    if (this.spine) this.spine.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(this.breath * 1.6) * 0.02 * idle));
    let wantW = 0, yawOff = 0, pitch = 0;
    if (this.look && !this.seq) {
      const dx = this.look.x - this.pos.x, dz = this.look.z - this.pos.z, d = Math.hypot(dx, dz);
      const rel = wrap(Math.atan2(dx, dz) - this.yaw);
      if (d < (this.look.r || 9) && Math.abs(rel) < 1.9) { wantW = 1; yawOff = clamp(rel, -1.1, 1.1); pitch = clamp(0.35 - d * 0.04, 0, 0.35); }
    }
    this.lookW += (wantW - this.lookW) * (1 - Math.exp(-dt * 2.5));
    this.lookYaw = lerp(this.lookYaw || 0, yawOff, 1 - Math.exp(-dt * 3));
    if (this.head && this.lookW > 0.01) {
      // rotate about the world up axis, split between neck and head
      const q = new THREE.Quaternion();
      for (const [b, f] of [[this.neck, 0.4], [this.head, 0.6]]) {
        if (!b) continue;
        const parentQ = b.parent.getWorldQuaternion(new THREE.Quaternion());
        const upLocal = new THREE.Vector3(0, 1, 0).applyQuaternion(parentQ.clone().invert());
        q.setFromAxisAngle(upLocal.normalize(), this.lookYaw * f * this.lookW);
        b.quaternion.premultiply(q);
        b.updateMatrixWorld(true);
      }
    }
  }
}

/** A two-key clip that holds a clip's pose at time t (a still pose to blend with). */
function poseClip(clip, t, name) {
  const tracks = clip.tracks.map((tr) => {
    const it = tr.createInterpolant(), v = Array.from(it.evaluate(t));
    return new tr.constructor(tr.name, [0, 1], [...v, ...v]);
  });
  return new THREE.AnimationClip(name, 1, tracks);
}
function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
function turnToward(from, to, maxStep, k) { const d = wrap(to - from); return from + clamp(d * k, -maxStep, maxStep); }
