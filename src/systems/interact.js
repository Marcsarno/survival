import * as THREE from 'three';
import { ITEMS } from './inventory.js';

// Finds the nearest interactable, shows the prompt, handles hold-to-act, and applies effects.
export class Interactions {
  constructor(game, list) {
    this.game = game; this.list = list; this.current = null; this.progress = 0;
    this.markerTex = starTexture();
    for (const i of list) this.decorate(i);
  }

  decorate(i) {
    const g = this.game;
    if (i.model) {
      const m = g.assets.clone(i.model);
      m.position.set(i.x, i.my || 0, i.z); m.rotation.set(i.mrx || 0, i.mry || 0, 0);
      g.scene.add(m); i.mesh = m;
    }
    if (['pickup', 'search', 'tool', 'wood', 'note', 'pack'].includes(i.kind)) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.markerTex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      s.scale.setScalar(0.55); s.position.set(i.x, 1.5, i.z); s.renderOrder = 5;
      g.scene.add(s); i.marker = s;
    }
  }

  add(o) { const i = { id: 'd' + Math.random().toString(36).slice(2), used: false, r: 1.8, hold: 0, ...o }; this.list.push(i); this.decorate(i); return i; }

  markUsed(i) {
    i.used = true;
    if (i.mesh) { this.game.scene.remove(i.mesh); i.mesh = null; }
    if (i.marker) i.marker.visible = false;
  }

  update(dt, input) {
    const g = this.game, p = g.player.pos;
    if (g.player.dead) { g.ui.setPrompt(null); return; }
    // nearest usable
    let best = null, bd = Infinity;
    for (const i of this.list) {
      if (i.used || i.hidden) continue;
      const d = Math.hypot(i.x - p.x, i.z - p.z);
      if (i.marker) {
        const vis = d < 16 ? Math.min(1, (16 - d) / 5) : 0;
        i.marker.material.opacity = vis * (0.55 + 0.35 * Math.sin(performance.now() * 0.004 + i.x));
        i.marker.position.y = 1.35 + Math.sin(performance.now() * 0.003 + i.z) * 0.12;
      }
      if (d < i.r && d < bd) { bd = d; best = i; }
    }
    if (g.wildlife.dog?.stray) {
      const dog = g.wildlife.dog, d = dog.obj.position.distanceTo(p);
      if (d < 2.2 && d < bd) { best = { kind: 'dog', label: g.inv.count('food') ? 'Offer food to the dog' : 'The dog watches you. (needs food)', hold: 0.8, dog }; }
    }
    if (best !== this.current && !(best && this.current && best.id === this.current.id)) { this.current = best; this.progress = 0; }
    const held = input.down('e') || input.tDown('interact');
    const pressed = input.hit('e') || input.tHit('interact');
    const i = this.current;
    if (!i || g.ui.modal && g.ui.modal !== 'shelter') { g.ui.setPrompt(null); g.ui.setProgress(null); g.player.interacting = null; return; }
    const verb = g.input.isTouch ? '<kbd>E</kbd>' : (i.hold ? '<kbd>E</kbd> hold' : '<kbd>E</kbd>');
    g.ui.setPrompt(`${verb} ${i.label}${this.extra(i)}`);
    if (i.hold > 0) {
      if (held) {
        this.progress += dt; g.player.interacting = i;
        g.ui.setProgress(this.progress / i.hold);
        if (this.progress >= i.hold) { this.progress = 0; g.player.interacting = null; g.ui.setProgress(null); this.apply(i); }
      } else { this.progress = 0; g.player.interacting = null; g.ui.setProgress(null); }
    } else if (pressed) this.apply(i);
  }

  extra(i) {
    const g = this.game;
    if (i.kind === 'wood' && !g.tools.axe && i.amount[1] > i.amount[0]) return ' <small>(an axe would yield more)</small>';
    if (i.kind === 'fire') return ` <small>(${g.shelter.lit ? Math.round(g.shelter.fuel) + '% fuel' : 'out'})</small>`;
    return '';
  }

  apply(i) {
    const g = this.game, ui = g.ui;
    switch (i.kind) {
      case 'search': {
        const got = {}, left = {};
        for (const [k, n] of Object.entries(i.loot || {})) {
          const fit = g.inv.add(k, n); if (fit) got[k] = fit; if (n - fit > 0) left[k] = n - fit;
        }
        if (Object.keys(got).length) { this.toastItems(got); g.audio?.pickup(); } else if (!Object.keys(left).length) ui.toast('Nothing useful here.', 'info');
        if (Object.keys(left).length) { i.loot = left; ui.toast('Your pack is full — some supplies left behind.', 'bad'); } else this.markUsed(i);
        g.stats.searched++;
        break;
      }
      case 'wood': {
        const n = g.tools.axe ? i.amount[1] : i.amount[0];
        const fit = g.inv.add('wood', n);
        if (!fit) { ui.toast('Your pack is full.', 'bad'); break; }
        this.toastItems({ wood: fit }); g.audio?.chop();
        i.usesLeft = (i.usesLeft ?? (i.uses || 2)) - 1;
        if (i.usesLeft <= 0) this.markUsed(i);
        g.stats.woodGathered += fit;
        break;
      }
      case 'tool': {
        if (i.tool === 'axe') { g.tools.axe = true; ui.toast('Got the axe. Gather more wood, hit harder (F).', 'good'); }
        if (i.tool === 'pistol') { g.tools.pistol = true; g.inv.add('ammo', i.ammo || 4); ui.toast(`Found a service pistol and ${i.ammo} rounds. Hold right mouse to aim.`, 'good'); }
        if (i.tool === 'backpack') { g.inv.capacity += 6; ui.toast('Hiking backpack: carry 6 more items.', 'good'); }
        g.audio?.pickup(); this.markUsed(i);
        break;
      }
      case 'note': ui.toast(i.text, 'info', 9000); i.label = i.label.replace('Read', 'Reread'); break;
      case 'stash': ui.openShelter(); break;
      case 'build': ui.openShelter(); break;
      case 'fire': g.shelter.tendFire(); break;
      case 'bed': g.shelter.rest(); break;
      case 'pack': {
        for (const [k, n] of Object.entries(i.items)) { const fit = g.inv.add(k, n); i.items[k] -= fit; if (!i.items[k]) delete i.items[k]; }
        if (!Object.keys(i.items).length) { this.markUsed(i); ui.toast('You recover your dropped pack.', 'good'); } else ui.toast('Recovered what fits.', 'info');
        g.audio?.pickup();
        break;
      }
      case 'dog': {
        if (!g.inv.remove('food', 1)) { ui.toast('The stray looks hungry. Bring it something to eat.', 'info'); break; }
        g.wildlife.befriend(); ui.toast('The dog wolfs down the food and falls in beside you.', 'good'); g.audio?.bark();
        g.stats.dog = true;
        break;
      }
    }
    g.ui.refreshInventory();
  }

  toastItems(got) {
    for (const [k, n] of Object.entries(got)) this.game.ui.toast(`+${n} ${ITEMS[k]?.icon || ''} ${ITEMS[k]?.name || k}`, 'good');
  }

  usedIds() { return this.list.filter((i) => i.used && typeof i.id === 'number').map((i) => i.id); }
  restoreUsed(ids) { for (const i of this.list) if (ids.includes(i.id)) this.markUsed(i); }
}

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,210,140,0.7)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,240,0.95)';
  g.beginPath(); g.moveTo(32, 6); g.lineTo(36, 28); g.lineTo(58, 32); g.lineTo(36, 36); g.lineTo(32, 58); g.lineTo(28, 36); g.lineTo(6, 32); g.lineTo(28, 28); g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}
