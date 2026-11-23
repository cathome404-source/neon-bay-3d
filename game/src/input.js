// Keyboard and mouse handling for Neon Bay 3D. Keys held down are polled each
// frame, while single presses (enter car, punch, pause, radio, weapon switch)
// sit in a queue and are consumed exactly once — no press is lost or double-counted.
// Exports: createInput, WEAPONS (the four weapon slots in wheel order).

export const WEAPONS = ['fists', 'pistol', 'shotgun', 'smg'];

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space',
]);

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  let weaponIndex = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = false;

  function onKeyDown(event) {
    if (MOVE_CODES.has(event.code) || event.code === 'Tab') {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
    if (event.code === 'Digit1') weaponIndex = 0;
    else if (event.code === 'Digit2') weaponIndex = 1;
    else if (event.code === 'Digit3') weaponIndex = 2;
    else if (event.code === 'Digit4') weaponIndex = 3;
    else if (event.code === 'Tab') weaponIndex = (weaponIndex + 1) % WEAPONS.length;
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouseDown = true;
    clicked = true;
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    mouseDown = false;
  }

  function onBlur() {
    held.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    /** True while the key with this code is held down. */
    held(code) {
      return held.has(code);
    },
    /** True only once, on the frame after the key was pressed. */
    takePressed(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    /** True only once, on the frame after a left mouse click. */
    takeClick() {
      if (!clicked) return false;
      clicked = false;
      return true;
    },
    /** Current mouse position in window pixels. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The weapon-wheel selection, as an index into WEAPONS. */
    weaponIndex() {
      return weaponIndex;
    },
    weapon() {
      return WEAPONS[weaponIndex];
    },
    /** Forward/strafe input from WASD or arrows, as -1/0/1 each. */
    moveAxes() {
      const forward = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0)
        - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const strafe = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0)
        - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { forward, strafe };
    },
    sprint() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    brake() {
      return held.has('Space');
    },
  };
}
