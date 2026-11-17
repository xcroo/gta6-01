// Dusthaven — vehicles.js
// Cars: boxy low-poly models built from primitives, arcade driving
// physics (accelerate, brake, steer, handbrake drift, collisions)
// and the traffic AI that keeps the streets alive.
var DH = window.DH || (window.DH = {});

DH.vehicles = (function () {
  'use strict';

  var U = DH.util;
  var CAR_COLORS = [0xc0392b, 0x2e6fb0, 0xe0a030, 0x3a3a3a, 0xd8d8d8, 0x5a8a3a, 0x8a4a9a, 0x20a0a0];
  var CAR_NAMES = ['Dune Runner', 'Mesa Coupe', 'Cactus Pickup', 'Sunset Sedan', 'Coyote Van', 'Dust GT', 'Ridge Racer', 'Canal Cruiser'];

  function makeCarMesh(color, isPolice) {
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x20344a, emissive: 0x0a1826 });

    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 2.4), glassMat);
    cabin.position.set(0, 1.3, -0.25);
    cabin.castShadow = true;
    group.add(cabin);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.5), darkMat);
    nose.position.set(0, 0.55, 2.4);
    group.add(nose);
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xffeebb });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), lightMat);
    hl.position.set(-0.7, 0.7, 2.62);
    group.add(hl);
    var hr = hl.clone();
    hr.position.x = 0.7;
    group.add(hr);
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), tailMat);
    tl.position.set(-0.7, 0.7, -2.32);
    group.add(tl);
    var tr = tl.clone();
    tr.position.x = 0.7;
    group.add(tr);

    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      bar.position.set(0, 1.75, -0.25);
      group.add(bar);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.42),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.3, 1.86, -0.25);
      group.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.42),
        new THREE.MeshBasicMaterial({ color: 0x2255ff }));
      blue.position.set(0.3, 1.86, -0.25);
      group.add(blue);
      group.userData.lightRed = red;
      group.userData.lightBlue = blue;
    }

    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    var wheels = [];
    [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, darkMat);
      w.position.set(p[0], 0.42, p[1]);
      w.castShadow = true;
      group.add(w);
      wheels.push(w);
    });
    group.userData.wheels = wheels;
    return group;
  }

  function createCar(G, x, z, heading, color, opts) {
    opts = opts || {};
    var mesh = makeCarMesh(color, !!opts.police);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    var car = {
      mesh: mesh,
      pos: mesh.position,
      heading: heading,
      speed: 0,
      maxSpeed: opts.maxSpeed || U.rand(24, 36),
      accel: opts.accel || 16,
      steer: 0,
      color: color,
      name: opts.name || U.pick(CAR_NAMES),
      isPolice: !!opts.police,
      isTraffic: !!opts.traffic,
      isPlayer: false,
      health: opts.health || 100,
      routeAxis: opts.routeAxis || 'x',
      routeDir: opts.routeDir || 1,
      routeLine: opts.routeLine || 0,
      stuck: 0,
      dead: false
    };
    return car;
  }

  // One physics step for a driven car. Returns true when it scraped
  // something hard enough to count as a crash.
  function driveCar(G, car, throttle, steerInput, handbrake, dt) {
    var crashed = false;
    var maxSpd = car.maxSpeed;
    if (handbrake) maxSpd *= 0.55;
    if (throttle > 0) car.speed += car.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= 26 * dt;
      else car.speed -= 9 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.4) car.speed = 0;
    }
    car.speed = U.clamp(car.speed, -12, maxSpd);
    var steerAmt = steerInput * U.clamp(Math.abs(car.speed) / 8, 0, 1);
    if (handbrake) steerAmt *= 1.7;
    car.heading += steerAmt * (car.speed >= 0 ? 1 : -1) * 1.9 * dt *
      (handbrake ? 1.4 : 1);
    var nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    var before = { x: car.pos.x, z: car.pos.z };
    car.pos.x = nx;
    car.pos.z = nz;
    if (DH.city.resolveCollisions(G, car.pos, 2.2)) {
      // Scraped a building: kill most of the speed, spark and thud.
      if (Math.abs(car.speed) > 6) {
        crashed = true;
        DH.effects.sparks(car.pos);
        DH.audio.crash();
        DH.effects.shake(0.35);
        car.health -= Math.abs(car.speed) * 0.55;
      }
      car.speed *= 0.35;
      var dx = car.pos.x - before.x, dz = car.pos.z - before.z;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        car.heading = Math.atan2(dx, dz);
      }
    }
    // Car-to-car bumps.
    var others = G.allCars || [];
    for (var i = 0; i < others.length; i++) {
      var o = others[i];
      if (o === car || o.dead) continue;
      var d = U.dist2D(car.pos.x, car.pos.z, o.pos.x, o.pos.z);
      if (d < 4.4 && d > 0.01) {
        var push = (4.4 - d) / 2;
        var px = (car.pos.x - o.pos.x) / d, pz = (car.pos.z - o.pos.z) / d;
        car.pos.x += px * push;
        car.pos.z += pz * push;
        if (!o.isPlayer) {
          o.pos.x -= px * push;
          o.pos.z -= pz * push;
        }
        var rel = Math.abs(car.speed - (o.speed || 0));
        if (rel > 7) {
          crashed = true;
          DH.effects.sparks(car.pos);
          DH.audio.crash();
          car.health -= rel * 0.4;
          if (o.health !== undefined) o.health -= rel * 0.4;
        }
        car.speed *= 0.82;
      }
    }
    car.mesh.rotation.y = car.heading;
    // Spin the wheels with the road speed.
    var spin = car.speed * dt / 0.42;
    var wheels = car.mesh.userData.wheels || [];
    for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += spin;
    // Handbrake drift leaves skid marks and dust.
    if (handbrake && Math.abs(car.speed) > 10) {
      var bx = car.pos.x - Math.sin(car.heading) * 1.5;
      var bz = car.pos.z - Math.cos(car.heading) * 1.5;
      DH.effects.skid(bx, bz, car.heading);
      if (Math.random() < 0.4) DH.effects.dust(car.pos);
    }
    return crashed;
  }

  function spawnParkedCars(G, count) {
    var list = [];
    var streets = DH.city.STREETS;
    for (var i = 0; i < count; i++) {
      var along = streets[Math.floor(Math.random() * streets.length)];
      var cross = streets[Math.floor(Math.random() * streets.length)];
      var side = Math.random() < 0.5 ? -1 : 1;
      var x, z, heading;
      if (Math.random() < 0.5) {
        x = along + side * 8.5;
        z = cross + U.rand(-20, 20);
        heading = 0;
      } else {
        x = cross + U.rand(-20, 20);
        z = along + side * 8.5;
        heading = Math.PI / 2;
      }
      var car = createCar(G, x, z, heading, U.pick(CAR_COLORS), {});
      list.push(car);
    }
    return list;
  }

  function spawnTraffic(G, count) {
    var list = [];
    var streets = DH.city.STREETS;
    for (var i = 0; i < count; i++) {
      var axis = Math.random() < 0.5 ? 'x' : 'z';
      var line = streets[Math.floor(Math.random() * streets.length)];
      var along = U.rand(-240, 240);
      var dir = Math.random() < 0.5 ? 1 : -1;
      var x = axis === 'x' ? along : line;
      var z = axis === 'x' ? line : along;
      var heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      var car = createCar(G, x, z, heading, U.pick(CAR_COLORS), {
        traffic: true,
        routeAxis: axis,
        routeDir: dir,
        routeLine: line,
        maxSpeed: U.rand(9, 15)
      });
      car.speed = car.maxSpeed * 0.8;
      list.push(car);
    }
    return list;
  }

  // Traffic follows its street; at an intersection it sometimes turns,
  // and it brakes when another car is right ahead of it.
  function updateTraffic(G, dt) {
    var list = G.traffic || [];
    var streets = DH.city.STREETS;
    for (var i = 0; i < list.length; i++) {
      var car = list[i];
      if (car.dead) continue;
      var blocked = false;
      var others = G.allCars || [];
      for (var j = 0; j < others.length; j++) {
        var o = others[j];
        if (o === car || o.dead) continue;
        var d = U.dist2D(car.pos.x, car.pos.z, o.pos.x, o.pos.z);
        if (d < 9) {
          var ahead = Math.sin(car.heading) * (o.pos.x - car.pos.x) +
            Math.cos(car.heading) * (o.pos.z - car.pos.z);
          if (ahead > 0 && ahead < 10 && Math.abs(U.angleDiff(car.heading, Math.atan2(o.pos.x - car.pos.x, o.pos.z - car.pos.z))) < 0.6) {
            blocked = true;
            break;
          }
        }
      }
      var target = blocked ? 0 : car.maxSpeed;
      car.speed = U.lerp(car.speed, target, U.clamp(dt * 2, 0, 1));
      var nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      var nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      car.pos.x = nx;
      car.pos.z = nz;
      // At an intersection, sometimes turn onto the crossing street.
      var nearX = DH.city.nearestStreetCoord(car.pos.x);
      var nearZ = DH.city.nearestStreetCoord(car.pos.z);
      var onCross = Math.abs(car.pos.x - nearX) < 2 && Math.abs(car.pos.z - nearZ) < 2;
      if (onCross && Math.random() < dt * 0.5) {
        var turn = U.pick([-1, 0, 0, 1]);
        if (turn !== 0) {
          car.heading += turn * Math.PI / 2;
          car.routeAxis = car.routeAxis === 'x' ? 'z' : 'x';
        }
      }
      // Keep traffic inside the city; wrap around the far edge.
      if (Math.abs(car.pos.x) > 275 || Math.abs(car.pos.z) > 275) {
        car.pos.x = U.clamp(car.pos.x, -240, 240);
        car.pos.z = U.clamp(car.pos.z, -240, 240);
        car.heading += Math.PI;
      }
      car.mesh.rotation.y = car.heading;
      var wheels = car.mesh.userData.wheels || [];
      var spin = car.speed * dt / 0.42;
      for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += spin;
      if (car.health <= 0 && !car.dead) {
        car.dead = true;
        DH.effects.explosion(car.pos);
        DH.effects.burst(car.pos, 0x333333, 10, 5, 1, -1);
        car.mesh.visible = false;
      }
    }
  }

  return {
    makeCarMesh: makeCarMesh,
    createCar: createCar,
    driveCar: driveCar,
    spawnParkedCars: spawnParkedCars,
    spawnTraffic: spawnTraffic,
    updateTraffic: updateTraffic,
    CAR_COLORS: CAR_COLORS,
    CAR_NAMES: CAR_NAMES
  };
})();
