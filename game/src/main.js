// main.js — boot, game loop, camera and state machine for Porto Verde.

V.cameraYaw = 0;
V.cameraPitch = 0.32;
V.cameraDist = 9;

function initGame() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game-canvas').appendChild(renderer.domElement);
  V.renderer = renderer;
  V.scene = new THREE.Scene();
  V.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  V.clock = new THREE.Clock();

  buildCity(V.scene);
  initEffects(V.scene);
  initMissionMarker(V.scene);
  createPlayer();
  spawnParkedCars();
  spawnTraffic(14);
  spawnPedestrians(26);
  setupCourierVan(V.scene);
  initHud();
  initInput();
  initAudio();

  window.addEventListener('resize', () => {
    V.camera.aspect = window.innerWidth / window.innerHeight;
    V.camera.updateProjectionMatrix();
    V.renderer.setSize(window.innerWidth, window.innerHeight);
  });
  // Clicking the canvas starts audio (browser gesture rule).
  renderer.domElement.addEventListener('click', () => { initAudio(); resumeAudio(); });
  showMenu();
  V.clock.start();
  renderer.setAnimationLoop(gameLoop);
}

function startNewGame() {
  V.money = 250; V.health = 100; V.wanted = 0; V.wantedHeat = 0;
  V.missionsDone = []; V.collectibles = 0; V.kills = 0; V.carsStolen = 0;
  V.mission = null;
  for (const c of CITY.collectibles) c.visible = true;
  if (V.activeCar) exitCar();
  V.player.x = 0; V.player.z = 40; V.player.health = 100;
  V.player.ammo = 12; V.player.reserveAmmo = 60;
  clearWanted();
  hideMenu(); hideEndScreen();
  V.state = 'playing';
  initAudio(); resumeAudio();
  showBanner('WELCOME TO PORTO VERDE');
  setTimeout(() => { if (V.state === 'playing' && !V.mission) startMission(MISSIONS[0]); }, 1500);
  saveGame();
}

function startContinueGame() {
  const d = loadSave();
  if (!d) { startNewGame(); return; }
  applySave(d);
  hideMenu(); hideEndScreen();
  V.state = 'playing';
  initAudio(); resumeAudio();
  const next = currentMissionDef();
  showBanner('WELCOME BACK TO PORTO VERDE');
  if (next) setTimeout(() => { if (V.state === 'playing' && !V.mission) startMission(next); }, 1500);
}

function respawnPlayer() {
  V.health = 100;
  V.player.x = 0; V.player.z = 40;
  if (V.activeCar) exitCar();
  hideEndScreen();
  V.state = 'playing';
  const next = currentMissionDef();
  if (next && !V.mission) startMission(next);
}

function updateCamera(dt) {
  const cam = V.camera;
  let tx, tz, ty, lookX, lookZ, lookY;
  if (V.activeCar) {
    const car = V.activeCar;
    const back = 11 + Math.abs(car.speed) * 0.12;
    tx = car.x - Math.sin(car.heading) * back;
    tz = car.z - Math.cos(car.heading) * back;
    ty = 5.2;
    lookX = car.x + Math.sin(car.heading) * 8;
    lookZ = car.z + Math.cos(car.heading) * 8;
    lookY = 1.6;
  } else if (V.player) {
    const p = V.player;
    V.cameraYaw = angleLerp(V.cameraYaw, p.heading, dt * 3);
    tx = p.x - Math.sin(V.cameraYaw) * 8;
    tz = p.z - Math.cos(V.cameraYaw) * 8;
    ty = 4.2;
    lookX = p.x + Math.sin(V.cameraYaw) * 6;
    lookZ = p.z + Math.cos(V.cameraYaw) * 6;
    lookY = 1.6;
  } else {
    tx = 0; tz = -60; ty = 60; lookX = 0; lookZ = 0; lookY = 0;
  }
  // Keep the camera out of buildings.
  const hit = hitsCollider(tx, tz, 1);
  if (hit) { tx = clamp(tx, hit.minX - 1, hit.maxX + 1); tz = clamp(tz, hit.minZ - 1, hit.maxZ + 1); }
  cam.position.x = lerp(cam.position.x, tx, 1 - Math.pow(0.0001, dt));
  cam.position.y = lerp(cam.position.y, ty, 1 - Math.pow(0.0001, dt));
  cam.position.z = lerp(cam.position.z, tz, 1 - Math.pow(0.0001, dt));
  cam.lookAt(lookX, lookY, lookZ);
}

