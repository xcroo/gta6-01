// Dusthaven — effects.js
// Juice: particle bursts, tyre skid marks, muzzle flashes, explosions
// and camera shake. Everything here is pooled and recycled so the
// frame rate stays steady even during a big chase pile-up.
var DH = window.DH || (window.DH = {});

DH.effects = (function () {
  'use strict';

  var particles = [];
  var skids = [];
  var flashLight = null;
  var flashTime = 0;
  var shakeAmount = 0;
  var poolSize = 120;
  var skidPool = 90;
  var geo = null;
  var mat = null;

  function init(G) {
    geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (var i = 0; i < poolSize; i++) {
      var m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      G.scene.add(m);
      particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0, max: 1, grav: 0 });
    }
    var skidGeo = new THREE.PlaneGeometry(0.55, 1.6);
    var skidMat = new THREE.MeshBasicMaterial({
      color: 0x1a1210, transparent: true, opacity: 0.55, depthWrite: false
    });
    for (var j = 0; j < skidPool; j++) {
      var s = new THREE.Mesh(skidGeo, skidMat.clone());
      s.rotation.x = -Math.PI / 2;
      s.position.y = 0.06;
      s.visible = false;
      G.scene.add(s);
      skids.push({ mesh: s, life: 0 });
    }
    flashLight = new THREE.PointLight(0xffcc66, 0, 26);
    G.scene.add(flashLight);
  }

  function spawnParticle(pos, vel, color, life, grav) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life > 0) continue;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.scale.setScalar(1);
      p.vel.copy(vel);
      p.life = life;
      p.max = life;
      p.grav = grav || 0;
      return;
    }
  }

  // A short burst of debris / sparks / smoke at a point.
  function burst(pos, color, count, speed, life, grav) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var up = Math.random() * 0.9 + 0.2;
      var v = new THREE.Vector3(
        Math.cos(a) * speed * Math.random(),
        up * speed * 0.7,
        Math.sin(a) * speed * Math.random()
      );
      spawnParticle(pos, v, color, life * (0.5 + Math.random() * 0.5), grav);
    }
  }

  function dust(pos) {
    burst(pos, 0xc9a06a, 3, 2.2, 0.7, -0.5);
  }

  function sparks(pos) {
    burst(pos, 0xffd27a, 8, 7, 0.4, 9);
  }

  function blood(pos) {
    burst(pos, 0x8c1f1f, 6, 3, 0.5, 6);
  }

  function explosion(pos) {
    burst(pos, 0xff7722, 26, 11, 0.9, 4);
    burst(pos, 0x332211, 18, 5, 1.4, -1);
    burst(pos, 0xffcc55, 12, 7, 0.5, 2);
    flashLight.position.copy(pos);
    flashLight.position.y += 2;
    flashLight.intensity = 5;
    flashTime = 0.22;
    shake(0.9);
  }

  // A muzzle flash: a brief warm light at the barrel, plus sparks.
  function muzzle(pos, dir) {
    flashLight.position.copy(pos);
    flashLight.intensity = 3.2;
    flashTime = 0.07;
    var tip = pos.clone().add(dir.clone().multiplyScalar(0.8));
    burst(tip, 0xffe08a, 4, 5, 0.18, 0);
  }

  // One skid segment under a wheel; fades away after a few seconds.
  function skid(x, z, heading) {
    for (var i = 0; i < skids.length; i++) {
      var s = skids[i];
      if (s.life > 0) continue;
      s.mesh.visible = true;
      s.mesh.position.set(x, 0.06, z);
      s.mesh.rotation.z = -heading;
      s.mesh.material.opacity = 0.55;
      s.life = 5;
      return;
    }
    // Pool full: recycle the oldest mark.
    var old = skids[0];
    old.mesh.position.set(x, 0.06, z);
    old.mesh.rotation.z = -heading;
    old.mesh.material.opacity = 0.55;
    old.mesh.visible = true;
    old.life = 5;
  }

  function shake(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
  }

  function shakeOffset() {
    if (shakeAmount <= 0.001) return { x: 0, y: 0 };
    var s = shakeAmount;
    return {
      x: (Math.random() - 0.5) * s * 0.6,
      y: (Math.random() - 0.5) * s * 0.6
    };
  }

  function update(dt) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      var k = p.life / p.max;
      p.mesh.scale.setScalar(0.4 + k * 0.8);
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vel.y = 0;
      }
    }
    for (var j = 0; j < skids.length; j++) {
      var s = skids[j];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, 0.55 * (s.life / 5));
      if (s.life <= 0) s.mesh.visible = false;
    }
    if (flashTime > 0) {
      flashTime -= dt;
      if (flashTime <= 0) flashLight.intensity = 0;
    }
    shakeAmount = Math.max(0, shakeAmount - dt * 2.2);
  }

  return {
    init: init,
    burst: burst,
    dust: dust,
    sparks: sparks,
    blood: blood,
    explosion: explosion,
    muzzle: muzzle,
    skid: skid,
    shake: shake,
    shakeOffset: shakeOffset,
    update: update
  };
})();
