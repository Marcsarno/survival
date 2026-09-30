import * as THREE from 'three';
import { clamp, angleLerp } from '../core/util.js';
import { groundHeight } from '../world/ground.js';
import { PAL } from '../palette.js';
import { Assets } from '../core/assets.js';

const WALK = 2.7, SPRINT = 4.8, RADIUS = 0.34, HEIGHT = 1.8;

export class Player {
  constructor(game) {
    this.game = game;
    const { root, mixer, actions } = game.assets.rigged('player');
    this.root = root; this.mixer = mixer; this.actions = actions;
    // normalize to real height
    this.fit = Assets.fitHeight(root, mixer, actions, HEIGHT);
    this.model = root;
    this.obj = new THREE.Group(); this.obj.add(root); game.scene.add(this.obj);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.handR = root.getObjectByName('WristR'); this.handL = root.getObjectByName('WristL');
    // held props
    this.lantern = game.assets.clone('lantern');
    this.lanternLight = new THREE.PointLight(PAL.lanternLight, 0, 13, 1.6);
    this.lanternLight.position.set(0, -0.22, 0);
    if (game.quality.lanternShadows) { this.lanternLight.castShadow = true; this.lanternLight.shadow.camera.far = 14; this.lanternLight.shadow.mapSize.set(512, 512); this.lanternLight.shadow.bias = -0.004; this.lanternLight.shadow.camera.near = 0.2; }
    this.lantern.add(this.lanternLight);
    // soft fill so the character reads at night (not a world light: tiny radius, no shadows)
    this.fill = new THREE.PointLight('#b8c8ff', 0, 6, 1.6); game.scene.add(this.fill);
    this.attach(this.lantern, this.handL, [0, -0.05, 0.03]);
    this.pistol = game.assets.clone('pistol'); this.attach(this.pistol, this.handR, [0.02, -0.05, 0.08], [0, 0, -Math.PI / 2]);
    this.axe = game.assets.clone('axe'); this.attach(this.axe, this.handR, [0.0, -0.06, 0.05], [Math.PI / 2, 0, 0]);
    this.pistol.visible = false; this.axe.visible = false;
    // ground ring that stays visible through roofs
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 24), new THREE.MeshBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.32, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 10; ring.position.y = 0.05; this.obj.add(ring);

