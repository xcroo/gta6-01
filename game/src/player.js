// SOLMARA — player.js
// Rook Calloway on foot: third-person movement, running, jumping,
// entering and leaving cars, and the little character mesh that
// represents him. Camera lives in main.js; this owns the body.

var Player = {
  mesh: null, body: null, legL: null, legR: null, armR: null,
  x: 0, z: 12, y: 0, heading: 0, vy: 0, grounded: true,
  speed: 0, walkSpeed: 6, runSpeed: 10.5,
  stepTimer: 0, shootCooldown: 0, punchCooldown: 0,
  visible: true,

  build: function (scene) {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    var jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
    var pants = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
    var hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });
    // torso
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.4), jacket);
    this.body.position.y = 1.15; this.body.castShadow = true; g.add(this.body);
    // head + hair
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.86; head.castShadow = true; g.add(head);
    var hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), hair);
    hairM.position.y = 2.08; g.add(hairM);
    // legs
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pants);
    this.legL.position.set(-0.19, 0.35, 0); this.legL.castShadow = true; g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pants);
    this.legR.position.set(0.19, 0.35, 0); this.legR.castShadow = true; g.add(this.legR);
    // arms
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.24), jacket);
    armL.position.set(-0.48, 1.2, 0); armL.castShadow = true; g.add(armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.24), jacket);
    this.armR.position.set(0.48, 1.2, 0); this.armR.castShadow = true; g.add(this.armR);
    // pistol in the right hand
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1c }));
    gun.position.set(0.48, 0.85, 0.2); g.add(gun);
    this.gun = gun;
    g.position.set(this.x, 0, this.z);
    scene.add(g);
    this.mesh = g;
    return g;
  },

  reset: function (x, z, heading) {
    this.x = x; this.z = z; this.y = 0; this.vy = 0;
    this.heading = heading || 0; this.speed = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.heading;
  },

  update: function (dt, input, camYaw) {
    if (G.inCar || G.mode !== 'playing') return;
    var fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
    var rightX = -fwdZ, rightZ = fwdX;
    var mx = 0, mz = 0;
    if (input.forward) { mx += fwdX; mz += fwdZ; }
    if (input.back) { mx -= fwdX; mz -= fwdZ; }
    if (input.left) { mx -= rightX; mz -= rightZ; }
    if (input.right) { mx += rightX; mz += rightZ; }
    var moving = (mx !== 0 || mz !== 0);
    var targetSpeed = 0;
    if (moving) {
      var len = Math.sqrt(mx * mx + mz * mz);
      mx /= len; mz /= len;
      targetSpeed = input.run ? this.runSpeed : this.walkSpeed;
      var wantHeading = Math.atan2(mx, mz);
      this.heading = angleLerp(this.heading, wantHeading, 1 - Math.exp(-12 * dt));
    }
    this.speed = damp(this.speed, targetSpeed, 10, dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    // gravity + jump (terminal velocity keeps long falls sane)
    if (input.jump && this.grounded) { this.vy = 7.5; this.grounded = false; }
    this.vy = Math.max(this.vy - 22 * dt, -30);
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; }
    // building collision
    var fixed = collideBuildings(this.x, this.z, 0.6);
    this.x = fixed.x; this.z = fixed.z;
    // footsteps
    if (moving && this.grounded) {
      this.stepTimer -= dt * this.speed;
      if (this.stepTimer <= 0) { this.stepTimer = 2.4; AudioSys.footstep(); }
    }
    // walk-cycle swing
    var swing = moving ? Math.sin(G.time * this.speed * 1.6) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armR.rotation.x = input.aiming ? -1.2 : -swing * 0.7;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
  },

  // Position a handgun shot leaves from, for the tracer.
  gunTip: function () {
    var p = new THREE.Vector3();
    this.gun.getWorldPosition(p);
    return p;
  },
};
