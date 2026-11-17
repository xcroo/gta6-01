// Dusthaven — save.js
// Progress persistence in localStorage: money, story progress,
// collected sun coins and the best stunt. Nothing else is stored,
// and a corrupt or missing save simply starts a fresh game.
var DH = window.DH || (window.DH = {});

DH.save = (function () {
  'use strict';

  var KEY = 'dusthaven-save-v1';

  function defaultSave() {
    return {
      money: 250,
      missionIndex: 0,
      missionsDone: [],
      coins: [],
      bestStunt: 0,
      carsStolen: 0,
      playSeconds: 0
    };
  }

  function saveGame(G) {
    try {
      var data = {
        money: Math.floor(G.money),
        missionIndex: G.missionIndex,
        missionsDone: G.missionsDone.slice(),
        coins: G.coinsCollected.slice(),
        bestStunt: G.bestStunt || 0,
        carsStolen: G.carsStolen || 0,
        playSeconds: Math.floor(G.playSeconds || 0)
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadGame() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.money !== 'number') return null;
      var out = defaultSave();
      out.money = data.money;
      out.missionIndex = Math.max(0, Math.min(data.missionIndex | 0, 5));
      out.missionsDone = Array.isArray(data.missionsDone) ? data.missionsDone : [];
      out.coins = Array.isArray(data.coins) ? data.coins : [];
      out.bestStunt = data.bestStunt | 0;
      out.carsStolen = data.carsStolen | 0;
      out.playSeconds = data.playSeconds | 0;
      return out;
    } catch (e) {
      return null;
    }
  }

  function hasSave() {
    return loadGame() !== null;
  }

  function clearSave() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (e) { /* storage unavailable: a fresh game either way */ }
  }

  return {
    saveGame: saveGame,
    loadGame: loadGame,
    hasSave: hasSave,
    clearSave: clearSave,
    defaultSave: defaultSave
  };
})();
