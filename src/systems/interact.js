// Route interactions: find the nearest usable point, show its prompt, act on E / the touch button.
// Kinds: 'gate' (swing the backyard gate open) and 'arrive' (automatic trigger at the destination).
export class Interactions {
  constructor(game, list) { this.game = game; this.list = list; this.current = null; }

  reset() { for (const i of this.list) i.used = false; this.current = null; }

  update(dt, input) {
    const g = this.game, p = g.player.pos;
    let best = null, bd = Infinity;
    for (const i of this.list) {
      if (i.used) continue;
      const d = Math.hypot(i.x - p.x, i.z - p.z);
      if (d < i.r && d < bd) { bd = d; best = i; }
    }
    this.current = best;
    if (best?.auto) { best.used = true; this.apply(best); return; }
    if (!best || g.ui.modal || g.player.frozen) { g.ui.setPrompt(null); return; }
    g.ui.setPrompt(`<kbd>E</kbd> ${best.label}`);
    if (input.hit('e') || input.tHit('interact')) { best.used = true; g.ui.setPrompt(null); this.apply(best); }
  }

  apply(i) {
    const g = this.game;
    if (i.kind === 'gate') g.openGate();
    if (i.kind === 'arrive') g.arrive();
  }
}
