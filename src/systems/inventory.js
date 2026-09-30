// Item definitions and the carried / stashed inventories.
export const ITEMS = {
  wood: { name: 'Firewood', icon: '🪵', stack: true },
  food: { name: 'Canned food', icon: '🥫', stack: true, use: 'eat' },
  water: { name: 'Water', icon: '💧', stack: true, use: 'drink' },
  medkit: { name: 'Medkit', icon: '🩹', stack: true, use: 'heal' },
  oil: { name: 'Lamp oil', icon: '🛢️', stack: true, use: 'refuel' },
  matches: { name: 'Matches', icon: '🔥', stack: true },
  tarp: { name: 'Tarp', icon: '⛺', stack: true },
  blanket: { name: 'Blanket', icon: '🧣', stack: true },
  scrap: { name: 'Scrap metal', icon: '🔩', stack: true },
  ammo: { name: 'Pistol rounds', icon: '•', stack: true, noSlot: true },
};
export const USE_KEYS = { '1': 'food', '2': 'medkit', '3': 'water', '4': 'oil' };

export class Inventory {
  constructor(capacity = 10) { this.items = {}; this.capacity = capacity; }
  count(id) { return this.items[id] || 0; }
  /** slot usage counts each unit (weight), except noSlot items */
  used() { let n = 0; for (const [k, v] of Object.entries(this.items)) if (!ITEMS[k]?.noSlot) n += v; return n; }
  space() { return this.capacity - this.used(); }
  /** Adds up to n units; returns how many fit. */
  add(id, n = 1) {
    const fit = ITEMS[id]?.noSlot ? n : Math.max(0, Math.min(n, this.space()));
    if (fit > 0) this.items[id] = this.count(id) + fit;
    return fit;
  }
  remove(id, n = 1) {
    const have = this.count(id), r = Math.min(have, n);
    if (r > 0) { this.items[id] = have - r; if (!this.items[id]) delete this.items[id]; }
    return r;
  }
  clear() { const old = this.items; this.items = {}; return old; }
  toJSON() { return { items: this.items, capacity: this.capacity }; }
  static from(j) { const i = new Inventory(j?.capacity || 10); i.items = { ...(j?.items || {}) }; return i; }
}
