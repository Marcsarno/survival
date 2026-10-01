// Contextual interactions: find the nearest usable one, show its prompt, act on E / the touch button.
// An entry has either a point and radius (x, z, r) or a reach(p, yaw) function returning a distance
// (Infinity when out of reach). once: it is used up when acted on (the bunny); otherwise it can be
// used again (stepping back over the log). The game decides what each kind does (game.interactWith).
export class Interactions {
  constructor(game, list) { this.game = game; this.list = list; this.current = null; }

  reset() { for (const i of this.list) i.used = false; this.current = null; }

  dist(i, p) { return i.reach ? i.reach(p, this.game.player.yaw) : Math.hypot(i.x - p.x, i.z - p.z) < i.r ? Math.hypot(i.x - p.x, i.z - p.z) : Infinity; }

  update(dt, input) {
    const g = this.game, p = g.player.pos;
    let best = null, bd = Infinity;
    if (!g.player.seq && !g.player.frozen && !g.ui.modal) {
      for (const i of this.list) {
        if (i.used) continue;
        const d = this.dist(i, p);
        if (d < bd) { bd = d; best = i; }
      }
    }
    this.current = best;
    if (!best) { g.ui.setPrompt(null); return; }
    g.ui.setPrompt(`<kbd>E</kbd> ${best.label}`);
    if (input.hit('e') || input.tHit('interact')) {
      if (best.once) best.used = true;
      g.ui.setPrompt(null);
      g.interactWith(best);
    }
  }
}
