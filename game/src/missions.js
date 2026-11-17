// missions.js — story missions, dialogue and the Courier Rush side job in Porto Verde.

const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', payout: 300,
    intro: [
      'MARLA QUINN: "New in town, huh? Name\'s Marla. I run jobs out of my garage."',
      'MARLA QUINN: "First rule of Porto Verde: a driver needs wheels. Take any car on the street."',
      'MARLA QUINN: "Then bring it to my garage. Don\'t scratch the paint."',
    ],
    steps: [
      { type: 'enterCar', label: 'Steal a car (walk up and press E)' },
      { type: 'drive', x: -80, z: -160, label: 'Drive to Marla\'s Garage' },
    ],
  },
  {
    id: 'm2', title: 'The Package', payout: 450,
    intro: [
      'MARLA QUINN: "A package is waiting at the docks. The boys there don\'t ask questions."',
      'MARLA QUINN: "Pick it up on foot, then bring it back to the garage. Quick and quiet."',
    ],
    steps: [
      { type: 'pickup', x: 296, z: 120, label: 'Pick up the package at the docks' },
      { type: 'go', x: -80, z: -160, label: 'Deliver the package to Marla\'s Garage' },
    ],
  },
  {
    id: 'm3', title: 'Heat on the Strip', payout: 600,
    intro: [
      'MARLA QUINN: "The Harbormen want their cut. We\'re not paying. Drive the strip, hit my three marks."',
      'MARLA QUINN: "The PD will be all over you. Lose them when you\'re done."',
    ],
    steps: [
      { type: 'enterCar', label: 'Get in a car — the PD is already watching' },
      { type: 'drive', x: 0, z: 0, label: 'Checkpoint 1: Plaza Verde' },
      { type: 'drive', x: 80, z: -80, label: 'Checkpoint 2: Marina Row' },
      { type: 'drive', x: -160, z: 80, label: 'Checkpoint 3: Coral Corner' },
      { type: 'escape', seconds: 20, label: 'Lose the heat — stay out of sight for 20s' },
    ],
  },
  {
    id: 'm4', title: 'Rival Turf', payout: 800,
    intro: [
      'MARLA QUINN: "The Red Jackals moved into Plaza Verde. They shot at one of my couriers."',
      'MARLA QUINN: "Go on foot. Make it loud. Four of them, and the plaza is ours again."',
    ],
    steps: [
      { type: 'go', x: 0, z: 0, label: 'Reach Plaza Verde' },
      { type: 'kill', count: 4, x: 0, z: 0, label: 'Take out the Red Jackals (0/4)' },
    ],
  },
  {
    id: 'm5', title: 'The Big Score', payout: 1500,
    intro: [
      'MARLA QUINN: "One last job, kid. The Harbor Bank truck is parked at the marina — take the cash."',
      'MARLA QUINN: "Every cop in Porto Verde will be on you. Bring it to the beach hideout. Then we\'re rich."',
    ],
    steps: [
      { type: 'pickup', x: 280, z: -200, label: 'Grab the cash at the marina' },
      { type: 'drive', x: -160, z: 160, label: 'Lose the cops — reach Coral Corner' },
      { type: 'drive', x: 296, z: -240, label: 'Deliver to the beach hideout' },
    ],
  },
];

let markerMesh = null;
let ringMeshes = [];

function initMissionMarker(scene) {
  markerMesh = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  beam.position.y = 30;
  markerMesh.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.3, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  markerMesh.add(ring);
  markerMesh.visible = false;
  scene.add(markerMesh);
}

function currentMissionDef() {
  const next = MISSIONS.find((m) => !V.missionsDone.includes(m.id));
  return next || null;
}

function startMission(def) {
  V.mission = { def, step: 0, kills: 0, timer: 0, enemiesSpawned: false };
  showBanner('MISSION: ' + def.title);
  showDialogue(def.intro);
  sfxMission();
  updateMarker();
  if (def.id === 'm3') addWanted(2, 'the Harbormen tipped off the PD');
  if (def.id === 'm5') addWanted(2, 'the bank alarm is ringing');
}

function stepLabel() {
  if (!V.mission) return 'Free roam — press N for the next job';
  const s = V.mission.def.steps[V.mission.step];
  if (!s) return '';
  if (s.type === 'kill') return s.label.replace(/\(\d+\/\d+\)/, '(' + V.mission.kills + '/' + s.count + ')');
  return s.label;
}

function stepTarget() {
  if (!V.mission) return null;
  const s = V.mission.def.steps[V.mission.step];
  if (!s || s.type === 'enterCar') return null;
  return { x: s.x, z: s.z };
}

function updateMarker() {
  const t = stepTarget();
  if (!markerMesh) return;
  if (t) {
    markerMesh.visible = true;
    markerMesh.position.set(t.x, 0, t.z);
  } else {
    markerMesh.visible = false;
  }
}

