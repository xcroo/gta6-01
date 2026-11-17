// Dusthaven — pedestrians.js
// The people of Dusthaven: walkers on the sidewalks who stroll, chat
// and cross the street — and who run for cover when guns come out or
// a car mounts the kerb.
var DH = window.DH || (window.DH = {});

DH.pedestrians = (function () {
  'use strict';

  var U = DH.util;
  var SHIRTS = [0x4a7ab0, 0xb04a6a, 0x5a9a4a, 0xd8c25a, 0x7a5ab0, 0xc0c0c0, 0x3a8a8a];
  var SKINS = [0xd9a077, 0xb07a4a, 0x8a5a3a, 0xe8b890];

  function makePedMesh(shirt, skin) {
    var group = new THREE.Group();
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32),
      new THREE.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.62;
    group.add(head);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x2e3448 });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.22), legMat);
    legL.position.set(-0.14, 0.34, 0);
    group.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.14;
    group.add(legR);
    group.userData.legL = legL;
    group.userData.legR = legR;
    return group;
  }

  function spawnPedestrians(G, count) {
    var list = [];
    var streets = DH.city.STREETS;
    for (var i = 0; i < count; i++) {
      var s = streets[Math.floor(Math.random() * streets.length)];
      var t = U.rand(-240, 240);
      var alongRoad = Math.random() < 0.5;
      var x = alongRoad ? s + U.pick([-9.5, 9.5]) : t;
      var z = alongRoad ? t : s + U.pick([-9.5, 9.5]);
      var mesh = makePedMesh(U.pick(SHIRTS), U.pick(SKINS));
      mesh.position.set(x, 0, z);
      G.scene.add(mesh);
      list.push({
        mesh: mesh,
        pos: mesh.position,
        heading: Math.random() * Math.PI * 2,
        speed: U.rand(1.2, 2.4),
        state: 'walk',
        fleeTimer: 0,
        walkPhase: Math.random() * 6,
        panic: 0
      });
    }
    return list;
  }

  function nearestDanger(G, ped) {
    var p = G.player;
    var d = U.dist2D(ped.pos.x, ped.pos.z, p.pos.x, p.pos.z);
    var gunOut = p.weapon === 'pistol' && !p.inCar;
    var chaos = G.wanted > 0 || gunOut || G.lastShotAt > G.time - 2;
    if (d < 14 && chaos) return { x: p.pos.x, z: p.pos.z, d: d };
    var cars = G.allCars || [];
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.dead) continue;
      var cd = U.dist2D(ped.pos.x, ped.pos.z, c.pos.x, c.pos.z);
      if (cd < 6 && Math.abs(c.speed || 0) > 8) return { x: c.pos.x, z: c.pos.z, d: cd };
    }
    return null;
  }

  function updatePeds(G, dt) {
    var list = G.peds || [];
    for (var i = 0; i < list.length; i++) {
      var ped = list[i];
      var danger = nearestDanger(G, ped);
      if (danger) {
        ped.state = 'flee';
        ped.fleeTimer = 1.2;
        ped.panic = 1;
      } else if (ped.fleeTimer > 0) {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      }
      var speed = ped.state === 'flee' ? 7 : ped.speed;
      if (ped.state === 'flee' && danger) {
        var away = Math.atan2(ped.pos.x - danger.x, ped.pos.z - danger.z);
        ped.heading = U.angleLerp(ped.heading, away, U.clamp(dt * 6, 0, 1));
      } else {
        // Amble along the sidewalk; turn at intersections sometimes.
        var nearX = DH.city.nearestStreetCoord(ped.pos.x);
        var nearZ = DH.city.nearestStreetCoord(ped.pos.z);
        if (Math.abs(ped.pos.x - nearX) < 10.5 && Math.abs(ped.pos.z - nearZ) < 10.5 &&
            Math.random() < dt * 0.25) {
          ped.heading = U.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
        }
      }
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
      DH.city.resolveCollisions(G, ped.pos, 0.5);
      ped.pos.x = U.clamp(ped.pos.x, -270, 270);
      ped.pos.z = U.clamp(ped.pos.z, -270, 270);
      ped.walkPhase += dt * speed * 2.2;
      var swing = Math.sin(ped.walkPhase) * (ped.state === 'flee' ? 0.9 : 0.45);
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.rotation.y = ped.heading;
      // A car that hits a pedestrian at speed is a crime — and a tragedy.
      var cars = G.allCars || [];
      for (var j = 0; j < cars.length; j++) {
        var c = cars[j];
        if (c.dead) continue;
        var d = U.dist2D(ped.pos.x, ped.pos.z, c.pos.x, c.pos.z);
        if (d < 2.2 && Math.abs(c.speed || 0) > 4) {
          DH.effects.blood(ped.pos);
          DH.effects.burst(ped.pos, 0xcc3333, 6, 3, 0.5, 6);
          if (c.isPlayer) {
            DH.police.addWanted(G, 2);
            DH.hud.showBanner('PEDESTRIAN HIT', 'Witnesses called it in — wanted up');
            DH.audio.crash();
          }
          // The pedestrian is knocked clear and scrambles away.
          ped.pos.x += (ped.pos.x - c.pos.x) * 0.8;
          ped.pos.z += (ped.pos.z - c.pos.z) * 0.8;
          ped.state = 'flee';
          ped.fleeTimer = 3;
          c.speed *= 0.7;
        }
      }
    }
  }

  return {
    spawnPedestrians: spawnPedestrians,
    updatePeds: updatePeds
  };
})();
