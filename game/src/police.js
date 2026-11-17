// police.js — wanted level, police pursuit, ramming and arrests in Porto Verde.

function addWanted(stars, reason) {
  const before = V.wanted;
  V.wanted = clamp(V.wanted + stars, 0, 5);
  V.wantedHeat = 100;
  if (V.wanted > before) {
    showSubtitle('WANTED: ' + V.wanted + ' star' + (V.wanted > 1 ? 's' : '') + ' — ' + reason);
    updateWantedHud();
  }
}

function clearWanted() {
  V.wanted = 0;
  V.wantedHeat = 0;
  updateWantedHud();
}

function updatePolice(dt) {
  // Wanted decays while the player lays low (no crime, not seen by police).
  if (V.wanted > 0) {
    V.wantedHeat -= dt * (V.police.length > 0 ? 2 : 9);
    if (V.wantedHeat <= 0) {
      V.wanted--;
      V.wantedHeat = V.wanted > 0 ? 60 : 0;
      updateWantedHud();
      if (V.wanted === 0) showSubtitle('You lost the heat. Lay low.');
    }
  }

  // Spawn police cars to match the wanted level (max 4 active).
  const wantCars = V.wanted >= 1 ? Math.min(V.wanted + 1, 4) : 0;
  const active = V.police.filter((c) => !c.wrecked).length;
  if (active < wantCars && V.player) {
    const p = randomRoadPoint();
    // Spawn a little way off, on a road near the player.
    const px = V.player.x, pz = V.player.z;
    const ang = rand(0, Math.PI * 2);
    const car = spawnCar(pick(CAR_MODELS), px + Math.sin(ang) * 70, pz + Math.cos(ang) * 70, ang, true);
    car.isPolice = true;
    V.scene.add(car.mesh);
    V.police.push(car);
    sfxClick();
  }
  // Despawn far or wrecked police.
  for (let i = V.police.length - 1; i >= 0; i--) {
    const car = V.police[i];
    if (car.wrecked) {
      car.mesh.rotation.z = 0.5;
      car.despawnTimer = (car.despawnTimer || 0) + dt;
      if (car.despawnTimer > 6) { V.scene.remove(car.mesh); V.police.splice(i, 1); }
      continue;
    }
    if (V.wanted === 0 && dist2d(car.x, car.z, V.player.x, V.player.z) > 120) {
      V.scene.remove(car.mesh);
      V.police.splice(i, 1);
    }
  }

  // Chase AI: steer toward the player, ram to stop them.
  for (const car of V.police) {
    if (car.wrecked || !V.player) continue;
    const tx = V.activeCar ? V.activeCar.x : V.player.x;
    const tz = V.activeCar ? V.activeCar.z : V.player.z;
    const d = dist2d(car.x, car.z, tx, tz);
    const wantHeading = Math.atan2(tx - car.x, tz - car.z);
    car.heading = angleLerp(car.heading, wantHeading, dt * 2.2);
    const targetSpeed = clamp(16 + V.wanted * 3 + d * 0.15, 0, 44);
    car.speed = lerp(car.speed, targetSpeed, dt * 1.2);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!hitsCollider(nx, nz, 1.6)) { car.x = nx; car.z = nz; }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Flashing light bar.
    car.sirenPhase += dt * 10;
    const on = Math.sin(car.sirenPhase) > 0;
    if (car.mesh.userData.lightRed) car.mesh.userData.lightRed.material.emissive.setHex(on ? 0xff0000 : 0x330000);
    if (car.mesh.userData.lightBlue) car.mesh.userData.lightBlue.material.emissive.setHex(on ? 0x000033 : 0x0000ff);
    // Ram the player's car.
    if (V.activeCar && d < 4.2) {
      if (Math.abs(V.activeCar.speed) > 2) {
        V.activeCar.speed *= 0.6;
        damageCar(V.activeCar, 6);
        spawnCrashSparks(car.x, car.z);
        sfxCrash();
      }
      if (V.activeCar.health <= 0 || (V.activeCar.speed < 1 && d < 3)) {
        car.arrestTimer = (car.arrestTimer || 0) + dt;
        if (car.arrestTimer > 2.5) busted('boxed in by the Porto Verde PD');
      }
    } else {
      car.arrestTimer = 0;
    }
    // On foot: a cop car that stops next to the player arrests them.
    if (!V.activeCar && d < 3.5) {
      car.arrestTimer = (car.arrestTimer || 0) + dt;
      if (car.arrestTimer > 2) busted('arrested by the Porto Verde PD');
    }
  }
}

function busted(reason) {
  if (V.state !== 'playing') return;
  V.state = 'busted';
  sfxBusted();
  const fine = Math.min(V.money, 200);
  V.money -= fine;
  clearWanted();
  if (V.activeCar) exitCar();
  showEndScreen('BUSTED', reason + '. The PD took ' + fmtMoney(fine) + ' in fines. Your save is intact — get back out there.');
  saveGame();
}

function wasted(source) {
  if (V.state !== 'playing') return;
  V.state = 'wasted';
  sfxBusted();
  V.money = Math.max(0, V.money - 150);
  clearWanted();
  showEndScreen('WASTED', 'Taken out by ' + source + '. The clinic patched you up for $150.');
  saveGame();
}
