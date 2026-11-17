// Dusthaven — city.js
// Builds the whole desert-edge metropolis: a street grid, downtown
// towers, a canal waterfront, highways, palms and cacti, billboards,
// a stunt ramp and the golden-hour sun. Also owns the collision boxes
// the cars and the player slide against.
var DH = window.DH || (window.DH = {});

DH.city = (function () {
  'use strict';

  var U = DH.util;
  var STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
  var ROAD_W = 14;
  var CITY_R = 285;
  var CANAL_X = 215;

  // Canvas texture: a lit-window facade, tinted per building by material.
  function facadeTexture() {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#8a7a68';
    g.fillRect(0, 0, 128, 256);
    for (var y = 10; y < 246; y += 18) {
      for (var x = 8; x < 120; x += 16) {
        var lit = Math.random() < 0.45;
        g.fillStyle = lit ? '#ffd98a' : '#2c2620';
        g.fillRect(x, y, 9, 11);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function billboardTexture(text, sub) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#1c1410';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#ffb347';
    g.lineWidth = 10;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = '#ffb347';
    g.font = 'bold 64px sans-serif';
    g.textAlign = 'center';
    g.fillText(text, 256, 110);
    g.fillStyle = '#f5e6c8';
    g.font = 'bold 34px sans-serif';
    g.fillText(sub, 256, 180);
    return new THREE.CanvasTexture(c);
  }

  function buildCity(G) {
    var scene = G.scene;
    var rng = U.seededRandom(1337);
    var colliders = [];
    var coinSpots = [];
    var group = new THREE.Group();
    scene.add(group);
    G.cityGroup = group;

    // Golden-hour sky, haze and sun.
    scene.background = new THREE.Color(0xff9e57);
    scene.fog = new THREE.Fog(0xe8905a, 260, 900);
    var hemi = new THREE.HemisphereLight(0xffd9a0, 0x7a4a2a, 0.75);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffb36b, 1.9);
    sun.position.set(-180, 130, -120);
    sun.castShadow = true;
    var shadowSize = G.shot ? 512 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.camera.left = -320;
    sun.shadow.camera.right = 320;
    sun.shadow.camera.top = 320;
    sun.shadow.camera.bottom = -320;
    sun.shadow.camera.far = 900;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(sun.target);
    G.sun = sun;

    // Desert floor.
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshLambertMaterial({ color: 0xc98f5a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // Roads: dark strips along every grid line, plus sidewalks.
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
    var walkMat = new THREE.MeshLambertMaterial({ color: 0xb59a72 });
    var lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
    STREETS.forEach(function (s) {
      var h = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2 + 60, ROAD_W), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, s);
      h.receiveShadow = true;
      group.add(h);
      var v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_R * 2 + 60), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(s, 0.02, 0);
      v.receiveShadow = true;
      group.add(v);
      var dashH = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2, 0.5), lineMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(0, 0.04, s);
      group.add(dashH);
      var dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, CITY_R * 2), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(s, 0.04, 0);
      group.add(dashV);
      var walkH = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2 + 60, ROAD_W + 8), walkMat);
      walkH.rotation.x = -Math.PI / 2;
      walkH.position.set(0, 0.01, s);
      group.add(walkH);
      var walkV = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 8, CITY_R * 2 + 60), walkMat);
      walkV.rotation.x = -Math.PI / 2;
      walkV.position.set(s, 0.01, 0);
      group.add(walkV);
    });

    // Canal waterfront on the east edge, with a bridge on each road.
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(90, CITY_R * 2 + 120),
      new THREE.MeshLambertMaterial({ color: 0x2f7f8f, transparent: true, opacity: 0.9 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(CANAL_X + 45, 0.05, 0);
    group.add(water);
    var quay = new THREE.Mesh(
      new THREE.PlaneGeometry(10, CITY_R * 2 + 120),
      new THREE.MeshLambertMaterial({ color: 0x9a8468 })
    );
    quay.rotation.x = -Math.PI / 2;
    quay.position.set(CANAL_X - 4, 0.03, 0);
    group.add(quay);
    STREETS.forEach(function (s) {
      var b = new THREE.Mesh(new THREE.PlaneGeometry(100, ROAD_W + 6),
        new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
      b.rotation.x = -Math.PI / 2;
      b.position.set(CANAL_X + 45, 0.08, s);
      group.add(b);
    });

    // Buildings: one or two per block, towers downtown, low sprawl outside.
    var facade = facadeTexture();
    var palette = [0x9a6b4a, 0x7a5a52, 0xb08a5e, 0x6b5a6e, 0x8a7a5e, 0xa06a4a];
    for (var ix = 0; ix < STREETS.length - 1; ix++) {
      for (var iz = 0; iz < STREETS.length - 1; iz++) {
        var cx = (STREETS[ix] + STREETS[ix + 1]) / 2;
        var cz = (STREETS[iz] + STREETS[iz + 1]) / 2;
        if (cx > CANAL_X - 40) continue; // canal blocks stay open
        var distC = Math.sqrt(cx * cx + cz * cz);
        var downtown = distC < 110;
        var n = downtown ? 2 : 1;
        for (var k = 0; k < n; k++) {
          if (rng() < 0.18) continue; // empty lot / parking
          var w = U.rand(16, 26), d = U.rand(16, 26);
          var h = downtown ? U.rand(28, 78) : U.rand(8, 26);
          var ox = cx + (k === 0 ? -11 : 11) + U.rand(-3, 3);
          var oz = cz + (k === 0 ? -8 : 10) + U.rand(-3, 3);
          var mat = new THREE.MeshLambertMaterial({
            color: palette[Math.floor(rng() * palette.length)],
            map: facade,
            emissive: 0x332211
          });
          var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(ox, h / 2, oz);
          b.castShadow = true;
          b.receiveShadow = true;
          group.add(b);
          colliders.push({
            minX: ox - w / 2 - 0.5, maxX: ox + w / 2 + 0.5,
            minZ: oz - d / 2 - 0.5, maxZ: oz + d / 2 + 0.5
          });
          // Rooftop beacon for the tallest downtown towers.
          if (h > 60) {
            var tip = new THREE.Mesh(
              new THREE.SphereGeometry(0.9, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xff4444 })
            );
            tip.position.set(ox, h + 1, oz);
            group.add(tip);
          }
        }
      }
    }

    // Mountain backdrop: big hazy cones ringing the city.
    var mMat = new THREE.MeshLambertMaterial({ color: 0x7a4a52 });
    for (var m = 0; m < 14; m++) {
      var a = (m / 14) * Math.PI * 2 + rng() * 0.3;
      var r = 680 + rng() * 160;
      var cone = new THREE.Mesh(new THREE.ConeGeometry(120 + rng() * 90, 180 + rng() * 160, 7), mMat);
      cone.position.set(Math.cos(a) * r, 60, Math.sin(a) * r);
      group.add(cone);
    }

    // Streetlights, palms and cacti along the roads.
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
    var palmMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
    var cactusMat = new THREE.MeshLambertMaterial({ color: 0x3a7a44 });
    STREETS.forEach(function (s) {
      for (var t = -240; t <= 240; t += 60) {
        if (rng() < 0.35) continue;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
        pole.position.set(s + 9, 3.5, t);
        pole.castShadow = true;
        group.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lampMat);
        lamp.position.set(s + 9, 7.1, t);
        group.add(lamp);
        if (rng() < 0.5) {
          var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 6), palmMat);
          trunk.position.set(s - 10, 3, t + 12);
          trunk.castShadow = true;
          group.add(trunk);
          var crown = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), leafMat);
          crown.position.set(s - 10, 6.6, t + 12);
          crown.scale.y = 0.55;
          group.add(crown);
        } else {
          var cac = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3.4, 8), cactusMat);
          cac.position.set(s - 10, 1.7, t + 12);
          cac.castShadow = true;
          group.add(cac);
        }
      }
    });

    // Billboards with the city's own names.
    var boards = [
      { text: 'DUSTHAVEN', sub: 'GOLDEN HOUR CITY', x: -60, z: -186, ry: 0 },
      { text: 'K-DUST 101.3', sub: 'DESERT BLUES ALL DAY', x: 60, z: 186, ry: Math.PI },
      { text: 'MESA MOTORS', sub: 'CARS • FAST • NO QUESTIONS', x: -186, z: 60, ry: Math.PI / 2 }
    ];
    boards.forEach(function (b) {
      var tex = billboardTexture(b.text, b.sub);
      var board = new THREE.Mesh(
        new THREE.BoxGeometry(26, 12, 1),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      board.position.set(b.x, 16, b.z);
      board.rotation.y = b.ry;
      group.add(board);
      var leg1 = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 1), poleMat);
      leg1.position.set(b.x - 9, 5, b.z);
      group.add(leg1);
      var leg2 = leg1.clone();
      leg2.position.x = b.x + 9;
      group.add(leg2);
    });

    // Stunt ramp on the south highway.
    var ramp = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 16),
      new THREE.MeshLambertMaterial({ color: 0xd8a03a })
    );
    ramp.position.set(0, 1.2, 252);
    ramp.rotation.x = -0.42;
    ramp.castShadow = true;
    group.add(ramp);
    G.rampPos = { x: 0, z: 252 };

    // Sun-coin collectible spots, scattered across the map.
    for (var ci = 0; ci < 10; ci++) {
      var sx = STREETS[Math.floor(rng() * STREETS.length)] + U.rand(-6, 6);
      var sz = STREETS[Math.floor(rng() * STREETS.length)] + U.rand(-6, 6);
      coinSpots.push({ x: sx, z: sz });
    }

    G.colliders = colliders;
    G.coinSpots = coinSpots;
    G.cityBuilt = true;
    return { colliders: colliders, coinSpots: coinSpots };
  }

  // Slide a circle (x,z,r) out of every building box it overlaps.
  function resolveCollisions(G, pos, radius) {
    var hit = false;
    var list = G.colliders || [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var nx = U.clamp(pos.x, b.minX, b.maxX);
      var nz = U.clamp(pos.z, b.minZ, b.maxZ);
      var dx = pos.x - nx, dz = pos.z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          pos.x = b.maxX + radius;
        }
      }
    }
    // Canal water edge and city bounds.
    if (pos.x > CANAL_X - 2) pos.x = CANAL_X - 2;
    pos.x = U.clamp(pos.x, -CITY_R, CITY_R + 20);
    pos.z = U.clamp(pos.z, -CITY_R, CITY_R + 20);
    return hit;
  }

  function isOnRoad(x, z) {
    for (var i = 0; i < STREETS.length; i++) {
      if (Math.abs(x - STREETS[i]) < ROAD_W / 2 + 1) return true;
      if (Math.abs(z - STREETS[i]) < ROAD_W / 2 + 1) return true;
    }
    return false;
  }

  function nearestStreetCoord(v) {
    var best = STREETS[0], bd = 1e9;
    for (var i = 0; i < STREETS.length; i++) {
      var d = Math.abs(v - STREETS[i]);
      if (d < bd) { bd = d; best = STREETS[i]; }
    }
    return best;
  }

  return {
    buildCity: buildCity,
    resolveCollisions: resolveCollisions,
    isOnRoad: isOnRoad,
    nearestStreetCoord: nearestStreetCoord,
    STREETS: STREETS,
    ROAD_W: ROAD_W,
    CITY_R: CITY_R,
    CANAL_X: CANAL_X
  };
})();
