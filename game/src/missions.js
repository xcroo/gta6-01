// Dusthaven — missions.js
// The story of Jet Calloway, a newcomer driver running jobs for the
// fixer Delia Voss against the Rust Vultures — plus the side work:
// timed deliveries, the stunt ramp and ten sun coins to collect.
var DH = window.DH || (window.DH = {});

DH.missions = (function () {
  'use strict';

  var U = DH.util;

  var MISSIONS = [
    {
      id: 'first-fare',
      title: 'First Fare',
      briefing: 'Delia Voss needs a driver. Pick up her contact at the canal, then drop him at the plaza hotel across town.',
      payout: 300,
      steps: [
        { type: 'goto', x: 200, z: -60, radius: 10, text: 'Pick up the contact at the canal quay', say: ['Delia Voss', 'Jet, first job. A friend waits by the canal. Drive careful — he pays careful.'] },
        { type: 'goto', x: -120, z: 120, radius: 10, text: 'Drop the contact at the plaza hotel', say: ['Contact', 'Smooth driving, kid. Delia picks good ones.'] }
      ]
    },
    {
      id: 'dust-run',
      title: 'Dust Run',
      briefing: 'Three drops across town, one ticking clock. The desert does not wait.',
      payout: 450,
      steps: [
        { type: 'timed', x: -120, z: 120, radius: 10, time: 150, text: 'Drop 1 of 3 — the plaza', say: ['Delia Voss', 'Three packages, one clock. Do not stop for the view.'] },
        { type: 'timed', x: 120, z: -180, radius: 10, time: 0, text: 'Drop 2 of 3 — north gate' },
        { type: 'timed', x: -180, z: -120, radius: 10, time: 0, text: 'Drop 3 of 3 — the old depot' }
      ]
    },
    {
      id: 'vulture-hunt',
      title: 'Vulture Hunt',
      briefing: 'The Rust Vultures jumped one of ours at the old depot. Go settle it — loud if you must.',
      payout: 600,
      steps: [
        { type: 'goto', x: -180, z: -120, radius: 12, text: 'Reach the old depot', say: ['Delia Voss', 'Four Vultures, maybe five. They started it. Finish it.'] },
        { type: 'kill', count: 4, x: -180, z: -120, radius: 30, text: 'Clear out the Rust Vultures (0/4)', say: ['Rust Vulture', 'Sunset Runner? In our yard? You picked the wrong sunset, kid.'] }
      ]
    },
    {
      id: 'big-lift',
      title: 'The Big Lift',
      briefing: 'A gold Dust GT sits outside the downtown tower. Take it. Bring it to the garage. The sheriff will notice.',
      payout: 800,
      steps: [
        { type: 'steal', x: 60, z: 60, radius: 8, text: 'Steal the gold Dust GT downtown', say: ['Delia Voss', 'Gold GT, downtown, keys in it. The owner is… indisposed. Move fast.'] },
        { type: 'deliver-car', x: 186, z: -60, radius: 10, text: 'Deliver the GT to Mesa Motors', say: ['Delia Voss', 'Beautiful. The sheriff can chase his own shadow now.'] }
      ]
    },
    {
      id: 'golden-getaway',
      title: 'Golden Getaway',
      briefing: 'The whole county is after you now. Lose them on the south highway and reach the hideout at sunset.',
      payout: 1200,
      steps: [
        { type: 'escape', x: 0, z: 252, radius: 14, text: 'Outrun the law — reach the south hideout', say: ['Delia Voss', 'Every deputy in the county is rolling, Jet. Drive like the sun is chasing you.'] }
      ]
    }
  ];

  var marker = null;
  var markerRing = null;
  var killTarget = 0;
  var killCount = 0;
  var stepTimer = 0;

  function buildMarker(G) {
    marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    marker.position.y = 21;
    marker.visible = false;
    G.scene.add(marker);
    markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc233 })
    );
    markerRing.rotation.x = Math.PI / 2;
    markerRing.position.y = 0.4;
    markerRing.visible = false;
    G.scene.add(markerRing);
    G.marker = marker;
    G.markerRing = markerRing;
  }

  function setMarker(G, x, z) {
    if (!marker) buildMarker(G);
    marker.position.x = x;
    marker.position.z = z;
    markerRing.position.x = x;
    markerRing.position.z = z;
    marker.visible = true;
    markerRing.visible = true;
    G.objectivePos = { x: x, z: z };
  }

  function hideMarker(G) {
    if (marker) marker.visible = false;
    if (markerRing) markerRing.visible = false;
    G.objectivePos = null;
  }

  function currentMission(G) {
    if (G.missionIndex >= MISSIONS.length) return null;
    return MISSIONS[G.missionIndex];
  }

  function currentStep(G) {
    var m = currentMission(G);
    if (!m || !G.mission) return null;
    return m.steps[G.mission.step];
  }

  function startMission(G, index) {
    var m = MISSIONS[index];
    if (!m) return false;
    G.mission = { def: m, step: 0, startedAt: G.time };
    G.missionIndex = index;
    killCount = 0;
    killTarget = 0;
    stepTimer = 0;
    DH.hud.showBanner(m.title, m.briefing);
    DH.hud.showObjective(m.steps[0].text);
    if (m.steps[0].say) DH.hud.showDialogue(m.steps[0].say[0], m.steps[0].say[1]);
    enterStep(G);
    DH.audio.cash();
    return true;
  }

  function enterStep(G) {
    var step = currentStep(G);
    if (!step) return;
    if (step.x !== undefined) setMarker(G, step.x, step.z);
    if (step.type === 'kill') {
      killTarget = step.count;
      killCount = 0;
      var cx = step.x, cz = step.z;
      for (var i = 0; i < step.count; i++) {
        DH.combat.spawnEnemy(G, cx + U.rand(-14, 14), cz + U.rand(-14, 14));
      }
      DH.hud.showObjective(step.text.replace('0/', '0/'));
    } else if (step.type === 'timed') {
      if (step.time) stepTimer = step.time;
    } else if (step.type === 'steal') {
      // Park the gold GT where the marker says.
      var car = DH.vehicles.createCar(G, step.x, step.z, Math.PI / 2, 0xd8a020, { maxSpeed: 40 });
      car.isMissionCar = true;
      G.missionCar = car;
      G.allCars.push(car);
      DH.hud.showToast('The gold Dust GT — press E to take it');
    } else if (step.type === 'escape') {
      DH.police.setWanted(G, 4);
    }
    if (step.say) DH.hud.showDialogue(step.say[0], step.say[1]);
    DH.hud.showObjective(step.text);
  }

  function advanceStep(G) {
    var m = G.mission.def;
    G.mission.step++;
    if (G.mission.step >= m.steps.length) {
      completeMission(G);
      return;
    }
    enterStep(G);
  }

  function completeMission(G) {
    var m = G.mission.def;
    G.money += m.payout;
    G.missionsDone.push(m.id);
    G.missionIndex++;
    hideMarker(G);
    DH.hud.showBanner('JOB DONE — ' + m.title, '+' + U.formatMoney(m.payout));
    DH.audio.cash();
    DH.save.saveGame(G);
    if (G.missionIndex >= MISSIONS.length) {
      G.mission = null;
      DH.hud.showBanner('DUSTHAVEN IS YOURS', 'Every job done. The sunset belongs to Jet Calloway.');
      DH.hud.showObjective('Free roam — deliveries, stunts and sun coins await');
      startDelivery(G);
      return;
    }
    G.mission = null;
    // The next job starts when the player walks to Delia's marker.
    setMarker(G, 186, -60);
    G.objectivePos = { x: 186, z: -60 };
    DH.hud.showObjective('Go to Mesa Motors to start the next job: ' + MISSIONS[G.missionIndex].title);
    DH.hud.showDialogue('Delia Voss', 'Come see me at the garage when you are ready for the next one.');
  }

  function failMission(G, reason) {
    var m = G.mission ? G.mission.def : null;
    hideMarker(G);
    G.mission = null;
    DH.hud.showBanner('JOB FAILED', reason);
    DH.audio.busted();
    DH.police.setWanted(G, Math.max(0, G.wanted - 1));
    if (m) {
      DH.hud.showObjective('Go to Mesa Motors to retry: ' + m.title);
      setMarker(G, 186, -60);
      G.objectivePos = { x: 186, z: -60 };
    }
  }

  function onEnemyDown(G, enemy) {
    if (!G.mission) return;
    var step = currentStep(G);
    if (!step || step.type !== 'kill') return;
    killCount++;
    DH.hud.showObjective(step.text.replace(/\(\d+\/\d+\)/, '(' + killCount + '/' + killTarget + ')'));
    if (killCount >= killTarget) advanceStep(G);
  }

  function tryStartNext(G) {
    if (G.mission) return;
    if (G.missionIndex >= MISSIONS.length) return;
    var d = U.dist2D(G.player.pos.x, G.player.pos.z, 186, -60);
    if (d < 10) startMission(G, G.missionIndex);
  }

  // A repeatable timed delivery for free-roam cash.
  function startDelivery(G) {
    var spots = [[-120, 120], [120, -180], [-180, 180], [180, 120], [0, -240]];
    var s = U.pick(spots);
    G.delivery = { x: s[0], z: s[1], timeLeft: 100, active: true };
    setMarker(G, s[0], s[1]);
    DH.hud.showObjective('Delivery: reach the marker in 100s — $150');
    DH.hud.showDialogue('Delia Voss', 'Side work, Jet: a package, a hundred seconds, one-fifty. Go.');
  }

  function updateDelivery(G, dt) {
    if (!G.delivery || !G.delivery.active) return;
    G.delivery.timeLeft -= dt;
    var d = U.dist2D(G.player.pos.x, G.player.pos.z, G.delivery.x, G.delivery.z);
    if (d < 9) {
      G.money += 150;
      G.delivery.active = false;
      DH.hud.showBanner('DELIVERY DONE', '+$150');
      DH.audio.cash();
      startDelivery(G);
    } else if (G.delivery.timeLeft <= 0) {
      G.delivery.active = false;
      DH.hud.showToast('Delivery late — the package went to someone else');
      startDelivery(G);
    }
  }

  // The stunt ramp: cross it fast and the jump pays out.
  function checkStunt(G) {
    var p = G.player;
    if (!p.inCar) return;
    var car = p.inCar;
    var ramp = G.rampPos;
    if (!ramp) return;
    var d = U.dist2D(car.pos.x, car.pos.z, ramp.x, ramp.z);
    if (d < 8 && Math.abs(car.speed) > 18 && !G.stuntCooldown) {
      G.stuntCooldown = 5;
      var score = Math.round(Math.abs(car.speed) * 10);
      G.bestStunt = Math.max(G.bestStunt || 0, score);
      G.money += 100;
      DH.effects.burst(car.pos, 0xffd27a, 14, 6, 0.8, 2);
      DH.effects.shake(0.4);
      DH.hud.showBanner('STUNT JUMP!', score + ' pts — +$100');
      DH.audio.pickup();
    }
    if (G.stuntCooldown) G.stuntCooldown -= 1 / 60;
  }

  // Sun coins: ten golden tokens hidden around the city.
  function buildCoins(G) {
    G.coinMeshes = [];
    var spots = G.coinSpots || [];
    spots.forEach(function (s, i) {
      var coin = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.25, 20),
        new THREE.MeshBasicMaterial({ color: 0xffc233 })
      );
      coin.rotation.x = Math.PI / 2;
      coin.position.set(s.x, 1.4, s.z);
      coin.visible = G.coinsCollected.indexOf(i) < 0;
      G.scene.add(coin);
      G.coinMeshes.push({ mesh: coin, x: s.x, z: s.z, index: i, taken: G.coinsCollected.indexOf(i) >= 0 });
    });
  }

  function updateCoins(G, dt) {
    var list = G.coinMeshes || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.taken) continue;
      c.mesh.rotation.z += dt * 2;
      c.mesh.position.y = 1.4 + Math.sin(G.time * 2 + i) * 0.25;
      var d = U.dist2D(G.player.pos.x, G.player.pos.z, c.x, c.z);
      if (d < 3) {
        c.taken = true;
        c.mesh.visible = false;
        G.coinsCollected.push(c.index);
        G.money += 50;
        DH.audio.pickup();
        DH.hud.showToast('Sun coin ' + G.coinsCollected.length + '/10 — +$50');
        DH.save.saveGame(G);
      }
    }
  }

  function updateMissions(G, dt) {
    if (G.mission) {
      var step = currentStep(G);
      if (!step) return;
      var p = G.player;
      if (step.type === 'goto' || step.type === 'timed') {
        var d = U.dist2D(p.pos.x, p.pos.z, step.x, step.z);
        if (d < step.radius) {
          if (step.type === 'timed' && step.time) {
            DH.hud.showToast('Drop made — ' + Math.ceil(stepTimer) + 's to spare');
          }
          advanceStep(G);
          return;
        }
        if (step.type === 'timed' && step.time) {
          stepTimer -= dt;
          if (stepTimer <= 0) {
            failMission(G, 'Out of time — the Dust Run slipped away');
            return;
          }
          DH.hud.showTimer(Math.ceil(stepTimer));
        }
      } else if (step.type === 'steal') {
        if (p.inCar && p.inCar.isMissionCar) {
          DH.hud.showToast('The GT is yours — now lose the heat and deliver it');
          advanceStep(G);
          return;
        }
      } else if (step.type === 'deliver-car') {
        if (p.inCar && p.inCar.isMissionCar) {
          var dd = U.dist2D(p.pos.x, p.pos.z, step.x, step.z);
          if (dd < step.radius) {
            p.inCar.isMissionCar = false;
            p.inCar.isPlayerOwned = true;
            advanceStep(G);
            return;
          }
        }
      } else if (step.type === 'escape') {
        var ed = U.dist2D(p.pos.x, p.pos.z, step.x, step.z);
        if (ed < step.radius) {
          DH.police.setWanted(G, 0);
          advanceStep(G);
          return;
        }
      }
    } else {
      tryStartNext(G);
    }
    updateDelivery(G, dt);
    checkStunt(G);
    updateCoins(G, dt);
  }

  return {
    MISSIONS: MISSIONS,
    buildMarker: buildMarker,
    setMarker: setMarker,
    hideMarker: hideMarker,
    currentMission: currentMission,
    currentStep: currentStep,
    startMission: startMission,
    completeMission: completeMission,
    failMission: failMission,
    onEnemyDown: onEnemyDown,
    startDelivery: startDelivery,
    buildCoins: buildCoins,
    updateMissions: updateMissions
  };
})();
