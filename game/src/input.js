// Dusthaven — input.js
// Keyboard and mouse state. The game reads keys through this module so
// the rest of the code never touches raw DOM events. `pressed` is an
// edge-triggered set: true only on the frame the key went down.
var DH = window.DH || (window.DH = {});

DH.input = (function () {
  'use strict';

  var keys = {};
  var pressed = {};
  var mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false };
  var anyKey = false;
  var started = false;

  function onKeyDown(e) {
    var c = e.code;
    if (c === 'Space' || c === 'ArrowUp' || c === 'ArrowDown' ||
        c === 'ArrowLeft' || c === 'ArrowRight' || c === 'Tab') {
      e.preventDefault();
    }
    if (!keys[c]) pressed[c] = true;
    keys[c] = true;
    anyKey = true;
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function onMouseMove(e) {
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  function onBlur() {
    keys = {};
    mouse.down = false;
  }

  function init() {
    if (started) return;
    started = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);
  }

  // Was the key held during this frame?
  function down(code) {
    return !!keys[code];
  }

  // Did the key go down on this frame?
  function hit(code) {
    return !!pressed[code];
  }

  // Held now, or just pressed: the forgiving check menus use.
  function hitOrDown(code) {
    return !!pressed[code] || !!keys[code];
  }

  // Driving / walking axes, -1..1, from WASD or the arrow keys.
  function moveAxes() {
    var f = 0, s = 0;
    if (down('KeyW') || down('ArrowUp')) f += 1;
    if (down('KeyS') || down('ArrowDown')) f -= 1;
    if (down('KeyD') || down('ArrowRight')) s += 1;
    if (down('KeyA') || down('ArrowLeft')) s -= 1;
    return { forward: f, strafe: s };
  }

  // Call once at the end of every frame: edges and mouse deltas expire.
  function endFrame() {
    pressed = {};
    mouse.dx = 0;
    mouse.dy = 0;
    mouse.clicked = false;
    anyKey = false;
  }

  function consumeAnyKey() {
    var v = anyKey;
    anyKey = false;
    return v;
  }

  return {
    init: init,
    down: down,
    hit: hit,
    hitOrDown: hitOrDown,
    moveAxes: moveAxes,
    endFrame: endFrame,
    consumeAnyKey: consumeAnyKey,
    keys: keys,
    mouse: mouse
  };
})();
