import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Assets } from './core/assets.js';
import { Input } from './core/input.js';
import { Collision } from './core/collision.js';
import { buildLevel, KIT, clampToRoute, groundKind, zoneAt, progressAt, seaDist, SPAWN, GATE, PLAY, BUNNY, LEVEL_TEST, ROUTE_LENGTH, nearest } from './world/level.js';
import { shared, setAnisotropy } from './world/materials.js';
import { Footprints } from './systems/footprints.js';
import { FollowCamera } from './systems/camera.js';
import { Player } from './systems/player.js';
import { Interactions } from './systems/interact.js';
import { Audio } from './systems/audio.js';
import { Story } from './systems/story.js';
import { UI } from './ui/hud.js';
import { Ambience } from './systems/ambience.js';
import { makeSeeThrough, updateSeeThrough } from './core/seethrough.js';
import { lerp, smoothstep } from './core/util.js';

// The opening, pass 2: Marc (the Tripo model) walks a Florida canal neighborhood at golden hour, from
// the seawall through the park to a locked gate and the house. Assets: the Blender kit and Poly Haven
// textures (see docs/DESIGN.md → Opening, pass 2). The sequence lives in systems/story.js.
const params = new URLSearchParams(location.search);

// light by progress (0 → 1): low golden sun at the seawall, sinking to a red-orange sunset at the house
const LIGHT = [
  { p: 0, sun: '#ffd3a0', sunI: 4.4, elev: 0.5, sky: '#e6d2b0', gnd: '#6b5640', hemiI: 0.8, fog: '#d9bf98', env: 0.55, exp: 1.06 },
  { p: 0.55, sun: '#ffc286', sunI: 4.0, elev: 0.4, sky: '#dcc2a0', gnd: '#5f4b3a', hemiI: 0.72, fog: '#cfae8a', env: 0.5, exp: 1.06 },
  { p: 1, sun: '#ff9e60', sunI: 3.2, elev: 0.27, sky: '#bfa29c', gnd: '#4e3e34', hemiI: 0.62, fog: '#b08c7c', env: 0.42, exp: 1.08 },
];

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    const touch = matchMedia('(pointer: coarse)').matches;
    this.quality = { low: params.get('quality') === 'low' || (touch && params.get('quality') !== 'high') };
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.quality.low, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.low ? 1.5 : 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    setAnisotropy(this.quality.low ? 4 : 8);
    this.scene = new THREE.Scene();
    this.assets = new Assets();
    this.input = new Input(this.canvas);
    this.col = new Collision();
    this.camera = new FollowCamera(innerWidth / innerHeight);
    this.log = []; this.paused = true; this.started = false;
    this.perf = { frames: 0, t0: performance.now(), fps: 0, worst: 0, loadMs: 0 };
    this.route = LEVEL_TEST;
    addEventListener('resize', () => this.resize());
  }

  async init() {
    const t0 = performance.now();
    const fill = document.getElementById('load-fill'), txt = document.getElementById('load-text');
    const env = new HDRLoader().loadAsync('./assets/env/dikhololo_sunset.hdr');
    await this.assets.loadAll((f, name) => { fill.style.width = `${Math.round(f * 80)}%`; txt.textContent = `Loading ${name.replace('kit/', '')}…`; }, [...KIT, 'marc'], { flat: false });
    txt.textContent = 'Building the neighborhood…';
    const pm = new THREE.PMREMGenerator(this.renderer), hdr = await env;
    this.scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
    this.scene.environmentIntensity = 0.5;
    await new Promise((r) => setTimeout(r, 20));
    this.level = buildLevel(this.scene, this.assets, this.col);
    this.setupLevelHooks();
    this.setupLights();
    this.lights = {};
    for (const l of this.level.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6); pl.position.set(l.x, l.y, l.z); this.scene.add(pl);
      this.lights[l.kind] = { light: pl, base: l.intensity };
    }
    this.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.noSeeThrough && o.material?.isMeshStandardMaterial) makeSeeThrough(o.material, { nearFade: !!o.material.alphaTest }); });
    this.footprints = new Footprints(this.scene, 220, false, 300, { tint: '#3b2c1e', night: '#2a1f15' });
    this.childPrints = new Footprints(this.scene, 64, false, Infinity, { tint: '#2e2216', night: '#21180f' });
    const trail = (x0, z0, x1, z1, n) => { const yaw = Math.atan2(x1 - x0, z1 - z0); for (let i = 0; i < n; i++) { const t = i / (n - 1), s = i % 2 ? 1 : -1; this.childPrints.add(x0 + (x1 - x0) * t + Math.cos(yaw) * 0.06 * s, 0.01, z0 + (z1 - z0) * t - Math.sin(yaw) * 0.06 * s, yaw + (Math.random() - 0.5) * 0.2, 1.3, s, 0.62); } };
    trail(PLAY.x - 0.5, PLAY.z + 3.0, PLAY.x - 5.4, PLAY.z - 1.4, 14);   // from under the swing toward the path
    trail(19.4, -57.6, 21.2, -61.0, 8); trail(21.0, -62.6, 22.9, -68.6, 11);  // up the lane, past the bunny, to the gate
    this.childPrints.update(1, false);
    this.player = new Player(this);
    this.ambience = new Ambience(this.scene);
    this.interact = new Interactions(this, this.level.interact);
    this.audio = new Audio();
    this.ui = new UI(this);
    this.story = new Story(this);
    this.resetRoute(false);
    if (params.has('at')) { const [x, z] = params.get('at').split(',').map(Number); this.player.setPosition(x, z, Math.PI); this.snapCamera(); }
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

  setupLights() {
    const s = this.sun = new THREE.DirectionalLight('#ffd4a0', 3);
    s.castShadow = true;
    const size = this.quality.low ? 1024 : 2048;
    s.shadow.mapSize.set(size, size);
    const c = s.shadow.camera; c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 140;
    s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03;
    this.scene.add(s, s.target);
    this.hemi = new THREE.HemisphereLight('#d2c3a6', '#5a4a3a', 0.55); this.scene.add(this.hemi);
    this.scene.fog = new THREE.Fog('#c2ab8c', 30, 100);
    this.scene.background = new THREE.Color('#c2ab8c');
  }

  setupLevelHooks() {
    const L = this.level, gate = L.dynamic.gate;
    L.gateShake = 0;
    L.gateRattle = (k = 1) => { L.gateShake = 0.06 * k; this.audio.rattle(k); };
    L.setGateLabel = (label) => { const g = L.interact.find((i) => i.id === 'gate'); if (g) g.label = label; };
    L.reset = () => {
      const bn = L.dynamic.bunny, h = L.dynamic.bunnyHome;
      this.scene.attach(bn); bn.position.set(h.x, 0, h.z); bn.rotation.set(0, h.ry, 0); bn.scale.setScalar(1);
      L.dynamic.figure.reset(); L.dynamic.doorCrack.material.opacity = 0; L.setGateLabel('Open the gate'); gate.rotation.y = 0;
      for (const i of L.interact) i.used = false;
    };
  }

  start() {
    this.audio.start();
    this.ui.toggleHelp(false);
    if (!this.started) { this.started = true; document.getElementById('btn-start').textContent = 'Resume'; }
  }
  setPaused(on) { this.paused = on; }

  resetRoute(fade) {
    const go = () => {
      this.ui.hideEnd();
      this.player.frozen = false; this.player.carrying = null; this.player.lookAt(null);
      this.player.setPosition(SPAWN.x, SPAWN.z, SPAWN.yaw);
      this.level.reset(); this.footprints.reset(); this.interact.reset(); this.story.reset();
      this.snapCamera();
      this.ui.fade(false);
    };
    if (fade) { this.ui.fade(true); setTimeout(go, 600); } else go();
  }

  snapCamera() { this.applyAtmosphere(0, true); this.camera.update(0, this.player.pos, null, true); }
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.setAspect(innerWidth / innerHeight); }
  groundAt(x, z) { return groundKind(x, z); }
  clampToRoute(x, z, r) { return clampToRoute(x, z, r); }

  interactWith(i) {
    if (i.kind === 'bunny') this.story.findBunny('interact');
    if (i.kind === 'gate') this.story.gate(this.player.pos.z > GATE.z);
  }

  endSlice() {
    this.ui.fade(true);
    setTimeout(() => { this.ui.fade(false); this.ui.showEnd(this.story.time, this.story.beats); }, 1300);
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.perf.frames++;
    const ft = now - (this._lf || now); this._lf = now; if (this.perf.frames > 30) this.perf.worst = Math.max(this.perf.worst, ft);
    if (now - this.perf.t0 > 1000) { this.perf.fps = Math.round((this.perf.frames * 1000) / (now - this.perf.t0)); this.perf.frames = 0; this.perf.t0 = now; }
    shared.time.value = now * 0.001;
    this.handleKeys();
    if (!this.paused) this.update(dt); else this.player.mixer.update(0);
    this.animateWorld(this.paused ? 0 : dt);
    if (!this.paused) this.ambience.update(dt, this.camera.focus);
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
    if (params.has('dev') && !this.paused) LEVEL_TEST.marks.forEach((m, k) => { if (i.hit(String(k + 1))) { this.player.setPosition(m.x, m.z, Math.PI); this.snapCamera(); this.ui.toast(`[dev] ${m.id}`); } });
  }

  update(dt) {
    this.player.update(dt, this.input, this.camera);
    this.story.update(dt);
    this.interact.update(dt, this.input);
    this.applyAtmosphere(dt);
    this.footprints.update(dt, false);
    const p = this.player.pos, sw = this.level.dynamic.swings[0];
    this.audio.update(dt, { seaDist: seaDist(p.x, p.z), swingDist: Math.hypot(p.x - sw.position.x, p.z - sw.position.z), swingPhase: this._swingPhase || 0, night: smoothstep(0.5, 1, progressAt(p.x, p.z)) });
  }

  /** The world moves on its own: a swing still swaying, the boat on the water, the gate, candlelight. */
  animateWorld(dt) {
    const t = performance.now() * 0.001, d = this.level.dynamic;
    this._swingPhase = t * 1.55;
    if (d.swings) { d.swings[0].rotation.x = Math.sin(this._swingPhase) * 0.2; d.swings[1].rotation.x = Math.sin(t * 1.1 + 1) * 0.05; }
    if (d.boat) { d.boat.position.y = -0.62 + Math.sin(t * 0.9) * 0.03; d.boat.rotation.z = Math.sin(t * 0.7) * 0.025; d.boat.rotation.x = Math.sin(t * 0.5 + 1) * 0.015; }
    if (this.level.gateShake > 0.001) { this.level.gateShake *= Math.exp(-dt * 5); d.gate.rotation.y = Math.sin(t * 38) * this.level.gateShake; } else d.gate.rotation.y = 0;
    d.figure.update(dt);
    for (const k of ['window', 'window2', 'porch']) { const l = this.lights[k]; if (l) l.light.intensity = l.base * (0.86 + 0.09 * Math.sin(t * 7.3 + k.length) + 0.05 * Math.sin(t * 13.1)); }
  }

  /** Light by progress; fog, camera distance and framing by area. */
  applyAtmosphere(dt, snap = false) {
    const p = this.player.pos, prog = progressAt(p.x, p.z);
    let a = LIGHT[0], b = LIGHT[1];
    for (let k = 0; k < LIGHT.length - 1; k++) if (prog >= LIGHT[k].p) { a = LIGHT[k]; b = LIGHT[k + 1]; }
    const k = smoothstep(a.p, b.p, prog);
    const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
    const ease = snap ? 1 : 1 - Math.exp(-dt * 0.8);
    const cur = this._light || (this._light = { sunI: a.sunI, elev: a.elev, hemiI: a.hemiI, env: a.env, exp: a.exp });
    for (const key of ['sunI', 'elev', 'hemiI', 'env', 'exp']) cur[key] += (lerp(a[key], b[key], k) - cur[key]) * ease;
    this.sun.color.lerp(c(a.sun, b.sun), ease); this.sun.intensity = cur.sunI;
    this.hemi.color.lerp(c(a.sky, b.sky), ease); this.hemi.groundColor.lerp(c(a.gnd, b.gnd), ease); this.hemi.intensity = cur.hemiI;
    this.scene.fog.color.lerp(c(a.fog, b.fog), ease); this.scene.background.copy(this.scene.fog.color);
    this.scene.environmentIntensity = cur.env; this.renderer.toneMappingExposure = cur.exp;
    // the sun from the west-south-west, low: long shadows reaching east-north-east, faces toward the camera lit
    const f = this.camera.focus.lengthSq() ? this.camera.focus : p, el = cur.elev;
    this.sun.position.set(f.x - 0.86 * Math.cos(el) * 70, f.y + Math.sin(el) * 70, f.z + 0.5 * Math.cos(el) * 70);
    this.sun.target.position.copy(f);
    const zone = zoneAt(p.z); this.section = zone.id;
    const zk = snap ? 1 : 1 - Math.exp(-dt * 0.7);
    this._fogFar = this._fogFar == null || snap ? zone.fog : this._fogFar + (zone.fog - this._fogFar) * zk;
    this.scene.fog.near = this.camera.dist + 26; this.scene.fog.far = this.scene.fog.near + this._fogFar * 1.6;   // a light haze far up the frame only
    this.camera.zoomTarget = zone.zoom; this.camera.biasTarget = zone.bias || null;
    if (snap) { this.camera.zoom = zone.zoom; if (zone.bias) Object.assign(this.camera.bias, zone.bias); else this.camera.bias.w = 0; }
  }

  debugOverlay() {
    const el = this.ui.el.debug; el.classList.remove('hidden');
    const p = this.player.pos, info = this.renderer.info.render;
    el.textContent = `fps ${this.perf.fps}  worst ${this.perf.worst.toFixed(0)}ms  load ${this.perf.loadMs}ms\npos ${p.x.toFixed(1)}, ${p.z.toFixed(1)}  ${this.section}  t ${this.story.time.toFixed(1)}s\n` +
      `ground ${this.groundAt(p.x, p.z)}  speed ${this.player.speed?.toFixed(2)}\ncalls ${info.calls} tris ${info.triangles}\nbeats ${this.story.beats.map((b) => b.id + '@' + b.t).join(' ')}`;
  }

  state() {
    const p = this.player.pos, n = nearest(p.x, p.z);
    return {
      pos: [+p.x.toFixed(2), +p.z.toFixed(2)], y: +p.y.toFixed(3), lat: +n.d.toFixed(2), w: +n.w.toFixed(2), routeLength: +ROUTE_LENGTH.toFixed(1), section: this.section, ground: this.groundAt(p.x, p.z),
      speed: +(this.player.speed || 0).toFixed(2), walkSpeed: +this.player.walkSpeed.toFixed(2), yaw: +this.player.yaw.toFixed(2), frozen: this.player.frozen, seq: this.player.seq?.kind ?? null, carrying: !!this.player.carrying,
      story: this.story.state(), prints: this.footprints.count, footfalls: this.player.footfalls,
      prompt: this.ui._prompt, subtitle: this.ui._sub, hint: this.ui._hint, modal: this.ui.modal, paused: this.paused,
      audio: { state: this.audio.state, muted: this.audio.muted, tension: +this.audio.tension.toFixed(2) },
      fps: this.perf.fps, worstFrame: +this.perf.worst.toFixed(1), loadMs: this.perf.loadMs, calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles,
      cam: { yaw: this.camera.yaw, pos: this.camera.cam.position.toArray().map((v) => +v.toFixed(2)) },
    };
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  document.getElementById('load-text').textContent = 'Failed to load: ' + e.message;
});
