// Dusthaven — util.js
// Small math, random and DOM helpers shared by every other module.
// Nothing here touches the scene; it only gives the rest of the game
// numbers, angles and tiny conveniences to work with.
var DH = window.DH || (window.DH = {});

DH.util = (function () {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function randInt(lo, hi) {
    return Math.floor(rand(lo, hi + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Deterministic generator (mulberry32) so city layout is stable per seed.
  function seededRandom(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Shortest signed difference between two headings, in radians.
  function angleDiff(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function angleLerp(a, b, t) {
    return a + angleDiff(a, b) * t;
  }

  function dist2D(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function formatMoney(n) {
    var v = Math.floor(n);
    return '$' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function el(id) {
    return document.getElementById(id);
  }

  // Show or hide a node. `display` is the value used when shown
  // (menus need 'flex', the HUD needs 'block'); the stylesheet hides
  // several of these by default, so '' would hide them again.
  function show(node, on, display) {
    if (node) node.style.display = on ? (display || 'block') : 'none';
  }

  // True when point (x,z) is inside an axis-aligned box {minX,maxX,minZ,maxZ}.
  function insideBox(x, z, b) {
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  return {
    clamp: clamp,
    lerp: lerp,
    rand: rand,
    randInt: randInt,
    pick: pick,
    seededRandom: seededRandom,
    angleDiff: angleDiff,
    angleLerp: angleLerp,
    dist2D: dist2D,
    degToRad: degToRad,
    formatMoney: formatMoney,
    el: el,
    show: show,
    insideBox: insideBox
  };
})();
