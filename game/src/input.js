// input.js — keyboard and mouse state for Porto Verde.

const Input = {
  keys: {},
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  mouseClicked: false, // consumed once per click by the shooter
  pointerLocked: false,
};

function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    Input.keys[e.code] = true;
    if (e.code === 'KeyM') V.muted = !V.muted;
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyE') tryEnterExitCar();
    if (e.code === 'KeyF') tryMelee();
    if (e.code === 'KeyR') reloadWeapon();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { Input.mouseDown = true; Input.mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) Input.mouseDown = false; });
  window.addEventListener('mousemove', (e) => { Input.mouseX = e.clientX; Input.mouseY = e.clientY; });
  document.addEventListener('pointerlockchange', () => {
    Input.pointerLocked = document.pointerLockElement === document.body;
  });
}

function key(code) { return !!Input.keys[code]; }
function consumeClick() {
  const c = Input.mouseClicked;
  Input.mouseClicked = false;
  return c;
}
