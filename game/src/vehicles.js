// SOLMARA — vehicles.js
// Cars: the models, arcade driving, stealing, and the traffic that
// fills the roads. Traffic cars follow the intersection graph; the
// player's car uses simple arcade physics with drift and damage.

var CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0xecf0f1, 0x1a1a1a, 0x7d3c98,
  0x16a085, 0xe67e22, 0x95a5a6, 0x8e44ad, 0x27ae60, 0xd35400];
var CAR_MODELS = [
  { name: 'Cortez', len: 4.4, w: 1.9, h: 0.62, top: 26, accel: 16 },   // sedan
  { name: 'Viento', len: 4.1, w: 1.85, h: 0.55, top: 32, accel: 21 },  // sports
  { name: 'Bison', len: 5.2, w: 2.1, h: 0.95, top: 22, accel: 13 },    // pickup
  { name: 'Sol Taxi', len: 4.4, w: 1.9, h: 0.66, top: 25, accel: 15 }, // taxi
  { name: 'Camion', len: 6.2, w: 2.3, h: 1.15, top: 19, accel: 11 },   // van
];

function makeCarMesh(model, color, isPolice) {
  var g = new THREE.Group();
  var paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xe8e8e8 : color });
  var glass = new THREE.MeshLambertMaterial({ color: 0x18222e });
  var trim = new THREE.MeshLambertMaterial({ color: 0x111111 });
  // lower body
  var body = new THREE.Mesh(new THREE.BoxGeometry(model.w, model.h, model.len), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  // cabin
  var cab = new THREE.Mesh(new THREE.BoxGeometry(model.w * 0.82, 0.55, model.len * 0.5), glass);
  cab.position.set(0, model.h + 0.22, -model.len * 0.06); cab.castShadow = true; g.add(cab);
  var roof = new THREE.Mesh(new THREE.BoxGeometry(model.w * 0.84, 0.08, model.len * 0.52), paint);
  roof.position.set(0, model.h + 0.52, -model.len * 0.06); g.add(roof);
  // lights
  var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  var tailMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
  [-1, 1].forEach(function (s) {
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
    hl.position.set(s * model.w * 0.32, 0.62, model.len / 2 + 0.01); g.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tl.position.set(s * model.w * 0.32, 0.62, -model.len / 2 - 0.01); g.add(tl);
  });
  if (isPolice) {
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, model.h + 0.62, -model.len * 0.06); g.add(bar);
    g.userData.lightBar = bar;
    var badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x1c2733 }));
    badge.position.set(model.w / 2 + 0.01, 0.62, 0); g.add(badge);
  }
  if (model.name === 'Sol Taxi') {
    var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffd21f }));
    sign.position.set(0, model.h + 0.62, -model.len * 0.06); g.add(sign);
  }
  // wheels
  var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  g.userData.wheels = [];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
    var w = new THREE.Mesh(wheelGeo, trim);
    w.position.set(p[0] * (model.w / 2 - 0.08), 0.36, p[1] * (model.len / 2 - 0.75));
    w.castShadow = true; g.add(w);
    g.userData.wheels.push(w);
  });
  return g;
}

// ---- a car in the world ----------------------------------------------------
function makeCar(opts) {
  var model = opts.model || pick(CAR_MODELS);
  var mesh = makeCarMesh(model, opts.color !== undefined ? opts.color : pick(CAR_COLORS), !!opts.police);
  mesh.position.set(opts.x || 0, 0, opts.z || 0);
  mesh.rotation.y = opts.heading || 0;
  G.scene.add(mesh);
  var car = {
    mesh: mesh, model: model, police: !!opts.police, traffic: !!opts.traffic,
    x: opts.x || 0, z: opts.z || 0, heading: opts.heading || 0,
    speed: 0, steer: 0, health: 100, driver: opts.driver || null,
    node: opts.node || null, nextNode: null, waitTimer: 0,
    brakeLights: false, smokeTimer: 0, stuckTimer: 0,
  };
  if (car.traffic) {
    car.nextNode = randomNeighbour(car.node);
  }
  return car;
}

function randomNeighbour(node) {
  var cands = CITY.nodes.filter(function (n) {
    return (n.x === node.x && Math.abs(n.z - node.z) === CITY.STEP) ||
           (n.z === node.z && Math.abs(n.x - node.x) === CITY.STEP);
  });
  return cands.length ? pick(cands) : node;
}

