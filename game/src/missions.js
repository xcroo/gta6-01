// SOLMARA — missions.js
// The story of Rook Calloway: five jobs for fixer Marta Ibarra, then
// free roam. Each mission is a list of stages (go somewhere, steal a
// car, survive a fight, deliver under a timer). Also owns the street
// pickups (health and ammo) that keep free roam alive.

var MISSIONS = [
  {
    id: 1, title: 'First Fare', reward: 300,
    briefing: 'Marta Ibarra needs a driver. Find her at Solmara Park — and bring a car.',
    stages: [
      { type: 'goto', text: 'Meet Marta at Solmara Park', x: 43, z: 43, r: 6 },
      { type: 'enterCar', text: 'Jack any car on the street (walk up and press E)' },
      { type: 'goto', text: 'Drive Marta to the Marina drop-off', x: -286, z: 0, r: 8 },
    ],
  },
  {
    id: 2, title: 'Hot Wheels', reward: 500, timer: 240,
    briefing: 'A Viento sports car is parked by the tower. Steal it and bring it to the garage — fast.',
    stages: [
      { type: 'steal', text: 'Steal the yellow Viento by Solmara Tower', x: 129, z: -43, r: 5 },
      { type: 'deliver', text: 'Deliver the Viento to the garage', x: 86, z: 172, r: 8 },
    ],
  },
  {
    id: 3, title: 'Heat Wave', reward: 400,
    briefing: 'You tripped every alarm in the district. Lose the heat and reach the safehouse.',
    stages: [
      { type: 'escape', text: 'Reach the safehouse on the north edge', x: -86, z: 258, r: 8 },
    ],
  },
  {
    id: 4, title: 'The Meridian Job', reward: 800,
    briefing: 'Pick up the package at the warehouse. The Meridian crew will not let it go quietly.',
    stages: [
      { type: 'pickup', text: 'Pick up the package at the warehouse', x: 258, z: 86, r: 6 },
      { type: 'fight', text: 'Deal with the Meridian crew (take down 3)', kills: 3 },
      { type: 'goto', text: 'Deliver the package to the old docks', x: -172, z: -172, r: 8 },
    ],
  },
  {
    id: 5, title: 'Sunset Run', reward: 1200, timer: 240,
    briefing: 'One last run before sunset: three drops, no stops, and the whole city watching.',
    stages: [
      { type: 'goto', text: 'Drop 1 of 3 — the beach bar', x: -258, z: 172, r: 8 },
      { type: 'goto', text: 'Drop 2 of 3 — the stadium gate', x: 172, z: 258, r: 8 },
      { type: 'goto', text: 'Drop 3 of 3 — Solmara Tower', x: 129, z: 43, r: 8 },
    ],
  },
];

