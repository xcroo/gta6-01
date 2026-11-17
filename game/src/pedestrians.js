// pedestrians.js — sidewalk walkers who flee from chaos in Porto Verde.

const PED_COLORS = [0xe8b04b, 0x4b8fe8, 0xe84b6a, 0x6ae84b, 0xb04be8, 0xe8e0d0, 0x3a3f45, 0xd8702e];

function buildPedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.95; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.68;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

function spawnPedestrians(n) {
  for (let i = 0; i < n; i++) {
    const x = rand(-280, 280), z = rand(-280, 280);
    const mesh = buildPedMesh(pick(PED_COLORS));
    mesh.position.set(x, 0, z);
    V.scene.add(mesh);
    V.peds.push({
      mesh, x, z, heading: rand(0, Math.PI * 2),
      speed: rand(1.2, 2.2), targetX: x, targetZ: z,
      panic: 0, walkPhase: rand(0, 6),
    });
  }
}

function pickPedTarget(ped) {
  // A new sidewalk waypoint: just off a street, inside a block edge.
  const street = pick(CITY.streets);
  const along = rand(-280, 280);
  if (rng() < 0.5) { ped.targetX = along; ped.targetZ = street + pick([-11, 11]); }
  else { ped.targetX = street + pick([-11, 11]); ped.targetZ = along; }
}

function updatePedestrians(dt) {
  const px = V.player ? V.player.x : 0, pz = V.player ? V.player.z : 0;
  const chaos = V.wanted > 0 || (V.activeCar && Math.abs(V.activeCar.speed) > 20);
  for (const ped of V.peds) {
    // Panic: gunfire, sirens or a speeding car nearby.
    const nearPlayer = dist2d(ped.x, ped.z, px, pz);
    if (nearPlayer < 14 && (chaos || V.playerFired)) ped.panic = 3;
    if (V.playerFired && nearPlayer < 30) ped.panic = Math.max(ped.panic, 1.5);
    let speed = ped.speed;
    let tx = ped.targetX, tz = ped.targetZ;
    if (ped.panic > 0) {
      ped.panic -= dt;
      speed = 5.5;
      tx = ped.x + (ped.x - px); tz = ped.z + (ped.z - pz); // run away
    }
    const dx = tx - ped.x, dz = tz - ped.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 2) { pickPedTarget(ped); continue; }
    const wantHeading = Math.atan2(dx, dz);
    ped.heading = angleLerp(ped.heading, wantHeading, dt * 5);
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    if (!hitsCollider(nx, nz, 0.6) && Math.abs(nx) < CITY.half + 10 && Math.abs(nz) < CITY.half + 10) {
      ped.x = nx; ped.z = nz;
    } else {
      pickPedTarget(ped);
    }
    // Run over by a car?
    if (V.activeCar && dist2d(ped.x, ped.z, V.activeCar.x, V.activeCar.z) < 2.2 && Math.abs(V.activeCar.speed) > 4) {
      ped.mesh.visible = false;
      ped.dead = true;
      spawnBlood(ped.x, ped.z);
      addWanted(1, 'hit a pedestrian');
      V.kills++;
      sfxHit();
    }
    ped.walkPhase += dt * speed * 2.2;
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.06, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
  // Remove the dead and keep the crowd topped up.
  for (let i = V.peds.length - 1; i >= 0; i--) {
    if (V.peds[i].dead) { V.scene.remove(V.peds[i].mesh); V.peds.splice(i, 1); }
  }
  if (V.peds.length < 22 && rng() < dt * 0.5) spawnPedestrians(1);
}
