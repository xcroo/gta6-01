// SOLMARA — pedestrians.js
// The people of Solmara: shoppers, joggers and beach-goers who stroll
// the sidewalks, cross at corners, and run when gunfire or a speeding
// car comes too close.

var Pedestrians = {
  list: [],
  SHIRTS: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xfd79a8],

  spawn: function (n) {
    for (var i = 0; i < n; i++) {
      var bx = pick(roadCentres()) + CITY.STEP / 2 + rr(-25, 25);
      var bz = pick(roadCentres()) + CITY.STEP / 2 + rr(-25, 25);
      this.list.push(this.makePed(bx, bz));
    }
  },

  makePed: function (x, z) {
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: pick(this.SHIRTS) });
    var skin = new THREE.MeshLambertMaterial({ color: pick([0xc98d64, 0x8d5a3b, 0xe8b48c, 0x6e4423]) });
    var pants = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.36), shirt);
    body.position.y = 1.1; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
    head.position.y = 1.75; head.castShadow = true; g.add(head);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.26), pants);
    legL.position.set(-0.16, 0.32, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    g.position.set(x, 0, z);
    G.scene.add(g);
    return {
      mesh: g, legL: legL, legR: legR, x: x, z: z,
      heading: rr(0, Math.PI * 2), speed: rr(1.2, 2.2),
      target: null, panic: 0, walkPhase: rr(0, 6), idle: 0,
    };
  },

  update: function (dt) {
    var px = G.inCar && G.car ? G.car.x : Player.x;
    var pz = G.inCar && G.car ? G.car.z : Player.z;
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      // panic: gunfire nearby, a car bearing down, or the player sprinting at them
      var dPlayer = dist2d(p.x, p.z, px, pz);
      var danger = (Combat && Combat.recentShotTimer > 0 && dPlayer < 30) ||
        (G.inCar && dPlayer < 10 && Math.abs(G.car.speed) > 8) ||
        (!G.inCar && dPlayer < 3 && Player.speed > 8);
      if (danger) p.panic = 2.5;
      if (p.panic > 0) {
        p.panic -= dt;
        // run away from the player
        var away = Math.atan2(p.x - px, p.z - pz);
        p.heading = angleLerp(p.heading, away, 1 - Math.exp(-6 * dt));
        p.speed = damp(p.speed, 5.5, 6, dt);
      } else {
        p.speed = damp(p.speed, 1.6, 2, dt);
        // idle a beat at the corner before picking a new stroll target
        if (p.idle > 0) { p.idle -= dt; }
        else if (!p.target || dist2d(p.x, p.z, p.target.x, p.target.z) < 2) {
          // pick a new stroll target on a sidewalk corner
          p.target = {
            x: pick(roadCentres()) + CITY.STEP / 2 + rr(-28, 28),
            z: pick(roadCentres()) + CITY.STEP / 2 + rr(-28, 28),
          };
          if (chance(0.25)) p.idle = rr(1, 3);
        }
        var want = Math.atan2(p.target.x - p.x, p.target.z - p.z);
        p.heading = angleLerp(p.heading, want, 1 - Math.exp(-3 * dt));
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      var fixed = collideBuildings(p.x, p.z, 0.5);
      p.x = fixed.x; p.z = fixed.z;
      p.walkPhase += dt * p.speed * 2.4;
      var swing = Math.sin(p.walkPhase) * 0.5;
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  },
};
