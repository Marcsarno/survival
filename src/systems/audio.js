// Tiny procedural WebAudio sound set (no audio files): wind, footsteps, gunshot, groans, fire, dog.
export class Audio {
  constructor() { this.ctx = null; this.enabled = true; }

  start() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.55; this.master.connect(c.destination);
    // white noise buffer shared by effects
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind bed
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.05;
    src.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.master); src.start();
    this.windFilter = bp;
    // fire crackle bed (gain driven by distance to fire)
    this.fireGain = c.createGain(); this.fireGain.gain.value = 0; this.fireGain.connect(this.master);
    const fsrc = c.createBufferSource(); fsrc.buffer = this.noiseBuf; fsrc.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    fsrc.connect(lp); lp.connect(this.fireGain); fsrc.start();
  }

  burst({ dur = 0.1, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.002, pitchTo = null } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
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
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.55; return !this.muted; }

  update(game) {
    if (!this.ctx) return;
    const n = game.daynight.nightness;
    this.windGain.gain.value = (0.035 + 0.035 * n) * (1 + 1.6 * (game.weather?.squall || 0));
    this.windFilter.frequency.value = 380 + Math.sin(performance.now() * 0.0003) * 120;
    const d = game.shelter.distToFire(game.player.pos);
    this.fireGain.gain.value = game.shelter.lit ? Math.max(0, 1 - d / 14) * 0.05 * (0.6 + Math.random() * 0.8) : 0;
    // distant wolves in the pines late at night
    this._howlT = (this._howlT ?? 40) - 1 / 60;
    if (n > 0.8 && this._howlT <= 0) { this._howlT = 50 + Math.random() * 60; const dw = Math.max(0, game.player.pos.x + 120); this.howl(Math.max(0.012, 0.06 - dw / 4000)); }
    if (game.shelter.lit && d < 12 && Math.random() < 0.08) this.burst({ dur: 0.03, freq: 2500 + Math.random() * 2000, gain: 0.08 * (1 - d / 12) });
  }

  step(surface, run) {
    if (surface === 'snow') this.burst({ dur: run ? 0.1 : 0.13, freq: 1500, q: 0.8, gain: run ? 0.1 : 0.07 });
    else if (surface === 'sand') this.burst({ dur: 0.1, freq: 900, gain: 0.05 });
    else this.burst({ dur: 0.05, freq: 600, type: 'lowpass', gain: 0.08 });
  }
  gunshot() { this.burst({ dur: 0.35, freq: 1800, type: 'lowpass', gain: 0.9, pitchTo: 300 }); this.tone({ freq: 120, to: 40, dur: 0.25, type: 'triangle', gain: 0.5 }); }
  click() { this.tone({ freq: 1800, dur: 0.03, type: 'square', gain: 0.05 }); }
  pickup() { this.tone({ freq: 660, dur: 0.12, gain: 0.08 }); this.tone({ freq: 990, dur: 0.16, gain: 0.07, delay: 0.07 }); }
  build() { for (let i = 0; i < 4; i++) setTimeout(() => this.burst({ dur: 0.08, freq: 300, type: 'lowpass', gain: 0.4 }), i * 140); }
  chop() { this.burst({ dur: 0.12, freq: 500, type: 'lowpass', gain: 0.35 }); }
  whoosh() { this.burst({ dur: 0.5, freq: 300, type: 'lowpass', gain: 0.18, pitchTo: 1200, attack: 0.15 }); }
  swing() { this.burst({ dur: 0.18, freq: 800, gain: 0.08, pitchTo: 2400, attack: 0.05 }); }
  thud() { this.tone({ freq: 90, to: 50, dur: 0.15, type: 'triangle', gain: 0.4 }); this.burst({ dur: 0.08, freq: 400, type: 'lowpass', gain: 0.3 }); }
  hurt() { this.tone({ freq: 180, to: 90, dur: 0.25, type: 'sawtooth', gain: 0.12 }); }
  groan(dist) { const g = Math.max(0.02, 0.14 * (1 - dist / 26)); this.tone({ freq: 95 + Math.random() * 30, to: 70, dur: 1.1, type: 'sawtooth', gain: g }); }
  zombieDie() { this.tone({ freq: 110, to: 40, dur: 0.9, type: 'sawtooth', gain: 0.12 }); }
  radio() { this.burst({ dur: 1.4, freq: 2200, q: 0.4, gain: 0.12, attack: 0.05 }); this.tone({ freq: 440, dur: 0.6, type: 'square', gain: 0.02, to: 300, delay: 0.3 }); }
  howl(g = 0.05) { this.tone({ freq: 380, to: 620, dur: 1.2, type: 'sine', gain: g }); this.tone({ freq: 620, to: 430, dur: 1.6, type: 'sine', gain: g * 0.8, delay: 1.1 }); }
  bark() { this.tone({ freq: 520, to: 300, dur: 0.09, type: 'square', gain: 0.07 }); this.tone({ freq: 480, to: 280, dur: 0.1, type: 'square', gain: 0.06, delay: 0.16 }); }
}
