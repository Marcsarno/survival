// Tiny procedural WebAudio sound set (no audio files): wind, footsteps, fire, the gate.
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
    // the wind rises as the woods deepen
    const wild = { shelter: 0.7, street: 0.85, woods: 1.1, deep: 1.6, house: 1.0 }[game.section] ?? 1;
    this.windGain.gain.value += ((0.03 + 0.03 * n) * wild - this.windGain.gain.value) * 0.02;
    this.windFilter.frequency.value = 380 + Math.sin(performance.now() * 0.0003) * 120;
    const d = game.fireDist();
    this.fireGain.gain.value = Math.max(0, 1 - d / 14) * 0.05 * (0.6 + Math.random() * 0.8);
    if (d < 12 && Math.random() < 0.08) this.burst({ dur: 0.03, freq: 2500 + Math.random() * 2000, gain: 0.08 * (1 - d / 12) });
  }

  step(surface, run) {
    if (surface === 'snow') this.burst({ dur: run ? 0.1 : 0.13, freq: 1500, q: 0.8, gain: run ? 0.1 : 0.07 });
    else if (surface === 'sand') this.burst({ dur: 0.1, freq: 900, gain: 0.05 });
    else this.burst({ dur: 0.05, freq: 600, type: 'lowpass', gain: 0.08 });
  }
  click() { this.tone({ freq: 1800, dur: 0.03, type: 'square', gain: 0.05 }); }
  creak() { this.tone({ freq: 210, to: 140, dur: 0.7, type: 'sawtooth', gain: 0.035 }); this.tone({ freq: 160, to: 250, dur: 0.5, type: 'triangle', gain: 0.03, delay: 0.45 }); setTimeout(() => this.burst({ dur: 0.15, freq: 400, type: 'lowpass', gain: 0.2 }), 900); }
}
