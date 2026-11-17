// SOLMARA — combat.js
// Gunplay: the player's pistol, rival gang members who shoot back,
// and damage. Shots are camera-ray hitscans with tracers; enemies are
// simple state machines that take cover distance and fire in bursts.

var Combat = {
  enemies: [],
  recentShotTimer: 0,
  raycaster: null,
  tracerPool: [],
  tracerIdx: 0,

  init: function (scene) {
    this.raycaster = new THREE.Raycaster();
    var geo = new THREE.BoxGeometry(0.06, 0.06, 1);
    for (var i = 0; i < 12; i++) {
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffe27a, transparent: true, opacity: 0,
      }));
      m.visible = false;
      scene.add(m);
      this.tracerPool.push({ mesh: m, life: 0 });
    }
  },

  fireTracer: function (from, to) {
    var t = this.tracerPool[this.tracerIdx++ % this.tracerPool.length];
    var mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    var dir = new THREE.Vector3().subVectors(to, from);
    var len = dir.length();
    t.mesh.position.copy(mid);
    t.mesh.scale.set(1, 1, len);
    t.mesh.lookAt(to);
    t.mesh.visible = true;
    t.mesh.material.opacity = 0.9;
    t.life = 0.08;
  },

  playerShoot: function () {
    if (G.mode !== 'playing' || G.inCar) return;
    if (Player.shootCooldown > 0) return;
    if (G.ammo <= 0) { AudioSys.click(); HUD.toast('Out of ammo — find the green pickup.'); return; }
    Player.shootCooldown = 0.28;
    G.ammo--;
    if (G.ammo === 0) HUD.toast('Mag empty — press R to reload from reserve.');
    G.stats.shotsFired++;
    this.recentShotTimer = 2;
    AudioSys.gunshot();
    var from = Player.gunTip();
    var dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    this.raycaster.set(G.camera.position, dir);
    this.raycaster.far = 90;
    var targets = [];
    this.enemies.forEach(function (e) { targets.push(e.mesh); });
    Pedestrians.list.forEach(function (p) { targets.push(p.mesh); });
    var hits = this.raycaster.intersectObjects(targets, true);
    var end = new THREE.Vector3().copy(G.camera.position).addScaledVector(dir, 90);
    if (hits.length) {
      var h = hits[0];
      end = h.point.clone();
      var root = h.object;
      while (root.parent && root.parent !== G.scene) root = root.parent;
      var enemy = this.enemies.find(function (e) { return e.mesh === root; });
      if (enemy) {
        G.stats.hits++;
        enemy.hp -= 34;
        Effects.blood(h.point.x, h.point.y, h.point.z);
        if (enemy.hp <= 0) this.killEnemy(enemy);
        else enemy.alerted = true;
      } else {
        // hit a pedestrian: they panic, and the law notices
        Effects.blood(h.point.x, h.point.y, h.point.z);
        addWanted(1);
      }
    }
    Effects.muzzle(from.x, from.y, from.z);
    this.fireTracer(from, end);
  },

  spawnEnemy: function (x, z) {
    var g = new THREE.Group();
    var red = new THREE.MeshLambertMaterial({ color: 0x8e2f2f });
    var skin = new THREE.MeshLambertMaterial({ color: 0x8d5a3b });
    var pants = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.4), red);
    body.position.y = 1.15; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.86; g.add(head);
    var band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    band.position.y = 2.02; g.add(band);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pants);
    legL.position.set(-0.19, 0.35, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.19; g.add(legR);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1c }));
    gun.position.set(0.48, 0.85, 0.2); g.add(gun);
    g.position.set(x, 0, z);
    G.scene.add(g);
    var e = {
      mesh: g, gun: gun, x: x, z: z, heading: 0, hp: 100,
      alerted: false, shootTimer: rr(1, 2), burstLeft: 0, phase: rr(0, 6),
    };
    this.enemies.push(e);
    return e;
  },

  killEnemy: function (enemy) {
    Effects.explosion(enemy.x, 1, enemy.z);
    G.scene.remove(enemy.mesh);
    this.enemies.splice(this.enemies.indexOf(enemy), 1);
    G.cash += 50;
    HUD.toast('Rival down — +$50 taken off him.');
    if (Missions.onEnemyKilled) Missions.onEnemyKilled(enemy);
  },

  clearEnemies: function () {
    this.enemies.forEach(function (e) { G.scene.remove(e.mesh); });
    this.enemies = [];
  },

  update: function (dt) {
    this.recentShotTimer = Math.max(0, this.recentShotTimer - dt);
    this.tracerPool.forEach(function (t) {
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.08) * 0.9;
        if (t.life <= 0) t.mesh.visible = false;
      }
    });
    var px = G.inCar && G.car ? G.car.x : Player.x;
    var pz = G.inCar && G.car ? G.car.z : Player.z;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      var d = dist2d(px, pz, e.x, e.z);
      if (d < 55) e.alerted = true;
      if (!e.alerted) continue;
      var want = Math.atan2(px - e.x, pz - e.z);
      e.heading = angleLerp(e.heading, want, 1 - Math.exp(-6 * dt));
      // hold a firing distance of 8-18m, strafe slowly
      var move = 0;
      if (d > 18) move = 3.2;
      else if (d < 7) move = -2.4;
      e.x += Math.sin(e.heading) * move * dt;
      e.z += Math.cos(e.heading) * move * dt;
      var fixed = collideBuildings(e.x, e.z, 0.5);
      e.x = fixed.x; e.z = fixed.z;
      e.phase += dt * (move !== 0 ? 5 : 1);
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      // fire in bursts of three
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 45) {
        if (e.burstLeft <= 0) { e.burstLeft = 3; e.shootTimer = 1.4; }
        else {
          e.burstLeft--;
          e.shootTimer = 0.16;
          AudioSys.distantShot();
          var from = new THREE.Vector3(e.x, 1.4, e.z);
          var to = new THREE.Vector3(px + rr(-1.5, 1.5), 1.2, pz + rr(-1.5, 1.5));
          this.fireTracer(from, to);
          if (chance(0.3)) damagePlayer(6, 'A rival gunman got you.');
        }
      }
    }
  },
};

function damagePlayer(amount, deathReason) {
  if (G.mode !== 'playing') return;
  G.health -= amount;
  HUD.flashDamage();
  if (G.health <= 0) {
    G.health = 0;
    Police.bustPlayer(deathReason || 'You went down.');
  }
}

function healPlayer(amount) {
  G.health = clamp(G.health + amount, 0, G.maxHealth);
}
