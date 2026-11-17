// SOLMARA — police.js
// The wanted system: crimes raise the heat, stars follow, and the
// Solmara PD answers — patrol cars that ram and foot cops who chase.
// Lose the heat by breaking line of sight and laying low.

function addWanted(amount) {
  if (G.mode !== 'playing') return;
  G.wantedHeat = clamp(G.wantedHeat + amount, 0, 5.5);
  var stars = Math.floor(G.wantedHeat);
  if (stars > G.wanted) {
    G.wanted = stars;
    HUD.toast(stars >= 3 ? 'The whole precinct is on you!' : 'The police are on to you.');
    AudioSys.setSiren(true);
  }
}

function clearWanted() {
  G.wanted = 0; G.wantedHeat = 0;
  Police.clearAll();
  AudioSys.setSiren(false);
  HUD.toast('You lost them. For now.');
}

var Police = {
  cars: [],
  cops: [],
  spawnTimer: 0,
  decayTimer: 0,
  sirenPhase: 0,

  wantedCarCount: function () {
    return [0, 1, 2, 3, 4, 5][G.wanted] || 0;
  },

  update: function (dt) {
    // heat decays only when no police unit is close
    var px = G.inCar && G.car ? G.car.x : Player.x;
    var pz = G.inCar && G.car ? G.car.z : Player.z;
    var nearest = 1e9;
    this.cars.forEach(function (c) { nearest = Math.min(nearest, dist2d(px, pz, c.x, c.z)); });
    this.cops.forEach(function (c) { nearest = Math.min(nearest, dist2d(px, pz, c.x, c.z)); });
    if (G.wanted > 0 && nearest > 70) {
      this.decayTimer += dt;
      if (this.decayTimer > 6) {
        this.decayTimer = 0;
        G.wantedHeat -= 1;
        if (G.wantedHeat < 1) { clearWanted(); return; }
        G.wanted = Math.floor(G.wantedHeat);
        if (G.wanted === 0) { clearWanted(); return; }
      }
    } else {
      this.decayTimer = 0;
    }

    // spawn to match the wanted level
    var want = this.wantedCarCount();
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      var angle = rr(0, Math.PI * 2);
      var sx = clamp(px + Math.sin(angle) * 90, -cityBounds() + 10, cityBounds() - 10);
      var sz = clamp(pz + Math.cos(angle) * 90, -cityBounds() + 10, cityBounds() - 10);
      var car = makeCar({
        x: nearestRoadCoord(sx), z: nearestRoadCoord(sz),
        heading: 0, police: true, model: CAR_MODELS[0],
      });
      this.cars.push(car);
    }
    // foot cops when the player is on foot and wanted
    if (!G.inCar && G.wanted >= 1 && this.cops.length < Math.min(G.wanted, 3) && this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      var a2 = rr(0, Math.PI * 2);
      this.cops.push(this.makeCop(px + Math.sin(a2) * 25, pz + Math.cos(a2) * 25));
    }

    this.updateCars(dt, px, pz);
    this.updateCops(dt, px, pz);
    this.sirenPhase += dt;
    // light bars flash
    var on = Math.floor(this.sirenPhase * 4) % 2 === 0;
    this.cars.forEach(function (c) {
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(on ? 0xff2222 : 0x2244ff);
      }
    });
  },

  makeCop: function (x, z) {
    var g = new THREE.Group();
    var navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.9, 0.38), navy);
    body.position.y = 1.12; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.82; g.add(head);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.42), navy);
    cap.position.y = 2.04; g.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.28), navy);
    legL.position.set(-0.17, 0.34, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
    g.position.set(x, 0, z);
    G.scene.add(g);
    return { mesh: g, legL: legL, legR: legR, x: x, z: z, heading: 0, phase: rr(0, 6), punchTimer: 0 };
  },

  updateCars: function (dt, px, pz) {
    for (var i = this.cars.length - 1; i >= 0; i--) {
      var c = this.cars[i];
      // staged for a screenshot: holds position, lights still flashing
      if (c.frozen) {
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
        continue;
      }
      var dx = px - c.x, dz = pz - c.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      var want = Math.atan2(dx, dz);
      var diff = angleDiff(c.heading, want);
      c.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
      var target = d > 6 ? 30 : 12;
      c.speed = damp(c.speed, target, 1.6, dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      var fixed = collideBuildings(c.x, c.z, 1.5);
      if (fixed.x !== c.x || fixed.z !== c.z) { c.x = fixed.x; c.z = fixed.z; c.speed *= 0.4; }
      // ram the player's car
      if (G.inCar && G.car && d < 3.6) {
        G.car.speed *= 0.7;
        G.car.x += Math.sin(c.heading) * 1.2;
        G.car.z += Math.cos(c.heading) * 1.2;
        G.car.health -= 6;
        if (Math.abs(c.speed) > 5) AudioSys.crash();
        Effects.impact(c.x, c.z);
        if (G.car.health <= 0) this.bustPlayer('Your car is wrecked.');
      }
      // too far away for too long: despawn and respawn closer later
      if (d > 260) { G.scene.remove(c.mesh); this.cars.splice(i, 1); continue; }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.mesh.userData.wheels.forEach(function (w) { w.rotation.x += c.speed * dt * 2.4; });
    }
  },

  updateCops: function (dt, px, pz) {
    for (var i = this.cops.length - 1; i >= 0; i--) {
      var c = this.cops[i];
      var d = dist2d(px, pz, c.x, c.z);
      if (G.wanted === 0 || d > 120) {
        G.scene.remove(c.mesh); this.cops.splice(i, 1); continue;
      }
      var want = Math.atan2(px - c.x, pz - c.z);
      c.heading = angleLerp(c.heading, want, 1 - Math.exp(-8 * dt));
      var sp = d > 2.2 ? 6.2 : 0;
      c.x += Math.sin(c.heading) * sp * dt;
      c.z += Math.cos(c.heading) * sp * dt;
      var fixed = collideBuildings(c.x, c.z, 0.5);
      c.x = fixed.x; c.z = fixed.z;
      c.phase += dt * sp * 2;
      var swing = Math.sin(c.phase) * 0.5;
      c.legL.rotation.x = swing; c.legR.rotation.x = -swing;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // a cop that reaches the player on foot busts them
      c.punchTimer -= dt;
      if (!G.inCar && d < 1.6 && c.punchTimer <= 0) {
        c.punchTimer = 1.1;
        damagePlayer(14, 'A cop worked you over.');
        Effects.blood(Player.x, 1.2, Player.z);
      }
    }
  },

  bustPlayer: function (reason) {
    if (G.mode !== 'playing') return;
    G.mode = 'busted';
    G.stats.copsDodged = Math.max(0, G.stats.copsDodged);
    var fine = Math.floor(G.cash * 0.15);
    G.cash -= fine;
    AudioSys.missionFail();
    AudioSys.setSiren(false);
    AudioSys.setEngine(0, false);
    el('busted-reason').textContent = reason + ' Fine: ' + fmtMoney(fine) + '.';
    show('busted-screen', true);
    show('hud', false);
    exitCarSilent();
    clearWanted();
    SaveGame.save();
  },

  clearAll: function () {
    this.cars.forEach(function (c) { G.scene.remove(c.mesh); });
    this.cops.forEach(function (c) { G.scene.remove(c.mesh); });
    this.cars = []; this.cops = [];
  },
};

function exitCarSilent() {
  if (!G.car) return;
  var c = G.car;
  c.traffic = true;
  c.node = { x: nearestRoadCoord(c.x), z: nearestRoadCoord(c.z) };
  c.nextNode = randomNeighbour(c.node);
  G.car = null; G.inCar = false;
  Player.mesh.visible = true;
  Player.reset(c.x - Math.sin(c.heading) * 2.6, c.z - Math.cos(c.heading) * 2.6, c.heading);
  AudioSys.setEngine(0, false);
}
