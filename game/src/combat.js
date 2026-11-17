// Dusthaven — combat.js
// Fists, a pistol and the rival gang members who carry them. Shooting
// uses a ray from the player toward the camera aim; enemies return
// fire with deliberate inaccuracy so fights stay winnable.
var DH = window.DH || (window.DH = {});

DH.combat = (function () {
  'use strict';

  var U = DH.util;
  var raycaster = null;

  function ensureRay() {
    if (!raycaster) raycaster = new THREE.Raycaster();
    return raycaster;
  }

  function aimPoint(G) {
    // Aim from the camera through the screen centre, out into the world.
    var cam = G.camera;
    var dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    var origin = G.player.inCar ? G.player.pos.clone() : G.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    return { origin: origin, dir: dir };
  }

  function shoot(G) {
    var p = G.player;
    if (p.inCar) return;
    if (p.weapon !== 'pistol') return;
    if (p.ammo <= 0) {
      DH.audio.blip();
      DH.hud.showToast('No ammo — press R to reload');
      return;
    }
    p.ammo--;
    G.lastShotAt = G.time;
    DH.police.addWanted(G, 1);
    var aim = aimPoint(G);
    var from = aim.origin.clone();
    var dir = aim.dir.clone();
    // A little spread keeps every shot from being a laser.
    dir.x += (Math.random() - 0.5) * 0.03;
    dir.y += (Math.random() - 0.5) * 0.03;
    dir.z += (Math.random() - 0.5) * 0.03;
    dir.normalize();
    var muzzlePos = from.clone().add(dir.clone().multiplyScalar(1.2));
    DH.effects.muzzle(muzzlePos, dir);
    DH.audio.shot();
    // Tracer: a short-lived bright line from the barrel.
    var tracerGeo = new THREE.BufferGeometry().setFromPoints([muzzlePos, muzzlePos.clone().add(dir.clone().multiplyScalar(40))]);
    var tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    G.scene.add(tracer);
    setTimeout(function () { G.scene.remove(tracer); }, 60);
    // Hit test against enemies, then deputies, then cars.
    var hit = testTargets(G, from, dir, 60);
    if (hit) {
      if (hit.kind === 'enemy') damageEnemy(G, hit.enemy, 34, dir);
      else if (hit.kind === 'deputy') {
        DH.police.addWanted(G, 1);
        DH.hud.showToast('You shot a deputy!');
      } else if (hit.kind === 'car') {
        hit.car.health -= 20;
        DH.effects.sparks(hit.point);
        if (hit.car.isPolice) DH.police.addWanted(G, 1);
      }
    }
    p.recoil = 0.12;
  }

  function testTargets(G, from, dir, maxDist) {
    var ray = ensureRay();
    ray.set(from, dir);
    ray.far = maxDist;
    var best = null, bestD = maxDist;
    var enemies = G.enemies || [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead) continue;
      var hit = ray.intersectObject(e.mesh, true);
      if (hit.length > 0 && hit[0].distance < bestD) {
        bestD = hit[0].distance;
        best = { kind: 'enemy', enemy: e, point: hit[0].point };
      }
    }
    var deps = G.deputies || [];
    for (var j = 0; j < deps.length; j++) {
      var hitD = ray.intersectObject(deps[j].mesh, true);
      if (hitD.length > 0 && hitD[0].distance < bestD) {
        bestD = hitD[0].distance;
        best = { kind: 'deputy', point: hitD[0].point };
      }
    }
    var cars = G.allCars || [];
    for (var k = 0; k < cars.length; k++) {
      var c = cars[k];
      if (c.dead || c.isPlayer) continue;
      var hitC = ray.intersectObject(c.mesh, true);
      if (hitC.length > 0 && hitC[0].distance < bestD) {
        bestD = hitC[0].distance;
        best = { kind: 'car', car: c, point: hitC[0].point };
      }
    }
    return best;
  }

  function melee(G) {
    var p = G.player;
    if (p.inCar) return;
    G.lastShotAt = G.time;
    DH.audio.punch();
    p.swingTimer = 0.3;
    var range = 2.6;
    var enemies = G.enemies || [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead) continue;
      var d = U.dist2D(p.pos.x, p.pos.z, e.pos.x, e.pos.z);
      if (d < range) {
        var ang = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        if (Math.abs(U.angleDiff(p.heading, ang)) < 1.1) {
          damageEnemy(G, e, 25, null);
        }
      }
    }
    var deps = G.deputies || [];
    for (var j = 0; j < deps.length; j++) {
      var dep = deps[j];
      var dd = U.dist2D(p.pos.x, p.pos.z, dep.pos.x, dep.pos.z);
      if (dd < range) {
        DH.police.addWanted(G, 1);
        dep.pos.x += Math.sin(p.heading) * 3;
        dep.pos.z += Math.cos(p.heading) * 3;
      }
    }
    var peds = G.peds || [];
    for (var k = 0; k < peds.length; k++) {
      var ped = peds[k];
      var pd = U.dist2D(p.pos.x, p.pos.z, ped.pos.x, ped.pos.z);
      if (pd < range) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        DH.police.addWanted(G, 1);
      }
    }
  }

  function spawnEnemy(G, x, z) {
    var group = new THREE.Group();
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x5a1a1a }));
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc08a5a }));
    head.position.y = 1.78;
    group.add(head);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    band.position.y = 1.95;
    group.add(band);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.35, 1.2, 0.4);
    group.add(gun);
    group.position.set(x, 0, z);
    G.scene.add(group);
    var enemy = {
      mesh: group,
      pos: group.position,
      heading: 0,
      health: 100,
      dead: false,
      shootTimer: U.rand(0.5, 1.5),
      moveTimer: 0
    };
    G.enemies.push(enemy);
    return enemy;
  }

  function damageEnemy(G, enemy, amount, dir) {
    if (enemy.dead) return;
    enemy.health -= amount;
    DH.effects.blood(enemy.pos);
    if (dir) {
      enemy.pos.x += dir.x * 0.4;
      enemy.pos.z += dir.z * 0.4;
    }
    if (enemy.health <= 0) {
      enemy.dead = true;
      enemy.mesh.visible = false;
      DH.effects.burst(enemy.pos, 0x883333, 8, 4, 0.6, 5);
      G.money += 25;
      DH.hud.showToast('Rival down — +$25');
      DH.audio.pickup();
      if (G.mission) DH.missions.onEnemyDown(G, enemy);
    }
  }

  // Rival gang members: close in, strafe, and shoot with loose aim.
  function updateEnemies(G, dt) {
    var list = G.enemies || [];
    var p = G.player;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead) continue;
      var d = U.dist2D(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
      var heading = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
      e.heading = U.angleLerp(e.heading, heading, U.clamp(dt * 6, 0, 1));
      e.mesh.rotation.y = e.heading;
      e.moveTimer -= dt;
      if (d > 14) {
        e.pos.x += Math.sin(e.heading) * 5 * dt;
        e.pos.z += Math.cos(e.heading) * 5 * dt;
      } else if (d < 6) {
        e.pos.x -= Math.sin(e.heading) * 2.5 * dt;
        e.pos.z -= Math.cos(e.heading) * 2.5 * dt;
      } else if (e.moveTimer <= 0) {
        e.moveTimer = U.rand(0.8, 1.8);
        e.strafe = Math.random() < 0.5 ? -1 : 1;
      }
      if (e.strafe && d <= 14) {
        e.pos.x += Math.cos(e.heading) * e.strafe * 2.5 * dt;
        e.pos.z -= Math.sin(e.heading) * e.strafe * 2.5 * dt;
      }
      DH.city.resolveCollisions(G, e.pos, 0.5);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 42 && G.state === 'playing') {
        e.shootTimer = U.rand(1.1, 2.2);
        var from = e.pos.clone();
        from.y = 1.4;
        var dir = new THREE.Vector3(p.pos.x - from.x, 1.2 - from.y, p.pos.z - from.z).normalize();
        DH.effects.muzzle(from, dir);
        DH.audio.shot();
        // Loose aim: most shots miss, some sting.
        if (Math.random() < 0.28) {
          DH.player.damagePlayer(G, 6, from);
          DH.hud.showToast('You are hit!');
        } else {
          var near = p.pos.clone();
          near.x += U.rand(-2, 2);
          near.z += U.rand(-2, 2);
          DH.effects.sparks(near);
        }
      }
    }
  }

  function reload(G) {
    var p = G.player;
    if (p.ammo >= 12 || p.ammoReserve <= 0) return;
    var need = 12 - p.ammo;
    var take = Math.min(need, p.ammoReserve);
    p.ammo += take;
    p.ammoReserve -= take;
    DH.audio.blip();
    DH.hud.showToast('Reloaded — ' + p.ammo + '/12');
  }

  return {
    shoot: shoot,
    melee: melee,
    spawnEnemy: spawnEnemy,
    damageEnemy: damageEnemy,
    updateEnemies: updateEnemies,
    reload: reload
  };
})();