var Traffic = {
  cars: [],
  spawn: function (n) {
    for (var i = 0; i < n; i++) {
      var node = pick(CITY.nodes);
      var car = makeCar({
        x: node.x + rr(-3, 3), z: node.z + rr(-3, 3),
        heading: pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
        traffic: true, node: node,
      });
      this.cars.push(car);
    }
  },
  update: function (dt) {
    for (var i = 0; i < this.cars.length; i++) {
      var c = this.cars[i];
      if (c === G.car) continue; // the player's car is driven, not AI
      this.driveAI(c, dt);
    }
  },
  driveAI: function (c, dt) {
    if (c.waitTimer > 0) { c.waitTimer -= dt; c.speed = damp(c.speed, 0, 8, dt); }
    else {
      var tx = c.nextNode.x, tz = c.nextNode.z;
      var dx = tx - c.x, dz = tz - c.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      var want = Math.atan2(dx, dz);
      var diff = angleDiff(c.heading, want);
      c.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
      // slow for a car ahead
      var aheadClear = true;
      Traffic.cars.forEach(function (o) {
        if (o === c) return;
        var ox = o.x - c.x, oz = o.z - c.z;
        var fwd = ox * Math.sin(c.heading) + oz * Math.cos(c.heading);
        var side = Math.abs(ox * Math.cos(c.heading) - oz * Math.sin(c.heading));
        if (fwd > 0 && fwd < 9 && side < 2.4) aheadClear = false;
      });
      var px = Player.x - c.x, pz = Player.z - c.z;
      var pfwd = px * Math.sin(c.heading) + pz * Math.cos(c.heading);
      var pside = Math.abs(px * Math.cos(c.heading) - pz * Math.sin(c.heading));
      if (!G.inCar && pfwd > 0 && pfwd < 8 && pside < 2.2) aheadClear = false;
      var target = aheadClear ? 10 : 0;
      c.speed = damp(c.speed, target, 2, dt);
      if (d < 3) {
        c.node = c.nextNode;
        c.nextNode = randomNeighbour(c.node);
        if (chance(0.12)) c.waitTimer = rr(0.5, 2.5); // pause at the corner
      }
    }
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    // stay on the road: snap back toward the nearest road centre
    if (!isOnRoad(c.x, c.z)) {
      var nx = nearestRoadCoord(c.x), nz = nearestRoadCoord(c.z);
      c.x = damp(c.x, nx, 2, dt); c.z = damp(c.z, nz, 2, dt);
    }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    c.mesh.userData.wheels.forEach(function (w) { w.rotation.x += c.speed * dt * 2.4; });
  },
};

// ---- the player's driving --------------------------------------------------
var Driving = {
  update: function (dt, input) {
    var c = G.car;
    if (!c) return;
    var accel = 0;
    if (input.forward) accel = c.model.accel;
    if (input.back) accel = c.speed > 0.5 ? -26 : -10;
    if (input.handbrake) accel = -c.speed * 2.2;
    c.speed += accel * dt;
    // drag + top speed
    c.speed -= c.speed * 0.55 * dt;
    c.speed = clamp(c.speed, -12, c.model.top);
    if (Math.abs(c.speed) < 0.15 && !input.forward && !input.back) c.speed = 0;
    // steering: stronger at low speed, reversed when reversing
    var steerTarget = 0;
    if (input.left) steerTarget = 1;
    if (input.right) steerTarget = -1;
    c.steer = damp(c.steer, steerTarget, 8, dt);
    var steerRate = 1.9 * (1 - Math.min(Math.abs(c.speed) / c.model.top, 0.7) * 0.6);
    c.heading += c.steer * steerRate * (c.speed / c.model.top) * dt * (c.speed >= 0 ? 1 : -1) * 2.2;
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    // buildings stop the car hard
    var before = { x: c.x, z: c.z };
    var fixed = collideBuildings(c.x, c.z, 1.5);
    if (fixed.x !== before.x || fixed.z !== before.z) {
      if (Math.abs(c.speed) > 8) { AudioSys.crash(); Effects.impact(fixed.x, fixed.z); addWanted(0.4); }
      c.x = fixed.x; c.z = fixed.z;
      c.speed *= -0.25;
    }
    // bumping traffic cars
    Traffic.cars.forEach(function (o) {
      if (o === c || o.police) return;
      var d = dist2d(c.x, c.z, o.x, o.z);
      if (d < 3.4 && d > 0.01) {
        var push = (3.4 - d) / 2;
        var nx = (o.x - c.x) / d, nz = (o.z - c.z) / d;
        o.x += nx * push; o.z += nz * push;
        if (Math.abs(c.speed) > 6) { AudioSys.crash(); addWanted(0.2); }
        c.speed *= 0.55;
      }
    });
    // tyre smoke + skid when handbraking at speed
    if (input.handbrake && Math.abs(c.speed) > 10) {
      c.smokeTimer -= dt;
      if (c.smokeTimer <= 0) { c.smokeTimer = 0.05; Effects.smoke(c.x, c.z); }
    }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    c.mesh.userData.wheels.forEach(function (w, i) {
      w.rotation.x += c.speed * dt * 2.4;
      if (i < 2) w.rotation.y = c.steer * 0.35;
    });
    AudioSys.setEngine(Math.abs(c.speed) / c.model.top, true);
  },
};

// ---- stealing ----------------------------------------------------------------
function nearestStealableCar(maxD) {
  var best = null, bd = maxD;
  Traffic.cars.forEach(function (c) {
    if (c.police) return;
    var d = dist2d(Player.x, Player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}

function enterCar(car) {
  G.car = car;
  G.inCar = true;
  car.traffic = false;
  Player.mesh.visible = false;
  G.stats.carsStolen++;
  addWanted(1);
  HUD.toast('You jacked the ' + car.model.name + ' — the cops noticed.');
  AudioSys.tone(220, 0.12, 0.2, 'square', 440);
}

function exitCar() {
  if (!G.car) return;
  var c = G.car;
  Player.x = c.x - Math.sin(c.heading) * 2.6;
  Player.z = c.z - Math.cos(c.heading) * 2.6;
  var fixed = collideBuildings(Player.x, Player.z, 0.6);
  Player.x = fixed.x; Player.z = fixed.z;
  Player.reset(Player.x, Player.z, c.heading);
  Player.mesh.visible = true;
  c.traffic = true;
  c.node = { x: nearestRoadCoord(c.x), z: nearestRoadCoord(c.z) };
  c.nextNode = randomNeighbour(c.node);
  G.car = null;
  G.inCar = false;
  AudioSys.setEngine(0, false);
}
