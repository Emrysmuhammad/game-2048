(function (root) {
  'use strict';

  /** Settings that never change while the game runs. */
  const Config = Object.freeze({
    SIZE: 4,                    // the board is SIZE x SIZE
    WIN_TILE: 2048,             // reaching this tile wins the game
    SPAWN_FOUR_CHANCE: 0.1,     // a new tile is a 4 this often, otherwise a 2
    UNDO_LIMIT: 10,             // how many moves can be undone

    SWIPE_THRESHOLD: 24,        // pixels a finger must travel to count as a swipe
    MOVE_MS: 120,               // slide animation time (kept in sync with the CSS)
    OVERLAY_DELAY_MS: 500,      // wait for the animation before showing win / game over

    STORAGE_KEYS: Object.freeze({
      BEST: '2048.best',
      STATE: '2048.state'
    })
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;                 // Node (unit tests)
  } else {
    root.Game2048 = root.Game2048 || {};
    root.Game2048.Config = Config;           // Browser
  }
})(typeof window !== 'undefined' ? window : globalThis);