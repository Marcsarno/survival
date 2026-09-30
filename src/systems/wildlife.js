import * as THREE from 'three';
import { angleLerp } from '../core/util.js';
import { groundHeight } from '../world/ground.js';
import { SHELTER } from '../world/world.js';
import { Footprints } from './footprints.js';
import { Assets } from '../core/assets.js';

// Wildlife: rigged deer / fox / wolf / dog (Quaternius) and static rabbit / duck / owl (Poly by Google),
// animated procedurally. Animals flee the player; the stray dog can be befriended with food.
const SIZE = { deer: 1.45, fox: 0.5, wolf: 0.85, dog: 0.62 };
const FLEE = { deer: 10, fox: 7, wolf: 8, rabbit: 5, duck: 6 };

export class Wildlife {
  constructor(game, spawns) {
    this.game = game; this.list = [];
    this.prints = new Footprints(game.scene, 400, true);
    for (const s of spawns) this.add(s);
  }

  add(s) {
    const g = this.game;
    const a = { ...s, t: Math.random() * 4, yaw: Math.random() * 6, state: 'idle', step: 0, current: null, home: new THREE.Vector3(s.x, 0, s.z) };
    if (SIZE[s.kind]) {
      const { root, mixer, actions } = g.assets.rigged(s.kind);
      Assets.fitHeight(root, mixer, actions, SIZE[s.kind]);
      root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      a.obj = new THREE.Group(); a.obj.add(root); a.mixer = mixer; a.actions = actions;
      this.play(a, s.stray ? 'Idle_2' : 'Idle');
    } else {
      a.obj = new THREE.Group(); a.obj.add(g.assets.clone(s.kind));
    }
    a.obj.position.set(s.x, s.kind === 'duck' ? -0.32 : s.perch || groundHeight(s.x, s.z), s.z);
    g.scene.add(a.obj);
    this.list.push(a);
    return a;
  }

  play(a, name, speed = 1) {
    const act = a.actions?.[name]; if (!act) return;
    if (a.current === act) { act.setEffectiveTimeScale(speed); return; }
    act.reset(); act.setEffectiveTimeScale(speed); act.play();
    if (a.current) a.current.crossFadeTo(act, 0.25, false);
    a.current = act;
  }

  get dog() { return this.list.find((a) => a.kind === 'dog'); }

  update(dt) {
    const g = this.game, p = g.player.pos, night = g.daynight.nightness;
    for (const a of this.list) {
      const o = a.obj.position;
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      const far = d > 55;
      a.obj.visible = !far;
      if (!far) a.mixer?.update(dt);
      a.t -= dt;
      if (a.kind === 'owl') { a.obj.visible = !far && night > 0.3; a.obj.rotation.y = Math.sin(performance.now() * 0.0005) * 1.2; continue; }
      if (a.kind === 'wolf') a.obj.visible = !far && night > 0.4;
      if (a.kind === 'dog' && a.friend) { this.updateDog(a, dt, d); continue; }
      if (a.kind === 'dog' && a.stray) { a.obj.rotation.y = Math.atan2(-dx, -dz); if (d < 6) this.play(a, 'Idle_2_HeadLow'); else this.play(a, 'Idle_2'); continue; }

      const scare = FLEE[a.kind] * (g.noise > 0.8 ? 1.6 : 1) * (a.kind === 'wolf' && g.player.lanternOn ? 1.6 : 1);
      let speed = 0, goalYaw = a.yaw;
      if (d < scare && a.obj.visible !== false) {
        a.state = 'flee'; a.t = 3;
        goalYaw = Math.atan2(dx, dz);
        speed = { deer: 6.5, fox: 5.5, wolf: 5.5, rabbit: 4.5, duck: 1.6 }[a.kind];
      } else if (a.state === 'flee' && a.t > 0) {
        speed = { deer: 5, fox: 4.5, wolf: 4.5, rabbit: 3.5, duck: 1.2 }[a.kind];
      } else {
        if (a.t <= 0) {
          const r = Math.random();
          a.state = r < 0.45 ? 'graze' : r < 0.8 ? 'walk' : 'idle';
          a.t = 3 + Math.random() * 5;
          if (a.state === 'walk') {
            // wander back toward home when far
            const hx = a.home.x - o.x, hz = a.home.z - o.z;
            a.walkYaw = Math.hypot(hx, hz) > 14 ? Math.atan2(hx, hz) : Math.random() * Math.PI * 2;
          }
        }
        if (a.state === 'walk') { speed = { deer: 1.1, fox: 1.3, wolf: 1.4, rabbit: 0.9, duck: 0.35 }[a.kind]; goalYaw = a.walkYaw; }
      }
      if (speed > 0) {
        a.yaw = angleLerp(a.yaw, goalYaw, 1 - Math.exp(-dt * 6));
        let nx = o.x + Math.sin(a.yaw) * speed * dt, nz = o.z + Math.cos(a.yaw) * speed * dt;
        if (a.water) { // ducks stay on their water rectangle
          const [[x0, z0], [x1, z1]] = a.water;
          if (nx < x0 || nx > x1 || nz < z0 || nz > z1) { a.yaw += Math.PI * 0.6; nx = o.x; nz = o.z; }
          o.x = nx; o.z = nz;
        } else {
          const r = g.col.resolve(nx, nz, 0.35);
          if (Math.hypot(r.x - nx, r.z - nz) > 0.01) a.yaw += (Math.random() - 0.5) * 1.5;
          o.x = r.x; o.z = r.z; o.y = groundHeight(o.x, o.z);
          a.step += speed * dt;
          if (a.step > 0.45) { a.step = 0; this.prints.add(o.x, o.y, o.z, a.yaw, 0.8); }
        }
      }
      a.obj.rotation.y = a.yaw;
      if (a.actions) {
        if (speed > 3) this.play(a, 'Gallop', 1.1); else if (speed > 0) this.play(a, 'Walk', 0.9);
        else if (a.state === 'graze') this.play(a, 'Eating'); else this.play(a, 'Idle');
      } else if (a.kind === 'rabbit') {
        const hop = speed > 0 ? Math.abs(Math.sin(performance.now() * 0.012 * (speed > 2 ? 1.6 : 1))) * 0.18 : 0;
        a.obj.children[0].position.y = hop;
      } else if (a.kind === 'duck') {
        a.obj.children[0].position.y = Math.sin(performance.now() * 0.003 + a.x) * 0.03;
      }
    }
    this.prints.update(dt, night > 0.5);
  }

