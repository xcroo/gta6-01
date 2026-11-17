// city.js — Porto Verde: street grid, buildings, beach, props and collision data.

const CITY = {
  half: 320,          // playable half-extent
  streetStep: 80,     // distance between street centrelines
  streetHalf: 8,      // half width of a street
  streets: [],        // centreline coordinates, both axes
  colliders: [],      // {minX,maxX,minZ,maxZ} building boxes
  palms: [],
  lights: [],
  collectibles: [],   // stash crate meshes
  beachX: 288,        // sand starts here
  waterX: 312,        // sea starts here
};

function makeCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildingTexture(base, lit) {
  return makeCanvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 20) {
        const on = rng() < lit;
        g.fillStyle = on ? '#ffd98a' : '#2c3a4a';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

function roadTexture() {
  return makeCanvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = '#33363b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5d76e';
    g.fillRect(w / 2 - 2, 0, 4, 40); g.fillRect(w / 2 - 2, 90, 4, 40); g.fillRect(w / 2 - 2, 180, 4, 40);
    g.fillStyle = '#e8e8e8';
    g.fillRect(4, 0, 2, h); g.fillRect(w - 6, 0, 2, h);
  });
}

function buildCity(scene) {
  V.city = CITY;
  const S = CITY;
  for (let i = -3; i <= 3; i++) S.streets.push(i * S.streetStep);

  // Sun, sky, fog.
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -340; sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340; sun.shadow.camera.bottom = -340;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75));
  scene.background = new THREE.Color(0x8ec8ee);
  scene.fog = new THREE.Fog(0x9fd0ef, 380, 900);

  // Ground: grass-green base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshLambertMaterial({ color: 0x6f9e57 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sand strip + sea on the east edge.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 760), new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(S.beachX + 30, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(140, 760), new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(S.beachX + 130, 0.01, 0);
  scene.add(sea);
  // Boardwalk along the beach.
  const walk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 640), new THREE.MeshLambertMaterial({ color: 0xb98d5f }));
  walk.position.set(S.beachX - 2, 0.2, 0);
  walk.receiveShadow = true;
  scene.add(walk);

  // Roads: one long strip per street, both axes.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const c of S.streets) {
    for (const axis of ['x', 'z']) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 660), roadMat.clone());
      road.material.map = roadTex.clone();
      road.material.map.repeat.set(1, 10);
      road.material.map.needsUpdate = true;
      road.rotation.x = -Math.PI / 2;
      if (axis === 'x') { road.rotation.z = Math.PI / 2; road.position.set(0, 0.03, c); }
      else road.position.set(c, 0.03, 0);
      road.receiveShadow = true;
      scene.add(road);
    }
  }

  // Blocks: sidewalks + buildings.
  const palette = ['#c9a37e', '#b7c4cc', '#d8b48a', '#9fb3c8', '#c8b09a', '#a8b8a0', '#d0a0a0', '#8fa8bf'];
  const windowTexes = [buildingTexture('#ffffff', 0.25), buildingTexture('#ffffff', 0.4), buildingTexture('#ffffff', 0.15)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // Block centres sit midway between streets (-240..240 step 80), so the
  // slabs never bury a road. Midpoints: -200,-120,-40,40,120,200.
  for (let bx = 0; bx < 6; bx++) {
    for (let bz = 0; bz < 6; bz++) {
      const cx = -200 + bx * S.streetStep, cz = -200 + bz * S.streetStep;
      // Sidewalk slab.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(64, 0.3, 64), new THREE.MeshLambertMaterial({ color: 0xbdb5a8 }));
      slab.position.set(cx, 0.15, cz);
      slab.receiveShadow = true;
      scene.add(slab);
      // Downtown towers near the centre, low blocks elsewhere.
      const downtown = Math.abs(cx) <= 80 && Math.abs(cz) <= 80;
      const count = downtown ? randInt(1, 2) : randInt(2, 4);
      for (let i = 0; i < count; i++) {
        const w = rand(14, downtown ? 26 : 20);
        const d = rand(14, downtown ? 26 : 20);
        const h = downtown ? rand(45, 110) : rand(9, 30);
        const ox = rand(-20, 20), oz = rand(-20, 20);
        const x = cx + ox, z = cz + oz;
        if (Math.abs(x) > S.half - 20 || Math.abs(z) > S.half - 20) continue;
        const mat = new THREE.MeshLambertMaterial({ color: pick(palette), map: pick(windowTexes) });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2 + 0.3, z);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        S.colliders.push({ minX: x - w / 2 - 0.5, maxX: x + w / 2 + 0.5, minZ: z - d / 2 - 0.5, maxZ: z + d / 2 + 0.5 });
        // Roof rim.
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.8, d + 1), new THREE.MeshLambertMaterial({ color: 0x5a5a5a }));
        rim.position.set(x, h + 0.6, z);
        scene.add(rim);
      }
    }
  }

  // Palms along the beach and scattered on sidewalks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    S.palms.push(g);
  }
  for (let z = -300; z <= 300; z += 40) { palm(S.beachX + 8, z + rand(-8, 8)); palm(S.beachX + 24, z + 20 + rand(-8, 8)); }
  for (let i = 0; i < 40; i++) palm(rand(-280, 280), rand(-280, 280));

  // Streetlights at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 });
  for (const sx of S.streets) {
    for (const sz of S.streets) {
      if (rng() < 0.5) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole.position.set(sx + 9.5, 3.5, sz + 9.5);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
      lamp.position.set(sx + 9.5, 7.1, sz + 9.5);
      scene.add(lamp);
    }
  }

  // Billboards with original Porto Verde names.
  const boards = [
    { x: -40, z: -40, text: 'PORTO VERDE', sub: 'SUN • SAND • SPEED' },
    { x: 120, z: 40, text: 'MARLA\'S GARAGE', sub: 'FIXES • FAST • NO QUESTIONS' },
    { x: -120, z: 160, text: 'SOLMAR COLA', sub: 'TASTE THE COAST' },
  ];
  for (const b of boards) {
    const tex = makeCanvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = '#123a5c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23e'; g.font = 'bold 64px Arial'; g.textAlign = 'center';
      g.fillText(b.text, w / 2, 110);
      g.fillStyle = '#ffffff'; g.font = '28px Arial';
      g.fillText(b.sub, w / 2, 170);
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.position.set(b.x, 16, b.z);
    mesh.rotation.y = rng() * Math.PI;
    scene.add(mesh);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 6), poleMat);
    post.position.set(b.x, 5, b.z);
    scene.add(post);
  }

  // Stunt ramp on the beach.
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0xe86a2a }));
  ramp.position.set(S.beachX + 10, 1.6, -80);
  ramp.rotation.x = -0.35;
  ramp.castShadow = true;
  scene.add(ramp);
  S.colliders.push({ minX: S.beachX + 4, maxX: S.beachX + 16, minZ: -89, maxZ: -71 });

  // Collectible stash crates (10) — glowing gold boxes.
  const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xffc93e, emissive: 0x8a6a00 });
  for (let i = 0; i < 10; i++) {
    const x = rand(-280, 280), z = rand(-280, 280);
    if (hitsCollider(x, z, 3)) { i--; continue; }
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(x, 1.4, z);
    crate.userData.collectible = true;
    scene.add(crate);
    S.collectibles.push(crate);
  }
}

function hitsCollider(x, z, pad) {
  for (const c of CITY.colliders) {
    if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return c;
  }
  return null;
}

function isOnRoad(x, z) {
  for (const s of CITY.streets) {
    if (Math.abs(x - s) < CITY.streetHalf + 2) return true;
    if (Math.abs(z - s) < CITY.streetHalf + 2) return true;
  }
  return false;
}

function nearestStreetCoord(v) {
  let best = CITY.streets[0], bd = 1e9;
  for (const s of CITY.streets) { const d = Math.abs(v - s); if (d < bd) { bd = d; best = s; } }
  return best;
}

// A random point on a road, for spawning traffic / police.
function randomRoadPoint() {
  const along = rand(-280, 280);
  const street = pick(CITY.streets);
  return Math.random() < 0.5 ? { x: along, z: street } : { x: street, z: along };
}
