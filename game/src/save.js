// save.js — localStorage persistence for Porto Verde.

const SAVE_KEY = 'porto-verde-save-v1';

function saveGame() {
  try {
    const data = {
      money: V.money,
      health: V.health,
      missionsDone: V.missionsDone.slice(),
      collectibles: V.collectibles,
      kills: V.kills,
      carsStolen: V.carsStolen,
      px: V.player ? V.player.x : 0,
      pz: V.player ? V.player.z : 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) { return false; }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number' || !Array.isArray(d.missionsDone)) return null;
    return d;
  } catch (err) { return null; }
}

function applySave(d) {
  V.money = d.money;
  V.health = 100;
  V.missionsDone = d.missionsDone.slice();
  V.collectibles = d.collectibles || 0;
  V.kills = d.kills || 0;
  V.carsStolen = d.carsStolen || 0;
  if (V.player && typeof d.px === 'number') { V.player.x = d.px; V.player.z = d.pz; }
}

function hasSave() { return loadSave() !== null; }
