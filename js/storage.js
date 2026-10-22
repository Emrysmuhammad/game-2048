(function (root) {
  'use strict';

  const Config = (typeof module !== 'undefined' && module.exports)
    ? require('./config.js')
    : root.Game2048.Config;

  // ---------- safe localStorage access ----------

  function defaultStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (err) {
      return null; // blocked (private mode or strict browser settings)
    }
  }

  function readJson(key, storage) {
    try {
      if (!storage) return null;
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeJson(key, value, storage) {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  // ---------- best score ----------

  /** The saved best score, or 0 if there is none or it is not a sensible number. */
  function loadBest(storage = defaultStorage()) {
    const value = Number(readJson(Config.STORAGE_KEYS.BEST, storage));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  function saveBest(score, storage = defaultStorage()) {
    if (!Number.isFinite(score) || score < 0) return false;
    return writeJson(Config.STORAGE_KEYS.BEST, Math.floor(score), storage);
  }

  // ---------- the game in progress ----------

  /** The raw saved game. The Game class validates it before using it. */
  function loadState(storage = defaultStorage()) {
    return readJson(Config.STORAGE_KEYS.STATE, storage);
  }

  function saveState(state, storage = defaultStorage()) {
    return writeJson(Config.STORAGE_KEYS.STATE, state, storage);
  }

  const api = { loadBest, saveBest, loadState, saveState };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Game2048 = root.Game2048 || {};
    Object.assign(root.Game2048, api);
  }
})(typeof window !== 'undefined' ? window : globalThis);