// Keyboard and touch input merged into one action state.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();   // keys pressed this frame
    this.touch = { active: false, joyX: 0, joyY: 0, jogToggle: false, buttons: new Set(), pressedButtons: new Set(), releasedButtons: new Set() };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.canvas = canvas;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k); this.pressed.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    // no page scrolling, rubber-banding, double-tap or pinch zoom while playing (help text can still scroll)
    document.addEventListener('touchmove', (e) => { if (!e.target.closest?.('.scrollable')) e.preventDefault(); }, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());
    if (this.isTouch) this.setupTouch();
  }

  setupTouch() {
    document.body.classList.add('touch');
    document.getElementById('touch').classList.remove('hidden');
    // floating joystick: a thumb down anywhere in the left zone centers the stick there
    const zone = document.getElementById('joy-zone'), joy = document.getElementById('joy'), knob = document.getElementById('joy-knob');
    let joyId = null, cx = 0, cy = 0;
    const R = 52;
    const move = (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touch.joyX = dx / R; this.touch.joyY = dy / R; this.touch.active = true;
    };
    const end = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; knob.style.transform = ''; joy.classList.remove('active'); joy.style.left = joy.style.top = ''; this.touch.joyX = this.touch.joyY = 0;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      e.preventDefault();
      joyId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch {}
      cx = e.clientX; cy = e.clientY;
      joy.style.left = `${cx}px`; joy.style.top = `${cy}px`; joy.classList.add('active');
      move(e);
    });
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    for (const b of document.querySelectorAll('#touch .tb')) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {}
        if (act === 'jog') { this.touch.jogToggle = !this.touch.jogToggle; b.classList.toggle('active', this.touch.jogToggle); return; }
        this.touch.buttons.add(act); this.touch.pressedButtons.add(act); b.classList.add('active');
      });
      const up = () => {
        if (act === 'jog') return;
        if (this.touch.buttons.has(act)) this.touch.releasedButtons.add(act);
        this.touch.buttons.delete(act); b.classList.remove('active');
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
  }

  down(k) { return this.keys.has(k); }
  hit(k) { return this.pressed.has(k); }
  tDown(a) { return this.touch.buttons.has(a); }
  tHit(a) { return this.touch.pressedButtons.has(a); }
  tUp(a) { return this.touch.releasedButtons.has(a); }

  // movement vector in screen space (x right, y down), length <= 1
  moveVector() {
    let x = 0, y = 0;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.touch.joyX || this.touch.joyY) { x = this.touch.joyX; y = this.touch.joyY; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, len: Math.min(1, l) };
  }

  endFrame() {
    this.pressed.clear();
    this.touch.pressedButtons.clear(); this.touch.releasedButtons.clear();
  }
}
