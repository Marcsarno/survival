const $ = (id) => document.getElementById(id);

// Minimal HUD for the route slice: an interaction prompt, a pause/help card, the end card, and
// small corner buttons. No meters, inventory, map or goals.
export class UI {
  constructor(game) {
    this.game = game; this.modal = null;
    this.el = { prompt: $('prompt'), toasts: $('toasts'), fade: $('fade'), help: $('help'), end: $('endcard'), endTime: $('end-time'), debug: $('debug') };
    $('btn-help').onclick = () => this.toggleHelp();
    $('btn-mute').onclick = () => { const on = game.audio.toggleMute(); $('btn-mute').textContent = on ? '🔊' : '🔇'; };
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
  fade(on) { this.el.fade.style.opacity = on ? 1 : 0; }

  toggleHelp(force) {
    if (this.modal === 'end') return;
    const on = force ?? this.el.help.classList.contains('hidden');
    this.el.help.classList.toggle('hidden', !on);
    this.modal = on ? 'help' : null;
    this.game.paused = on;
  }
  showEnd(seconds) {
    const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
    this.el.endTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
    this.el.end.classList.remove('hidden'); this.modal = 'end';
  }
  hideEnd() { this.el.end.classList.add('hidden'); if (this.modal === 'end') this.modal = null; }
}
