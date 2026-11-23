// Keyboard + mouse-orbit input. No pointer lock (headless-safe): drag to orbit.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDown = false;
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.clicked = false;   // left click this frame (shoot / punch)
    this.pressed = new Set(); // keys pressed this frame (edge-triggered)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.lastX = e.clientX; this.lastY = e.clientY;
      if (e.button === 0) this.clicked = true;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown) return;
      this.yawDelta -= (e.clientX - this.lastX) * 0.005;
      this.pitchDelta -= (e.clientY - this.lastY) * 0.004;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  axis() {
    // returns {f, s} forward/strafe in -1..1 from WASD/arrows
    let f = 0, s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return { f, s };
  }
  endFrame() { this.pressed.clear(); this.clicked = false; this.yawDelta = 0; this.pitchDelta = 0; }
}
