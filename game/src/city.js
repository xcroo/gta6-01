// SOLMARA — city.js
// Procedural sun-soaked coastal city: a road grid, towers, palms, a beach
// and a marina. Everything is generated from a fixed seed, so the city
// is identical on every load. Also owns collision and road queries.

var CITY = {
  STEP: 86,          // road-centre to road-centre
  ROAD_W: 16,
  GRID: 3,           // intersections at i*STEP, i in -3..3
  BLOCK: 70,         // block width between road edges
  buildings: [],     // {x,z,hx,hz,h} collision boxes
  nodes: [],         // intersection points for traffic routing
  palms: [],
  towerPos: { x: 43, z: 43 },
};

function roadCentres() {
  var cs = [];
  for (var i = -CITY.GRID; i <= CITY.GRID; i++) cs.push(i * CITY.STEP);
  return cs;
}

function nearestRoadCoord(v) {
  var best = roadCentres()[0], bd = 1e9;
  roadCentres().forEach(function (c) {
    var d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}
function isOnRoad(x, z) {
  var dx = Math.abs(x - nearestRoadCoord(x));
  var dz = Math.abs(z - nearestRoadCoord(z));
  return dx < CITY.ROAD_W / 2 + 1 || dz < CITY.ROAD_W / 2 + 1;
}
function cityBounds() { return (CITY.GRID + 0.5) * CITY.STEP + 40; }

// Push a circle (player / car) out of every building AABB it overlaps.
function collideBuildings(x, z, r) {
  for (var i = 0; i < CITY.buildings.length; i++) {
    var b = CITY.buildings[i];
    var cx = clamp(x, b.x - b.hx, b.x + b.hx);
    var cz = clamp(z, b.z - b.hz, b.z + b.hz);
    var dx = x - cx, dz = z - cz;
    var d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        var d = Math.sqrt(d2);
        x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the smallest penetration
        var px = (b.hx + r) - Math.abs(x - b.x);
        var pz = (b.hz + r) - Math.abs(z - b.z);
        if (px < pz) x = b.x + (x < b.x ? -(b.hx + r) : (b.hx + r));
        else z = b.z + (z < b.z ? -(b.hz + r) : (b.hz + r));
      }
    }
  }
  var lim = cityBounds();
  x = clamp(x, -lim, lim); z = clamp(z, -lim, lim);
  return { x: x, z: z };
}

