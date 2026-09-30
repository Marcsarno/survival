import * as THREE from 'three';
import { angleLerp, clamp } from '../core/util.js';
import { groundHeight } from '../world/ground.js';
import { SHELTER } from '../world/world.js';
import { Footprints } from './footprints.js';
import { Assets } from '../core/assets.js';

// "The frozen": slow, relentless, drawn to noise and lantern light.
const DAY_SPEED = 1.35, NIGHT_SPEED = 1.9;

export class Zombies {
  constructor(game, spawns) {
    this.game = game; this.list = []; this.spawns = spawns;
    this.prints = new Footprints(game.scene, 500);
    this.flow = new FlowField(game.col);
    this.respawnT = 0;
    spawns.forEach((s, i) => { if (!s.night) this.spawn(s, i); });
  }

  spawn(s, i) {
    const g = this.game;
    const kind = i % 2 ? 'zombie-b' : 'zombie-a';
    const { root, mixer, actions } = g.assets.rigged(kind);
    Assets.fitHeight(root, mixer, actions, 1.72 + (i % 3) * 0.06);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const obj = new THREE.Group(); obj.add(root); g.scene.add(obj);
    obj.position.set(s.x, groundHeight(s.x, s.z), s.z);
    const z = {
      obj, mixer, actions, spawn: s, home: new THREE.Vector3(s.x, 0, s.z), hp: 3, state: 'wander', t: Math.random() * 3,
      yaw: Math.random() * 6, target: null, attackT: 0, stagger: 0, dead: false, deadT: 0, current: null, step: 0, side: 1, groanT: 2 + Math.random() * 6,
      arms: ['L', 'R'].map((k) => [root.getObjectByName('UpperArm' + k), root.getObjectByName('LowerArm' + k), root.getObjectByName('Wrist' + k), k === 'L' ? 1 : -1]), idx: i,
    };
    this.play(z, 'Walk', 0.5);
    this.list.push(z);
    return z;
  }

  play(z, name, speed = 1, once = false) {
    const a = z.actions[name]; if (!a) return;
    if (z.current === a && !once) { a.setEffectiveTimeScale(speed); return; }
    a.reset(); a.setEffectiveTimeScale(speed);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.play(); if (z.current) z.current.crossFadeTo(a, 0.2, false); z.current = a;
  }

  alive() { return this.list.filter((z) => !z.dead); }

