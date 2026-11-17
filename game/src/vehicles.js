// vehicles.js — car models, arcade driving physics and traffic AI for Porto Verde.

const CAR_MODELS = [
  { name: 'Coral Runner', color: 0xd94f3d, topSpeed: 34, accel: 16, grip: 2.6 },
  { name: 'Sunset Coupe', color: 0x2e6fd8, topSpeed: 42, accel: 19, grip: 2.9 },
  { name: 'Palm Van', color: 0xe8e0c8, topSpeed: 26, accel: 11, grip: 2.2 },
  { name: 'Marina GT', color: 0xf2c230, topSpeed: 48, accel: 22, grip: 3.1 },
  { name: 'Dune Buggy', color: 0x7ac74f, topSpeed: 30, accel: 14, grip: 2.4 },
  { name: 'Harbor Sedan', color: 0x8a8f98, topSpeed: 36, accel: 15, grip: 2.7 },
];

function buildCarMesh(model, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2f4a : model.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), new THREE.MeshLambertMaterial({ color: 0x18222e }));
  cabin.position.set(0, 1.08, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.45, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.set(-0.32, 1.5, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.set(0.32, 1.5, -0.25);
    g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.3), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554400 }));
  nose.position.set(0, 0.6, 2.25);
  g.add(nose);
  return g;
}

function spawnCar(model, x, z, heading, isPolice) {
  const mesh = buildCarMesh(model, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  V.scene.add(mesh);
  const car = {
    mesh, model, isPolice: !!isPolice,
    x, z, heading, speed: 0, steer: 0,
    health: 100, isTraffic: false, isParked: false,
    targetSpeed: 0, nextTurnAt: 0, laneDir: 1,
    stuckTimer: 0, sirenPhase: 0,
  };
  return car;
}

function spawnParkedCars() {
  for (let i = 0; i < 14; i++) {
    const p = randomRoadPoint();
    const alongAxis = Math.abs(p.z - nearestStreetCoord(p.z)) < 1;
    const heading = alongAxis ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const off = 5.5;
    const x = alongAxis ? p.x : p.z * 0 + nearestStreetCoord(p.x) + (rng() < 0.5 ? off : -off);
    const z = alongAxis ? nearestStreetCoord(p.z) + (rng() < 0.5 ? off : -off) : p.z;
    const car = spawnCar(pick(CAR_MODELS), x, z, heading, false);
    car.isParked = true;
    V.traffic.push(car);
  }
}

function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint();
    const alongAxis = Math.abs(p.z - nearestStreetCoord(p.z)) < 1;
    const heading = alongAxis ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = spawnCar(pick(CAR_MODELS), p.x, p.z, heading, false);
    car.isTraffic = true;
    car.speed = rand(8, 14);
    car.targetSpeed = car.speed;
    V.traffic.push(car);
  }
}

// --- arcade driving -------------------------------------------------------
function driveCar(car, dt) {
  const throttle = (key('KeyW') || key('ArrowUp') || V.debugDrive) ? 1 : 0;
  const brake = key('KeyS') || key('ArrowDown') ? 1 : 0;
  const steerIn = (key('KeyA') || key('ArrowLeft') ? 1 : 0) - (key('KeyD') || key('ArrowRight') ? 1 : 0);
  const handbrake = key('Space') ? 1 : 0;

  const m = car.model;
  if (throttle) car.speed += m.accel * dt;
  if (brake) car.speed -= (car.speed > 0.5 ? 26 : 10) * dt; // brake, or reverse
  car.speed -= car.speed * (handbrake ? 1.4 : 0.35) * dt;   // drag
  if (!throttle && !brake) car.speed -= car.speed * 0.6 * dt;
  car.speed = clamp(car.speed, -12, m.topSpeed);

  const steerTarget = steerIn * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer = lerp(car.steer, steerTarget, dt * 6);
  const grip = handbrake ? m.grip * 0.35 : m.grip;
  car.heading += car.steer * clamp(Math.abs(car.speed) / 10, 0, 1) * grip * dt * (car.speed >= 0 ? 1 : -1);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = hitsCollider(nx, nz, 1.6);
  if (hit || Math.abs(nx) > CITY.half + 8 || Math.abs(nz) > CITY.half + 8) {
    if (Math.abs(car.speed) > 14) { sfxCrash(); spawnCrashSparks(car.x, car.z); }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.z = nz;
  }
  // Skid marks + smoke when drifting hard.
  if (handbrake && Math.abs(car.speed) > 10) {
    addSkid(car.x - Math.sin(car.heading) * 1.4, car.z - Math.cos(car.heading) * 1.4, car.heading);
    if (rng() < 0.5) spawnSmoke(car.x, car.z);
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -car.steer * 0.08 * clamp(Math.abs(car.speed) / 20, 0, 1);
  // Keep the player's position in sync with the car: missions, the minimap
  // and police all read V.player.x/z.
  if (V.player) { V.player.x = car.x; V.player.z = car.z; }
}

// --- traffic AI -----------------------------------------------------------
function updateTraffic(dt) {
  for (const car of V.traffic) {
    if (car.isParked) continue;
    if (car === V.activeCar) continue;
    // Slow down for the car ahead on the same street.
    let blocked = false;
    for (const other of V.traffic) {
      if (other === car || other.isParked) continue;
      const d = dist2d(car.x, car.z, other.x, other.z);
      if (d < 11) {
        const ahead = Math.sin(car.heading) * (other.x - car.x) + Math.cos(car.heading) * (other.z - car.z);
        if (ahead > 0) { blocked = true; break; }
      }
    }
    // Avoid the player: swerve target speed down when close.
    if (V.player && dist2d(car.x, car.z, V.player.x, V.player.z) < 9 && !V.activeCar) blocked = true;
    const want = blocked ? 0 : car.targetSpeed;
    car.speed = lerp(car.speed, want, dt * 1.5);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // At an intersection (near a street crossing) pick a new direction.
    const nearX = nearestStreetCoord(car.x), nearZ = nearestStreetCoord(car.z);
    const atCross = Math.abs(car.x - nearX) < 2 && Math.abs(car.z - nearZ) < 2;
    if (atCross && V.time - (car.lastTurn || -99) > 1.2) {
      car.lastTurn = V.time;
      const r = rng();
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      const cur = dirs.reduce((best, d) => Math.abs(d - normAngle(car.heading)) < Math.abs(best - normAngle(car.heading)) ? d : best, dirs[0]);
      let next = cur;
      if (r < 0.55) next = cur; // straight
      else if (r < 0.8) next = cur + Math.PI / 2; // right
      else if (r < 0.95) next = cur - Math.PI / 2; // left
      else next = cur + Math.PI; // u-turn
      car.heading = next;
      car.x = clamp(car.x, -CITY.half, CITY.half);
      car.z = clamp(car.z, -CITY.half, CITY.half);
    }
    // Snap back onto a road if drifted off (paranoia guard).
    if (!isOnRoad(car.x, car.z) && rng() < 0.02) {
      const p = randomRoadPoint();
      car.x = p.x; car.z = p.z;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Damage a car; returns true when it is wrecked.
function damageCar(car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    spawnExplosion(car.x, car.z);
    sfxCrash();
    return true;
  }
  return false;
}