    this.pos = this.obj.position; this.yaw = 0; this.vel = new THREE.Vector3();
    this.stats = { health: 100, warmth: 100, stamina: 100, oil: 60 };
    this.lanternOn = false;
    this.state = 'idle'; this.stepDist = 0; this.stepSide = 1;
    this.aim = { on: false, focus: 0, target: null, dir: new THREE.Vector3(0, 0, 1) };
    this.cooldown = 0; this.hurtT = 0; this.meleeT = 0; this.dead = false;
    this.current = null; this.play('Idle');
    this.mixer.addEventListener('finished', (e) => { if (e.action === this.actions.Death) return; this.oneShot = null; });
  }

  attach(obj, bone, p = [0, 0, 0], r = [0, 0, 0]) {
    // bones live inside the scaled root; counter-scale so props keep world size
    const ws = new THREE.Vector3(); bone.getWorldScale(ws);
    this.root.updateMatrixWorld(true); bone.getWorldScale(ws);
    obj.scale.setScalar(1 / ws.x);
    obj.position.set(p[0] / ws.x, p[1] / ws.x, p[2] / ws.x);
    obj.rotation.set(...r);
    bone.add(obj);
  }

  play(name, { fade = 0.18, once = false, speed = 1 } = {}) {
    const a = this.actions[name]; if (!a) return;
    if (this.current === a && !once) return;
    a.reset(); a.setEffectiveTimeScale(speed); a.setEffectiveWeight(1);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.play();
    if (this.current && this.current !== a) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }

  setPosition(x, z) { this.pos.set(x, groundHeight(x, z), z); }

  update(dt, input, cam) {
    const g = this.game, st = this.stats;
    this.mixer.update(dt);
    if (this.dead) return;
    this.graceT = Math.max(0, (this.graceT || 0) - dt); this.cooldown = Math.max(0, this.cooldown - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.meleeT = Math.max(0, this.meleeT - dt);

    // ---- aim (right mouse / touch aim button)
    const aimHeld = input.mouse.right || input.tDown('aim');
    const canAim = g.tools.pistol;
    if (aimHeld && canAim && !g.ui.modal) {
      if (!this.aim.on) { this.aim.on = true; this.aim.focus = 0; }
      this.aim.focus = Math.min(1, this.aim.focus + dt / 0.9);
    } else if (this.aim.on && !aimHeld) {
      // touch: release fires; mouse: release cancels (left click fires)
      if (input.tUp('aim')) g.combat.fire();
      this.aim.on = false;
    }
    if (aimHeld && !canAim && (input.tHit('aim') || input.mouse.leftPressed)) g.ui.toast('No firearm yet. Something from the police cruiser, maybe.', 'info');
    if (this.aim.on && input.mouse.leftPressed) g.combat.fire();

    // ---- movement
    const mv = g.ui.modal || this.interacting ? { x: 0, y: 0, len: 0 } : input.moveVector();
    const { forward, right } = cam.basis();
    const dir = new THREE.Vector3().addScaledVector(right, mv.x).addScaledVector(forward, -mv.y);
    const sprintHeld = input.down('shift') || input.touch.sprintToggle;
    const sprinting = sprintHeld && mv.len > 0.3 && st.stamina > 1 && !this.aim.on;
    const paved = g.surfaceAt(this.pos.x, this.pos.z);
    let speed = (sprinting ? SPRINT : WALK) * (paved === 'snow' ? 0.92 : 1) * (this.aim.on ? 0.45 : 1);
    if (st.health < 25) speed *= 0.8;
    if (this.meleeT > 0.25) speed *= 0.3;
    const moving = mv.len > 0.08;
    if (moving) {
      dir.normalize();
      const nx = this.pos.x + dir.x * speed * mv.len * dt, nz = this.pos.z + dir.z * speed * mv.len * dt;
      const r = g.col.resolve(nx, nz, RADIUS);
      const moved = Math.hypot(r.x - this.pos.x, r.z - this.pos.z);
      this.pos.x = r.x; this.pos.z = r.z; this.pos.y = groundHeight(r.x, r.z);
      if (!this.aim.on) this.yaw = angleLerp(this.yaw, Math.atan2(dir.x, dir.z), 1 - Math.exp(-dt * 12));
      this.stepDist += moved;
      const stride = sprinting ? 0.95 : 0.72;
      if (this.stepDist > stride) {
        this.stepDist = 0; this.stepSide *= -1;
        const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.13 * this.stepSide);
        const strength = paved === 'snow' ? 1 : paved === 'sand' ? 0.8 : 0.35;
        g.footprints.add(this.pos.x + side.x, this.pos.y, this.pos.z + side.z, this.yaw, strength);
        g.audio?.step(paved, sprinting);
        g.noise = Math.max(g.noise, sprinting ? 1 : 0.4);
      }
    }
    if (this.aim.on) {
      const t = g.combat.aimTarget(input);
      if (t) this.yaw = angleLerp(this.yaw, Math.atan2(t.x - this.pos.x, t.z - this.pos.z), 1 - Math.exp(-dt * 14));
    }
    this.obj.rotation.y = this.yaw;

    // ---- stamina
    if (sprinting && moving) st.stamina = Math.max(0, st.stamina - dt * 16);
    else st.stamina = Math.min(100, st.stamina + dt * (moving ? 7 : 14));

    // ---- lantern
    if ((input.hit('l') || input.tHit('lantern')) && !g.ui.modal) this.toggleLantern();
    if (this.lanternOn) {
      st.oil = Math.max(0, st.oil - dt * 0.28);
      if (st.oil <= 0) { this.lanternOn = false; g.ui.toast('The lantern sputters out. Find lamp oil.', 'bad'); }
    }
    this.lantern.visible = this.lanternOn || g.daynight.nightness > 0.2;
    this.fill.intensity = 4.5 * g.daynight.nightness;
    // keep the fill on the camera side of the player so the visible side is lit
    this.fill.position.set(this.pos.x + Math.sin(cam.yaw) * 1.6, this.pos.y + 2.3, this.pos.z + Math.cos(cam.yaw) * 1.6);
    const flick = 1 + Math.sin(performance.now() * 0.013) * 0.05 + Math.sin(performance.now() * 0.031) * 0.04;
    this.lanternLight.intensity = this.lanternOn ? (6 + 14 * g.daynight.nightness) * flick : 0;
    this.lantern.traverse((o) => { if (o.isMesh && o.material.name === 'LanternGlow') o.material.emissiveIntensity = this.lanternOn ? 3 : 0.05; });

    // ---- melee (axe swing or shove)
    if ((input.hit('f') || input.tHit('melee')) && this.meleeT <= 0 && !g.ui.modal && st.stamina > 8) {
      this.meleeT = 0.75; st.stamina -= 10;
      // forgiving melee: turn toward the nearest zombie in reach
      let best = null, bd = 2.8;
      for (const z of g.zombies.alive()) { const d = z.obj.position.distanceTo(this.pos); if (d < bd) { bd = d; best = z; } }
      if (best) this.yaw = Math.atan2(best.obj.position.x - this.pos.x, best.obj.position.z - this.pos.z);
      this.axe.visible = g.tools.axe;
      this.oneShot = g.tools.axe ? 'Sword_Slash' : 'Punch_Right';
      this.play(this.oneShot, { once: true, speed: 1.4, fade: 0.08 });
      setTimeout(() => g.combat.melee(), 260);
      g.audio?.swing();
    }

    // ---- animation state
    const busy = this.oneShot && this.current && this.current.isRunning();
    if (!busy) {
      this.axe.visible = false;
      if (this.interacting) this.play('Interact');
      else if (this.aim.on) this.play(moving ? 'Walk' : 'Idle_Gun_Pointing', { speed: moving ? 0.6 : 1 });
      else if (moving) this.play(sprinting ? 'Run' : 'Walk', { speed: sprinting ? 0.95 : 0.85 * mv.len + 0.25 });
      else this.play('Idle');
    }
    this.pistol.visible = this.aim.on || (this.oneShot === 'Gun_Shoot' && busy);
  }

  toggleLantern() {
    const g = this.game;
    if (!this.lanternOn && this.stats.oil <= 0) { g.ui.toast('The lantern is dry. Press 4 to refill with lamp oil.', 'bad'); return; }
    this.lanternOn = !this.lanternOn;
    g.audio?.click();
  }

  hurt(amount, from) {
    if (this.dead) return;
    const g = this.game;
    if (this.graceT > 0 && amount < 100) return;   // brief grace after each hit so groups can't stun-lock
    this.graceT = 0.7;
    this.stats.health = Math.max(0, this.stats.health - amount);
    g.ui.flashDamage(); g.camera.shake = 0.35; g.audio?.hurt();
    if (this.hurtT <= 0 && !this.aim.on) { this.hurtT = 0.8; this.oneShot = 'HitRecieve'; this.play('HitRecieve', { once: true, speed: 1.5, fade: 0.05 }); }
    if (from) { // knockback
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      const r = g.col.resolve(this.pos.x + (dx / l) * 0.5, this.pos.z + (dz / l) * 0.5, RADIUS);
      this.pos.x = r.x; this.pos.z = r.z;
    }
    if (this.stats.health <= 0) g.onPlayerDown();
  }

  die() {
    this.dead = true; this.aim.on = false; this.interacting = null;
    this.oneShot = 'Death'; this.play('Death', { once: true, fade: 0.1 });
  }
  revive() { this.dead = false; this.oneShot = null; this.current = null; this.play('Idle'); }
}
