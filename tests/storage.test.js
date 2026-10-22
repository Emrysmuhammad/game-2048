const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBest, saveBest, loadState, saveState } = require('../js/storage.js');

// A tiny in-memory stand-in for localStorage
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value))
  };
}

test('loadBest is 0 when nothing is saved', () => {
  assert.equal(loadBest(fakeStorage()), 0);
});

test('the best score survives a save and load round trip', () => {
  const storage = fakeStorage();
  assert.equal(saveBest(4096, storage), true);
  assert.equal(loadBest(storage), 4096);
});

test('decimals are rounded down', () => {
  const storage = fakeStorage();
  saveBest(100.9, storage);
  assert.equal(loadBest(storage), 100);
});

test('invalid best scores are ignored', () => {
  assert.equal(saveBest(-5, fakeStorage()), false);
  assert.equal(saveBest(NaN, fakeStorage()), false);
  assert.equal(loadBest(fakeStorage({ '2048.best': '"abc"' })), 0);
  assert.equal(loadBest(fakeStorage({ '2048.best': '-20' })), 0);
  assert.equal(loadBest(fakeStorage({ '2048.best': '{"a":1}' })), 0);
});

test('corrupt saved data falls back to safe defaults', () => {
  const storage = fakeStorage({ '2048.best': '{oops', '2048.state': '{oops' });
  assert.equal(loadBest(storage), 0);
  assert.equal(loadState(storage), null);
});

test('a saved game survives a save and load round trip', () => {
  const storage = fakeStorage();
  const state = { tiles: [{ id: 1, value: 2, r: 0, c: 0 }], score: 8, nextId: 2, won: false, keepPlaying: false };
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(loadState(storage), state);
});

test('loadState is null when no game is saved', () => {
  assert.equal(loadState(fakeStorage()), null);
});

test('missing storage does not crash anything', () => {
  assert.equal(loadBest(null), 0);
  assert.equal(saveBest(5, null), false);
  assert.equal(loadState(null), null);
  assert.equal(saveState({}, null), false);
});