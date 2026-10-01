import { BUNNY, GATE, DOOR, PLAY, HOUSE, MUD, MUD_PATCHES } from '../world/level.js';
import { clamp } from '../core/util.js';

// The opening as an explicit sequence of one-time beats, set by place or action (never a clock) and
// stamped with story time (seconds since Start, pauses excluded). Text only: speaker-labeled
// subtitles, and sound captions in italics. One queue, so lines never overlap; nothing holds Marc
// back while a line plays. reset() clears everything for a restart.
//
//   search     Start, on the street, already searching: "Arianna?"
//   prints     near her small prints in the mud at the side-passage gate: "She was here."
//   call2      in the side passage: "Arianna!"
//   creak      in the backyard: a swing creaks somewhere ahead (caption)
//   locked     E at the backyard gate: Marc tries it, kicks the latch, "Locked."
//   over       E again: he climbs it and drops down the far side
//   park       into the park: his head turns to the swing, still moving
//   bunny      E at the bunny (or walking onto it, or passing it): "She wouldn't leave this."
//   urgency    1.6 s later: "Daddy!" from ahead; "Arianna!"; from here Marc runs
//   fork       through the broken fence: the mud straight on, or the firm way around (which is recorded)
//   reveal     into the yard: the house, top right; he slows; the figure leaves the window; a door shuts
//   argument   two adults argue inside (placeholder lines)
//   stay       near the door once the argument ends (or right at the door): "Stay there." Marc stops.
//   end        the end card
export const SPEAKERS = { marc: 'Marc', arianna: 'Arianna (distant)', woman: 'Woman (inside)', man: 'Man (inside)', door: 'Man (at the door)', sfx: '' };
const ARGUMENT = [
  ['woman', 'Someone’s out there.'],
  ['man', 'Then keep her quiet.'],
  ['woman', 'She’s a little girl—'],
  ['man', 'We don’t have a choice.'],
];
export const PRINTS_AT = { x: MUD_PATCHES[0][0], z: MUD_PATCHES[0][1] };
const YARD_Z = -61.8, FENCE_Z = -49.4;

export class Story {
  constructor(game) { this.g = game; this.reset(); }

  reset() {
    this.time = 0; this.flags = {}; this.beats = []; this.queue = []; this.line = null; this.gap = 0; this.timers = []; this.history = [];
    this.moved = 0;
    if (this.g.audio) { this.g.audio.tensionTarget = 0; this.g.audio.creakNear = false; }
    if (this.g.player) this.g.player.running = false;
    this.g.ui?.subtitle(null); this.g.ui?.hint(null);
  }

  mark(id, extra = {}) {
    if (this.flags[id] != null) return false;
    const p = this.g.player.pos;
    this.flags[id] = +this.time.toFixed(2);
    this.beats.push({ id, t: +this.time.toFixed(1), pos: [+p.x.toFixed(1), +p.z.toFixed(1)], ...extra });
    return true;
  }
  after(sec, fn) { this.timers.push({ at: this.time + sec, fn }); }
  say(who, text, opts = {}) { this.queue.push({ who, text, dur: opts.dur ?? clamp(0.9 + text.length * 0.055, 1.5, 3.4), gap: opts.gap ?? 0.45, ...opts }); }

  update(dt) {
    const g = this.g, p = g.player.pos, f = this.flags;
    this.time += dt; this.moved += g.player.speed * dt;
    for (const t of this.timers.filter((x) => x.at <= this.time)) { this.timers.splice(this.timers.indexOf(t), 1); t.fn(); }
    if (this.line) {
      this.line.left -= dt;
      if (this.line.left <= 0) { const l = this.line; this.line = null; this.gap = l.gap; this.history[this.history.length - 1].end = +this.time.toFixed(2); g.ui.subtitle(null); l.onEnd?.(); }
    } else if (this.gap > 0) this.gap -= dt;
    else if (this.queue.length) {
      const l = this.queue.shift(); l.left = l.dur; this.line = l;
      this.history.push({ who: l.who, text: l.text, start: +this.time.toFixed(2), end: null });
      g.ui.subtitle(SPEAKERS[l.who], l.text, l.who === 'arianna' ? 'distant' : l.who === 'sfx' ? 'sfx' : '');
      l.onStart?.();
    }

    // 1 the street
    if (f.search == null && this.time > 0.6) { this.mark('search'); this.say('marc', 'Arianna?'); g.ui.hint(g.input.isTouch ? 'Drag on the left side to walk' : 'WASD or arrow keys to walk'); g.player.lookAt({ x: PRINTS_AT.x, z: PRINTS_AT.z - 2, r: 7 }); }
    if (f.search != null && f.hintDone == null && (this.moved > 3 || this.time > 10)) { f.hintDone = this.time; g.ui.hint(null); }
    if (f.prints == null && Math.hypot(p.x - PRINTS_AT.x, p.z - PRINTS_AT.z) < 2.6) { this.mark('prints'); this.say('marc', 'She was here.'); g.player.lookAt({ ...PRINTS_AT, r: 4 }); }
    // 2 the passage, 3 the backyard
    if (f.call2 == null && p.z < -10) { this.mark('call2'); this.say('marc', 'Arianna!'); g.player.lookAt(null); }
    if (f.creak == null && p.z < -25) { this.mark('creak'); this.say('sfx', 'A swing creaks, somewhere ahead.'); g.audio.creakNear = true; }
    // 4 the park and the bunny
    if (f.park == null && p.z < GATE.z - 1.2) { this.mark('park'); g.player.lookAt({ x: PLAY.x, z: PLAY.z, r: 11 }); }
    if (f.lane == null && p.z < -44) { this.mark('lane'); g.player.lookAt({ x: BUNNY.x, z: BUNNY.z, r: 6 }); }
    if (f.bunny == null) {
      const d = Math.hypot(p.x - BUNNY.x, p.z - BUNNY.z);
      if (d < 0.7) this.findBunny('walked-onto');
      else if (p.z < BUNNY.z - 1.6 && d < 4) this.findBunny('passed');
    }
    if (f.urgency == null && p.z < FENCE_Z) this.urgency('reached-fence');
    // 5 mud or firm ground
    if (f.fork == null) {
      if (p.x > MUD.x0 - 0.2 && p.x < MUD.x1 && p.z < MUD.z0 + 0.2 && p.z > MUD.z1) this.mark('fork', { way: 'mud' });
      else if (p.x > 8.4 && p.z < -51.4 && p.z > -61) this.mark('fork', { way: 'firm' });
    }
    // 6 the yard: the reveal, the voices, the door
    if (f.reveal == null && p.z < YARD_Z) this.reveal();
    const dDoor = Math.hypot(p.x - DOOR.x, p.z - DOOR.z);
    const argued = f.argument != null && !this.queue.some((l) => l.group === 'argument') && this.line?.group !== 'argument';
    if (f.stay == null && f.reveal != null && ((dDoor < 6.8 && argued) || dDoor < 3.6)) this.stay();
  }

