import { Inventory, ITEMS } from './inventory.js';
import { SHELTER } from '../world/world.js';

export const UPGRADES = {
  windbreak: { name: 'Windbreak walls', cost: { wood: 6, tarp: 1 }, desc: 'Board up the ends and hang a tarp. The fire burns 40% longer.' },
  rack: { name: 'Firewood rack', cost: { wood: 4, scrap: 1 }, desc: 'Stacked, dry wood. Feeds the fire from the stash automatically.' },
  bed: { name: 'Cot & blankets', cost: { blanket: 1, wood: 2 }, desc: 'Rest until morning and wake fully healed. Saves progress.' },
  post: { name: 'Lantern post', cost: { oil: 1, wood: 2, scrap: 2 }, desc: 'A lamp on a pole at the park gate. The frozen stay away at night.' },
};

export class Shelter {
  constructor(game, dynamic) {
    this.game = game; this.dynamic = dynamic;
    this.stash = new Inventory(999);
    this.stash.add('wood', 2); this.stash.add('food', 1); this.stash.add('matches', 3);
    this.fuel = 55; this.lit = true;
    this.upgrades = { windbreak: false, rack: false, bed: false, post: false };
    this.fireFlame = null;
    dynamic.fire.traverse((o) => { if (o.isMesh && o.material.name === 'Fire') { this.fireFlame = o; o.material = o.material.clone(); o.material.emissive.set('#ff7a2a'); } });
  }

  get warmZone() { return this.lit ? 7.5 : 0; }
  distToFire(p) { return Math.hypot(p.x - SHELTER.fire.x, p.z - SHELTER.fire.z); }
  inShelter(p) { return Math.hypot(p.x - SHELTER.x, p.z - SHELTER.z) < 9; }

  update(dt) {
    const g = this.game;
    if (this.lit) {
      this.fuel -= dt * (this.upgrades.windbreak ? 0.12 : 0.2);
      if (this.upgrades.rack && this.fuel < 25 && this.stash.count('wood') > 0) {
        this.stash.remove('wood', 1); this.fuel += 22;
        if (this.inShelter(g.player.pos)) g.ui.toast('The rack feeds the fire. (-1 stashed wood)', 'info');
      }
      if (this.fuel <= 0) {
        this.fuel = 0; this.lit = false;
        g.ui.toast(this.inShelter(g.player.pos) ? 'The fire has gone out.' : 'Back at the pavilion, the fire has gone out.', 'bad');
      }
    }
    // flame visuals & light
    const t = performance.now() * 0.001;
    const f = this.lit ? Math.min(1, 0.35 + this.fuel / 60) : 0;
    if (this.fireFlame) {
      this.fireFlame.visible = this.lit;
      this.fireFlame.scale.set(0.8 + f * 0.3, (0.6 + f * 0.6) * (1 + Math.sin(t * 9) * 0.06), 0.8 + f * 0.3);
      this.fireFlame.material.emissiveIntensity = 1.5 + Math.sin(t * 13) * 0.3;
    }
    const fl = g.lights.fire;
    if (fl) fl.intensity = this.lit ? (14 + 26 * f) * (1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.05) * (0.45 + 0.55 * g.daynight.nightness) : 0;
    const post = g.lights.post; if (post) post.intensity = this.upgrades.post ? 20 * g.daynight.nightness + 2 : 0;
    const rack = this.dynamic.upgrades.rack;
    if (rack.visible) rack.userData.logs.forEach((l, i) => (l.visible = i < this.stash.count('wood')));
  }

  /** Resources can come from the stash or the carried pack. */
  have(cost) { const g = this.game; return Object.entries(cost).every(([k, n]) => this.stash.count(k) + g.inv.count(k) >= n); }
  pay(cost) {
    const g = this.game;
    for (const [k, n] of Object.entries(cost)) { const fromStash = this.stash.remove(k, n); g.inv.remove(k, n - fromStash); }
  }

  build(id) {
    const g = this.game, u = UPGRADES[id];
    if (this.upgrades[id] || !this.have(u.cost)) return false;
    this.pay(u.cost); this.upgrades[id] = true;
    this.applyVisuals();
    g.ui.toast(`Built: ${u.name}`, 'good'); g.audio?.build();
    g.stats.built++;
    g.save();
    return true;
  }
  applyVisuals() {
    const v = this.dynamic.upgrades;
    v.boards.visible = this.upgrades.windbreak; v.rack.visible = this.upgrades.rack;
    v.bed.visible = this.upgrades.bed; v.post.visible = this.upgrades.post;
  }

  depositAll() {
    const g = this.game; let n = 0;
    for (const [k, v] of Object.entries(g.inv.items)) { if (k === 'ammo') continue; this.stash.add(k, v); g.inv.remove(k, v); n += v; }
    if (n) { g.ui.toast(`Stored ${n} item${n > 1 ? 's' : ''} in the stash.`, 'good'); g.audio?.pickup(); }
    return n;
  }
  take(id) {
    const g = this.game;
    if (this.stash.count(id) <= 0) return;
    if (g.inv.add(id, 1)) this.stash.remove(id, 1); else g.ui.toast('Your pack is full.', 'bad');
  }

  tendFire() {
    const g = this.game;
    const takeWood = () => (g.inv.remove('wood', 1) || this.stash.remove('wood', 1));
    if (!this.lit) {
      if (!(g.inv.count('matches') || this.stash.count('matches'))) { g.ui.toast('No matches to relight the fire.', 'bad'); return; }
      if (!takeWood()) { g.ui.toast('You need firewood to relight the fire.', 'bad'); return; }
      if (!g.inv.remove('matches', 1)) this.stash.remove('matches', 1);
      this.lit = true; this.fuel = 25; g.ui.toast('The fire catches. (-1 match, -1 wood)', 'good'); g.audio?.whoosh();
      return;
    }
    if (this.fuel > 92) { g.ui.toast('The fire is roaring.', 'info'); return; }
    if (takeWood()) { this.fuel = Math.min(100, this.fuel + 22); g.ui.toast('You feed the fire. (-1 wood)', 'good'); g.audio?.whoosh(); g.stats.woodBurned++; }
    else g.ui.toast('No firewood. Try the woods west of the park.', 'bad');
  }

  rest() {
    const g = this.game;
    if (this.upgrades.bed) {
      g.sleep(true);
    } else if (this.lit) {
      g.sleep(false);
    } else g.ui.toast('Too cold to rest without a fire.', 'bad');
  }

  toJSON() { return { stash: this.stash.toJSON(), fuel: this.fuel, lit: this.lit, upgrades: this.upgrades }; }
  load(j) {
    this.stash = Inventory.from(j.stash); this.stash.capacity = 999;
    this.fuel = j.fuel; this.lit = j.lit; this.upgrades = { ...this.upgrades, ...j.upgrades };
    this.applyVisuals();
  }
}

export function itemLine(items) {
  return Object.entries(items).map(([k, v]) => `${ITEMS[k]?.icon || ''} ${v} ${ITEMS[k]?.name || k}`).join(', ');
}
