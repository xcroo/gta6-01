// SOLMARA — effects.js
// Particles and flashes: muzzle smoke, tyre smoke, impacts, explosions
// and the screen shake that sells them. All geometry is pooled so the
// frame rate stays steady during a chase.

var Effects = {
  pool: [], shake: 0, flash: 0,

  init: function (scene) {
    var geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (var i = 0; i < 160; i++) {
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
      }));
      m.visible = false;
      scene.add(m);
      this.pool.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grav: 0 });
    }
  },

  // Hide every live particle (new game, busted respawn).
  clear: function () {
    for (var i = 0; i < this.pool.length; i++) {
      var p = this.pool[i];
      p.life = 0; p.mesh.visible = false;
    }
    this.shake = 0; this.flash = 0;
  },

  spawn: function (x, y, z, color, n, speed, life, grav, size) {
    var made = 0;
    for (var i = 0; i < this.pool.length && made < n; i++) {
      var p = this.pool[i];
      if (p.life > 0) continue;
      p.life = p.maxLife = life * rr(0.6, 1.3);
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 0.95;
      p.mesh.position.set(x + rr(-0.3, 0.3), y + rr(-0.2, 0.3), z + rr(-0.3, 0.3));
      var s = (size || 1) * rr(0.7, 1.4);
      p.mesh.scale.set(s, s, s);
      var a = rr(0, Math.PI * 2), b = rr(-0.5, 1);
      p.vx = Math.cos(a) * speed * rr(0.4, 1);
      p.vy = b * speed;
      p.vz = Math.sin(a) * speed * rr(0.4, 1);
      p.grav = grav;
      made++;
    }
  },

  smoke: function (x, z) {
    this.spawn(x + rr(-0.8, 0.8), 0.4, z + rr(-0.8, 0.8), 0xbbbbbb, 2, 1.2, 0.9, 1.5, 1.6);
  },
  impact: function (x, z) {
    this.spawn(x, 1, z, 0xffcc66, 10, 5, 0.5, 6, 1);
    this.spawn(x, 1, z, 0x888888, 6, 2.5, 0.8, 2, 1.8);
    this.shake = Math.max(this.shake, 0.35);
  },
  muzzle: function (x, y, z) {
    this.spawn(x, y, z, 0xffdd55, 3, 2, 0.12, 0, 1.2);
    this.flash = 0.09;
  },
  explosion: function (x, y, z) {
    this.spawn(x, y, z, 0xff7722, 26, 9, 0.9, 4, 2.2);
    this.spawn(x, y + 1, z, 0x333333, 14, 4, 1.4, 1, 2.6);
    this.spawn(x, y, z, 0xffdd44, 10, 12, 0.4, 2, 1.4);
    this.shake = Math.max(this.shake, 0.8);
    this.flash = 0.18;
    AudioSys.burst(120, 0.7, 0.7, 'lowpass');
  },
  blood: function (x, y, z) {
    this.spawn(x, y, z, 0xaa1111, 8, 3, 0.5, 8, 0.8);
  },

  update: function (dt) {
    for (var i = 0; i < this.pool.length; i++) {
      var p = this.pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vy -= p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1) p.mesh.position.y = 0.1;
      p.mesh.material.opacity = 0.95 * (p.life / p.maxLife);
      p.mesh.rotation.x += dt * 3; p.mesh.rotation.y += dt * 2;
    }
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.flash = Math.max(0, this.flash - dt);
  },
};