  findBunny(how) {
    const g = this.g;
    if (!this.mark('bunny', { how })) return;
    const it = g.level.interact.find((i) => i.id === 'bunny');
    if (how !== 'passed') {
      if (it) it.used = true;
      g.player.frozen = true; g.player.lookAt({ x: BUNNY.x, z: BUNNY.z, r: 4 });
      this.after(0.6, () => g.player.carry(g.level.dynamic.bunny));
      this.after(1.3, () => { if (this.flags.stay == null) g.player.frozen = false; });
    }
    this.say('marc', 'She wouldn’t leave this.', { onEnd: () => this.after(1.6, () => this.urgency('after-bunny')) });
  }

  /** Her call from ahead: from here the search is a run. */
  urgency(reason) {
    const g = this.g;
    if (!this.mark('urgency', { reason })) return;
    this.say('arianna', 'Daddy!', { dur: 1.6, onStart: () => { g.camera.shake = 0.08; g.audio.tensionTarget = 0.35; g.player.lookAt({ x: HOUSE.x, z: HOUSE.z, r: 60 }); g.player.running = true; } });
    this.say('marc', 'Arianna!');
  }

  /** E at the gate: the first time from the south it is locked; after that (or from the north) he climbs. */
  gate(fromSouth) {
    const g = this.g;
    if (g.player.seq) return;
    if (fromSouth && this.flags.locked == null) {
      this.mark('locked');
      g.player.yaw = Math.PI;
      g.player.tryGate(() => { g.level.gateRattle(); this.say('marc', 'Locked.', { dur: 1.4 }); }, () => g.level.setGateLabel('Climb over'));
      return;
    }
    g.player.climbGate(GATE.z, (GATE.x0 + GATE.x1) / 2, fromSouth ? -1 : 1, () => g.level.gateRattle(0.4), () => { if (fromSouth) this.mark('over'); });
  }

  /** Into the yard: the house top right. He slows to a walk; the figure leaves the window; a door shuts. */
  reveal() {
    const g = this.g;
    if (!this.mark('reveal')) return;
    g.player.running = false;
    g.player.lookAt({ x: HOUSE.x, z: HOUSE.z, r: 30 });
    g.audio.tensionTarget = 0.6;
    this.after(1.1, () => g.level.dynamic.figure.withdraw());
    this.after(1.8, () => { g.audio.door(); this.say('sfx', 'A door shuts inside the house.', { dur: 2 }); });
    this.after(2.2, () => this.argument());
  }

  argument() {
    if (!this.mark('argument')) return;
    this.g.audio.tensionTarget = 0.85;
    for (const [who, text] of ARGUMENT) this.say(who, text, { group: 'argument', gap: 0.35 });
  }

  stay() {
    const g = this.g;
    if (this.flags.argument == null) this.argument();
    const dropped = this.queue.filter((l) => l.group === 'argument').length;
    this.queue = this.queue.filter((l) => l.group !== 'argument');
    this.mark('stay', { argumentLinesDropped: dropped });
    this.say('door', 'Stay there.', {
      dur: 1.8,
      onStart: () => {
        g.player.frozen = true; g.audio.tensionTarget = 1; g.audio.creak();
        const m = g.level.dynamic.doorCrack.material; const open = () => { m.opacity = Math.min(0.9, m.opacity + 0.06); if (m.opacity < 0.9) this.after(0.03, open); }; open();
      },
      onEnd: () => this.after(1.6, () => this.end()),
    });
  }

  end() {
    if (!this.mark('end')) return;
    this.g.audio.tensionTarget = 0;
    this.g.endSlice();
  }

  state() {
    return { time: +this.time.toFixed(1), flags: this.flags, beats: this.beats, history: this.history, line: this.line?.text ?? null, queued: this.queue.length };
  }
}
