// combat.js — pistol, melee and rival-gang enemy AI in Porto Verde.

function firePistol() {
  const p = V.player;
  if (!p || p.inCar) return;
  if (p.ammo <= 0) { sfxClick(); showSubtitle('Out of ammo — press R to reload.'); return; }
  p.ammo--;
  V.playerFired = true;
  setTimeout(() => { V.playerFired = false; }, 400);
  sfxShot();
  spawnMuzzleFlash(p.x, 1.4, p.z, p.heading);
  addWanted(1, 'fired a weapon');

  // Raycast forward from the player against enemies, peds and cars.
  const dirX = Math.sin(p.heading), dirZ = Math.cos(p.heading);
  const range = 45;
  let best = null, bd = range;
  function test(tx, tz, obj, kind) {
    const dx = tx - p.x, dz = tz - p.z;
    const along = dx * dirX + dz * dirZ;
    if (along < 0 || along > bd) return;
    const perp = Math.abs(dx * dirZ - dz * dirX);
    if (perp < 1.4) { bd = along; best = { obj, kind }; }
  }
  for (const e of V.enemies) if (!e.dead) test(e.x, e.z, e, 'enemy');
  for (const ped of V.peds) test(ped.x, ped.z, ped, 'ped');
  for (const car of V.traffic) test(car.x, car.z, car, 'car');
  for (const cop of V.police) if (!cop.wrecked) test(cop.x, cop.z, cop, 'copcar');
  if (!best) return;
  if (best.kind === 'enemy') {
    best.obj.health -= 34;
    sfxHit();
    spawnBlood(best.obj.x, best.obj.z);
    if (best.obj.health <= 0) {
      best.obj.dead = true;
      best.obj.mesh.visible = false;
      V.kills++;
      V.money += 75;
      showSubtitle('Rival down. +$75');
      onEnemyKilled(best.obj);
    }
  } else if (best.kind === 'ped') {
    best.obj.dead = true;
    best.obj.mesh.visible = false;
    spawnBlood(best.obj.x, best.obj.z);
    addWanted(1, 'shot a pedestrian');
    V.kills++;
  } else if (best.kind === 'car' || best.kind === 'copcar') {
    damageCar(best.obj, 25);
    spawnCrashSparks(best.obj.x, best.obj.z);
    if (best.kind === 'copcar') addWanted(1, 'shot a police car');
  }
}

function tryMelee() {
  const p = V.player;
  if (!p || p.inCar || V.state !== 'playing' || p.meleeCooldown > 0) return;
  p.meleeCooldown = 0.6;
  sfxHit();
  for (const e of V.enemies) {
    if (!e.dead && dist2d(p.x, p.z, e.x, e.z) < 2.6) {
      e.health -= 25;
      spawnBlood(e.x, e.z);
      if (e.health <= 0) { e.dead = true; e.mesh.visible = false; V.kills++; onEnemyKilled(e); }
    }
  }
  for (const ped of V.peds) {
    if (dist2d(p.x, p.z, ped.x, ped.z) < 2.2) { ped.panic = 3; }
  }
}

function spawnEnemy(x, z, missionId) {
  const mesh = buildPedMesh(0x8a1f2e);
  mesh.position.set(x, 0, z);
  V.scene.add(mesh);
  const e = { mesh, x, z, heading: 0, health: 100, dead: false, missionId, shootTimer: rand(1, 2), walkPhase: 0 };
  V.enemies.push(e);
  return e;
}

function updateEnemies(dt) {
  const p = V.player;
  if (!p) return;
  for (const e of V.enemies) {
    if (e.dead) continue;
    const d = dist2d(e.x, e.z, p.x, p.z);
    // Chase the player when close, strafe otherwise.
    const wantHeading = Math.atan2(p.x - e.x, p.z - e.z);
    e.heading = angleLerp(e.heading, wantHeading, dt * 4);
    if (d > 3 && d < 60) {
      const sp = 3.2;
      const nx = e.x + Math.sin(e.heading) * sp * dt;
      const nz = e.z + Math.cos(e.heading) * sp * dt;
      if (!hitsCollider(nx, nz, 0.6)) { e.x = nx; e.z = nz; }
      e.walkPhase += dt * 6;
    }
    // Shoot back, inaccurately, when in range.
    e.shootTimer -= dt;
    if (d < 30 && e.shootTimer <= 0) {
      e.shootTimer = rand(1.2, 2.4);
      spawnMuzzleFlash(e.x, 1.4, e.z, e.heading);
      sfxShot();
      if (rng() < 0.35) {
        damagePlayer(8, 'rival gang');
      }
    }
    e.mesh.position.set(e.x, Math.abs(Math.sin(e.walkPhase)) * 0.05, e.z);
    e.mesh.rotation.y = e.heading;
  }
  for (let i = V.enemies.length - 1; i >= 0; i--) {
    if (V.enemies[i].dead) { V.scene.remove(V.enemies[i].mesh); V.enemies.splice(i, 1); }
  }
}

function damagePlayer(amount, source) {
  if (V.state !== 'playing') return;
  V.health -= amount;
  flashDamage();
  if (V.health <= 0) {
    V.health = 0;
    wasted(source);
  }
}

function onEnemyKilled(e) {
  if (V.mission && typeof V.mission.onKill === 'function') V.mission.onKill(e);
}
