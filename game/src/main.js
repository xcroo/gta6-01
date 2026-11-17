// SOLMARA — main.js
// Bootstrap and the game loop. Builds the renderer, sun, sky and city,
// wires the menus, runs every system each frame, and drives the camera.
// Also owns the ?shot= presets the screenshots are taken from.

var Main = {
  sun: null,
  autoDrive: false,
  dragTimer: 0,
  lastDamageAt: -99,
  shotReadyAt: 4,

  init: function () {
    window.__gameErrors = [];
    window.addEventListener('error', function (e) {
      window.__gameErrors.push(String(e.message || e.error));
    });

    var params = new URLSearchParams(window.location.search);
    G.shotMode = params.get('shot');
    if (params.get('debug') === '1') G.debug = true;

    // --- renderer ---------------------------------------------------------
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    document.getElementById('game-canvas').appendChild(renderer.domElement);
    G.renderer = renderer;

    // --- scene, golden-hour sky -------------------------------------------
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ecfe8);
    scene.fog = new THREE.Fog(0xecc99a, 140, 720);
    G.scene = scene;

    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    G.camera = camera;

    var hemi = new THREE.HemisphereLight(0x9fc8e8, 0x8a6f4d, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
    sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // --- world --------------------------------------------------------------
    G.clock = new THREE.Clock();
    buildCity(scene);
    Player.build(scene);
    Player.reset(0, 12, Math.PI);
    Traffic.spawn(16);
    Pedestrians.spawn(22);
    Effects.init(scene);
    Combat.init(scene);
    Missions.build(scene);
    Pickups.init();
    HUD.init();
    Input.init();
    Input.onKey = this.onKey.bind(this);

    // --- menus ----------------------------------------------------------------
    el('btn-new').addEventListener('click', function () { Main.newGame(); });
    el('btn-continue').addEventListener('click', function () { Main.continueGame(); });
    el('btn-howto').addEventListener('click', function () {
      show('howto-panel', true); AudioSys.click();
    });
    el('btn-close-howto').addEventListener('click', function () {
      show('howto-panel', false); AudioSys.click();
    });
    el('btn-resume').addEventListener('click', function () { Main.togglePause(false); });
    el('btn-quit-menu').addEventListener('click', function () {
      Main.togglePause(false);
      SaveGame.save();
      Main.toMenu();
    });
    el('btn-busted').addEventListener('click', function () { Main.respawnAfterBusted(); });
    el('btn-save-quit').addEventListener('click', function () {
      SaveGame.save(); Main.toMenu();
    });
    if (SaveGame.hasSave()) {
      el('btn-continue').style.display = '';
    }
    window.addEventListener('resize', function () {
      G.camera.aspect = window.innerWidth / window.innerHeight;
      G.camera.updateProjectionMatrix();
      G.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- screenshot presets ---------------------------------------------------
    if (G.shotMode) this.applyShotMode(G.shotMode);

    this.loop();
  },

  onKey: function (code) {
    if (code === 'Escape') {
      if (G.mode === 'playing') this.togglePause(true);
      else if (G.mode === 'paused') this.togglePause(false);
      return;
    }
    if (G.mode !== 'playing') return;
    if (code === 'KeyE') {
      if (G.inCar) exitCar();
      else {
        var car = nearestStealableCar(4);
        if (car) enterCar(car);
      }
    }
    if (code === 'KeyM') {
      if (!Missions.active) {
        if (G.missionIndex < MISSIONS.length) Missions.start(G.missionIndex);
        else { G.missionIndex = 0; Missions.start(0); }
      }
    }
    if (code === 'KeyH' && G.inCar) AudioSys.horn();
    if (code === 'KeyR' && !G.inCar) {
      // reload from reserve into the magazine
      if (G.reserveAmmo > 0 && G.ammo < 12) {
        var take = Math.min(12 - G.ammo, G.reserveAmmo);
        G.ammo += take; G.reserveAmmo -= take;
        HUD.toast('Reloaded — ' + G.ammo + ' in the mag');
        AudioSys.click();
      }
    }
  },

  newGame: function () {
    SaveGame.wipe();
    G.cash = 250; G.health = 100; G.ammo = 24; G.reserveAmmo = 120;
    G.missionIndex = 0; G.missionsDone = 0; G.freeRoam = false;
    G.stats = { carsStolen: 0, missionsDone: 0, copsDodged: 0, shotsFired: 0, hits: 0 };
    clearWanted();
    Combat.clearEnemies();
    Player.reset(0, 12, Math.PI);
    this.startPlaying();
    HUD.toast('Welcome to Solmara, Rook. Press M for your first job.');
  },

  continueGame: function () {
    var data = SaveGame.load();
    if (!data) { this.newGame(); return; }
    SaveGame.apply(data);
    this.startPlaying();
    HUD.toast('Welcome back to Solmara, Rook.');
  },

  startPlaying: function () {
    AudioSys.init();
    AudioSys.resume();
    show('start-screen', false);
    show('pause-screen', false);
    show('busted-screen', false);
    show('hud', true);
    G.mode = 'playing';
    G.paused = false;
  },

  toMenu: function () {
    G.mode = 'menu';
    show('hud', false);
    show('start-screen', true);
    if (SaveGame.hasSave()) el('btn-continue').style.display = '';
  },

  togglePause: function (on) {
    if (on) {
      G.mode = 'paused'; G.paused = true;
      show('pause-screen', true);
      AudioSys.setEngine(0, false);
      AudioSys.setSiren(false);
    } else {
      G.mode = 'playing'; G.paused = false;
      show('pause-screen', false);
      AudioSys.resume();
    }
  },

  respawnAfterBusted: function () {
    show('busted-screen', false);
    show('hud', true);
    G.health = 100;
    Player.reset(43, 60, 0);
    G.mode = 'playing';
    HUD.toast('The hospital patched you up. Lay low for a while.');
  },

  // ---- screenshot presets: real game states, no menus ----------------------
  applyShotMode: function (shot) {
    this.startPlaying();
    // the chase reads best a little earlier, before the car reaches the roadblock
    this.shotReadyAt = shot === 'chase' ? 2.5 : shot === 'drive' ? 3 : 4;
    if (shot === 'street') {
      Player.reset(16, 82, 2.6);
      Input.camYaw = -0.66; Input.camPitch = 0.32;
      Missions.start(0);
    } else if (shot === 'drive') {
      var car = makeCar({ x: 0, z: -120, heading: 0, model: CAR_MODELS[0], color: 0x2e86c1 });
      Traffic.cars.push(car);
      enterCarNoWanted(car);
      this.autoDrive = true;
      Input.camYaw = Math.PI; Input.camPitch = 0.3;
      Missions.start(0); // objective + marker on the minimap
      // traffic ahead on the same avenue so the shot shows the city alive
      [[0, -40], [0, 30], [0, 95], [-86, -20]].forEach(function (p) {
        var t = makeCar({
          x: p[0], z: p[1], heading: p[0] === -86 ? Math.PI / 2 : 0,
          traffic: true, node: { x: nearestRoadCoord(p[0]), z: nearestRoadCoord(p[1]) },
        });
        t.nextNode = randomNeighbour(t.node);
        Traffic.cars.push(t);
      });
    } else if (shot === 'chase') {
      var c2 = makeCar({ x: 0, z: -100, heading: 0, model: CAR_MODELS[1], color: 0xc0392b });
      Traffic.cars.push(c2);
      enterCarNoWanted(c2);
      this.autoDrive = true;
      Input.camYaw = Math.PI; Input.camPitch = 0.3;
      [[0, 30], [0, 95]].forEach(function (p) {
        var t = makeCar({
          x: p[0], z: p[1], heading: 0,
          traffic: true, node: { x: 0, z: nearestRoadCoord(p[1]) },
        });
        t.nextNode = randomNeighbour(t.node);
        Traffic.cars.push(t);
      });
      Missions.start(2); // Heat Wave: 3 stars + safehouse marker
      // roadblock on the cross-street ahead: two patrol cars side by side,
      // facing the player (frozen in place for the shot — lights still flash)
      var pc1 = makeCar({ x: -6, z: 0, heading: Math.PI, police: true, model: CAR_MODELS[0] });
      pc1.frozen = true;
      Police.cars.push(pc1);
      var pc2 = makeCar({ x: 6, z: 0, heading: Math.PI, police: true, model: CAR_MODELS[0] });
      pc2.frozen = true;
      Police.cars.push(pc2);
      Police.spawnTimer = 5;
    } else if (shot === 'mission') {
      Player.reset(234, 102, 2.35);
      Input.camYaw = -0.78; Input.camPitch = 0.3;
      Missions.start(3);
      // jump straight to the fight stage
      Missions.active.stage = 1;
      Missions.showStage();
      for (var i = 0; i < 4; i++) Combat.spawnEnemy(244 + rr(-4, 4), 92 + rr(-4, 4));
      Combat.enemies.forEach(function (e) { e.alerted = true; });
      addWanted(1);
      Input.mouseDown = true; // show the crosshair
    }
    // the shot is ready once enough game time has run, not wall time:
    // software rendering runs far below real time, so the flag is set
    // from the loop when G.time passes the mark.
  },

  // ---- camera ---------------------------------------------------------------
  updateCamera: function (dt) {
    var target;
    if (G.inCar && G.car) {
      target = new THREE.Vector3(G.car.x, 1.6, G.car.z);
      // auto-follow behind the car unless the player dragged recently
      if (G.time - this.dragTimer > 2.5) {
        var want = G.car.heading + Math.PI;
        Input.camYaw = angleLerp(Input.camYaw, want, 1 - Math.exp(-1.8 * dt));
      }
    } else {
      target = new THREE.Vector3(Player.x, 1.9 + Player.y * 0.5, Player.z);
    }
    var dist = Input.camDist + (G.inCar ? 1.5 : 0);
    var cp = Input.camPitch;
    var off = new THREE.Vector3(
      Math.sin(Input.camYaw) * Math.cos(cp) * dist,
      Math.sin(cp) * dist + 1.2,
      Math.cos(Input.camYaw) * Math.cos(cp) * dist
    );
    var pos = target.clone().add(off);
    // keep the camera out of buildings
    var fixed = collideBuildings(pos.x, pos.z, 1);
    pos.x = fixed.x; pos.z = fixed.z;
    if (pos.y < 1.2) pos.y = 1.2;
    // screen shake
    if (Effects.shake > 0) {
      pos.x += rr(-1, 1) * Effects.shake * 0.5;
      pos.y += rr(-1, 1) * Effects.shake * 0.4;
    }
    G.camera.position.copy(pos);
    G.camera.lookAt(target);
    // sun shadow follows the player
    var px = G.inCar && G.car ? G.car.x : Player.x;
    var pz = G.inCar && G.car ? G.car.z : Player.z;
    this.sun.position.set(px + 180, 150, pz - 120);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
  },

  // ---- one simulation step (run several per frame in shot mode, where
  // software rendering runs far below real time) --------------------------
  updateGame: function (dt) {
    G.time += dt;
    // screenshot autopilot: drive straight down the avenue
    if (this.autoDrive && G.car) {
      Input.keys['KeyW'] = true;
      var lane = nearestRoadCoord(G.car.x);
      var steer = clamp((lane - G.car.x) * 0.2, -1, 1);
      Input.keys['KeyA'] = steer > 0.15;
      Input.keys['KeyD'] = steer < -0.15;
    }
    // slow health regen while calm
    if (G.wanted === 0 && G.health < G.maxHealth && G.time - this.lastDamageAt > 8) {
      G.health = Math.min(G.maxHealth, G.health + 1.5 * dt);
    }
    if (G.inCar) Driving.update(dt, Input);
    else Player.update(dt, Input, Input.camYaw);
    if (Input.mouseDown && !G.inCar && performance.now() - Input.mouseDownAt > 120) {
      Combat.playerShoot();
    }
    Traffic.update(dt);
    Pedestrians.update(dt);
    Police.update(dt);
    Combat.update(dt);
    Missions.update(dt);
    Pickups.update(dt);
    Effects.update(dt);
  },

  // ---- the loop ---------------------------------------------------------------
  loop: function () {
    var self = this;
    function frame() {
      requestAnimationFrame(frame);
      var dt = Math.min(G.clock.getDelta(), 0.05);
      if (G.mode === 'playing') {
        // once a shot is ready the simulation freezes: the screenshot is
        // taken of that exact state, not of whatever the slow renderer
        // got around to afterwards.
        if (!G.shotMode || !window.__shotReady) {
          var steps = G.shotMode ? 8 : 1;
          for (var s = 0; s < steps; s++) self.updateGame(dt);
        }
        HUD.update(dt);
        AudioSys.setSiren(G.wanted > 0);
        if (!G.inCar) AudioSys.setEngine(0, false);
        if (G.shotMode && !window.__shotReady && G.time >= self.shotReadyAt) {
          window.__shotReady = true;
        }
      }
      self.updateCamera(G.mode === 'menu' ? 0 : dt);
      if (G.mode === 'menu') {
        // slow cinematic orbit over the city behind the title
        var t = performance.now() * 0.00004;
        G.camera.position.set(Math.sin(t) * 260, 90, Math.cos(t) * 260);
        G.camera.lookAt(43, 10, 43);
      }
      if (Effects.flash > 0) {
        var f = el('flash');
        f.style.opacity = String(Effects.flash * 2.2);
      } else {
        el('flash').style.opacity = '0';
      }
      G.renderer.render(G.scene, G.camera);
    }
    frame();
  },
};

function enterCarNoWanted(car) {
  G.car = car;
  G.inCar = true;
  car.traffic = false;
  Player.mesh.visible = false;
}

window.addEventListener('DOMContentLoaded', function () { Main.init(); });