  update(dt) {
    const g = this.game, p = g.player.pos, night = g.daynight.nightness;
    this.flow.update(dt, p);
    const safeZone = g.shelter.upgrades.post;
    for (const z of this.list) {
      z.mixer.update(dt);
      if (z.dead) {
        z.deadT += dt;
        if (z.deadT > 6) z.obj.position.y -= dt * 0.25; // sink into the snow
        if (z.deadT > 12) z.obj.visible = false;
        continue;
      }
      const o = z.obj.position;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      // perception: day sight, reduced at night unless the player carries a lit lantern
      let sight = 11 * (1 - night) + 6 * night;
      if (g.player.lanternOn) sight = Math.max(sight, 16);
      const hear = 6 + g.noise * 14;
      const sees = !g.player.dead && (d < hear || (d < sight && !g.col.blocked(o.x, o.z, p.x, p.z, 0.8)));
      z.stagger = Math.max(0, z.stagger - dt);
      z.attackT = Math.max(0, z.attackT - dt);
      z.groanT -= dt;
      if (z.groanT < 0 && d < 26) { z.groanT = 5 + Math.random() * 8; g.audio?.groan(d); }

      let speed = 0, goal = null;
      if (z.stagger > 0) { speed = 0; }
      else if (z.state === 'attack') {
        z.t -= dt;
        if (z.t <= 0) {
          if (d < 1.7 && !g.player.dead) g.player.hurt(9 + night * 4, o);
          z.state = 'chase'; z.attackT = 1.7;
        }
      } else if (sees || (z.state === 'chase' && d < sight + 8)) {
        z.state = 'chase'; goal = p; speed = (DAY_SPEED + (NIGHT_SPEED - DAY_SPEED) * night) * (d < 6 ? 1.15 : 1);
        if (d < 1.25 && z.attackT <= 0 && !g.player.dead) {
          z.state = 'attack'; z.t = 0.7; speed = 0;
          this.play(z, z.idx % 2 ? 'Punch_Left' : 'Punch_Right', 1.1, true);
        }
      } else {
        z.state = 'wander';
        z.t -= dt;
        if (!z.target || z.t <= 0 || Math.hypot(z.target.x - o.x, z.target.z - o.z) < 0.6) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 7;
          z.target = new THREE.Vector3(z.home.x + Math.cos(a) * r, 0, z.home.z + Math.sin(a) * r);
          z.t = 4 + Math.random() * 6;
        }
        goal = z.target; speed = 0.55;
      }
      // the lit lantern post keeps them out of the park
      if (safeZone && goal) {
        const sx = o.x - SHELTER.x, sz = o.z - SHELTER.z;
        if (Math.hypot(sx, sz) < 20) { goal = new THREE.Vector3(SHELTER.x + sx * 2, 0, SHELTER.z + sz * 2); z.state = 'wander'; speed = 1.2; }
      }
      // route around walls, cars and fences with the flow field when the direct line is blocked
      if (goal === p && speed > 0 && d > 2) {
        z.losT = (z.losT || 0) - dt;
        if (z.losT <= 0) { z.losT = 0.35; z.direct = !g.col.blocked(o.x, o.z, p.x, p.z, 0.6); }
        if (!z.direct) { const step = this.flow.next(o.x, o.z); if (step) goal = step; }
      }
      if (goal && speed > 0) {
        const gx = goal.x - o.x, gz = goal.z - o.z, gl = Math.hypot(gx, gz);
        if (gl > 0.05) {
          z.yaw = angleLerp(z.yaw, Math.atan2(gx, gz), 1 - Math.exp(-dt * 5));
          const nx = o.x + Math.sin(z.yaw) * speed * dt, nz = o.z + Math.cos(z.yaw) * speed * dt;
          const r = g.col.resolve(nx, nz, 0.34);
          // avoid stacking on other zombies
          let rx = r.x, rz = r.z;
          for (const q of this.list) if (q !== z && !q.dead) {
            const ex = rx - q.obj.position.x, ez = rz - q.obj.position.z, el = Math.hypot(ex, ez);
            if (el < 0.7 && el > 0.01) { rx += (ex / el) * (0.7 - el) * 0.5; rz += (ez / el) * (0.7 - el) * 0.5; }
          }
          z.step += Math.hypot(rx - o.x, rz - o.z);
          o.set(rx, groundHeight(rx, rz), rz);
          if (z.step > 0.7) { z.step = 0; z.side *= -1; const sx = Math.cos(z.yaw) * 0.12 * z.side, sz = -Math.sin(z.yaw) * 0.12 * z.side; this.prints.add(o.x + sx, o.y, o.z + sz, z.yaw, 0.9); }
        }
      }
      if (z.state !== 'attack' && z.stagger <= 0) this.play(z, speed > 0 ? 'Walk' : 'Idle', speed > 0 ? clamp(speed / 2.2, 0.35, 0.9) : 0.6);
      z.obj.rotation.y = z.yaw;
      // reaching arms: bend upper arms forward after the animation pose
      if (z.state !== 'attack' && z.obj.position.distanceTo(p) < 45) reachArms(z);
    }
    this.prints.update(dt, night > 0.5);
    // night respawns at spawn points far from the player
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = 20;
      const alive = this.alive().length;
      const target = night > 0.5 ? this.spawns.length : this.spawns.filter((s) => !s.night).length;
      if (alive < target) {
        const cand = this.spawns.map((s, i) => [s, i]).filter(([s]) => (night > 0.5 || !s.night) && Math.hypot(s.x - p.x, s.z - p.z) > 40
          && !this.list.some((z) => !z.dead && z.spawn === s));
        if (cand.length) { const [s, i] = cand[Math.floor(Math.random() * cand.length)]; this.cleanup(); this.spawn(s, i); }
      }
    }
  }

  cleanup() {
    this.list = this.list.filter((z) => { if (z.dead && z.deadT > 12) { this.game.scene.remove(z.obj); return false; } return true; });
  }

  damage(z, amount, fromX, fromZ, knock = 0.6) {
    const g = this.game;
    z.hp -= amount; z.stagger = 0.6; z.state = 'chase';
    const o = z.obj.position, dx = o.x - fromX, dz = o.z - fromZ, l = Math.hypot(dx, dz) || 1;
    const r = g.col.resolve(o.x + (dx / l) * knock, o.z + (dz / l) * knock, 0.34); o.x = r.x; o.z = r.z;
    if (z.hp <= 0) {
      z.dead = true; z.deadT = 0; this.play(z, 'Death', 1, true);
      g.stats.kills++; g.audio?.zombieDie();
      g.ui.toast('It stops moving.', 'good');
    } else this.play(z, 'HitRecieve', 1.4, true);
  }

  resetAll() {
    for (const z of this.list) this.game.scene.remove(z.obj);
    this.list = [];
    this.spawns.forEach((s, i) => { if (!s.night) this.spawn(s, i); });
  }
}

