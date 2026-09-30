import * as THREE from 'three';
import { Assets } from './core/assets.js';
import { Input } from './core/input.js';
import { Collision } from './core/collision.js';
import { buildRoute, nearest, clampToRoute, groundKind, sectionAt, START, SHELTER_FIRE, ROUTE_LENGTH, ROUTE_TEST } from './world/route.js';
import { DayNight } from './systems/daynight.js';
import { Snowfall } from './systems/snowfall.js';
import { Footprints } from './systems/footprints.js';
import { FollowCamera } from './systems/camera.js';
import { Player } from './systems/player.js';
import { Wildlife } from './systems/wildlife.js';
import { Interactions } from './systems/interact.js';
import { Audio } from './systems/audio.js';
import { UI } from './ui/hud.js';
import { makeSeeThrough, updateSeeThrough } from './core/seethrough.js';
import { lerp, smoothstep } from './core/util.js';
import { groundHeight } from './world/ground.js';

// Opening-route slice: shelter → neighborhood edge → woods → deeper snowy trail → the house.
// No inventory, combat or survival meters. The light is authored by how far along the route you are.
const params = new URLSearchParams(location.search);

// hour of the day by route progress (0..1): blue hour at the shelter, full dark by the house
const LIGHT_KEYS = [[0, 19.3], [0.22, 19.5], [0.55, 19.85], [0.82, 20.15], [1, 20.35]];
const ATMOS = { // per section: snowfall, fog distance beyond the camera, camera distance (zoom 1 = default)
  shelter: { snow: 0.7, fog: 95, zoom: 1.0 }, street: { snow: 0.9, fog: 85, zoom: 1.3 }, woods: { snow: 1.2, fog: 62, zoom: 0.95 },
  deep: { snow: 2.1, fog: 46, zoom: 0.92 }, house: { snow: 1.3, fog: 60, zoom: 1.12 },
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    const touch = matchMedia('(pointer: coarse)').matches;
    this.quality = { low: params.get('quality') === 'low' || (touch && params.get('quality') !== 'high') };
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.quality.low, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.low ? 1.5 : 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.assets = new Assets();
    this.input = new Input(this.canvas);
    this.col = new Collision();
    this.camera = new FollowCamera(innerWidth / innerHeight);
    this.log = []; this.noise = 0; this.paused = true; this.started = false;
    this.run = { t: 0, moving: false, arrived: false, gateOpenedAt: null };
    this.perf = { frames: 0, t0: performance.now(), fps: 0, worst: 0, loadMs: 0 };
    this.route = ROUTE_TEST;
    addEventListener('resize', () => this.resize());
  }

  async init() {
    const t0 = performance.now();
    const fill = document.getElementById('load-fill'), txt = document.getElementById('load-text');
    await this.assets.loadAll((f, name) => { fill.style.width = `${Math.round(f * 85)}%`; txt.textContent = `Loading ${name}…`; });
    txt.textContent = 'Building the route…';
    await new Promise((r) => setTimeout(r, 20));
    this.world = buildRoute(this.scene, this.assets, this.col);
    this.lights = {};
    for (const l of this.world.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 1.7);
      pl.position.set(l.x, l.y, l.z); this.scene.add(pl); this.lights[l.kind] = pl;
    }
    this.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.noSeeThrough) makeSeeThrough(o.material); });
    this.daynight = new DayNight(this.scene, this.renderer, this.quality);
    this.snow = new Snowfall(this.scene, this.quality.low ? 900 : 1800);
    this.footprints = new Footprints(this.scene, 700, false, 900);  // bounded pool, long life: the whole walk stays readable
    this.player = new Player(this);
    this.wildlife = new Wildlife(this, this.world.animalSpawns);
    this.interact = new Interactions(this, this.world.interact);
    this.audio = new Audio();
    this.ui = new UI(this);
    this.fixedHour = params.has('t') ? parseFloat(params.get('t')) : null;
    this.resetRoute(false);
    if (params.has('at')) { const [x, z] = params.get('at').split(',').map(Number); this.player.setPosition(x, z, Math.PI); this.snapCamera(); }
    this.applyAtmosphere(0, true);
    fill.style.width = '100%';
    this.renderer.compile(this.scene, this.camera.cam);
    this.renderer.render(this.scene, this.camera.cam);
    this.perf.loadMs = Math.round(performance.now() - t0);
    document.getElementById('loading').classList.add('hidden');
    this.ui.show();
    document.getElementById('btn-start').onclick = () => this.start();
    document.getElementById('btn-restart').onclick = () => { this.resetRoute(true); this.start(); };
    document.getElementById('btn-again').onclick = () => { this.resetRoute(true); this.start(); };
    if (params.has('autostart')) this.start(); else this.ui.toggleHelp(true);
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    window.__game = this;
    if (params.has('debug')) addEventListener('error', (e) => this.ui.toast('JS error: ' + e.message, 'bad', 10000));
  }

  start() {
    this.audio.start();
    this.ui.toggleHelp(false);
    this.paused = false;
    if (!this.started) { this.started = true; document.getElementById('btn-start').textContent = 'Resume'; }
  }

  /** Back to the shelter: position, gate, footprints, timer and light. */
  resetRoute(fade) {
    const go = () => {
      this.ui.hideEnd();
      this.player.frozen = false;
      this.player.setPosition(START.x, START.z, START.yaw);
      this.footprints.reset(); this.wildlife.prints.reset();
      const gt = this.world.dynamic.gate; gt.target = 0; gt.open = 0; gt.group.rotation.y = 0; gt.collider.on = true;
      this.interact.reset();
      this.run = { t: 0, moving: false, arrived: false, gateOpenedAt: null };
      this.daynight.hour = this.fixedHour ?? LIGHT_KEYS[0][1];
      this.snapCamera();
      this.ui.fade(false);
    };
    if (fade) { this.ui.fade(true); setTimeout(go, 600); } else go();
  }

  snapCamera() { this.camera.update(0, this.player.pos, null, true); }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.setAspect(innerWidth / innerHeight);
  }

  groundAt(x, z) { return groundKind(x, z); }
  clampToRoute(x, z, r) { return clampToRoute(x, z, r); }
  fireDist() { const p = this.player.pos; return Math.hypot(p.x - SHELTER_FIRE.x, p.z - SHELTER_FIRE.z); }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.perf.frames++;
    const ft = now - (this._lf || now); this._lf = now; if (this.perf.frames > 30) this.perf.worst = Math.max(this.perf.worst, ft);
    if (now - this.perf.t0 > 1000) { this.perf.fps = Math.round((this.perf.frames * 1000) / (now - this.perf.t0)); this.perf.frames = 0; this.perf.t0 = now; }
    this.handleKeys();
    if (!this.paused) this.update(dt);
    else this.player.mixer.update(0);
    this.camera.update(this.paused ? 0 : dt, this.player.pos, this.player.vel);
    this._stTarget = (this._stTarget || new THREE.Vector3()).copy(this.player.pos); this._stTarget.y += 1.0;
    updateSeeThrough(this.camera.cam, this.renderer, this._stTarget);
    this.renderer.render(this.scene, this.camera.cam);
    this.input.endFrame();
    if (params.has('debug')) this.debugOverlay();
  }

  handleKeys() {
    const i = this.input;
    if (i.hit('h') || i.hit('?') || i.hit('escape')) this.ui.toggleHelp();
    if (i.hit('r') && this.ui.modal !== 'help') { this.resetRoute(true); if (this.paused) this.start(); }
    if (params.has('dev') && !this.paused) {
      ROUTE_TEST.marks.forEach((m, k) => { if (i.hit(String(k + 1))) { this.player.setPosition(m.x, m.z, Math.PI); this.snapCamera(); this.ui.toast(`[dev] ${m.id}`); } });
    }
  }

  update(dt) {
    this.noise *= Math.exp(-dt * 2);
    this.player.update(dt, this.input, this.camera);
    if (!this.run.moving && this.player.speed > 0.3) this.run.moving = true;
    if (this.run.moving && !this.run.arrived) this.run.t += dt;
    this.applyAtmosphere(dt);
    this.wildlife.update(dt);
    this.interact.update(dt, this.input);
    this.footprints.update(dt, this.daynight.nightness > 0.5);
    this.snow.update(dt, this.player.pos);
    const gt = this.world.dynamic.gate;
    if (gt.open !== gt.target) { gt.open += Math.sign(gt.target - gt.open) * Math.min(Math.abs(gt.target - gt.open), dt * 1.6); gt.group.rotation.y = gt.open; }
    const f = this.world.dynamic.fire; if (f) f.scale.y = 1 + Math.sin(performance.now() * 0.02) * 0.04;
    if (this.lights.fire) this.lights.fire.intensity = 30 * (0.9 + Math.random() * 0.12);
    this.audio.update(this);
  }

  /** Light, fog and snowfall authored along the route (not a running clock). */
  applyAtmosphere(dt, snap = false) {
    const p = this.player.pos, prog = Math.max(0, Math.min(1, nearest(p.x, p.z).s / ROUTE_LENGTH));
    let target = LIGHT_KEYS[LIGHT_KEYS.length - 1][1];
    for (let k = 0; k < LIGHT_KEYS.length - 1; k++) {
      const [a, ha] = LIGHT_KEYS[k], [b, hb] = LIGHT_KEYS[k + 1];
      if (prog <= b) { target = lerp(ha, hb, smoothstep(a, b, prog)); break; }
    }
    if (this.fixedHour != null) target = this.fixedHour;
    this.daynight.hour += (target - this.daynight.hour) * (snap ? 1 : 1 - Math.exp(-dt * 0.8));
    this.daynight.apply(this.camera.focus.lengthSq() ? this.camera.focus : p);
    const sec = sectionAt(p.z), at = ATMOS[sec.id];
    this.section = sec.id;
    const k = snap ? 1 : 1 - Math.exp(-dt * 0.7);
    this._fogFar = this._fogFar == null || snap ? at.fog : this._fogFar + (at.fog - this._fogFar) * k;
    const fog = this.scene.fog; fog.near = this.camera.dist + 3; fog.far = fog.near + this._fogFar;
    this.snow.intensity += (at.snow - this.snow.intensity) * k;
    this.camera.zoomTarget = at.zoom;
    if (snap) this.camera.zoom = at.zoom;
  }

  openGate() {
    const gt = this.world.dynamic.gate;
    gt.target = 1.75; gt.collider.on = false;
    this.run.gateOpenedAt = +this.run.t.toFixed(1);
    this.audio.creak();
  }

  arrive() {
    if (this.run.arrived) return;
    this.run.arrived = true; this.player.frozen = true;
    setTimeout(() => { this.ui.fade(true); }, 900);
    setTimeout(() => { this.ui.fade(false); this.ui.showEnd(this.run.t); }, 2200);
  }

  debugOverlay() {
    const el = this.ui.el.debug; el.classList.remove('hidden');
    const p = this.player.pos, info = this.renderer.info.render, n = nearest(p.x, p.z);
    el.textContent = `fps ${this.perf.fps}  worst ${this.perf.worst.toFixed(0)}ms  load ${this.perf.loadMs}ms\npos ${p.x.toFixed(1)}, ${p.z.toFixed(1)}  s ${n.s.toFixed(0)}/${ROUTE_LENGTH.toFixed(0)}  ${this.section}\n` +
      `ground ${this.groundAt(p.x, p.z)}  speed ${this.player.speed?.toFixed(2)}  t ${this.run.t.toFixed(1)}s\nhour ${this.daynight.hour.toFixed(2)}  calls ${info.calls} tris ${info.triangles}  prints ${this.footprints.count}`;
  }

  /** the newest n footprints as [x, height above ground, z] (playtest: spacing and floating checks) */
  printsSample(n = 40) {
    const fp = this.footprints, m = new THREE.Matrix4(), v = new THREE.Vector3(), out = [];
    for (let k = 1; k <= Math.min(n, fp.count, fp.max); k++) {
      fp.mesh.getMatrixAt((fp.i - k + fp.max) % fp.max, m); v.setFromMatrixPosition(m);
      out.push([+v.x.toFixed(2), +(v.y - 0.02 - groundHeight(v.x, v.z)).toFixed(3), +v.z.toFixed(2)]);
    }
    return out;
  }

  /** compact state for automated playtests and captures */
  state() {
    const p = this.player.pos, n = nearest(p.x, p.z);
    return {
      pos: [+p.x.toFixed(2), +p.z.toFixed(2)], y: +p.y.toFixed(3), s: +n.s.toFixed(1), lat: +n.d.toFixed(2), w: +n.w.toFixed(2), routeLength: +ROUTE_LENGTH.toFixed(1), section: this.section, ground: this.groundAt(p.x, p.z),
      speed: +(this.player.speed || 0).toFixed(2), yaw: +this.player.yaw.toFixed(2), gateOpen: this.world.dynamic.gate.target > 0, gateOpenedAt: this.run.gateOpenedAt,
      arrived: this.run.arrived, walkTime: +this.run.t.toFixed(1), prints: this.footprints.count, footfalls: this.player.footfalls, prompt: this.ui._prompt, modal: this.ui.modal,
      hour: +this.daynight.hour.toFixed(2), fps: this.perf.fps, worstFrame: +this.perf.worst.toFixed(1), loadMs: this.perf.loadMs,
      cam: { yaw: this.camera.yaw, pos: this.camera.cam.position.toArray().map((v) => +v.toFixed(2)) }, gait: this.player.gait, log: this.log.slice(-5),
    };
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  document.getElementById('load-text').textContent = 'Failed to load: ' + e.message;
});
