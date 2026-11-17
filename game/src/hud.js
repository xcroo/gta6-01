// hud.js — HUD, minimap, banners, dialogue and menus for Porto Verde.

const Hud = {
  els: {},
  dialogueQueue: [],
  dialogueTimer: 0,
};

function initHud() {
  Hud.els = {
    health: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    money: document.getElementById('money'),
    stars: document.getElementById('stars'),
    speed: document.getElementById('speed'),
    speedUnit: document.getElementById('speed-unit'),
    objective: document.getElementById('objective'),
    objectiveTitle: document.getElementById('objective-title'),
    minimap: document.getElementById('minimap'),
    banner: document.getElementById('banner'),
    subtitle: document.getElementById('subtitle'),
    crosshair: document.getElementById('crosshair'),
    ammo: document.getElementById('ammo'),
    damage: document.getElementById('damage-flash'),
    menu: document.getElementById('menu'),
    pause: document.getElementById('pause'),
    end: document.getElementById('end-screen'),
    toast: document.getElementById('toast'),
  };
  document.getElementById('btn-new').addEventListener('click', () => { sfxClick(); startNewGame(); });
  document.getElementById('btn-continue').addEventListener('click', () => { sfxClick(); startContinueGame(); });
  document.getElementById('btn-resume').addEventListener('click', () => { sfxClick(); togglePause(); });
  document.getElementById('btn-restart').addEventListener('click', () => { sfxClick(); startNewGame(); });
  document.getElementById('btn-menu').addEventListener('click', () => { sfxClick(); showMenu(); });
  document.getElementById('btn-end-menu').addEventListener('click', () => { sfxClick(); showMenu(); });
  document.getElementById('btn-end-retry').addEventListener('click', () => { sfxClick(); respawnPlayer(); });
  updateWantedHud();
}

function updateWantedHud() {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < V.wanted ? '★' : '☆';
  Hud.els.stars.textContent = s;
  Hud.els.stars.style.color = V.wanted > 0 ? '#ffd23e' : '#888888';
}

function showBanner(text) {
  V.banner = text;
  V.bannerUntil = V.time + 4;
  Hud.els.banner.textContent = text;
  Hud.els.banner.style.opacity = '1';
}

function showSubtitle(text) {
  V.subtitle = text;
  V.subtitleUntil = V.time + 4.5;
  Hud.els.subtitle.textContent = text;
  Hud.els.subtitle.style.opacity = '1';
}

function showDialogue(lines) {
  Hud.dialogueQueue = lines.slice();
  Hud.dialogueTimer = 0;
}

function updateDialogue(dt) {
  if (Hud.dialogueQueue.length === 0) return;
  Hud.dialogueTimer -= dt;
  if (Hud.dialogueTimer <= 0) {
    const line = Hud.dialogueQueue.shift();
    showSubtitle(line);
    Hud.dialogueTimer = 4.5;
  }
}

function flashDamage() {
  Hud.els.damage.style.opacity = '0.45';
  setTimeout(() => { Hud.els.damage.style.opacity = '0'; }, 120);
}

function showEndScreen(title, text) {
  Hud.els.end.style.display = 'flex';
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
}

function hideEndScreen() { Hud.els.end.style.display = 'none'; }

function showMenu() {
  V.state = 'menu';
  Hud.els.menu.style.display = 'flex';
  Hud.els.pause.style.display = 'none';
  hideEndScreen();
  document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none';
}

function hideMenu() { Hud.els.menu.style.display = 'none'; }

function togglePause() {
  if (V.state === 'playing') {
    V.state = 'paused';
    Hud.els.pause.style.display = 'flex';
  } else if (V.state === 'paused') {
    V.state = 'playing';
    Hud.els.pause.style.display = 'none';
  }
}

function updateHud(dt) {
  const e = Hud.els;
  e.health.style.width = clamp(V.health, 0, 100) + '%';
  e.healthText.textContent = Math.ceil(V.health) + ' HP';
  e.money.textContent = fmtMoney(V.money);
  const car = V.activeCar;
  e.speed.textContent = car ? Math.round(Math.abs(car.speed) * 3.6) : '0';
  e.speedUnit.textContent = car ? car.model.name + '  •  km/h' : 'ON FOOT';
  e.ammo.textContent = V.player && !V.player.inCar
    ? 'PISTOL  ' + V.player.ammo + ' / ' + V.player.reserveAmmo
    : (car ? 'E — exit car    SPACE — handbrake' : '');
  e.crosshair.style.display = V.player && !V.player.inCar && V.state === 'playing' ? 'block' : 'none';
  if (V.mission) {
    e.objectiveTitle.textContent = V.mission.def.title.toUpperCase();
    e.objective.textContent = stepLabel() + (COURIER.active ? '  •  RUSH ' + fmtTime(COURIER.timeLeft) : '');
  } else {
    e.objectiveTitle.textContent = 'PORTO VERDE';
    e.objective.textContent = COURIER.active
      ? 'Courier Rush: ' + (COURIER.ringIndex) + '/5 rings — ' + fmtTime(COURIER.timeLeft)
      : 'Free roam — press N for the next job';
  }
  if (V.banner && V.time > V.bannerUntil) { e.banner.style.opacity = '0'; V.banner = ''; }
  if (V.subtitle && V.time > V.subtitleUntil) { e.subtitle.style.opacity = '0'; V.subtitle = ''; }
  updateDialogue(dt);
  drawMinimap();
}

function drawMinimap() {
  const cv = Hud.els.minimap;
  if (!cv) return;
  const g = cv.getContext('2d');
  const S = 180, half = CITY.half + 40;
  const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#0e2a1a';
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
  // Sea + sand.
  const [bx] = toMap(CITY.beachX, 0);
  g.fillStyle = '#2e7fb8'; g.fillRect(bx, 0, S - bx, S);
  g.fillStyle = '#e8d29a'; g.fillRect(bx - 6, 0, 6, S);
  // Streets.
  g.strokeStyle = '#3a3f45'; g.lineWidth = 4;
  for (const s of CITY.streets) {
    const [x1, y1] = toMap(s, -half);
    const [x2, y2] = toMap(s, half);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const [x3, y3] = toMap(-half, s);
    const [x4, y4] = toMap(half, s);
    g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
  }
  // Collectibles.
  g.fillStyle = '#ffd23e';
  for (const c of CITY.collectibles) {
    if (!c.visible) continue;
    const [x, y] = toMap(c.position.x, c.position.z);
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // Courier rings.
  if (COURIER.active && COURIER.rings[COURIER.ringIndex]) {
    const r = COURIER.rings[COURIER.ringIndex];
    const [x, y] = toMap(r.position.x, r.position.z);
    g.fillStyle = '#22d3ee';
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }
  // Mission marker.
  const t = stepTarget();
  if (t) {
    const [x, y] = toMap(t.x, t.z);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke();
  }
  // Police blips.
  g.fillStyle = '#ff3344';
  for (const c of V.police) {
    if (c.wrecked) continue;
    const [x, y] = toMap(c.x, c.z);
    g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
  }
  // Player arrow.
  const px = V.activeCar ? V.activeCar.x : (V.player ? V.player.x : 0);
  const pz = V.activeCar ? V.activeCar.z : (V.player ? V.player.z : 0);
  const heading = V.activeCar ? V.activeCar.heading : (V.player ? V.player.heading : 0);
  const [mx, my] = toMap(px, pz);
  g.save();
  g.translate(mx, my);
  g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
  g.restore();
  // Rim.
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); g.stroke();
}
