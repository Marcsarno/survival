// Keyboard, mouse and touch input merged into one action state.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();   // keys pressed this frame
    this.mouse = { x: 0, y: 0, left: false, right: false, leftPressed: false, rightReleased: false, wheel: 0 };
    this.touch = { active: false, joyX: 0, joyY: 0, buttons: new Set(), pressedButtons: new Set(), releasedButtons: new Set() };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.canvas = canvas;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k); this.pressed.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouseMoved = true; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) { this.mouse.right = false; this.mouse.rightReleased = true; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    if (this.isTouch) this.setupTouch();
  }

  setupTouch() {
    document.body.classList.add('touch');
    document.getElementById('touch').classList.remove('hidden');
    const joy = document.getElementById('joy'), knob = document.getElementById('joy-knob');
    let joyId = null, cx = 0, cy = 0;
    const R = 52;
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch {}
      const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touch.joyX = dx / R; this.touch.joyY = dy / R; this.touch.active = true;
    };
    const end = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; knob.style.transform = ''; this.touch.joyX = this.touch.joyY = 0;
    };
    joy.addEventListener('pointermove', move);
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    for (const b of document.querySelectorAll('#touch .tb')) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {}
        if (act === 'sprint') { this.touch.sprintToggle = !this.touch.sprintToggle; b.classList.toggle('active', this.touch.sprintToggle); return; }
        this.touch.buttons.add(act); this.touch.pressedButtons.add(act); b.classList.add('active');
      });
      const up = () => {
        if (act === 'sprint') return;
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
    this.mouse.leftPressed = false; this.mouse.rightReleased = false; this.mouse.wheel = 0;
    this.touch.pressedButtons.clear(); this.touch.releasedButtons.clear();
  }
}
