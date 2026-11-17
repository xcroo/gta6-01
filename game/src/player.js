// player.js — on-foot movement, entering and exiting cars, in Porto Verde.

function createPlayer() {
  const mesh = buildPedMesh(0x2e6fd8);
  // Give the player a distinct look: dark jacket, cap.
  mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xd94f3d }));
  cap.position.y = 1.92;
  mesh.add(cap);
  mesh.position.set(0, 0, 40);
  V.scene.add(mesh);
  V.player = {
    mesh, x: 0, z: 40, heading: 0,
    speed: 0, health: 100,
    ammo: 12, ammoMax: 12, reserveAmmo: 60,
    weapon: 'pistol', meleeCooldown: 0,
    inCar: false, walkPhase: 0,
  };
  V.playerFired = false;
}

function updatePlayer(dt) {
  const p = V.player;
  if (!p || p.inCar) return;
  if (p.meleeCooldown > 0) p.meleeCooldown -= dt;

  // Movement relative to the camera heading.
  const camYaw = V.cameraYaw || 0;
  let fx = 0, fz = 0;
  if (key('KeyW') || key('ArrowUp')) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
  if (key('KeyS') || key('ArrowDown')) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
  if (key('KeyA') || key('ArrowLeft')) { fx -= Math.cos(camYaw); fz += Math.sin(camYaw); }
  if (key('KeyD') || key('ArrowRight')) { fx += Math.cos(camYaw); fz -= Math.sin(camYaw); }
  const len = Math.sqrt(fx * fx + fz * fz);
  const sprint = key('ShiftLeft') || key('ShiftRight');
  const targetSpeed = len > 0 ? (sprint ? 9.5 : 5.5) : 0;
  p.speed = lerp(p.speed, targetSpeed, dt * 8);
  if (len > 0) {
    fx /= len; fz /= len;
    const nx = p.x + fx * p.speed * dt;
    const nz = p.z + fz * p.speed * dt;
    if (!hitsCollider(nx, nz, 0.7)) { p.x = nx; p.z = nz; }
    p.heading = angleLerp(p.heading, Math.atan2(fx, fz), dt * 10);
    p.walkPhase += dt * p.speed * 1.6;
  }
  p.x = clamp(p.x, -CITY.half - 10, CITY.half + 30);
  p.z = clamp(p.z, -CITY.half - 10, CITY.half + 10);
  p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.05, p.z);
  p.mesh.rotation.y = p.heading;

  // Collectible stash crates.
  for (const crate of CITY.collectibles) {
    if (crate.visible && dist2d(p.x, p.z, crate.position.x, crate.position.z) < 2.2) {
      crate.visible = false;
      V.collectibles++;
      V.money += 150;
      sfxPickup();
      showSubtitle('Stash found! +$150  (' + V.collectibles + '/' + V.collectiblesTotal + ' stashes)');
    }
  }

  // Shooting (mouse click aims at the crosshair centre).
  if (consumeClick() && V.state === 'playing') firePistol();
}

function nearestCar(maxDist) {
  let best = null, bd = maxDist;
  for (const car of V.traffic) {
    const d = dist2d(V.player.x, V.player.z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  for (const car of V.police) {
    if (car.wrecked) continue;
    const d = dist2d(V.player.x, V.player.z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function tryEnterExitCar() {
  if (V.state !== 'playing' || !V.player) return;
  if (V.player.inCar) {
    exitCar();
    return;
  }
  const car = nearestCar(4.5);
  if (!car) return;
  enterCar(car);
}

function enterCar(car) {
  car.isParked = false;
  car.isTraffic = false;
  V.activeCar = car;
  V.player.inCar = true;
  V.player.mesh.visible = false;
  V.player.x = car.x; V.player.z = car.z;
  if (!car.wasStolen) {
    car.wasStolen = true;
    V.carsStolen++;
    addWanted(1, 'stole a ' + car.model.name);
    showSubtitle('You took the ' + car.model.name + '. The owner called it in!');
  }
  sfxClick();
}

function exitCar() {
  const car = V.activeCar;
  if (!car) return;
  V.activeCar = null;
  V.player.inCar = false;
  V.player.mesh.visible = true;
  V.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  V.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  car.speed = 0;
}

function reloadWeapon() {
  const p = V.player;
  if (!p || p.inCar || p.ammo === p.ammoMax || p.reserveAmmo <= 0) return;
  const need = p.ammoMax - p.ammo;
  const take = Math.min(need, p.reserveAmmo);
  p.ammo += take; p.reserveAmmo -= take;
  sfxClick();
}