function makeFacadeTexture(base, win, lit) {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  var g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (var x = 0; x < 128; x += 16) g.fillRect(x, 0, 2, 256);
  for (var row = 0; row < 12; row++) {
    for (var col = 0; col < 6; col++) {
      var wx = 8 + col * 20, wy = 12 + row * 20;
      g.fillStyle = (rng() < 0.35 ? lit : win);
      g.fillRect(wx, wy, 12, 13);
    }
  }
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCity(scene) {
  var group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  var extent = cityBounds();

  // --- ground, beach, sea -------------------------------------------------
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(extent * 2 + 160, extent * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x8d8478 })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(-40, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  var sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, extent * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0xd9b380 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-extent - 35, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  var sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, extent * 2 + 400),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-extent - 270, 0.05, 0);
  group.add(sea);

  // --- roads ---------------------------------------------------------------
  var roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  var markMat = new THREE.MeshLambertMaterial({ color: 0xd8c86a });
  roadCentres().forEach(function (c) {
    var h = new THREE.Mesh(new THREE.PlaneGeometry(extent * 2, CITY.ROAD_W), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.04, c);
    h.receiveShadow = true; group.add(h);
    var v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.ROAD_W, extent * 2), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.04, 0);
    v.receiveShadow = true; group.add(v);
    // centre dashes
    for (var t = -extent; t < extent; t += 12) {
      var d1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), markMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(t, 0.06, c); group.add(d1);
      var d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), markMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(c, 0.06, t); group.add(d2);
    }
  });

  // --- facades --------------------------------------------------------------
  var facades = [
    makeFacadeTexture('#e8d5b5', '#3d4a5a', '#ffd98a'),
    makeFacadeTexture('#d9a986', '#33404f', '#ffe1a0'),
    makeFacadeTexture('#a8c4c4', '#2f3d4a', '#ffdf8e'),
    makeFacadeTexture('#c98f7a', '#3a4552', '#ffe9b0'),
    makeFacadeTexture('#e3cfae', '#37424e', '#ffd98a'),
  ];
  var roofMat = new THREE.MeshLambertMaterial({ color: 0x6b5d4f });
  var trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  var palmMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a });
  var lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  var lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });

  // --- blocks ---------------------------------------------------------------
  var palette = [0xe8d5b5, 0xd9a986, 0xa8c4c4, 0xc98f7a, 0xe3cfae, 0xb8a58e];
  for (var bi = -CITY.GRID - 1; bi <= CITY.GRID; bi++) {
    for (var bj = -CITY.GRID - 1; bj <= CITY.GRID; bj++) {
      var bx = bi * CITY.STEP + CITY.STEP / 2;
      var bz = bj * CITY.STEP + CITY.STEP / 2;
      // central park instead of buildings
      if (bi === 0 && bj === 0) {
        var park = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.BLOCK, CITY.BLOCK),
          new THREE.MeshLambertMaterial({ color: 0x5d8a4a })
        );
        park.rotation.x = -Math.PI / 2; park.position.set(bx, 0.07, bz);
        park.receiveShadow = true; group.add(park);
        for (var p = 0; p < 14; p++) {
          addPalm(group, bx + rr(-30, 30), bz + rr(-30, 30), trunkMat, palmMat);
        }
        continue;
      }
      // block slab (sidewalk)
      var slab = new THREE.Mesh(
        new THREE.PlaneGeometry(CITY.BLOCK, CITY.BLOCK),
        new THREE.MeshLambertMaterial({ color: 0xb0a894 })
      );
      slab.rotation.x = -Math.PI / 2; slab.position.set(bx, 0.05, bz);
      slab.receiveShadow = true; group.add(slab);
      // 1-3 buildings per block
      var n = ri(1, 3);
      for (var k = 0; k < n; k++) {
        var w = rr(16, 26), d = rr(16, 26);
        var ox = rr(-14, 14), oz = rr(-14, 14);
        var h = rr(9, 34);
        var isTower = (bi === 1 && bj === 0 && k === 0);
        if (isTower) { h = 92; w = 30; d = 30; ox = 0; oz = 0; }
        var px = bx + ox, pz = bz + oz;
        var tex = pick(facades);
        var mat = new THREE.MeshLambertMaterial({ map: tex });
        var bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        bld.position.set(px, h / 2 + 0.05, pz);
        bld.castShadow = true; bld.receiveShadow = true;
        group.add(bld);
        // roof box
        var roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 1.6, d * 0.4), roofMat);
        roof.position.set(px, h + 0.8, pz);
        roof.castShadow = true; group.add(roof);
        if (isTower) {
          var beacon = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff4444 })
          );
          beacon.position.set(px, h + 2.4, pz);
          group.add(beacon);
          var sign = makeTextSprite('SOLMARA TOWER', '#ffd98a');
          sign.position.set(px, h + 9, pz);
          group.add(sign);
        }
        CITY.buildings.push({ x: px, z: pz, hx: w / 2 + 0.4, hz: d / 2 + 0.4, h: h });
      }
      // palms on the block corners
      if (chance(0.7)) addPalm(group, bx - 30, bz - 30, trunkMat, palmMat);
      if (chance(0.7)) addPalm(group, bx + 30, bz + 30, trunkMat, palmMat);
    }
  }

  // --- street lamps + palms along the beach --------------------------------
  roadCentres().forEach(function (c) {
    roadCentres().forEach(function (c2) {
      CITY.nodes.push({ x: c, z: c2 });
      var lamp = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampMat);
      pole.position.y = 3.5; pole.castShadow = true; lamp.add(pole);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.15), lampMat);
      arm.position.set(1.1, 6.9, 0); lamp.add(arm);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampGlowMat);
      bulb.position.set(2.2, 6.8, 0); lamp.add(bulb);
      lamp.position.set(c + CITY.ROAD_W / 2 + 1.2, 0, c2 + CITY.ROAD_W / 2 + 1.2);
      group.add(lamp);
    });
  });
  for (var s = -extent; s < extent; s += 24) {
    addPalm(group, -extent - 12, s, trunkMat, palmMat);
  }

  // --- marina sign on the beach --------------------------------------------
  var marina = makeTextSprite('MARINA', '#ffffff');
  marina.position.set(-extent - 20, 14, 0);
  group.add(marina);

  return group;
}

function addPalm(group, x, z, trunkMat, palmMat) {
  var g = new THREE.Group();
  var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 6, 6), trunkMat);
  trunk.position.y = 3; trunk.castShadow = true; g.add(trunk);
  var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), palmMat);
  crown.position.y = 6.6; crown.scale.y = 0.7; crown.castShadow = true; g.add(crown);
  g.position.set(x, 0, z);
  group.add(g);
  CITY.palms.push({ x: x, z: z });
}

// Floating label sprite made from a canvas (no image files).
function makeTextSprite(text, color) {
  var c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  var g = c.getContext('2d');
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color;
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 10;
  g.fillText(text, 256, 48);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(26, 4.9, 1);
  return sp;
}
