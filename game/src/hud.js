// SOLMARA — hud.js
// The 2D layer: health, cash, ammo, wanted stars, speed, the mission
// objective, the minimap, toasts, banners and the damage vignette.
// Everything here is DOM + one 2D canvas; the 3D scene never touches it.

var HUD = {
  minimap: null, mmCtx: null,
  toastTimer: 0, bannerTimer: 0,
  lastHealth: 100,

  init: function () {
    this.minimap = el('minimap');
    this.mmCtx = this.minimap.getContext('2d');
    el('objective').textContent = 'Press M to start the first job';
  },

  toast: function (msg) {
    var t = el('toast');
    t.textContent = msg;
    t.style.opacity = '1';
    this.toastTimer = 4;
  },

  showBanner: function (title, sub) {
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub || '';
    show('banner', true);
    this.bannerTimer = 3.2;
  },

  setObjective: function (text) {
    el('objective').textContent = text;
  },

  flashDamage: function () {
    var v = el('damage-vignette');
    v.style.opacity = '0.85';
    setTimeout(function () { v.style.opacity = '0'; }, 260);
  },

  update: function (dt) {
    // toast fade
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) el('toast').style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) show('banner', false);
    }
    // numbers
    el('cash').textContent = fmtMoney(G.cash);
    el('health-fill').style.width = clamp(G.health, 0, 100) + '%';
    el('health-fill').style.background = G.health > 50 ? '#2ecc71' : G.health > 25 ? '#f39c12' : '#e74c3c';
    el('health-num').textContent = Math.ceil(G.health);
    el('ammo').textContent = G.ammo;
    el('reserve').textContent = 'RES ' + G.reserveAmmo;
    el('car-name').textContent = G.inCar && G.car ? G.car.model.name : '';
    el('speed').textContent = G.inCar && G.car ? Math.round(Math.abs(G.car.speed) * 3.2) : Math.round(Player.speed * 3.2);
    el('speed-unit').textContent = G.inCar ? 'km/h' : 'on foot';
    // wanted stars
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
    el('stars').textContent = stars;
    el('stars').style.color = G.wanted >= 3 ? '#ff4444' : '#ffd21f';
    // clock + mission timer
    var h = Math.floor(G.dayTime), m = Math.floor((G.dayTime - h) * 60);
    el('clock').textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    if (Missions.active && Missions.active.timer > 0) {
      el('mission-timer').textContent = '⏱ ' + fmtTime(Missions.active.timer);
      el('mission-timer').style.color = Missions.active.timer < 30 ? '#ff5544' : '#ffffff';
    } else {
      el('mission-timer').textContent = '';
    }
    // interaction hint
    var hint = '';
    if (!G.inCar) {
      var near = nearestStealableCar(4);
      if (near) hint = '[E] Jack the ' + near.model.name;
      else if (G.ammo === 0) hint = 'Find an ammo crate (yellow box)';
    } else {
      hint = '[E] Leave car · [Space] Handbrake · [H] Horn';
    }
    el('hint').textContent = hint;
    // crosshair only when on foot and aiming with the mouse held
    el('crosshair').style.display = (!G.inCar && Input.mouseDown) ? 'block' : 'none';
    this.drawMinimap();
  },

  drawMinimap: function () {
    var c = this.mmCtx, S = 190;
    var extent = cityBounds() + 20;
    function toMap(v) { return ((v + extent) / (extent * 2)) * S; }
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(10, 18, 28, 0.85)';
    c.fillRect(0, 0, S, S);
    // sea (west edge)
    c.fillStyle = '#2e7f9e';
    c.fillRect(0, 0, toMap(-cityBounds()) , S);
    // roads
    c.strokeStyle = '#5a5f66';
    c.lineWidth = 5;
    roadCentres().forEach(function (rc) {
      c.beginPath(); c.moveTo(toMap(rc), 0); c.lineTo(toMap(rc), S); c.stroke();
      c.beginPath(); c.moveTo(0, toMap(rc)); c.lineTo(S, toMap(rc)); c.stroke();
    });
    // park
    c.fillStyle = '#4a7a3a';
    c.fillRect(toMap(8), toMap(8), toMap(78) - toMap(8), toMap(78) - toMap(8));
    // mission marker (pulsing)
    var s = Missions.active ? Missions.currentStage() : null;
    if (s && s.x !== undefined) {
      var pulse = 5 + Math.sin(G.time * 5) * 2;
      c.fillStyle = '#ffd21f';
      c.beginPath(); c.arc(toMap(s.x), toMap(s.z), pulse, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      c.beginPath(); c.arc(toMap(s.x), toMap(s.z), pulse + 3, 0, Math.PI * 2); c.stroke();
    }
    // pickups
    Pickups.items.forEach(function (it) {
      c.fillStyle = it.kind === 'health' ? '#2ecc71' : '#f1c40f';
      c.fillRect(toMap(it.x) - 2, toMap(it.z) - 2, 4, 4);
    });
    // traffic (yellow dots)
    c.fillStyle = '#f5d76e';
    Traffic.cars.forEach(function (car) {
      if (car === G.car) return;
      c.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
    });
    // police (blue/red flashing)
    c.fillStyle = Math.floor(G.time * 4) % 2 ? '#ff3333' : '#3388ff';
    Police.cars.forEach(function (car) {
      c.beginPath(); c.arc(toMap(car.x), toMap(car.z), 4, 0, Math.PI * 2); c.fill();
    });
    Police.cops.forEach(function (cop) {
      c.fillRect(toMap(cop.x) - 2, toMap(cop.z) - 2, 4, 4);
    });
    // enemies (red)
    c.fillStyle = '#ff2222';
    Combat.enemies.forEach(function (e) {
      c.beginPath(); c.arc(toMap(e.x), toMap(e.z), 3.5, 0, Math.PI * 2); c.fill();
    });
    // player arrow
    var px = G.inCar && G.car ? G.car.x : Player.x;
    var pz = G.inCar && G.car ? G.car.z : Player.z;
    var heading = G.inCar && G.car ? G.car.heading : Player.heading;
    c.save();
    c.translate(toMap(px), toMap(pz));
    c.rotate(-heading + Math.PI);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.strokeStyle = '#111111'; c.lineWidth = 1.5; c.stroke();
    c.restore();
    // north tick
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px Arial';
    c.fillText('N', S - 14, 14);
  },
};
