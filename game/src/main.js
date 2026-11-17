// Dusthaven — main.js
// Boot, the game loop and the state machine (menu / playing / paused /
// busted / down). Owns the renderer, the follow camera and the
// screenshot staging hooks (?shot=chase|drive|mission|street) that let
// the headless browser pose the game for its four screenshots.
var DH = window.DH || (window.DH = {});

DH.main = (function () {
  'use strict';

  var U = DH.util;
  var G = null;

  function newGameState() {
    return {
      scene: null,
      camera: null,
      renderer: null,
      state: 'menu',
      time: 0,
      playSeconds: 0,
      money: 250,
      wanted: 0,
      lastCrimeAt: -100,
      lastShotAt: -100,
      missionIndex: 0,
      missionsDone: [],
      coinsCollected: [],
      bestStunt: 0,
      carsStolen: 0,
      player: null,
      allCars: [],
      parkedCars: [],
      traffic: [],
      peds: [],
      policeCars: [],
      deputies: [],
      enemies: [],
      colliders: [],
      coinSpots: [],
      coinMeshes: [],
      mission: null,
      delivery: null,
      objectivePos: null,
      rampPos: null,
      camYaw: 0,
      mouseYaw: 0,
      camDist: 9,
      shot: null,
      shotReady: false,
      shotCruise: false,
      cruiseSpeed: 16,
      saveTimer: 0,
      stuntCooldown: 0
    };
  }

  function boot() {
    window.__gameErrors = [];
    window.addEventListener('error', function (e) {
      window.__gameErrors.push(String(e.message || e.error));
      var el = document.getElementById('errlog');
      if (el) el.textContent = window.__gameErrors.join(' | ');
    });
    DH.input.init();
    G = newGameState();
    window.DH.G = G;
    var params = new URLSearchParams(window.location.search);
    G.shot = params.get('shot');

    var shotMode = !!params.get('shot');
    var renderer = new THREE.WebGLRenderer({ antialias: !shotMode });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Screenshot staging runs under software GL: cap the pixel ratio
    // and the shadow map there so a posed shot still renders in time.
    renderer.setPixelRatio(shotMode ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('game').appendChild(renderer.domElement);
    G.renderer = renderer;

    var scene = new THREE.Scene();
    G.scene = scene;
    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    G.camera = camera;

    DH.city.buildCity(G);
    DH.effects.init(G);
    DH.hud.init(G);
    DH.missions.buildMarker(G);

    G.player = DH.player.createPlayer(G, 0, -40);
    G.parkedCars = DH.vehicles.spawnParkedCars(G, 14);
    G.traffic = DH.vehicles.spawnTraffic(G, 16);
    G.peds = DH.pedestrians.spawnPedestrians(G, 26);
    G.allCars = G.parkedCars.concat(G.traffic);
    DH.missions.buildCoins(G);

    // The player's own starter car, parked by the garage.
    var starter = DH.vehicles.createCar(G, 178, -52, Math.PI / 2, 0xd86a1e, { maxSpeed: 36 });
    starter.isPlayerOwned = true;
    G.allCars.push(starter);
    G.starterCar = starter;

    wireMenu();
    window.addEventListener('resize', onResize);
    DH.hud.showMenu(false);
    DH.hud.showObjective('Welcome to Dusthaven — press New Game');
    updateMenuSave();

    if (G.shot) {
      startGame(false);
      stageShot(G.shot);
    }
    requestAnimationFrame(loop);
  }

  function updateMenuSave() {
    var save = DH.save.loadGame();
    DH.hud.showMenu(!!save);
  }

  function wireMenu() {
    U.el('btn-new').addEventListener('click', function () {
      DH.audio.ensure();
      DH.save.clearSave();
      startGame(true);
    });
    U.el('btn-continue').addEventListener('click', function () {
      DH.audio.ensure();
      startGame(false);
    });
    U.el('btn-resume').addEventListener('click', function () {
      G.state = 'playing';
      DH.hud.showPause(false);
    });
    U.el('btn-restart').addEventListener('click', function () {
      DH.save.clearSave();
      startGame(true);
    });
    U.el('btn-quit').addEventListener('click', function () {
      DH.save.saveGame(G);
      G.state = 'menu';
      updateMenuSave();
    });
  }

  function applySave(save) {
    G.money = save.money;
    G.missionIndex = save.missionIndex;
    G.missionsDone = save.missionsDone.slice();
    G.coinsCollected = save.coins.slice();
    G.bestStunt = save.bestStunt;
    G.carsStolen = save.carsStolen;
    G.playSeconds = save.playSeconds;
    // Rebuild coin visibility from the loaded save.
    (G.coinMeshes || []).forEach(function (c) {
      c.taken = G.coinsCollected.indexOf(c.index) >= 0;
      c.mesh.visible = !c.taken;
    });
  }

  function startGame(fresh) {
    var save = fresh ? null : DH.save.loadGame();
    if (save) applySave(save);
    else {
      G.money = 250;
      G.missionIndex = 0;
      G.missionsDone = [];
      G.coinsCollected = [];
      G.bestStunt = 0;
      G.carsStolen = 0;
      G.playSeconds = 0;
    }
    G.state = 'playing';
    G.wanted = 0;
    DH.police.setWanted(G, 0);
    DH.hud.showGame();
    DH.hud.updateStars(G);
    DH.hud.showObjective(G.missionIndex < DH.missions.MISSIONS.length
      ? 'Go to Mesa Motors to start: ' + DH.missions.MISSIONS[G.missionIndex].title
      : 'Free roam — deliveries, stunts and sun coins await');
    DH.missions.setMarker(G, 186, -60);
    DH.audio.setRadio(true);
    DH.audio.ensure();
    if (!fresh && save) DH.hud.showBanner('WELCOME BACK', 'Jet Calloway returns to Dusthaven');
    else DH.hud.showBanner('DUSTHAVEN', 'A desert-edge city at golden hour — make it yours');
  }

  // Pose the game for a screenshot: put the player, the police and the
  // mission exactly where the shot needs them, then let the loop run.
  function stageShot(shot) {
    var p = G.player;
    if (shot === 'chase') {
      var car = DH.vehicles.createCar(G, 0, 30, 0, 0xc0392b, { maxSpeed: 38 });
      car.isPlayerOwned = true;
      car.health = 10000; // the posed chase car must survive the staging
      G.allCars.push(car);
      DH.player.enterCar(G, car);
      car.speed = 22;
      G.shotCruise = true;
      G.cruiseSpeed = 22;
      DH.police.setWanted(G, 3);
      for (var i = 0; i < 3; i++) {
        var cop = DH.vehicles.createCar(G, -2 + i * 3, 30 - 16 - i * 12, 0, 0xe8e8e8, {
          police: true, maxSpeed: 38, accel: 20
        });
        cop.speed = 18;
        G.policeCars.push(cop);
        G.allCars.push(cop);
      }
      DH.missions.startMission(G, 0);
      DH.hud.showDialogue('Delia Voss', 'Jet, first job. A friend waits by the canal. Drive careful — he pays careful.');
      G.keepDialogue = ['Delia Voss', 'Jet, first job. A friend waits by the canal. Drive careful — he pays careful.'];
    } else if (shot === 'drive') {
      var car2 = DH.vehicles.createCar(G, 60, -120, Math.PI / 2, 0x2e6fb0, { maxSpeed: 36 });
      car2.isPlayerOwned = true;
      G.allCars.push(car2);
      DH.player.enterCar(G, car2);
      car2.speed = 18;
      G.shotCruise = true;
      G.cruiseSpeed = 18;
      DH.hud.showObjective('Free roam — cruise downtown Dusthaven');
      DH.missions.setMarker(G, 186, -60);
    } else if (shot === 'mission') {
      var car3 = DH.vehicles.createCar(G, 160, -60, Math.PI / 2, 0xd86a1e, { maxSpeed: 36 });
      car3.isPlayerOwned = true;
      G.allCars.push(car3);
      DH.player.enterCar(G, car3);
      car3.speed = 10;
      G.shotCruise = true;
      G.cruiseSpeed = 12;
      DH.missions.startMission(G, 0);
      DH.hud.showDialogue('Delia Voss', 'Jet, first job. A friend waits by the canal. Drive careful — he pays careful.');
      G.keepDialogue = ['Delia Voss', 'Jet, first job. A friend waits by the canal. Drive careful — he pays careful.'];
    } else if (shot === 'street') {
      p.pos.set(0, 0, -52);
      p.heading = 0.4;
      p.mesh.visible = true;
      // Fists out, not the pistol: with a gun drawn every pedestrian
      // would flee the frame before the shutter falls.
      p.weapon = 'fists';
      // A few parked cars right in front of the camera.
      [[8, -38, 0], [8, -66, 0], [-8, -40, Math.PI]].forEach(function (c) {
        var pc = DH.vehicles.createCar(G, c[0], c[1], c[2], DH.vehicles.CAR_COLORS[Math.floor(Math.random() * 8)], {});
        G.allCars.push(pc);
        G.parkedCars.push(pc);
      });
      var extra = DH.pedestrians.spawnPedestrians(G, 8);
      extra.forEach(function (ped) {
        ped.pos.x = U.rand(-12, 12);
        ped.pos.z = U.rand(-48, -18);
      });
      G.peds = G.peds.concat(extra);
      DH.hud.showObjective('On foot in Dusthaven — press E near a car to take it');
      DH.missions.setMarker(G, 186, -60);
    }
    G.camYaw = p.heading;
  }

  function playerBusted(G) {
    if (G.state !== 'playing') return;
    G.state = 'busted';
    DH.audio.setSiren(false);
    DH.audio.busted();
    var fine = Math.min(150, Math.floor(G.money * 0.2));
    G.money -= fine;
    DH.police.setWanted(G, 0);
    DH.hud.setPausedText('BUSTED');
    U.el('pause-sub').textContent = 'The sheriff caught up — fine ' + U.formatMoney(fine) + '. Back to the garage.';
    DH.hud.showPause(true);
    respawnAtGarage(G);
    setTimeout(function () {
      if (G.state === 'busted') {
        G.state = 'playing';
        DH.hud.showPause(false);
      }
    }, 2600);
  }

  function playerDown(G) {
    if (G.state !== 'playing') return;
    G.state = 'down';
    DH.audio.setSiren(false);
    var fee = Math.min(100, Math.floor(G.money * 0.15));
    G.money -= fee;
    DH.police.setWanted(G, 0);
    DH.hud.setPausedText('FLAT OUT');
    U.el('pause-sub').textContent = 'You woke up at the clinic — bill ' + U.formatMoney(fee) + '. Dust yourself off.';
    DH.hud.showPause(true);
    respawnAtGarage(G);
    setTimeout(function () {
      if (G.state === 'down') {
        G.state = 'playing';
        DH.hud.showPause(false);
      }
    }, 2600);
  }

  function respawnAtGarage(G) {
    var p = G.player;
    if (p.inCar) DH.player.exitCar(G);
    p.health = 100;
    p.ammo = 12;
    p.ammoReserve = 48;
    p.pos.set(178, 0, -44);
    p.heading = Math.PI / 2;
    p.mesh.visible = true;
    // Clear the heat's cars so the respawn is not an ambush.
    (G.policeCars || []).slice().forEach(function (car) {
      car.dead = true;
      car.mesh.visible = false;
    });
    G.policeCars = [];
    G.allCars = G.allCars.filter(function (c) { return !c.isPolice; });
    (G.deputies || []).forEach(function (d) { G.scene.remove(d.mesh); });
    G.deputies = [];
    G.camYaw = p.heading;
  }

  function updateCamera(G, dt) {
    var p = G.player;
    // Cover-shot camera: sit ahead of the player car and look back at
    // it, so the pursuing police cars are in frame behind it.
    if (G.shot === 'chase' && p.inCar) {
      var fwd = p.heading;
      var cx = p.pos.x + Math.sin(fwd) * 16;
      var cz = p.pos.z + Math.cos(fwd) * 16;
      var shake = DH.effects.shakeOffset();
      G.camera.position.set(cx + shake.x, 5 + shake.y, cz);
      var look = p.pos.clone();
      look.y = 1.4;
      look.x -= Math.sin(fwd) * 10;
      look.z -= Math.cos(fwd) * 10;
      G.camera.lookAt(look);
      return;
    }
    var targetYaw = p.heading;
    G.mouseYaw += DH.input.mouse.dx * 0.003;
    G.mouseYaw = U.clamp(G.mouseYaw, -1.4, 1.4);
    G.mouseYaw = U.lerp(G.mouseYaw, 0, U.clamp(dt * 0.8, 0, 1));
    G.camYaw = U.angleLerp(G.camYaw, targetYaw + G.mouseYaw, U.clamp(dt * 4, 0, 1));
    var dist = p.inCar ? 10.5 : 7.5;
    var height = p.inCar ? 4.2 : 3.2;
    var cx = p.pos.x - Math.sin(G.camYaw) * dist;
    var cz = p.pos.z - Math.cos(G.camYaw) * dist;
    var shake = DH.effects.shakeOffset();
    G.camera.position.set(cx + shake.x, height + shake.y, cz);
    var look = p.pos.clone();
    look.y = 1.6;
    look.x += Math.sin(G.camYaw) * 8;
    look.z += Math.cos(G.camYaw) * 8;
    G.camera.lookAt(look);
  }

  var last = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min((t - last) / 1000 || 0.016, 0.05);
    last = t;
    if (!G) return;
    if (G.state === 'playing') {
      G.time += dt;
      G.playSeconds += dt;
      if (DH.input.hit('Escape')) {
        G.state = 'paused';
        DH.hud.setPausedText('PAUSED');
        U.el('pause-sub').textContent = 'Take a breath. The city waits.';
        DH.hud.showPause(true);
      }
      if (DH.input.hit('KeyR')) DH.combat.reload(G);
      if (DH.input.hit('KeyM')) DH.audio.toggleMute();
      if (DH.input.mouse.clicked && !G.player.inCar) DH.combat.shoot(G);
      if (G.player.inCar) DH.player.updateDriving(G, dt);
      else DH.player.updateOnFoot(G, dt);
      DH.vehicles.updateTraffic(G, dt);
      DH.pedestrians.updatePeds(G, dt);
      DH.police.updatePolice(G, dt);
      DH.combat.updateEnemies(G, dt);
      DH.missions.updateMissions(G, dt);
      DH.effects.update(dt);
      var car = G.player.inCar;
      DH.audio.setEngine(car ? Math.abs(car.speed) / car.maxSpeed : 0, !!car);
      DH.audio.update(dt);
      updateCamera(G, dt);
      DH.hud.update(G, dt);
      if (G.keepDialogue) DH.hud.showDialogue(G.keepDialogue[0], G.keepDialogue[1]);
      G.saveTimer += dt;
      if (G.saveTimer > 20) {
        G.saveTimer = 0;
        DH.save.saveGame(G);
      }
      if (G.shot && !G.shotReady && G.time > 2.5) {
        G.shotReady = true;
        window.__shotReady = true;
      }
    } else if (G.state === 'paused' || G.state === 'busted' || G.state === 'down') {
      DH.hud.update(G, 0);
      if (DH.input.hit('Escape') && G.state === 'paused') {
        G.state = 'playing';
        DH.hud.showPause(false);
      }
    } else {
      // Menu: slow cinematic orbit over downtown.
      G.time += dt;
      var a = G.time * 0.05;
      G.camera.position.set(Math.cos(a) * 150, 70, Math.sin(a) * 150);
      G.camera.lookAt(0, 10, 0);
      DH.effects.update(dt);
    }
    DH.input.endFrame();
    G.renderer.render(G.scene, G.camera);
  }

  function onResize() {
    if (!G) return;
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return {
    boot: boot,
    playerBusted: playerBusted,
    playerDown: playerDown,
    getG: function () { return G; }
  };
})();

window.addEventListener('DOMContentLoaded', function () {
  DH.main.boot();
});