function gameLoop() {
  const dt = Math.min(V.clock.getDelta(), 0.05);
  V.time += dt;
  if (V.state === 'playing') {
    if (key('KeyN') && !V.mission) {
      const next = currentMissionDef();
      if (next) startMission(next);
    }
    if (V.activeCar) {
      driveCar(V.activeCar, dt);
      // Courier van triggers the side job.
      if (V.activeCar.courier && !COURIER.active && COURIER.ringIndex === 0 && !V.mission) startCourierRush();
      updateCourier(dt);
    }
    updatePlayer(dt);
    updateTraffic(dt);
    updatePedestrians(dt);
    updatePolice(dt);
    updateEnemies(dt);
    updateMissions(dt);
    updateEffects(dt);
    updateAudio(dt);
    // Collectible crates bob and spin.
    for (const c of CITY.collectibles) {
      if (c.visible) { c.rotation.y += dt * 2; c.position.y = 1.4 + Math.sin(V.time * 2 + c.position.x) * 0.25; }
    }
    // Police light flash on the player's car when wanted.
    updateHud(dt);
    updateCamera(dt);
  } else if (V.state === 'menu') {
    // Slow cinematic orbit over the city behind the menu.
    const a = V.time * 0.05;
    V.camera.position.set(Math.sin(a) * 180, 90, Math.cos(a) * 180);
    V.camera.lookAt(0, 0, 0);
    updateTraffic(dt * 0.5);
    updatePedestrians(dt * 0.5);
    updateEffects(dt);
  }
  V.renderer.render(V.scene, V.camera);
}

// --- debug hooks for the screenshot driver (real renders, no network) -----
function snapCamera() {
  const cam = V.camera;
  if (V.activeCar) {
    const car = V.activeCar;
    cam.position.set(car.x - Math.sin(car.heading) * 11, 5.2, car.z - Math.cos(car.heading) * 11);
    cam.lookAt(car.x + Math.sin(car.heading) * 8, 1.6, car.z + Math.cos(car.heading) * 8);
  } else if (V.player) {
    const p = V.player;
    cam.position.set(p.x - Math.sin(V.cameraYaw) * 8, 4.2, p.z - Math.cos(V.cameraYaw) * 8);
    cam.lookAt(p.x + Math.sin(V.cameraYaw) * 6, 1.6, p.z + Math.cos(V.cameraYaw) * 6);
  }
}

V.debug = {
  start: () => startNewGame(),
  state: () => V,
  setChase: () => {
    startNewGame();
    const car = V.traffic.find((c) => c.isParked) || V.traffic[0];
    enterCar(car);
    car.x = 80; car.z = 80; car.heading = Math.PI; car.speed = 22;
    V.debugDrive = true;
    addWanted(3, 'the PD spotted the stolen car');
    const copSpots = [[-5, 9], [5, 11], [0, 22]];
    for (let i = 0; i < 3; i++) {
      const cop = spawnCar(CAR_MODELS[0], car.x + copSpots[i][0], car.z + copSpots[i][1], Math.PI, true);
      cop.isPolice = true;
      V.police.push(cop);
    }
    V.mission = { def: MISSIONS[2], step: 1, kills: 0, timer: 0, enemiesSpawned: false };
    updateMarker();
    snapCamera();
  },
  setDrive: () => {
    startNewGame();
    const car = V.traffic.find((c) => c.isParked) || V.traffic[0];
    enterCar(car);
    car.x = 80; car.z = -80; car.heading = 0; car.speed = 18;
    V.debugDrive = true;
    V.mission = { def: MISSIONS[0], step: 1, kills: 0, timer: 0, enemiesSpawned: false };
    updateMarker();
    snapCamera();
  },
  setMission: () => {
    startNewGame();
    V.mission = { def: MISSIONS[3], step: 1, kills: 0, timer: 0, enemiesSpawned: false };
    V.player.x = -80; V.player.z = -48; V.player.heading = Math.PI;
    V.cameraYaw = Math.PI;
    for (let i = 0; i < 4; i++) spawnEnemy(-80 + rand(-8, 8), -80 + rand(-8, 8), 'm4');
    V.mission.enemiesSpawned = true;
    showDialogue(['MARLA QUINN: "Go on foot. Make it loud. Four of them, and the plaza is ours again."']);
    updateMarker();
    snapCamera();
  },
  setStreet: () => {
    startNewGame();
    V.player.x = -80; V.player.z = 120; V.player.heading = Math.PI / 2;
    V.cameraYaw = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const p = randomRoadPoint();
      V.peds[i].x = -80 + i * 4; V.peds[i].z = 120 + (i % 2) * 6;
    }
    showSubtitle('Porto Verde — explore on foot, steal any car, take any job.');
    snapCamera();
  },
};

window.addEventListener('DOMContentLoaded', initGame);
