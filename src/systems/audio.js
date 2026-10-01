// Temporary sound for the opening, all procedural WebAudio (no files, no voices: lines are text only).
//
// - Ambience: a low wind, evening insects (a pulsing high band), a low tension drone the story raises
//   and cuts. (The water loop stays silent: there is no water in the neighborhood opening.)
// - The playground swing creaks as it sways (louder as Marc nears it).
// - Footsteps by surface (concrete, grass, leaf litter, mud), heavier when running; the gate rattling against its padlock;
//   a thud when Marc lands; the house door.
// The audio context starts from the Start button (a normal user gesture).
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.tension = 0; this.tensionTarget = 0; this.creakNear = false; this._creakT = 0; this._lap = 0; }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const loop = (filterType, freq, q, gain) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.master); s.start(0, Math.random() * 2);
      return { f, g };
    };
    this.wind = loop('bandpass', 320, 0.5, 0.03);
    this.water = loop('lowpass', 520, 0.7, 0.0);
    this.insects = loop('bandpass', 4300, 9, 0.0);
    // tension drone: detuned low saws through a lowpass
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    for (const f of [49, 49.6, 73.5]) { const o = c.createOscillator(); o.type = f > 70 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    lp.connect(this.droneGain); this.droneGain.connect(this.master); this.droneFilter = lp;
  }

  get state() { return this.ctx ? this.ctx.state : 'none'; }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.7; return !this.muted; }
  pauseVoices() {}

  burst({ dur = 0.1, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.002, pitchTo = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (pitchTo) f.frequency.exponentialRampToValueAtTime(pitchTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone({ freq = 440, dur = 0.2, type = 'sine', gain = 0.2, to = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  /** per frame: game supplies distances (seawall, swing) and the swing's motion */
  update(dt, { seaDist = 99, swingDist = 99, swingPhase = 0, night = 0 } = {}) {
    if (!this.ctx) return;
    const now = performance.now() * 0.001;
    this.wind.g.gain.value += (0.03 + 0.015 * Math.sin(now * 0.21) - this.wind.g.gain.value) * 0.03;
    this.wind.f.frequency.value = 300 + Math.sin(now * 0.31) * 90;
    const wTarget = 0.07 * Math.max(0, 1 - Math.max(0, seaDist) / 14) * (0.7 + 0.3 * Math.sin(now * 0.9));
    this.water.g.gain.value += (wTarget - this.water.g.gain.value) * 0.05;
    if (seaDist < 6 && (this._lap -= dt) < 0) { this._lap = 1.2 + Math.random() * 1.6; this.burst({ dur: 0.5, freq: 380, type: 'lowpass', gain: 0.05 * (1 - seaDist / 6), attack: 0.15 }); }
    // insects swell as the light goes; a slow pulse
    this.insects.g.gain.value = (0.006 + 0.012 * night) * (0.6 + 0.4 * Math.sin(now * 5.1) * Math.sin(now * 0.7));
    // the swing: creak at the ends of each swing
    if (swingDist < 26) {
      this._creakT -= dt;
      const end = Math.abs(Math.sin(swingPhase)) > 0.96;
      if (end && this._creakT < 0) {
        this._creakT = 0.9; const k = Math.max(0, 1 - swingDist / 26) * (this.creakNear ? 1 : 0.6);
        this.tone({ freq: 640 + Math.random() * 80, to: 540, dur: 0.35, type: 'sawtooth', gain: 0.012 * k });
        this.tone({ freq: 910, to: 820, dur: 0.22, type: 'triangle', gain: 0.01 * k, delay: 0.05 });
      }
    }
    this.tension += (this.tensionTarget - this.tension) * (1 - Math.exp(-dt * (this.tensionTarget < this.tension ? 6 : 0.4)));
    this.droneGain.gain.value = 0.05 * this.tension;
    this.droneFilter.frequency.value = 160 + 240 * this.tension;
  }

  step(surface, run = false) {
    const k = run ? 1.5 : 1;
    if (surface === 'concrete') this.burst({ dur: 0.05, freq: 1900, q: 1.3, gain: 0.06 * k });
    else if (surface === 'mud') { this.burst({ dur: 0.16, freq: 420, q: 0.8, gain: 0.07 * k, attack: 0.02 }); this.burst({ dur: 0.08, freq: 1500, q: 2.5, gain: 0.02 * k, delay: 0.07 }); }
    else if (surface === 'leaves') { this.burst({ dur: 0.09, freq: 3200, q: 0.7, gain: 0.05 * k }); this.burst({ dur: 0.07, freq: 600, q: 0.8, gain: 0.04 * k }); }
    else this.burst({ dur: 0.07, freq: 800, q: 0.7, gain: 0.045 * k });
  }
  rattle(k = 1) { // the gate shaken against its padlock
    for (let i = 0; i < 5; i++) { this.burst({ dur: 0.05, freq: 2600 + Math.random() * 900, q: 5, gain: 0.07 * k, delay: i * 0.09 + Math.random() * 0.03 }); this.burst({ dur: 0.08, freq: 250, type: 'lowpass', gain: 0.12 * k, delay: i * 0.09 }); }
  }
  thud() { this.burst({ dur: 0.18, freq: 140, type: 'lowpass', gain: 0.3 }); }
  door() { this.burst({ dur: 0.03, freq: 3200, q: 4, gain: 0.1 }); this.tone({ freq: 190, to: 120, dur: 0.45, type: 'triangle', gain: 0.04, delay: 0.05 }); this.burst({ dur: 0.25, freq: 160, type: 'lowpass', gain: 0.35, delay: 0.5 }); }
  creak() { this.tone({ freq: 230, to: 150, dur: 0.8, type: 'sawtooth', gain: 0.025 }); }
}