// Breadth-first flow field on a 1 m grid around the player (radius ~34 m), rebuilt a few times a second.
// Cells are walkable if a 0.32 m circle there does not touch a collider (cached per cell).
class FlowField {
  constructor(col) { this.col = col; this.walk = new Map(); this.dist = new Map(); this.t = 0; this.R = 34; }
  key(i, j) { return i * 4096 + j; }
  walkable(i, j) {
    const k = this.key(i, j);
    let w = this.walk.get(k);
    if (w === undefined) { const x = i + 0.5, z = j + 0.5; w = !this.col.resolve(x, z, 0.32, 1).hit; this.walk.set(k, w); }
    return w;
  }
  update(dt, p) {
    this.t -= dt; if (this.t > 0) return; this.t = 0.4;
    const pi = Math.floor(p.x), pj = Math.floor(p.z), R = this.R;
    const dist = new Map(); const q = [[pi, pj]]; dist.set(this.key(pi, pj), 0);
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h], d0 = dist.get(this.key(i, j));
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (Math.abs(ni - pi) > R || Math.abs(nj - pj) > R) continue;
        const k = this.key(ni, nj); if (dist.has(k) || !this.walkable(ni, nj)) continue;
        if (di && dj && (!this.walkable(i + di, j) || !this.walkable(i, j + dj))) continue; // no corner cutting
        dist.set(k, d0 + (di && dj ? 1.414 : 1)); q.push([ni, nj]);
      }
    }
    this.dist = dist;
  }
  /** center of the neighboring cell that is closest to the player, or null */
  next(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    let best = null, bd = this.dist.get(this.key(i, j)) ?? Infinity;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const d = this.dist.get(this.key(i + di, j + dj));
      if (d !== undefined && d < bd) { bd = d; best = [i + di, j + dj]; }
    }
    return best ? new THREE.Vector3(best[0] + 0.5, 0, best[1] + 0.5) : null;
  }
}

// Point both arms forward (classic reach) regardless of the rig's bone axes:
// rotate each bone so its child lies along the target direction, in world space.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _p = new THREE.Quaternion();
function aimBone(bone, child, target, amount) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, target);
  bone.getWorldQuaternion(_w); _q.multiply(_w);
  bone.parent.getWorldQuaternion(_p); _p.invert().multiply(_q);
  bone.quaternion.slerp(_p, amount);
  bone.updateMatrixWorld(true);
}
function reachArms(z) {
  z.obj.updateMatrixWorld(true);
  const yaw = z.yaw, sway = Math.sin(performance.now() * 0.002 + z.idx) * 0.08;
  for (const [upper, lower, wrist, side] of z.arms) {
    if (!upper || !lower || !wrist) continue;
    _t.set(Math.sin(yaw) + Math.cos(yaw) * 0.18 * side, -0.28 + sway, Math.cos(yaw) - Math.sin(yaw) * 0.18 * side).normalize();
    aimBone(upper, lower, _t, 0.8);
    aimBone(lower, wrist, _t, 0.7);
  }
}

