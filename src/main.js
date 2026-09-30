import * as THREE from 'three';
import { Assets } from './core/assets.js';
import { Input } from './core/input.js';
import { Collision } from './core/collision.js';
import { buildWorld, areaAt, SHELTER, START } from './world/world.js';
import { surfaceKindAt } from './world/ground.js';
import { DayNight } from './systems/daynight.js';
import { Snowfall } from './systems/snowfall.js';
import { Footprints } from './systems/footprints.js';
import { FollowCamera } from './systems/camera.js';
import { Player } from './systems/player.js';
import { Zombies, Combat } from './systems/zombies.js';
import { Wildlife } from './systems/wildlife.js';
import { Shelter } from './systems/shelter.js';
import { Interactions } from './systems/interact.js';
import { Inventory, USE_KEYS, ITEMS } from './systems/inventory.js';
import { Audio } from './systems/audio.js';
import { UI } from './ui/hud.js';
import { PAL } from './palette.js';
import { makeSeeThrough, updateSeeThrough } from './core/seethrough.js';

const params = new URLSearchParams(location.search);
const SAVE_KEY = 'sarno-survive-save-v1';
const TELEPORTS = {
  f1: ['Pavilion Park', -60, 16], f2: ['Coral Palm Drive', 40, 1], f3: ['Sunflower Tot Lot', 39, -14], f4: ['Pelican Pharmacy', 18, -76],
  f5: ['Canal Walk', 30, 56], f6: ['Beach', 122, 0], f7: ['Frozen Pond', -104, -36], f8: ['Abandoned Camp', -40, -76], f9: ['Woodshed', -100, 4],
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    const touch = matchMedia('(pointer: coarse)').matches;
    this.quality = { low: params.get('quality') === 'low' || (touch && params.get('quality') !== 'high'), lanternShadows: params.get('shadows') === 'high' };
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.quality.low, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.low ? 1.25 : 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.assets = new Assets();
    this.input = new Input(this.canvas);
    this.col = new Collision();
    this.camera = new FollowCamera(innerWidth / innerHeight);
    this.log = []; this.noise = 0; this.paused = true; this.started = false;
    this.stats = { kills: 0, shots: 0, searched: 0, woodGathered: 0, woodBurned: 0, built: 0, deaths: 0, dog: false, areas: new Set() };
    this.perf = { frames: 0, t0: performance.now(), fps: 0, worst: 0, loadMs: 0 };
    addEventListener('resize', () => this.resize());
  }

  async init() {
    const t0 = performance.now();
    const fill = document.getElementById('load-fill'), txt = document.getElementById('load-text');
    await this.assets.loadAll((f, name) => { fill.style.width = `${Math.round(f * 85)}%`; txt.textContent = `Loading ${name}…`; });
    txt.textContent = 'Building the neighborhood…';
    await new Promise((r) => setTimeout(r, 20));
    this.world = buildWorld(this.scene, this.assets, this.col);
    this.lights = {};
    for (const l of this.world.lights) {
      const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 1.7);
      pl.position.set(l.x, l.y, l.z); this.scene.add(pl); this.lights[l.kind] = pl;
    }
    const post = new THREE.PointLight(PAL.lanternLight, 0, 26, 1.5); post.position.set(SHELTER.post.x + 0.8, 2.6, SHELTER.post.z); this.scene.add(post); this.lights.post = post;
    this.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.noSeeThrough) makeSeeThrough(o.material); });
    this.daynight = new DayNight(this.scene, this.renderer, this.quality);
    this.snow = new Snowfall(this.scene, this.quality.low ? 900 : 1800);
    this.footprints = new Footprints(this.scene, 900);
    this.inv = new Inventory(10);
    this.tools = { axe: false, pistol: false };
    this.player = new Player(this);
    this.player.setPosition(START.x, START.z);
    this.shelter = new Shelter(this, this.world.dynamic);
    this.zombies = new Zombies(this, this.world.zombieSpawns);
    this.wildlife = new Wildlife(this, this.world.animalSpawns);
    this.combat = new Combat(this);
    this.interact = new Interactions(this, this.world.interact);
    this.audio = new Audio();
    this.ui = new UI(this);
    if (params.has('t')) this.daynight.hour = parseFloat(params.get('t'));
    if (!params.has('fresh')) this.load();
    if (params.has('at')) { const [x, z] = params.get('at').split(',').map(Number); this.player.setPosition(x, z); }
    this.camera.update(0, this.player.pos, true);
    this.daynight.apply(this.player.pos);
    fill.style.width = '100%';
    // first frame compile before hiding the loader
    this.renderer.compile(this.scene, this.camera.cam);
    this.renderer.render(this.scene, this.camera.cam);
    this.perf.loadMs = Math.round(performance.now() - t0);
    document.getElementById('loading').classList.add('hidden');
    this.ui.show();
    document.getElementById('btn-start').onclick = () => this.start();
    document.getElementById('btn-restart').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} location.search = params.has('dev') ? '?dev=1&fresh=1' : '?fresh=1'; };
    if (params.has('autostart')) this.start(); else this.ui.toggleHelp(true);
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    window.__game = this;
  }

  start() {
    this.audio.start();
    this.ui.toggleHelp(false);
    this.paused = false;
    if (!this.started) {
      this.started = true;
      document.getElementById('btn-start').textContent = 'Resume';
      this.ui.toast('The fire needs wood. The woods are west, through the park gate.', 'info', 6000);
      setTimeout(() => this.ui.toast('Store what you find in the pavilion stash — carried items are lost if you fall.', 'info', 6000), 2500);
    }
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.cam.aspect = innerWidth / innerHeight; this.camera.cam.updateProjectionMatrix();
  }

  surfaceAt(x, z) { const k = surfaceKindAt(x, z); return k === 'sand' ? 'sand' : k === 'snow' ? 'snow' : 'paved'; }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.perf.frames++;
    const ft = now - (this._lf || now); this._lf = now; if (this.perf.frames > 30) this.perf.worst = Math.max(this.perf.worst, ft);
    if (now - this.perf.t0 > 1000) { this.perf.fps = Math.round((this.perf.frames * 1000) / (now - this.perf.t0)); this.perf.frames = 0; this.perf.t0 = now; }
    this.handleKeys();
    if (!this.paused) this.update(dt);
    else { this.player.mixer.update(0); }
    this.camera.update(dt, this.player.pos);
    this._stTarget = (this._stTarget || this.player.pos.clone()).copy(this.player.pos); this._stTarget.y += 1.0;
    updateSeeThrough(this.camera.cam, this.renderer, this._stTarget);
    this.renderer.render(this.scene, this.camera.cam);
    this.input.endFrame();
    if (params.has('debug')) this.debugOverlay();
  }

  handleKeys() {
    const i = this.input;
    if (i.hit('h') || i.hit('?')) this.ui.toggleHelp();
    if (i.hit('escape')) {
      if (this.ui.modal === 'shelter') this.ui.closeShelter();
      else if (this.ui.modal === 'map') this.ui.toggleMap(false);
      else this.ui.toggleHelp();
    }
    if (this.paused) return;
    if (i.hit('m')) this.ui.toggleMap();
    if (i.hit('n')) { this.daynight.skip(); this.ui.toast(this.daynight.hour > 12 ? 'Night falls.' : 'Morning comes.', 'info'); }
    if (i.hit('z')) this.camera.rotate(-1);
    if (i.hit('x')) this.camera.rotate(1);
    if (i.hit('+') || i.hit('=') || i.tHit('zoomIn')) this.camera.zoom(-1);
    if (i.hit('-') || i.hit('_') || i.tHit('zoomOut')) this.camera.zoom(1);
    if (i.mouse.wheel) this.camera.zoom(i.mouse.wheel > 0 ? 1 : -1);
    for (const [k, item] of Object.entries(USE_KEYS)) if (i.hit(k)) this.useItem(item);
    if (params.has('dev')) {
      for (const [k, [name, x, z]] of Object.entries(TELEPORTS)) if (i.hit(k)) { this.teleport(x, z); this.ui.toast(`[dev] ${name}`, 'info'); }
      if (i.hit('g')) { this.inv.capacity = 30; for (const k of ['wood', 'food', 'medkit', 'oil', 'tarp', 'blanket', 'scrap', 'ammo']) this.inv.add(k, 3); this.tools.axe = this.tools.pistol = true; this.ui.toast('[dev] supplies', 'info'); }
    }
  }

  teleport(x, z) { this.player.setPosition(x, z); this.camera.update(0, this.player.pos, true); }

  update(dt) {
    this.noise *= Math.exp(-dt * 2);
    this.daynight.update(dt, this.player.pos);
    this.player.update(dt, this.input, this.camera);
    this.zombies.update(dt);
    this.wildlife.update(dt);
    this.combat.update(dt);
    this.shelter.update(dt);
    this.interact.update(dt, this.input);
    this.footprints.update(dt, this.daynight.isNight);
    this.snow.update(dt, this.player.pos);
    for (const w of this.world.water) w.userData.uniforms.uTime.value += dt;
    this.updateSurvival(dt);
    this.audio.update(this);
    // area banner
    const a = areaAt(this.player.pos.x, this.player.pos.z);
    if (a && a.id !== this.areaId) { this.areaId = a.id; this.ui.banner(a); this.stats.areas.add(a.id); }
    this.ui.update();
    this._saveT = (this._saveT || 0) + dt;
    if (this._saveT > 30) { this._saveT = 0; this.save(); }
  }

  updateSurvival(dt) {
    const s = this.player.stats, p = this.player.pos;
    if (this.player.dead) return;
    const nearFire = this.shelter.lit && this.shelter.distToFire(p) < this.shelter.warmZone;
    const sheltered = this.shelter.upgrades.windbreak && this.shelter.inShelter(p);
    if (nearFire) {
      s.warmth = Math.min(100, s.warmth + dt * 7);
      if (s.warmth > 60) s.health = Math.min(100, s.health + dt * 0.6);
    } else if (!sheltered) {
      let drain = 0.28 + 0.3 * this.daynight.nightness;
      if (this.player.lanternOn) drain *= 0.75;
      s.warmth = Math.max(0, s.warmth - drain * dt);
    }
    if (s.warmth <= 0) {
      s.health = Math.max(0, s.health - dt * 1.2);
      this._coldWarn = (this._coldWarn || 0) - dt;
      if (this._coldWarn <= 0) { this._coldWarn = 12; this.ui.toast("You're freezing. Get back to the fire.", 'bad'); }
      if (s.health <= 0) this.onPlayerDown();
    } else if (s.warmth < 25 && !this._lowWarm) { this._lowWarm = true; this.ui.toast('Your hands are going numb. Head for the fire.', 'bad'); }
    if (s.warmth > 40) this._lowWarm = false;
  }

  useItem(id) {
    const s = this.player.stats;
    if (!this.inv.count(id)) { if (ITEMS[id]) this.ui.toast(`No ${ITEMS[id].name.toLowerCase()}.`, 'bad'); return; }
    if (id === 'food') { s.health = Math.min(100, s.health + 25); s.warmth = Math.min(100, s.warmth + 12); this.ui.toast('You eat cold beans. Better. (+health, +warmth)', 'good'); }
    else if (id === 'water') { s.stamina = 100; s.health = Math.min(100, s.health + 8); this.ui.toast('Icy water. (+stamina)', 'good'); }
    else if (id === 'medkit') { if (s.health >= 100) { this.ui.toast('You are not hurt.', 'info'); return; } s.health = Math.min(100, s.health + 55); this.ui.toast('You patch yourself up. (+health)', 'good'); }
    else if (id === 'oil') { if (s.oil >= 98) { this.ui.toast('The lantern is full.', 'info'); return; } s.oil = Math.min(100, s.oil + 55); this.ui.toast('Lantern refilled.', 'good'); }
    else { this.ui.toast(`${ITEMS[id].name}: bring it to the shelter to build with.`, 'info'); return; }
    this.inv.remove(id, 1); this.audio.pickup(); this.ui.refreshInventory();
  }

  onPlayerDown() {
    if (this.player.dead) return;
    this.player.die(); this.stats.deaths++;
    const p = this.player.pos.clone();
    const items = this.inv.clear();
    this.ui.toast('Everything goes white…', 'bad', 4000);
    setTimeout(() => this.ui.fade(true), 1600);
    setTimeout(() => {
      if (Object.keys(items).length) this.interact.add({ kind: 'pack', x: p.x, z: p.z, r: 2.0, hold: 1.0, label: 'Recover your dropped pack', items });
      if (items.ammo) { this.inv.add('ammo', 0); }
      this.player.revive();
      this.player.setPosition(START.x, START.z);
      Object.assign(this.player.stats, { health: 60, warmth: 80, stamina: 100 });
      if (this.daynight.hour > 7) this.daynight.day++;
      this.daynight.hour = 7.2;
      this.zombies.resetAll();
      this.camera.update(0, this.player.pos, true);
      this.ui.fade(false);
      this.ui.toast('You wake by the pavilion, shaking. Your pack is still out there — marked on the map (M).', 'info', 7000);
      this.save();
    }, 3400);
  }

  sleep(full) {
    this.ui.fade(true); this.paused = true;
    setTimeout(() => {
      const s = this.player.stats;
      if (full) {
        if (this.daynight.hour > 7) this.daynight.day++;
        this.daynight.hour = 7.0; s.health = 100; s.warmth = 100; s.stamina = 100;
        this.shelter.fuel = Math.max(0, this.shelter.fuel - 30); if (this.shelter.fuel <= 0) this.shelter.lit = false;
        this.zombies.resetAll();
      } else {
        this.daynight.hour += 2; if (this.daynight.hour >= 24) { this.daynight.hour -= 24; this.daynight.day++; }
        s.health = Math.min(100, s.health + 20); s.warmth = 100;
        this.shelter.fuel = Math.max(1, this.shelter.fuel - 15);
      }
      this.daynight.apply(this.player.pos);
      this.save();
      this.ui.fade(false); this.paused = false;
      this.ui.toast(full ? `Day ${this.daynight.day}. You slept through the night. Progress saved.` : 'You doze by the fire for two hours.', 'good', 4500);
    }, 1300);
  }

  save() {
    try {
      const d = {
        v: 1, hour: this.daynight.hour, day: this.daynight.day, pos: [this.player.pos.x, this.player.pos.z], stats: this.player.stats,
        inv: this.inv.toJSON(), tools: this.tools, shelter: this.shelter.toJSON(), used: this.interact.usedIds(), dog: this.stats.dog,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch { /* storage unavailable: play without saving */ }
  }
  load() {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { d = null; }
    if (!d || d.v !== 1) return false;
    this.daynight.hour = d.hour; this.daynight.day = d.day;
    this.player.setPosition(d.pos[0], d.pos[1]);
    Object.assign(this.player.stats, d.stats);
    this.inv = Inventory.from(d.inv); this.tools = d.tools;
    this.shelter.load(d.shelter);
    this.interact.restoreUsed(d.used || []);
    if (d.dog) { this.wildlife.befriend(); this.stats.dog = true; const dg = this.wildlife.dog; if (dg) dg.obj.position.set(d.pos[0] + 1.5, 0, d.pos[1] + 1.5); }
    return true;
  }

  debugOverlay() {
    const el = this.ui.el.debug; el.classList.remove('hidden');
    const p = this.player.pos, info = this.renderer.info.render;
    el.textContent = `fps ${this.perf.fps}  worst ${this.perf.worst.toFixed(0)}ms  load ${this.perf.loadMs}ms\npos ${p.x.toFixed(1)}, ${p.z.toFixed(1)}  area ${this.areaId}\n` +
      `time ${this.daynight.timeString()} night ${this.daynight.nightness.toFixed(2)}\ncalls ${info.calls} tris ${info.triangles}\nzombies ${this.zombies.alive().length}  prints ${this.footprints.count}`;
  }

  /** compact state for automated playtests */
  state() {
    const p = this.player.pos;
    return {
      pos: [+p.x.toFixed(2), +p.z.toFixed(2)], area: this.areaId, hour: +this.daynight.hour.toFixed(2), day: this.daynight.day, night: this.daynight.isNight,
      stats: { ...this.player.stats }, inv: { ...this.inv.items }, capacity: this.inv.capacity, tools: { ...this.tools }, stash: { ...this.shelter.stash.items },
      fire: { lit: this.shelter.lit, fuel: +this.shelter.fuel.toFixed(1) }, upgrades: { ...this.shelter.upgrades }, lanternOn: this.player.lanternOn,
      prints: this.footprints.count, zombies: this.zombies.alive().map((z) => [+z.obj.position.x.toFixed(1), +z.obj.position.z.toFixed(1), z.state]),
      prompt: this.ui._prompt, dead: this.player.dead, fps: this.perf.fps, worstFrame: +this.perf.worst.toFixed(1), loadMs: this.perf.loadMs,
      cam: { level: this.camera.level, height: +this.camera.height.toFixed(1), yaw: +this.camera.targetYaw.toFixed(2) }, areas: [...this.stats.areas], log: this.log.slice(-8),
    };
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  document.getElementById('load-text').textContent = 'Failed to load: ' + e.message;
});
