// Lightweight goals that point new players at the loop (no scripted missions).
// Each goal checks game state; the first few unfinished ones are shown under the clock.
export const GOALS = [
  { id: 'wood', text: 'Bring firewood back to the shelter stash', done: (g) => g.shelter.stash.count('wood') >= 5 || g.stats.woodBurned >= 1 },
  { id: 'feed', text: 'Feed the fire (E at the fire pit)', done: (g) => g.stats.woodBurned >= 1 },
  { id: 'axe', text: 'Find the axe at the woodshed in the pines', done: (g) => g.tools.axe },
  { id: 'chop', text: 'Chop down a dead pine with the axe', done: (g) => (g.stats.chopped || 0) >= 1 },
  { id: 'search', text: 'Search 3 porches, cars or mailboxes', done: (g) => g.stats.searched >= 3 },
  { id: 'gun', text: 'Check the police cruiser on Hibiscus Lane', done: (g) => g.tools.pistol },
  { id: 'meds', text: 'Scavenge the Pelican Pharmacy', done: (g) => g.interact.list.some((i) => i.label === 'Search pharmacy aisles' && i.used) },
  { id: 'build', text: 'Improve the shelter (open the stash)', done: (g) => Object.values(g.shelter.upgrades).some(Boolean) },
  { id: 'dog', text: 'Win over the stray dog at the playground', done: (g) => g.stats.dog },
  { id: 'night', text: 'Survive a night', done: (g) => g.daynight.day >= 2 },
  { id: 'all', text: 'Build all four shelter improvements', done: (g) => Object.values(g.shelter.upgrades).every(Boolean) },
];

export class Goals {
  constructor(game) {
    this.game = game; this.done = new Set();
    this.el = document.createElement('div'); this.el.id = 'goals';
    document.getElementById('hud').appendChild(this.el);
    this.t = 0; this.html = '';
  }
  update(dt) {
    this.t += dt; if (this.t < 0.5) return; this.t = 0;
    const g = this.game;
    for (const goal of GOALS) {
      if (!this.done.has(goal.id) && goal.done(g)) {
        this.done.add(goal.id);
        if (g.started) { g.ui.toast(`✓ ${goal.text}`, 'good', 3500); g.audio?.pickup(); }
      }
    }
    const open = GOALS.filter((x) => !this.done.has(x.id)).slice(0, 3);
    const html = open.length ? `<b>Goals</b>${open.map((x) => `<div>◻ ${x.text}</div>`).join('')}` : '<b>Goals</b><div>All done — keep the fire burning.</div>';
    if (html !== this.html) { this.el.innerHTML = html; this.html = html; }
  }
}