// ---------------------------------------------------------------- combat
export class Combat {
  constructor(game) {
    this.game = game;
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.flash = new THREE.PointLight('#ffd08a', 0, 10, 2); game.scene.add(this.flash);
    this.tracerMat = new THREE.LineBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0.9 });
    this.tracers = [];
    this.lockTarget = null;
  }

  /** Where the player is aiming: locked zombie (forgiving auto-aim) or the ground point. */
  aimTarget(input) {
    const g = this.game, p = g.player.pos;
    let aimPt = null;
    if (!input.isTouch || input.mouseMoved) {
      const ndc = new THREE.Vector2((input.mouse.x / innerWidth) * 2 - 1, -(input.mouse.y / innerHeight) * 2 + 1);
      this.ray.setFromCamera(ndc, g.camera.cam);
      const hit = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, hit)) aimPt = hit;
    }
    let best = null, bestScore = Infinity;
    for (const z of g.zombies.alive()) {
      const o = z.obj.position, d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d > 18) continue;
      let score;
      if (aimPt) { const m = Math.hypot(o.x - aimPt.x, o.z - aimPt.z); if (m > 3.2) continue; score = m; }
      else { // touch: nearest in front, else nearest overall
        const ang = Math.abs(((Math.atan2(o.x - p.x, o.z - p.z) - g.player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        score = d + ang * 4;
      }
      if (score < bestScore) { bestScore = score; best = z; }
    }
    if (best !== this.lockTarget) { this.lockTarget = best; if (best) g.player.aim.focus = Math.min(g.player.aim.focus, 0.4); }
    return best ? best.obj.position : aimPt;
  }

  fire() {
    const g = this.game, pl = g.player;
    if (pl.cooldown > 0 || pl.dead) return;
    if (g.inv.count('ammo') <= 0) { g.ui.toast('Click. Out of rounds.', 'bad'); g.audio?.click(); pl.cooldown = 0.4; return; }
    g.inv.remove('ammo', 1); pl.cooldown = 0.5;
    pl.oneShot = 'Gun_Shoot'; pl.play('Gun_Shoot', { once: true, speed: 1.6, fade: 0.05 });
    g.audio?.gunshot(); g.noise = 2.5; g.camera.shake = 0.25;
    const muzzle = new THREE.Vector3(); pl.pistol.getWorldPosition(muzzle);
    this.flash.position.copy(muzzle); this.flash.intensity = 40;
    const z = this.lockTarget;
    let end;
    const focus = pl.aim.focus;
    if (z && !z.dead) {
      const o = z.obj.position;
      const clear = !g.col.blocked(pl.pos.x, pl.pos.z, o.x, o.z, 0.5, 'car');
      const chance = 0.6 + 0.4 * focus;       // forgiving: a steady aim always hits
      const hit = clear && Math.random() < chance;
      end = new THREE.Vector3(o.x, 1.3, o.z);
      if (hit) {
        const dmg = focus >= 0.95 ? 3 : 1.5;
        g.zombies.damage(z, dmg, pl.pos.x, pl.pos.z, 0.4);
        if (dmg >= 3 && !z.dead) g.ui.toast('Steady shot.', 'info');
        g.ui.hitMarker();
      } else { end.x += (Math.random() - 0.5) * 2.5; end.z += (Math.random() - 0.5) * 2.5; }
    } else {
      end = muzzle.clone().add(new THREE.Vector3(Math.sin(pl.yaw), 0, Math.cos(pl.yaw)).multiplyScalar(16));
    }
    pl.aim.focus = 0.3;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, end]), this.tracerMat.clone());
    g.scene.add(line); this.tracers.push({ line, t: 0.08 });
    g.stats.shots++;
  }

  melee() {
    const g = this.game, pl = g.player, p = pl.pos;
    let hitAny = false;
    for (const z of g.zombies.alive()) {
      const o = z.obj.position, d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d > 2.0) continue;
      const ang = Math.abs(((Math.atan2(o.x - p.x, o.z - p.z) - pl.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (ang > 1.0) continue;
      if (g.tools.axe) g.zombies.damage(z, 1.1, p.x, p.z, 0.9);
      else { z.stagger = 1.0; g.zombies.damage(z, 0, p.x, p.z, 1.6); }
      hitAny = true;
    }
    if (hitAny) { g.audio?.thud(); g.camera.shake = 0.15; }
  }

  update(dt) {
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 400);
    this.tracers = this.tracers.filter((t) => { t.t -= dt; if (t.t <= 0) { this.game.scene.remove(t.line); t.line.geometry.dispose(); return false; } return true; });
  }
}
