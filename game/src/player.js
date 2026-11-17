// Dusthaven — player.js
// The hero on foot: third-person walking and running, camera-relative
// movement, and getting in and out of cars. Jet Calloway, a newcomer
// driver trying to make a name in Dusthaven.
var DH = window.DH || (window.DH = {});

DH.player = (function () {
  'use strict';

  var U = DH.util;

  function makeBodyMesh() {
    var group = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xd86a1e });
    var pants = new THREE.MeshLambertMaterial({ color: 0x2a2f45 });
    var skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.78;
    head.castShadow = true;
    group.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 12),
      new THREE.MeshLambertMaterial({ color: 0x8a2a1a }));
    cap.position.y = 1.98;
    group.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), pants);
    legL.position.set(-0.16, 0.38, 0);
    group.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.16;
    group.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), jacket);
    armL.position.set(-0.42, 1.15, 0);
    group.add(armL);
    var armR = armL.clone();
    armR.position.x = 0.42;
    group.add(armR);
    group.userData.legL = legL;
    group.userData.legR = legR;
    group.userData.armL = armL;
    group.userData.armR = armR;
    return group;
  }

  function createPlayer(G, x, z) {
    var mesh = makeBodyMesh();
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    var p = {
      mesh: mesh,
      pos: mesh.position,
      heading: 0,
      speed: 0,
      health: 100,
      maxHealth: 100,
      inCar: null,
      weapon: 'pistol',
      ammo: 12,
      ammoReserve: 48,
      walkPhase: 0,
      onGround: true
    };
    return p;
  }

  // Nearest car the player could steal, within reach.
  function nearestCar(G, maxDist) {
    var best = null, bd = maxDist || 4.5;
    var cars = G.allCars || [];
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.dead || c.isPlayer) continue;
      var d = U.dist2D(G.player.pos.x, G.player.pos.z, c.pos.x, c.pos.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  function enterCar(G, car) {
    var p = G.player;
    if (!car) return false;
    // Stealing a car that is not yours is a crime.
    if (!car.isPlayerOwned) {
      DH.police.addWanted(G, 1);
      G.carsStolen = (G.carsStolen || 0) + 1;
      DH.hud.showBanner('CAR TAKEN', car.name + ' — the law noticed that');
      DH.audio.blip();
    }
    p.inCar = car;
    car.isPlayer = true;
    p.mesh.visible = false;
    p.pos.set(car.pos.x, 0, car.pos.z);
    return true;
  }

  function exitCar(G) {
    var p = G.player;
    var car = p.inCar;
    if (!car) return;
    car.isPlayer = false;
    car.speed = 0;
    p.inCar = null;
    var side = car.pos.clone();
    side.x += Math.cos(car.heading) * 3;
    side.z -= Math.sin(car.heading) * 3;
    DH.city.resolveCollisions(G, side, 1);
    p.pos.set(side.x, 0, side.z);
    p.heading = car.heading;
    p.mesh.visible = true;
  }

  function updateOnFoot(G, dt) {
    var p = G.player;
    var inp = DH.input;
    var axes = inp.moveAxes();
    var running = inp.down('ShiftLeft') || inp.down('ShiftRight');
    var speed = running ? 9.5 : 4.6;
    // Camera-relative movement: forward is where the camera looks.
    var camYaw = G.camYaw || 0;
    var mx = Math.sin(camYaw) * axes.forward + Math.cos(camYaw) * axes.strafe;
    var mz = Math.cos(camYaw) * axes.forward - Math.sin(camYaw) * axes.strafe;
    var moving = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01;
    if (moving) {
      var len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
      var targetHeading = Math.atan2(mx, mz);
      p.heading = U.angleLerp(p.heading, targetHeading, U.clamp(dt * 12, 0, 1));
      p.pos.x += mx * speed * dt;
      p.pos.z += mz * speed * dt;
      p.walkPhase += dt * speed * 1.6;
      if (Math.random() < dt * 2 && running) DH.effects.dust(p.pos);
      DH.city.resolveCollisions(G, p.pos, 0.6);
    }
    p.mesh.rotation.y = p.heading;
    // Simple walk-cycle swing.
    var swing = moving ? Math.sin(p.walkPhase) * 0.5 : 0;
    var ud = p.mesh.userData;
    ud.legL.rotation.x = swing;
    ud.legR.rotation.x = -swing;
    ud.armL.rotation.x = -swing * 0.8;
    ud.armR.rotation.x = swing * 0.8;
    // Entering a car.
    if (inp.hit('KeyE')) {
      var car = nearestCar(G, 4.5);
      if (car) enterCar(G, car);
    }
    // Melee swing.
    if (inp.hit('KeyF') && !p.inCar) {
      DH.combat.melee(G);
    }
    // Weapon switch.
    if (inp.hit('Digit1')) p.weapon = 'fists';
    if (inp.hit('Digit2')) p.weapon = 'pistol';
  }

  // Driving input each frame while the player is behind the wheel.
  function updateDriving(G, dt) {
    var p = G.player;
    var car = p.inCar;
    if (!car) return;
    var inp = DH.input;
    var axes = inp.moveAxes();
    // Screenshot staging cruises at a set speed so the posed car is
    // actually moving when the shutter falls.
    if (G.shotCruise) {
      var target = G.cruiseSpeed || 16;
      axes.forward = car.speed < target ? 1 : 0;
    }
    var handbrake = inp.down('Space');
    var crashed = DH.vehicles.driveCar(G, car, axes.forward, axes.strafe, handbrake, dt);
    if (crashed) {
      p.health -= 2;
      DH.police.addWanted(G, 0); // a crash alone is not a crime
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      DH.effects.explosion(car.pos);
      DH.hud.showBanner('CAR WRECKED', 'That ride is finished — find another');
      exitCar(G);
      p.health -= 15;
      G.playerCar = null;
    }
    if (inp.hit('KeyE')) exitCar(G);
    // Shooting from the car window is not possible; keep the wheel.
    p.pos.set(car.pos.x, 0, car.pos.z);
    p.heading = car.heading;
  }

  function damagePlayer(G, amount, fromPos) {
    var p = G.player;
    if (G.state !== 'playing') return;
    p.health -= amount;
    DH.effects.shake(0.3);
    if (fromPos) DH.effects.blood(p.pos);
    if (p.health <= 0) {
      p.health = 0;
      DH.main.playerDown(G);
    }
  }

  return {
    createPlayer: createPlayer,
    nearestCar: nearestCar,
    enterCar: enterCar,
    exitCar: exitCar,
    updateOnFoot: updateOnFoot,
    updateDriving: updateDriving,
    damagePlayer: damagePlayer
  };
})();