function advanceStep() {
  const m = V.mission;
  if (!m) return;
  m.step++;
  m.enemiesSpawned = false;
  if (m.step >= m.def.steps.length) {
    completeMission();
  } else {
    updateMarker();
    sfxPickup();
  }
}

function completeMission() {
  const m = V.mission;
  V.money += m.def.payout;
  V.missionsDone.push(m.def.id);
  showBanner('MISSION COMPLETE — ' + m.def.title + '  +' + fmtMoney(m.def.payout));
  sfxMission();
  saveGame();
  V.mission = null;
  updateMarker();
  setTimeout(() => {
    if (V.state === 'playing') {
      const next = currentMissionDef();
      if (next) startMission(next);
      else showBanner('ALL MISSIONS COMPLETE — Porto Verde is yours, ' + fmtMoney(V.money));
    }
  }, 5000);
}

function failMission(reason) {
  if (!V.mission) return;
  showBanner('MISSION FAILED — ' + reason);
  V.mission = null;
  updateMarker();
}

function updateMissions(dt) {
  const m = V.mission;
  if (!m || !V.player) return;
  const s = m.def.steps[m.step];
  if (!s) return;
  const px = V.player.x, pz = V.player.z;
  if (s.type === 'enterCar' && V.player.inCar) advanceStep();
  else if (s.type === 'go' && dist2d(px, pz, s.x, s.z) < 6) advanceStep();
  else if (s.type === 'drive' && V.player.inCar && dist2d(px, pz, s.x, s.z) < 8) advanceStep();
  else if (s.type === 'pickup' && !V.player.inCar && dist2d(px, pz, s.x, s.z) < 4) {
    sfxPickup();
    advanceStep();
  } else if (s.type === 'pickup' && V.player.inCar && dist2d(px, pz, s.x, s.z) < 4) {
    showSubtitle('Get out of the car to grab it (press E).');
  } else if (s.type === 'kill') {
    if (!m.enemiesSpawned) {
      m.enemiesSpawned = true;
      for (let i = 0; i < s.count; i++) {
        spawnEnemy(s.x + rand(-12, 12), s.z + rand(-12, 12), m.def.id);
      }
    }
    if (m.kills >= s.count) advanceStep();
  } else if (s.type === 'escape') {
    if (V.wanted === 0) {
      m.timer += dt;
      if (m.timer >= s.seconds) advanceStep();
    } else {
      m.timer = 0;
    }
  }
  // Marker pulse.
  if (markerMesh && markerMesh.visible) {
    markerMesh.rotation.y += dt;
    markerMesh.children[1].scale.setScalar(1 + Math.sin(V.time * 4) * 0.12);
  }
}

// --- Courier Rush side job: drive the marked van through 5 rings in 90s. ---
const COURIER = {
  active: false, rings: [], ringIndex: 0, timeLeft: 0, van: null,
};

function setupCourierVan(scene) {
  const van = spawnCar(CAR_MODELS[2], 80, 128, Math.PI / 2, false);
  van.isParked = true;
  van.courier = true;
  V.traffic.push(van);
  COURIER.van = van;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 2),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  sign.position.set(80, 6, 121);
  scene.add(sign);
}

function startCourierRush() {
  COURIER.active = true;
  COURIER.ringIndex = 0;
  COURIER.timeLeft = 90;
  COURIER.rings = [];
  const spots = [[120, 120], [-120, -40], [0, -200], [200, 40], [-40, 200]];
  for (const [x, z] of spots) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4, 0.4, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 2.5, z);
    V.scene.add(ring);
    COURIER.rings.push(ring);
  }
  showBanner('COURIER RUSH — 5 drops in 90 seconds!');
  showSubtitle('Drive the van through every glowing ring before time runs out.');
}

function updateCourier(dt) {
  if (!COURIER.active || !V.activeCar) return;
  COURIER.timeLeft -= dt;
  const ring = COURIER.rings[COURIER.ringIndex];
  if (ring) {
    ring.rotation.y += dt * 2;
    if (dist2d(V.activeCar.x, V.activeCar.z, ring.position.x, ring.position.z) < 6) {
      V.scene.remove(ring);
      COURIER.ringIndex++;
      V.money += 80;
      sfxPickup();
      showSubtitle('Drop ' + COURIER.ringIndex + '/5 — +$80');
    }
  }
  if (COURIER.ringIndex >= COURIER.rings.length) {
    COURIER.active = false;
    V.money += 400;
    showBanner('COURIER RUSH DONE — +$400 bonus');
    sfxMission();
  } else if (COURIER.timeLeft <= 0) {
    COURIER.active = false;
    for (const r of COURIER.rings) V.scene.remove(r);
    showBanner('COURIER RUSH FAILED — out of time');
  }
}
