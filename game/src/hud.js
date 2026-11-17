// Dusthaven — hud.js
// Everything the player reads while playing: health, money, wanted
// stars, speed, the objective line, toast messages, dialogue, banners
// and the live circular minimap drawn on a 2D canvas.
var DH = window.DH || (window.DH = {});

DH.hud = (function () {
  'use strict';

  var U = DH.util;
  var mapCtx = null;
  var mapCanvas = null;
  var bannerTimer = 0;
  var dialogueTimer = 0;
  var toastTimer = 0;
  var timerValue = null;

  function init(G) {
    mapCanvas = U.el('minimap');
    if (mapCanvas) mapCtx = mapCanvas.getContext('2d');
  }

  function updateStars(G) {
    var el = U.el('stars');
    if (!el) return;
    var s = '';
    for (var i = 0; i < 5; i++) s += i < G.wanted ? '★' : '☆';
    el.textContent = s;
    el.className = G.wanted > 0 ? 'hot' : '';
  }

  function showBanner(title, sub) {
    var b = U.el('banner');
    if (!b) return;
    U.el('banner-title').textContent = title;
    U.el('banner-sub').textContent = sub || '';
    b.style.display = 'block';
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    bannerTimer = 3.2;
  }

  function showObjective(text) {
    var o = U.el('objective');
    if (o) o.textContent = '◆ ' + text;
  }

  function showDialogue(name, text) {
    var d = U.el('dialogue');
    if (!d) return;
    U.el('dialogue-name').textContent = name;
    U.el('dialogue-text').textContent = text;
    d.style.display = 'block';
    dialogueTimer = 5;
  }

  function showToast(text) {
    var t = U.el('toast');
    if (!t) return;
    t.textContent = text;
    t.style.display = 'block';
    toastTimer = 2.5;
  }

  function showTimer(seconds) {
    timerValue = seconds;
  }

  function update(G, dt) {
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) {
        var b = U.el('banner');
        if (b) b.style.display = 'none';
      }
    }
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) {
        var d = U.el('dialogue');
        if (d) d.style.display = 'none';
      }
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) {
        var t = U.el('toast');
        if (t) t.style.display = 'none';
      }
    }
    var moneyEl = U.el('money');
    if (moneyEl) moneyEl.textContent = U.formatMoney(G.money);
    var hp = U.el('health-fill');
    if (hp) hp.style.width = Math.max(0, G.player.health) + '%';
    var sp = U.el('speed');
    if (sp) {
      var car = G.player.inCar;
      sp.textContent = car ? Math.round(Math.abs(car.speed) * 3.6) + ' km/h' : 'ON FOOT';
    }
    var ammoEl = U.el('ammo');
    if (ammoEl) {
      ammoEl.textContent = G.player.weapon === 'pistol'
        ? 'PISTOL ' + G.player.ammo + ' / ' + G.player.ammoReserve
        : 'FISTS — press 2 for pistol';
    }
    var timerEl = U.el('timer');
    if (timerEl) {
      if (timerValue !== null) {
        timerEl.textContent = '⏱ ' + timerValue + 's';
        timerEl.style.display = 'block';
      } else {
        timerEl.style.display = 'none';
      }
    }
    timerValue = null;
    var hint = U.el('hint');
    if (hint) {
      var near = G.player.inCar ? null : DH.player.nearestCar(G, 4.5);
      hint.textContent = near
        ? 'Press E to take the ' + near.name
        : (G.player.inCar ? 'E — leave car · Space — handbrake' : 'WASD — move · E — enter car · F — punch · Click — shoot');
    }
    drawMinimap(G);
  }

  // The circular minimap: streets, canal, player arrow, police blips,
  // the objective marker and the garage, all in gold on dark glass.
  function drawMinimap(G) {
    if (!mapCtx || !mapCanvas) return;
    var size = mapCanvas.width;
    var cx = size / 2, cy = size / 2, r = size / 2 - 4;
    var range = 640; // world units across the whole map
    function toMap(x, z) {
      return [cx + (x / range) * r * 2, cy + (z / range) * r * 2];
    }
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, r, 0, Math.PI * 2);
    mapCtx.clip();
    mapCtx.fillStyle = 'rgba(20, 14, 10, 0.82)';
    mapCtx.fillRect(0, 0, size, size);
    // Canal.
    mapCtx.fillStyle = '#2f7f8f';
    var canal = toMap(DH.city.CANAL_X, 0);
    mapCtx.fillRect(canal[0], 0, 14, size);
    // Streets.
    mapCtx.strokeStyle = '#8a7a5e';
    mapCtx.lineWidth = 3;
    DH.city.STREETS.forEach(function (s) {
      var a = toMap(s, -300), b = toMap(s, 300);
      mapCtx.beginPath();
      mapCtx.moveTo(a[0], a[1]);
      mapCtx.lineTo(b[0], b[1]);
      mapCtx.stroke();
      var c = toMap(-300, s), d = toMap(300, s);
      mapCtx.beginPath();
      mapCtx.moveTo(c[0], c[1]);
      mapCtx.lineTo(d[0], d[1]);
      mapCtx.stroke();
    });
    // Garage (Mesa Motors).
    var g = toMap(186, -60);
    mapCtx.fillStyle = '#d8a03a';
    mapCtx.fillRect(g[0] - 4, g[1] - 4, 8, 8);
    // Objective marker, pulsing.
    if (G.objectivePos) {
      var o = toMap(G.objectivePos.x, G.objectivePos.z);
      var pulse = 5 + Math.sin(G.time * 5) * 2;
      mapCtx.fillStyle = '#ffc233';
      mapCtx.beginPath();
      mapCtx.arc(o[0], o[1], pulse, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#fff2c0';
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
    // Police blips.
    mapCtx.fillStyle = '#4a90ff';
    (G.policeCars || []).forEach(function (car) {
      var p = toMap(car.pos.x, car.pos.z);
      mapCtx.beginPath();
      mapCtx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    });
    // Enemies.
    mapCtx.fillStyle = '#ff4444';
    (G.enemies || []).forEach(function (e) {
      if (e.dead) return;
      var p = toMap(e.pos.x, e.pos.z);
      mapCtx.beginPath();
      mapCtx.arc(p[0], p[1], 3, 0, Math.PI * 2);
      mapCtx.fill();
    });
    // Player arrow, pointing along the heading.
    var pp = toMap(G.player.pos.x, G.player.pos.z);
    var h = G.player.heading;
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#111111';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.moveTo(pp[0] + Math.sin(h) * 9, pp[1] + Math.cos(h) * 9);
    mapCtx.lineTo(pp[0] + Math.sin(h + 2.6) * 7, pp[1] + Math.cos(h + 2.6) * 7);
    mapCtx.lineTo(pp[0] + Math.sin(h - 2.6) * 7, pp[1] + Math.cos(h - 2.6) * 7);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
    // Ring and north tick.
    mapCtx.strokeStyle = 'rgba(255, 194, 51, 0.9)';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, r, 0, Math.PI * 2);
    mapCtx.stroke();
    mapCtx.fillStyle = '#ffc233';
    mapCtx.font = 'bold 13px sans-serif';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('N', cx, 16);
  }

  function showMenu(hasSave) {
    U.show(U.el('menu'), true, 'flex');
    U.show(U.el('hud'), false);
    U.show(U.el('pause'), false);
    var cont = U.el('btn-continue');
    if (cont) cont.style.display = hasSave ? '' : 'none';
  }

  function showGame() {
    U.show(U.el('menu'), false);
    U.show(U.el('hud'), true, 'block');
    U.show(U.el('pause'), false);
  }

  function showPause(on) {
    U.show(U.el('pause'), on, 'flex');
  }

  function setPausedText(t) {
    var p = U.el('pause-title');
    if (p) p.textContent = t;
  }

  return {
    init: init,
    update: update,
    updateStars: updateStars,
    showBanner: showBanner,
    showObjective: showObjective,
    showDialogue: showDialogue,
    showToast: showToast,
    showTimer: showTimer,
    drawMinimap: drawMinimap,
    showMenu: showMenu,
    showGame: showGame,
    showPause: showPause,
    setPausedText: setPausedText
  };
})();
