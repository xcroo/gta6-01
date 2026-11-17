// Dusthaven — police.js
// The Dusthaven Sheriff's Department: a 0–5 star wanted level, patrol
// cars that spawn, chase and ram, and deputies on foot who try to
// arrest the player. Lay low and the heat cools off.
var DH = window.DH || (window.DH = {});

DH.police = (function () {
  'use strict';

  var U = DH.util;
  var MAX_COPS = 6;
  var decayTimer = 0;

  function setWanted(G, n) {
    G.wanted = U.clamp(Math.round(n), 0, 5);
    decayTimer = 0;
    DH.audio.setSiren(G.wanted > 0);
    DH.hud.updateStars(G);
  }

  function addWanted(G, n) {
    if (n <= 0) return;
    G.lastCrimeAt = G.time;
    setWanted(G, G.wanted + n);
    decayTimer = 0;
  }

  function spawnCopCar(G) {
    var p = G.player.pos;
    var a = Math.random() * Math.PI * 2;
    var d = U.rand(45, 70);
    var x = U.clamp(p.x + Math.cos(a) * d, -250, 250);
    var z = U.clamp(p.z + Math.sin(a) * d, -250, 250);
    x = DH.city.nearestStreetCoord(x);
    z = DH.city.nearestStreetCoord(z);
    var car = DH.vehicles.createCar(G, x, z, Math.random() * Math.PI * 2, 0xe8e8e8, {
      police: true, maxSpeed: 38, accel: 20
    });
    car.speed = 10;
    G.policeCars.push(car);
    G.allCars.push(car);
    return car;
  }

  function spawnDeputy(G) {
    var p = G.player.pos;
    var a = Math.random() * Math.PI * 2;
    var x = p.x + Math.cos(a) * 30;
    var z = p.z + Math.sin(a) * 30;
    var mesh = new THREE.Group();
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    torso.position.y = 1.1;
    torso.castShadow = true;
    mesh.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9a077 }));
    head.position.y = 1.7;
    mesh.add(head);
    var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
    hat.position.y = 1.9;
    mesh.add(hat);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    var dep = { mesh: mesh, pos: mesh.position, heading: 0, arrestTimer: 0 };
    G.deputies.push(dep);
    return dep;
  }

  // A cop car hunts the player: steer toward them, ram to slow them.
  function chaseCar(G, car, dt) {
    var p = G.player;
    var targetHeading = Math.atan2(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
    var diff = U.angleDiff(car.heading, targetHeading);
    var steer = U.clamp(diff * 1.6, -1, 1);
    var throttle = 1;
    var d = U.dist2D(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
    if (d < 6) throttle = 0.4; // ease off once on top of the player
    var crashed = DH.vehicles.driveCar(G, car, throttle, steer, false, dt);
    if (crashed && car.isPlayer === false) {
      // Ramming the player hard hurts them a little.
      if (d < 5 && p.inCar) {
        DH.player.damagePlayer(G, 1.5);
      }
    }
    // Flash the light bar.
    var ud = car.mesh.userData;
    var phase = Math.floor(G.time * 6) % 2 === 0;
    if (ud.lightRed) ud.lightRed.material.color.setHex(phase ? 0xff2222 : 0x661111);
    if (ud.lightBlue) ud.lightBlue.material.color.setHex(phase ? 0x111166 : 0x2255ff);
    // Caught: if the player is on foot and a cop car parks on them.
    if (!p.inCar && d < 3.5 && G.wanted > 0) {
      DH.main.playerBusted(G);
    }
  }

  function updateDeputy(G, dep, dt) {
    var p = G.player;
    var d = U.dist2D(dep.pos.x, dep.pos.z, p.pos.x, p.pos.z);
    var heading = Math.atan2(p.pos.x - dep.pos.x, p.pos.z - dep.pos.z);
    dep.heading = U.angleLerp(dep.heading, heading, U.clamp(dt * 8, 0, 1));
    var speed = d > 3 ? 7.5 : 0;
    dep.pos.x += Math.sin(dep.heading) * speed * dt;
    dep.pos.z += Math.cos(dep.heading) * speed * dt;
    DH.city.resolveCollisions(G, dep.pos, 0.5);
    dep.mesh.rotation.y = dep.heading;
    if (d < 2.6) {
      dep.arrestTimer += dt;
      if (dep.arrestTimer > 1.6) DH.main.playerBusted(G);
    } else {
      dep.arrestTimer = 0;
    }
  }

  function removeCopCar(G, car) {
    car.dead = true;
    car.mesh.visible = false;
    var i = G.policeCars.indexOf(car);
    if (i >= 0) G.policeCars.splice(i, 1);
    var j = G.allCars.indexOf(car);
    if (j >= 0) G.allCars.splice(j, 1);
  }

  function updatePolice(G, dt) {
    if (!G.policeCars) return;
    var want = G.wanted;
    // How many units the heat calls for: cars scale with stars.
    var wantCars = want === 0 ? 0 : Math.min(1 + want, MAX_COPS);
    var wantDeps = (!G.player.inCar && want >= 2) ? Math.min(want - 1, 3) : 0;
    while (G.policeCars.length < wantCars) spawnCopCar(G);
    while (G.policeCars.length > wantCars) removeCopCar(G, G.policeCars[G.policeCars.length - 1]);
    while (G.deputies.length < wantDeps) spawnDeputy(G);
    while (G.deputies.length > wantDeps) {
      var dep = G.deputies.pop();
      G.scene.remove(dep.mesh);
    }
    for (var i = 0; i < G.policeCars.length; i++) {
      var car = G.policeCars[i];
      if (car.dead) continue;
      chaseCar(G, car, dt);
      var d = U.dist2D(car.pos.x, car.pos.z, G.player.pos.x, G.player.pos.z);
      if (d > 160) {
        // Too far behind: respawn closer to keep the chase hot.
        removeCopCar(G, car);
        spawnCopCar(G);
      }
      if (car.health <= 0) {
        DH.effects.explosion(car.pos);
        DH.hud.showBanner('COP CAR DOWN', 'That will bring more heat — wanted up');
        addWanted(G, 1);
        removeCopCar(G, car);
      }
    }
    for (var j = 0; j < G.deputies.length; j++) updateDeputy(G, G.deputies[j], dt);
    // Wanted decays when the player stays clean and out of sight.
    if (want > 0) {
      decayTimer += dt;
      var calm = G.time - (G.lastCrimeAt || 0) > 18;
      if (calm && decayTimer > 6) {
        setWanted(G, want - 1);
        decayTimer = 0;
        if (G.wanted === 0) DH.hud.showBanner('HEAT OFF', 'You slipped away — for now');
      }
    }
  }

  return {
    setWanted: setWanted,
    addWanted: addWanted,
    spawnCopCar: spawnCopCar,
    updatePolice: updatePolice
  };
})();