var Missions = {
  active: null,          // {def, stage, timer, targetCar, kills}
  marker: null,          // 3D beacon mesh
  markerRing: null,

  build: function (scene) {
    var geo = new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xffd21f, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.visible = false;
    scene.add(this.marker);
    var ringGeo = new THREE.RingGeometry(2.2, 3, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.markerRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffd21f, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    }));
    this.markerRing.visible = false;
    scene.add(this.markerRing);
  },

  start: function (index) {
    var def = MISSIONS[index];
    if (!def) return;
    this.active = { def: def, stage: 0, timer: def.timer || 0, targetCar: null, kills: 0 };
    G.missionIndex = index;
    if (def.id === 2) {
      // park the target Viento by the tower
      var car = makeCar({
        x: 129, z: -43, heading: Math.PI / 2,
        model: CAR_MODELS[1], color: 0xf1c40f, traffic: true,
        node: { x: 86, z: -86 },
      });
      car.nextNode = randomNeighbour(car.node);
      Traffic.cars.push(car);
      this.active.targetCar = car;
    }
    if (def.id === 3) { addWanted(3); }
    if (def.id === 5) { addWanted(2); }
    this.showStage();
    HUD.toast('MISSION: ' + def.title + ' — ' + def.briefing);
    AudioSys.tone(523, 0.2, 0.2, 'triangle');
    SaveGame.save();
  },

  currentStage: function () {
    return this.active ? this.active.def.stages[this.active.stage] : null;
  },

  showStage: function () {
    var s = this.currentStage();
    if (!s) return;
    if (s.x !== undefined) {
      this.marker.position.set(s.x, 13, s.z);
      this.markerRing.position.set(s.x, 0.1, s.z);
      this.marker.visible = true;
      this.markerRing.visible = true;
    } else {
      this.marker.visible = false;
      this.markerRing.visible = false;
    }
    HUD.setObjective((this.active.def.title) + ' — ' + s.text);
  },

  advance: function () {
    this.active.stage++;
    if (this.active.stage >= this.active.def.stages.length) {
      this.complete();
    } else {
      this.showStage();
      AudioSys.pickup();
    }
  },

  complete: function () {
    var def = this.active.def;
    G.cash += def.reward;
    G.missionsDone++;
    G.stats.missionsDone++;
    HUD.toast('MISSION COMPLETE: ' + def.title + '  +' + fmtMoney(def.reward));
    HUD.showBanner(def.title + ' COMPLETE', '+' + fmtMoney(def.reward));
    AudioSys.missionOk();
    this.active = null;
    this.marker.visible = false;
    this.markerRing.visible = false;
    HUD.setObjective('Free roam — press M for the next job');
    if (def.id === 3 || def.id === 5) clearWanted();
    if (def.id === 5) {
      G.freeRoam = true;
      HUD.showBanner('STORY COMPLETE', 'Solmara is yours. Free roam!');
    }
    SaveGame.save();
    // chain the next job after a breather
    var next = def.id; // ids are 1-based, index = id
    if (next < MISSIONS.length) {
      setTimeout(function () {
        if (G.mode === 'playing' && !Missions.active) Missions.start(next);
      }, 4000);
    }
  },

  fail: function (reason) {
    if (!this.active) return;
    var def = this.active.def;
    HUD.toast('MISSION FAILED: ' + def.title + ' — ' + reason);
    HUD.showBanner('MISSION FAILED', reason);
    AudioSys.missionFail();
    this.active = null;
    this.marker.visible = false;
    this.markerRing.visible = false;
    Combat.clearEnemies();
    HUD.setObjective('Press M to retry the job');
  },

  onEnemyKilled: function () {
    if (!Missions.active) return;
    var s = Missions.currentStage();
    if (s && s.type === 'fight') {
      Missions.active.kills++;
      if (Missions.active.kills >= s.kills) Missions.advance();
    }
  },

  update: function (dt) {
    if (!this.active) return;
    var s = this.currentStage();
    if (!s) return;
    // mission timer
    if (this.active.timer > 0) {
      this.active.timer -= dt;
      if (this.active.timer <= 0) { this.fail('Out of time.'); return; }
    }
    var px = G.inCar && G.car ? G.car.x : Player.x;
    var pz = G.inCar && G.car ? G.car.z : Player.z;
    if (s.type === 'goto' || s.type === 'escape' || s.type === 'pickup') {
      if (dist2d(px, pz, s.x, s.z) < s.r) {
        if (s.type === 'pickup') {
          HUD.toast('Package secured. Now move!');
          // the crew shows up
          for (var i = 0; i < 4; i++) {
            Combat.spawnEnemy(s.x + rr(-18, 18), s.z + rr(-18, 18));
          }
          addWanted(1);
        }
        if (s.type === 'escape') clearWanted();
        this.advance();
      }
    } else if (s.type === 'enterCar') {
      if (G.inCar) this.advance();
    } else if (s.type === 'steal') {
      if (G.car === this.active.targetCar) this.advance();
    } else if (s.type === 'deliver') {
      if (G.car === this.active.targetCar && dist2d(px, pz, s.x, s.z) < s.r) {
        // the garage takes the car
        var car = this.active.targetCar;
        G.scene.remove(car.mesh);
        Traffic.cars.splice(Traffic.cars.indexOf(car), 1);
        exitCarSilent();
        this.advance();
      }
    } else if (s.type === 'fight') {
      if (this.active.kills >= s.kills) this.advance();
    }
    // beacon pulse
    if (this.marker.visible) {
      this.markerRing.scale.setScalar(1 + Math.sin(G.time * 4) * 0.12);
      this.marker.material.opacity = 0.22 + Math.sin(G.time * 4) * 0.08;
    }
  },
};

// ---- street pickups: health kits and ammo crates ---------------------------
var Pickups = {
  items: [],
  spawnTimer: 0,

  spawnOne: function (kind) {
    var x = pick(roadCentres()) + CITY.STEP / 2 + rr(-20, 20);
    var z = pick(roadCentres()) + CITY.STEP / 2 + rr(-20, 20);
    var color = kind === 'health' ? 0x2ecc71 : 0xf1c40f;
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.35 })
    );
    mesh.position.set(x, 0.8, z);
    mesh.castShadow = true;
    G.scene.add(mesh);
    this.items.push({ mesh: mesh, x: x, z: z, kind: kind, bob: rr(0, 6) });
  },

  init: function () {
    for (var i = 0; i < 4; i++) this.spawnOne(i % 2 ? 'ammo' : 'health');
  },

  update: function (dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.items.length < 6) {
      this.spawnTimer = 25;
      this.spawnOne(chance(0.5) ? 'ammo' : 'health');
    }
    var px = Player.x, pz = Player.z;
    for (var i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      it.bob += dt * 3;
      it.mesh.position.y = 0.8 + Math.sin(it.bob) * 0.15;
      it.mesh.rotation.y += dt * 1.5;
      if (!G.inCar && dist2d(px, pz, it.x, it.z) < 1.6) {
        if (it.kind === 'health') { healPlayer(40); HUD.toast('Health +40'); }
        else { G.ammo += 24; G.reserveAmmo += 60; HUD.toast('Ammo +24'); }
        AudioSys.pickup();
        G.scene.remove(it.mesh);
        this.items.splice(i, 1);
      }
    }
  },
};
