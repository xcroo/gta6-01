// SOLMARA — util.js
// Shared helpers and the global game state container. No other file
// creates top-level state; everything hangs off `G` so the classic
// scripts loaded after this one can share it without modules.

// The one global every module reads and writes.
var G = {
  scene: null, camera: null, renderer: null, clock: null,
  mode: 'menu',            // menu | playing | paused | busted | complete
  time: 0,                 // seconds since the run started
  dayTime: 16.4,           // golden-hour clock (hours)
  cash: 250,
  health: 100, maxHealth: 100,
  ammo: 24, reserveAmmo: 120,
  wanted: 0,               // 0..5 stars
  wantedHeat: 0,           // crimes add heat; heat decays when hidden
  stats: { carsStolen: 0, missionsDone: 0, copsDodged: 0, shotsFired: 0, hits: 0 },
  player: null,            // on-foot controller state
  car: null,               // car the player is driving (or null)
  inCar: false,
  mission: null,           // active mission runtime
  missionIndex: 0,         // next mission to start (0..4)
  missionsDone: 0,
  freeRoam: false,
  saveSlot: 'solmara-save-v1',
  shotMode: null,          // 'street' | 'drive' | 'chase' | 'mission' when screenshotting
  paused: false,
  muted: false,
  debug: false,
};

// ---- deterministic random (same city every run) ---------------------------
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var rng = mulberry32(20261117);
function rr(a, b) { return a + rng() * (b - a); }
function ri(a, b) { return Math.floor(rr(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function chance(p) { return rng() < p; }

// ---- math helpers ---------------------------------------------------------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
function angleLerp(a, b, t) {
  var d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function angleDiff(a, b) {
  var d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function dist2d(ax, az, bx, bz) {
  var dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function fmtTime(sec) {
  var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function el(id) { return document.getElementById(id); }
function show(id, on) { var e = el(id); if (e) e.style.display = on ? 'block' : 'none'; }
