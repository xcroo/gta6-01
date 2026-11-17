// SOLMARA — input.js
// Keyboard + mouse. WASD move/drive, Shift run, Space jump/handbrake,
// E enter/exit car, H horn, M mission, Esc pause, mouse drag orbits the
// camera, click shoots. Also exposes the shot-mode hooks used by the
// screenshot runs (no keys needed there).

var Input = {
  keys: {},
  mouseDown: false,
  mouseDownAt: 0,
  dragging: false,
  lastX: 0, lastY: 0,
  camYaw: 0.6, camPitch: 0.42, camDist: 8,
  onKey: null, // set by main.js: (code) => void for one-shot keys

  get forward() { return this.keys['KeyW'] || this.keys['ArrowUp']; },
  get back() { return this.keys['KeyS'] || this.keys['ArrowDown']; },
  get left() { return this.keys['KeyA'] || this.keys['ArrowLeft']; },
  get right() { return this.keys['KeyD'] || this.keys['ArrowRight']; },
  get run() { return this.keys['ShiftLeft'] || this.keys['ShiftRight']; },
  get jump() { return this.keys['Space'] && !G.inCar; },
  get handbrake() { return this.keys['Space'] && G.inCar; },
  get aiming() { return this.mouseDown; },

  init: function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      self.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      if (self.onKey) self.onKey(e.code);
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    window.addEventListener('blur', function () { self.keys = {}; self.mouseDown = false; });

    var canvas = null;
    window.addEventListener('mousedown', function (e) {
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
      self.mouseDown = true;
      self.mouseDownAt = performance.now();
      self.dragging = true;
      self.lastX = e.clientX; self.lastY = e.clientY;
    });
    window.addEventListener('mouseup', function () {
      self.mouseDown = false;
      self.dragging = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (!self.dragging) return;
      var dx = e.clientX - self.lastX, dy = e.clientY - self.lastY;
      self.lastX = e.clientX; self.lastY = e.clientY;
      self.camYaw -= dx * 0.005;
      self.camPitch = clamp(self.camPitch + dy * 0.004, 0.08, 1.2);
    });
    window.addEventListener('wheel', function (e) {
      self.camDist = clamp(self.camDist + Math.sign(e.deltaY) * 1.2, 5, 16);
    }, { passive: true });

    // touch: left half is a virtual stick, right half drags the camera
    var stick = null;
    window.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.clientX < window.innerWidth / 2 && !stick) {
          stick = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else {
          self.dragging = true; self.lastX = t.clientX; self.lastY = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (stick && t.identifier === stick.id) {
          var dx = t.clientX - stick.x, dy = t.clientY - stick.y;
          self.keys['KeyW'] = dy < -24;
          self.keys['KeyS'] = dy > 24;
          self.keys['KeyA'] = dx < -24;
          self.keys['KeyD'] = dx > 24;
        } else if (self.dragging) {
          self.camYaw -= (t.clientX - self.lastX) * 0.006;
          self.camPitch = clamp(self.camPitch + (t.clientY - self.lastY) * 0.005, 0.08, 1.2);
          self.lastX = t.clientX; self.lastY = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (stick && e.changedTouches[i].identifier === stick.id) {
          stick = null;
          self.keys['KeyW'] = self.keys['KeyS'] = self.keys['KeyA'] = self.keys['KeyD'] = false;
        }
      }
      self.dragging = false;
    });
  },
};
