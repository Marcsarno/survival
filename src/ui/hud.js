import { ITEMS, USE_KEYS } from '../systems/inventory.js';
import { UPGRADES } from '../systems/shelter.js';
import { AREAS, SHELTER } from '../world/world.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game; this.modal = null; this.lastInv = '';
    this.el = { health: $('m-health'), warmth: $('m-warmth'), stamina: $('m-stamina'), oil: $('m-oil'), food: $('m-food'), time: $('clock-time'), day: $('clock-day'),
      prompt: $('prompt'), progress: $('progress'), progressFill: $('progress-fill'), toasts: $('toasts'), inv: $('inventory'), banner: $('area-banner'),
      reticle: $('reticle'), ammo: $('ammo'), dmg: $('damage-vignette'), cold: $('cold-vignette'), fade: $('fade'), shelter: $('shelter-panel'),
      help: $('help'), map: $('map-overlay'), mapCanvas: $('map-canvas'), debug: $('debug') };
    $('btn-help').onclick = () => this.toggleHelp();
    $('btn-map').onclick = () => this.toggleMap();
    $('btn-mute').onclick = () => { const on = game.audio.toggleMute(); $('btn-mute').textContent = on ? '🔊' : '🔇'; };
    this.el.map.onclick = () => this.toggleMap(false);
    this.el.inv.addEventListener('click', (e) => { const s = e.target.closest('.slot'); if (s?.dataset.item) game.useItem(s.dataset.item); });
  }

  show() { $('hud').classList.remove('hidden'); }

  toast(text, type = 'info', dur = 3200) {
    const d = document.createElement('div'); d.className = `toast ${type}`; d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 600); }, dur);
    this.game.log.push(text);
  }
  setPrompt(html) {
    if (!html) { this.el.prompt.classList.add('hidden'); this._prompt = null; return; }
    if (html !== this._prompt) { this.el.prompt.innerHTML = html; this._prompt = html; }
    this.el.prompt.classList.remove('hidden');
  }
  setProgress(f) {
    if (f == null) { this.el.progress.classList.add('hidden'); return; }
    this.el.progress.classList.remove('hidden'); this.el.progressFill.style.width = `${Math.min(100, f * 100)}%`;
  }
  banner(area) {
    clearTimeout(this._bt);
    this.el.banner.innerHTML = `${area.name}${area.sub ? `<small>${area.sub}</small>` : ''}`;
    this.el.banner.classList.add('show');
    this._bt = setTimeout(() => this.el.banner.classList.remove('show'), 2600);
  }
  flashDamage() { this.el.dmg.style.opacity = 1; setTimeout(() => (this.el.dmg.style.opacity = 0), 220); }
  hitMarker() { this.el.reticle.classList.add('locked'); setTimeout(() => this.el.reticle.classList.remove('locked'), 150); }
  fade(on) { this.el.fade.style.opacity = on ? 1 : 0; }

  update() {
    const g = this.game, s = g.player.stats;
    this.el.health.style.width = `${s.health}%`; this.el.warmth.style.width = `${s.warmth}%`;
    this.el.stamina.style.width = `${s.stamina}%`; this.el.oil.style.width = `${s.oil}%`; this.el.food.style.width = `${s.food ?? 100}%`;
    this.el.time.textContent = g.daynight.timeString(); this.el.day.textContent = `Day ${g.daynight.day}${g.daynight.isNight ? ' · night' : ''}`;
    this.el.cold.style.opacity = Math.max(0, (40 - s.warmth) / 40) * 0.9;
    this.refreshInventory();
    // ammo + reticle
    if (g.tools.pistol) { this.el.ammo.classList.remove('hidden'); this.el.ammo.textContent = `🔫 ${g.inv.count('ammo')}`; }
    const aim = g.player.aim;
    if (aim.on) {
      const t = g.combat.lockTarget;
      const pos = t ? t.obj.position.clone().setY(1.3) : null;
      let sx = g.input.mouse.x, sy = g.input.mouse.y;
      if (pos) { pos.project(g.camera.cam); sx = (pos.x + 1) / 2 * innerWidth; sy = (1 - pos.y) / 2 * innerHeight; }
      const size = 64 - 44 * aim.focus;
      Object.assign(this.el.reticle.style, { left: `${sx}px`, top: `${sy}px`, width: `${size}px`, height: `${size}px`, marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px` });
      this.el.reticle.classList.remove('hidden'); this.el.reticle.classList.toggle('locked', !!t && aim.focus > 0.95);
    } else this.el.reticle.classList.add('hidden');
    if (this.modal === 'shelter') {
      const p = g.player.pos;
      if (Math.hypot(p.x - SHELTER.x, p.z - SHELTER.z) > 10) this.closeShelter(); else if (this._shelterDirty) this.renderShelter();
    }
  }

  refreshInventory() {
    const g = this.game;
    const key = JSON.stringify(g.inv.items) + g.inv.capacity + JSON.stringify(g.tools);
    if (key === this.lastInv) return; this.lastInv = key;
    const keyOf = Object.fromEntries(Object.entries(USE_KEYS).map(([k, v]) => [v, k]));
    let html = '';
    for (const [id, n] of Object.entries(g.inv.items)) {
      if (ITEMS[id]?.noSlot) continue;
      html += `<div class="slot" data-item="${id}" title="${ITEMS[id].name}${keyOf[id] ? ` (key ${keyOf[id]})` : ''}">${keyOf[id] ? `<span class="k">${keyOf[id]}</span>` : ''}${ITEMS[id].icon}<span class="n">${n}</span></div>`;
    }
    const tools = `${g.tools.axe ? '🪓' : ''}${g.tools.pistol ? '🔫' : ''}`;
    html += `<div class="slot cap">${tools} ${g.inv.used()}/${g.inv.capacity}</div>`;
    this.el.inv.innerHTML = html;
    this._shelterDirty = true;
  }

  // ------------------------------------------------------------ shelter panel
  openShelter() { this.modal = 'shelter'; this.renderShelter(); this.el.shelter.classList.remove('hidden'); }
  closeShelter() { if (this.modal === 'shelter') this.modal = null; this.el.shelter.classList.add('hidden'); }
  renderShelter() {
    const g = this.game, sh = g.shelter;
    this._shelterDirty = false;
    const stash = Object.entries(sh.stash.items).map(([k, n]) => `<div class="row"><span>${ITEMS[k].icon} ${ITEMS[k].name}</span><span>${n} ${['food', 'medkit', 'water', 'oil', 'matches'].includes(k) ? `<a href="#" data-take="${k}">take</a>` : ''}</span></div>`).join('') || '<div class="row"><i>Empty</i></div>';
    let ups = '';
    for (const [id, u] of Object.entries(UPGRADES)) {
      const done = sh.upgrades[id];
      const cost = Object.entries(u.cost).map(([k, n]) => `${ITEMS[k].icon}${n}`).join(' ');
      ups += `<button data-build="${id}" class="${done ? 'done' : ''}" ${done || !sh.have(u.cost) ? 'disabled' : ''} title="${u.desc}">${done ? '✓ ' : ''}${u.name} <span style="float:right">${done ? 'built' : cost}</span><br><small style="opacity:.75">${u.desc}</small></button>`;
    }
    this.el.shelter.innerHTML = `<h3>Pavilion shelter</h3>
      <div class="row"><span>Fire</span><span>${sh.lit ? `🔥 ${Math.round(sh.fuel)}%` : 'out'}</span></div>
      <button data-act="deposit">Store everything you carry</button>
      <h3 style="margin-top:10px">Stash</h3>${stash}
      <h3 style="margin-top:10px">Improve</h3>${ups}
      <button data-act="close" style="background:#555">Close (Esc)</button>`;
    this.el.shelter.querySelectorAll('button,[data-take]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      if (b.dataset.act === 'deposit') sh.depositAll();
      if (b.dataset.act === 'close') this.closeShelter();
      if (b.dataset.build) sh.build(b.dataset.build);
      if (b.dataset.take) sh.take(b.dataset.take);
      this.refreshInventory(); if (this.modal === 'shelter') this.renderShelter();
    }));
  }

  // ------------------------------------------------------------ help & map
  toggleHelp(force) {
    const on = force ?? this.el.help.classList.contains('hidden');
    this.el.help.classList.toggle('hidden', !on);
    this.modal = on ? 'help' : null;
    this.game.paused = on;
  }
  toggleMap(force) {
    const on = force ?? this.el.map.classList.contains('hidden');
    this.el.map.classList.toggle('hidden', !on);
    this.modal = on ? 'map' : null;
    if (on) this.drawMap();
  }
  drawMap() {
    const g = this.game, c = this.el.mapCanvas, x = c.getContext('2d');
    const W = c.width, H = c.height, X0 = -150, X1 = 150, Z0 = -130, Z1 = 90;
    const sx = (v) => ((v - X0) / (X1 - X0)) * W, sz = (v) => ((v - Z0) / (Z1 - Z0)) * H;
    x.fillStyle = '#e8edf3'; x.fillRect(0, 0, W, H);
    const colors = { woods: '#b9cbb8', park: '#d8e6c8', cpd: '#ecdccb', canal: '#d4e0ea', beach: '#efe2c0', pharmacy: '#efcfc4', playground: '#e8d8a8', hibiscus: '#ecdccb', service: '#d2dccc', pond: '#c4dce8', camp: '#d9ccb8' };
    const seen = g.stats.areas;
    for (const a of [...AREAS].reverse()) {
      x.fillStyle = seen.has(a.id) ? (colors[a.id] || '#ddd') : '#c9ced6'; x.beginPath();
      a.poly.forEach(([px, pz], i) => (i ? x.lineTo(sx(px), sz(pz)) : x.moveTo(sx(px), sz(pz)))); x.closePath(); x.fill();
    }
    x.fillStyle = '#5c8aa8'; x.fillRect(sx(-40), sz(60), sx(104) - sx(-40), sz(76) - sz(60)); x.fillRect(sx(134), 0, W - sx(134), H);
    x.beginPath(); x.arc(sx(-120), sz(-39), (12 / 300) * W, 0, 7); x.fillStyle = '#bcd8e6'; x.fill();
    x.strokeStyle = '#6b6d72'; x.lineWidth = 5; x.beginPath(); x.moveTo(sx(-44), sz(0)); x.lineTo(sx(112), sz(0)); x.moveTo(sx(18), sz(-72)); x.lineTo(sx(18), sz(52)); x.stroke();
    x.strokeStyle = '#a89a86'; x.lineWidth = 2; x.setLineDash([4, 4]);
    for (const t of g.world.trails) { x.beginPath(); t.forEach(([px, pz], i) => (i ? x.lineTo(sx(px), sz(pz)) : x.moveTo(sx(px), sz(pz)))); x.stroke(); }
    x.setLineDash([]);
    x.fillStyle = '#2b3446'; x.font = 'bold 11px system-ui'; x.textAlign = 'center';
    for (const a of AREAS) { const cx = a.poly.reduce((s, p) => s + p[0], 0) / a.poly.length, cz = a.poly.reduce((s, p) => s + p[1], 0) / a.poly.length; x.fillStyle = seen.has(a.id) ? '#2b3446' : '#7d8491'; x.fillText(seen.has(a.id) ? a.name : '?', sx(cx), sz(cz)); }
    x.fillStyle = '#2b3446';
    x.fillStyle = '#e08a3c'; x.font = '18px system-ui'; x.fillText('⌂', sx(SHELTER.x), sz(SHELTER.z) + 6);
    for (const i of g.interact.list) if (i.kind === 'pack' && !i.used) { x.fillStyle = '#c33'; x.fillText('✖', sx(i.x), sz(i.z) + 5); }
    const p = g.player.pos;
    x.beginPath(); x.arc(sx(p.x), sz(p.z), 6, 0, 7); x.fillStyle = '#d23f2f'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#2b3446'; x.font = '12px system-ui'; x.textAlign = 'left'; x.fillText('N ↑', 10, 18);
  }
}
