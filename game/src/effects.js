// effects.js — particles, skid marks, flashes and explosions for Porto Verde.

const FX = {
  particles: [],
  skids: [],
  maxParticles: 400,
};

function initEffects(scene) {
  V.effects = FX;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FX.maxParticles * 3), 3));
  const mat = new THREE.PointsMaterial({ color: 0xffcc66, size: 0.5, transparent: true, opacity: 0.95 });
  FX.points = new THREE.Points(geo, mat);
  FX.points.frustumCulled = false;
  scene.add(FX.points);
  for (let i = 0; i < FX.maxParticles; i++) {
    FX.particles.push({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 });
  }
}

function spawnParticle(x, y, z, vx, vy, vz, life) {
  for (const p of FX.particles) {
    if (p.life <= 0) {
      p.life = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
      return;
    }
  }
}

function spawnCrashSparks(x, z) {
  for (let i = 0; i < 14; i++) {
    spawnParticle(x, 0.8, z, rand(-6, 6), rand(1, 7), rand(-6, 6), rand(0.3, 0.8));
  }
}

function spawnSmoke(x, z) {
  spawnParticle(x + rand(-1, 1), 0.4, z + rand(-1, 1), rand(-1, 1), rand(1, 2.5), rand(-1, 1), rand(0.5, 1));
}

function spawnBlood(x, z) {
  for (let i = 0; i < 10; i++) spawnParticle(x, 0.3, z, rand(-4, 4), rand(0.5, 3), rand(-4, 4), rand(0.3, 0.7));
}

function spawnExplosion(x, z) {
  for (let i = 0; i < 40; i++) {
    spawnParticle(x, rand(0.5, 2), z, rand(-12, 12), rand(2, 14), rand(-12, 12), rand(0.5, 1.2));
  }
  const flash = new THREE.PointLight(0xff7722, 4, 30);
  flash.position.set(x, 3, z);
  V.scene.add(flash);
  setTimeout(() => V.scene.remove(flash), 300);
  sfxCrash();
}

function spawnMuzzleFlash(x, y, z, heading) {
  const flash = new THREE.PointLight(0xffdd88, 3, 12);
  flash.position.set(x + Math.sin(heading) * 1.2, y, z + Math.cos(heading) * 1.2);
  V.scene.add(flash);
  setTimeout(() => V.scene.remove(flash), 70);
  for (let i = 0; i < 6; i++) {
    spawnParticle(flash.position.x, y, flash.position.z, Math.sin(heading) * rand(6, 12) + rand(-2, 2), rand(-1, 2), Math.cos(heading) * rand(6, 12) + rand(-2, 2), 0.15);
  }
}

function addSkid(x, z, heading) {
  if (FX.skids.length > 60) {
    const old = FX.skids.shift();
    V.scene.remove(old);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 })
  );
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = heading;
  m.position.set(x, 0.05, z);
  V.scene.add(m);
  FX.skids.push(m);
  setTimeout(() => { const i = FX.skids.indexOf(m); if (i >= 0) { FX.skids.splice(i, 1); V.scene.remove(m); } }, 9000);
}

function updateEffects(dt) {
  const pos = FX.points.geometry.attributes.position.array;
  for (let i = 0; i < FX.particles.length; i++) {
    const p = FX.particles[i];
    if (p.life > 0) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 9 * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
    } else {
      p.y = -99;
    }
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
  }
  FX.points.geometry.attributes.position.needsUpdate = true;
}
