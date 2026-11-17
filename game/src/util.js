// util.js — math, seeded random and shared helpers for Porto Verde.
// Every module reads the shared world object V declared here.

const V = {
  state: 'menu', // menu | playing | paused | busted | wasted | missiondone
  time: 0,
  money: 250,
  health: 100,
  wanted: 0,
  wantedHeat: 0, // 0..100, decays when the player lays low
  missionsDone: [],
  collectibles: 0,
  collectiblesTotal: 10,
  kills: 0,
  carsStolen: 0,
  player: null,
  activeCar: null,
  traffic: [],
  peds: [],
  police: [],
  enemies: [],
  effects: null,
  city: null,
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  paused: false,
  muted: false,
  mission: null,
  missionStep: 0,
  banner: '',
  bannerUntil: 0,
  subtitle: '',
  subtitleUntil: 0,
  debug: {},
};

// Seeded RNG so the city layout is identical every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261118);

function rand(a, b) { return a + rng() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
