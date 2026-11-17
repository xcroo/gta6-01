// SOLMARA — save.js
// Save and load through localStorage. Saves cash, health, ammo, the
// next mission, the player's position and lifetime stats. A save is
// only ever written from a clean state — never mid-mission data that
// could strand the player.

var SaveGame = {
  save: function () {
    try {
      var data = {
        v: 1,
        cash: G.cash,
        health: G.health,
        ammo: G.ammo,
        reserveAmmo: G.reserveAmmo,
        missionIndex: G.missionIndex,
        missionsDone: G.missionsDone,
        freeRoam: G.freeRoam,
        x: Player.x, z: Player.z, heading: Player.heading,
        stats: G.stats,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(G.saveSlot, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },

  load: function () {
    try {
      var raw = localStorage.getItem(G.saveSlot);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      return data;
    } catch (e) { return null; }
  },

  hasSave: function () { return this.load() !== null; },

  apply: function (data) {
    G.cash = data.cash;
    G.health = clamp(data.health, 1, G.maxHealth);
    G.ammo = data.ammo;
    G.reserveAmmo = data.reserveAmmo;
    G.missionIndex = data.missionIndex;
    G.missionsDone = data.missionsDone;
    G.freeRoam = !!data.freeRoam;
    G.stats = data.stats || G.stats;
    Player.reset(data.x, data.z, data.heading || 0);
    clearWanted();
    if (G.freeRoam) {
      HUD.setObjective('Free roam — press M to replay the jobs');
    } else if (G.missionIndex < MISSIONS.length) {
      HUD.setObjective('Press M to start: ' + MISSIONS[G.missionIndex].title);
    }
  },

  wipe: function () {
    try { localStorage.removeItem(G.saveSlot); } catch (e) { /* ignore */ }
  },
};