  updateDog(a, dt, d) {
    const g = this.game, o = a.obj.position, p = g.player.pos;
    // threat check: bark at the nearest zombie close to the player
    let threat = null, td = 12;
    for (const z of g.zombies.alive()) { const zd = z.obj.position.distanceTo(p); if (zd < td) { td = zd; threat = z; } }
    let goal = null, speed = 0;
    const atShelter = Math.hypot(p.x - SHELTER.x, p.z - SHELTER.z) < 12;
    if (threat) {
      goal = threat.obj.position; const dd = goal.distanceTo(o);
      speed = dd > 1.6 ? 4.2 : 0;
      a.barkT = (a.barkT || 0) - dt;
      if (a.barkT <= 0) { a.barkT = 2.2; g.audio?.bark(); if (!a.warned) { g.ui.toast('Your dog growls — something is close.', 'bad'); a.warned = true; } }
      if (dd < 1.8 && (a.biteT = (a.biteT || 0) - dt) <= 0) { a.biteT = 1.6; g.zombies.damage(threat, 0.5, o.x, o.z, 0.8); this.play(a, 'Attack', 1.2); }
    } else {
      a.warned = false;
      if (atShelter && Math.hypot(o.x - SHELTER.fire.x, o.z - SHELTER.fire.z) > 2.5 && d < 14) { goal = new THREE.Vector3(SHELTER.fire.x + 1.8, 0, SHELTER.fire.z - 1.4); speed = 2.2; }
      else if (!atShelter && d > 3.2) { goal = p; speed = d > 8 ? 5 : 2.8; }
    }
    if (goal && speed > 0) {
      const gx = goal.x - o.x, gz = goal.z - o.z;
      a.yaw = angleLerp(a.yaw, Math.atan2(gx, gz), 1 - Math.exp(-dt * 8));
      const r = g.col.resolve(o.x + Math.sin(a.yaw) * speed * dt, o.z + Math.cos(a.yaw) * speed * dt, 0.3);
      o.x = r.x; o.z = r.z; o.y = groundHeight(o.x, o.z);
      a.step += speed * dt; if (a.step > 0.4) { a.step = 0; this.prints.add(o.x, o.y, o.z, a.yaw, 0.8); }
      if (d > 40) { o.x = p.x - 2; o.z = p.z - 2; } // never lose the dog
      this.play(a, speed > 3 ? 'Gallop' : 'Walk', speed > 3 ? 1.1 : 1);
    } else {
      if (atShelter) this.play(a, 'Idle_2'); else { a.yaw = angleLerp(a.yaw, Math.atan2(p.x - o.x, p.z - o.z), 0.05); this.play(a, 'Idle'); }
    }
    a.obj.rotation.y = a.yaw;
  }

  befriend() {
    const a = this.dog; if (!a) return;
    a.stray = false; a.friend = true;
  }
}
