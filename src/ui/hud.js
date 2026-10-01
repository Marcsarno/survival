const $ = (id) => document.getElementById(id);

// Minimal HUD for the opening: speaker-labeled subtitles and italic sound captions (text only, no
// voices), one teaching hint at a time, an interaction prompt, a pause/help card, the end card and
// small corner buttons. No meters, inventory, map or goals.
const BEAT_NAMES = {
  search: '“Arianna?”', creak: 'A swing creaks', park: 'Into the park', prints: '“She was here.”', bunny: 'Found the bunny', urgency: '“Daddy!”',
  locked: 'The gate is locked', over: 'Over the gate', fork: 'Mud or firm ground', reveal: 'The house', argument: 'Voices inside', stay: '“Stay there.”', end: 'End',
};

export class UI {
  constructor(game) {
    this.game = game; this.modal = null;
    this.el = { prompt: $('prompt'), toasts: $('toasts'), fade: $('fade'), help: $('help'), end: $('endcard'), endTime: $('end-time'), endBeats: $('end-beats'), debug: $('debug'), subs: $('subs'), hint: $('hint') };
    this.runBtn = document.querySelector('#touch [data-act="jog"]');
    $('btn-help').onclick = (e) => { e.currentTarget.blur(); this.toggleHelp(); };
    $('btn-mute').onclick = (e) => { e.currentTarget.blur(); const on = game.audio.toggleMute(); $('btn-mute').textContent = on ? '🔊' : '🔇'; }; // blur: keys keep driving the game
  }

  show() { $('hud').classList.remove('hidden'); }

  toast(text, type = 'info', dur = 3200) {
    const d = document.createElement('div'); d.className = `toast ${type}`; d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 600); }, dur);
    this.game.log.push(text);
  }
  setPrompt(html) {
    const touchE = document.querySelector('#touch [data-act="interact"]');
    touchE?.classList.toggle('ready', !!html);
    if (!html) { this.el.prompt.classList.add('hidden'); this._prompt = null; return; }
    if (html !== this._prompt) { this.el.prompt.innerHTML = html; this._prompt = html; }
    this.el.prompt.classList.remove('hidden');
  }
  /** One subtitle line with its speaker (kind: '' | 'distant' | 'sfx' for an italic sound caption); null clears it. */
  subtitle(who, text, kind = '') {
    const s = this.el.subs;
    if (who == null || text == null) { s.classList.remove('on'); this._sub = null; return; }
    s.innerHTML = who ? `<b>${who}</b> ${text}` : text;
    s.classList.toggle('distant', kind === 'distant'); s.classList.toggle('sfx', kind === 'sfx'); s.classList.add('on');
    this._sub = who ? `${who}: ${text}` : text;
  }
  /** A small teaching hint (movement, then running). null hides it. */
  hint(text) {
    const h = this.el.hint;
    if (!text) { h.classList.remove('on'); this._hint = null; return; }
    h.textContent = text; h.classList.add('on'); this._hint = text;
  }
  revealRun() { this.runBtn?.classList.remove('hidden'); this.runBtn?.classList.add('reveal'); setTimeout(() => this.runBtn?.classList.remove('reveal'), 4000); }
  hideRun() { this.runBtn?.classList.add('hidden'); this.runBtn?.classList.remove('active', 'reveal', 'dim'); }
  setRunDimmed(on) { this.runBtn?.classList.toggle('dim', on); }
  fade(on) { this.el.fade.style.opacity = on ? 1 : 0; }

  toggleHelp(force) {
    if (this.modal === 'end') return;
    const on = force ?? this.el.help.classList.contains('hidden');
    this.el.help.classList.toggle('hidden', !on);
    this.modal = on ? 'help' : null;
    this.game.setPaused(on);
  }
  showEnd(seconds, beats = []) {
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
    this.el.endTime.textContent = fmt(seconds);
    this.el.endBeats.innerHTML = beats.filter((b) => BEAT_NAMES[b.id] && b.id !== 'end').map((b) => `<li><span>${fmt(b.t)}</span> ${BEAT_NAMES[b.id]}${b.way ? ` (${b.way})` : ''}</li>`).join('');
    this.el.end.classList.remove('hidden'); this.modal = 'end';
  }
  hideEnd() { this.el.end.classList.add('hidden'); if (this.modal === 'end') this.modal = null; }
}
