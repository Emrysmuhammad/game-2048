(function (root) {
  'use strict';

  const Config = (typeof module !== 'undefined' && module.exports)
    ? require('./config.js')
    : root.Game2048.Config;

  const DIRECTIONS = ['left', 'right', 'up', 'down'];
  const MAX_TILE = 131072;   // 2^17: the largest tile a 4x4 board can ever hold

  function isTileValue(value) {
    return Number.isInteger(value) && value >= 2 && value <= MAX_TILE && (value & (value - 1)) === 0;
  }

  /**
   * The cells of one row or column, listed starting at the wall the tiles
   * slide towards. Moving "left" uses each row from column 0 outwards,
   * "right" uses each row from the last column inwards, and so on.
   */
  function lineCoords(size, direction, index) {
    const coords = [];
    for (let k = 0; k < size; k++) {
      if (direction === 'left') coords.push([index, k]);
      else if (direction === 'right') coords.push([index, size - 1 - k]);
      else if (direction === 'up') coords.push([k, index]);
      else coords.push([size - 1 - k, index]);
    }
    return coords;
  }

  /**
   * Turn anything (for example data read from localStorage) into a valid
   * saved state, or null if it cannot be trusted. Tile ids are renumbered.
   */
  function sanitizeState(raw, size) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tiles)) return null;
    if (raw.tiles.length === 0 || raw.tiles.length > size * size) return null;

    const seen = new Set();
    const tiles = [];
    for (const t of raw.tiles) {
      if (!t || typeof t !== 'object') return null;
      if (!Number.isInteger(t.r) || !Number.isInteger(t.c)) return null;
      if (t.r < 0 || t.r >= size || t.c < 0 || t.c >= size) return null;
      if (!isTileValue(t.value)) return null;

      const position = t.r * size + t.c;
      if (seen.has(position)) return null;     // two tiles on one cell
      seen.add(position);
      tiles.push({ id: tiles.length + 1, value: t.value, r: t.r, c: t.c });
    }

    const won = raw.won === true || tiles.some((t) => t.value >= Config.WIN_TILE);
    return {
      tiles: tiles,
      score: Number.isInteger(raw.score) && raw.score >= 0 ? raw.score : 0,
      nextId: tiles.length + 1,
      won: won,
      keepPlaying: raw.keepPlaying === true && won
    };
  }

  /**
   * The rules of 2048, with no DOM code.
   *
   * Every tile is { id, value, r, c, isNew, merged }. Tiles keep their id while
   * they slide, so the screen can animate them. When two tiles merge, both
   * disappear and a NEW tile with a new id and double the value is created.
   */
  class Game {
    constructor(size, rng) {
      this.size = size || Config.SIZE;
      this.rng = rng || Math.random;
      this.reset();
    }

    /** Build a game from a grid of numbers (0 = empty). Used by the tests. */
    static fromGrid(grid, rng) {
      const game = new Game(grid.length, rng);
      game.tiles = [];
      game.nextId = 1;
      game.history = [];
      grid.forEach((row, r) => {
        row.forEach((value, c) => {
          if (value) {
            game.tiles.push({ id: game.nextId++, value: value, r: r, c: c, isNew: false, merged: false });
          }
        });
      });
      game.won = game.tiles.some((t) => t.value >= Config.WIN_TILE);
      game.over = !game.canMove();
      return game;
    }

    /** Rebuild a game from saved data. Returns null if the data is not valid. */
    static fromState(raw, size, rng) {
      const clean = sanitizeState(raw, size || Config.SIZE);
      if (!clean) return null;
      const game = new Game(size, rng);
      game.history = [];
      game.restore(clean);
      return game;
    }

    reset() {
      this.tiles = [];
      this.score = 0;
      this.nextId = 1;
      this.won = false;
      this.keepPlaying = false;
      this.over = false;
      this.history = [];
      this.addRandomTile();
      this.addRandomTile();
    }

    // ---------- reading the board ----------

    buildGrid() {
      const grid = new Array(this.size * this.size).fill(null);
      this.tiles.forEach((t) => { grid[t.r * this.size + t.c] = t; });
      return grid;
    }

    /** The board as rows of numbers (0 = empty). */
    toGrid() {
      const rows = [];
      for (let r = 0; r < this.size; r++) rows.push(new Array(this.size).fill(0));
      this.tiles.forEach((t) => { rows[t.r][t.c] = t.value; });
      return rows;
    }

    emptyCells() {
      const grid = this.buildGrid();
      const empty = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!grid[r * this.size + c]) empty.push([r, c]);
        }
      }
      return empty;
    }

    highestTile() {
      return this.tiles.reduce((max, t) => Math.max(max, t.value), 0);
    }

    /** True while at least one move would change the board. */
    canMove() {
      const grid = this.buildGrid();
      const size = this.size;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const tile = grid[r * size + c];
          if (!tile) return true;
          const right = c + 1 < size ? grid[r * size + c + 1] : null;
          const below = r + 1 < size ? grid[(r + 1) * size + c] : null;
          if (right && right.value === tile.value) return true;
          if (below && below.value === tile.value) return true;
        }
      }
      return false;
    }

    /** Game over, or waiting for the player to choose "keep going" after winning. */
    isLocked() {
      return this.over || (this.won && !this.keepPlaying);
    }

    // ---------- changing the board ----------

    /** Put a 2 (or sometimes a 4) on a random empty cell. */
    addRandomTile() {
      const empty = this.emptyCells();
      if (empty.length === 0) return null;

      const [r, c] = empty[Math.floor(this.rng() * empty.length)];
      const value = this.rng() < Config.SPAWN_FOUR_CHANCE ? 4 : 2;
      const tile = { id: this.nextId++, value: value, r: r, c: c, isNew: true, merged: false };
      this.tiles.push(tile);
      return tile;
    }

    /**
     * Slide every tile as far as it can go in `direction`, merging equal
     * neighbours. A tile can merge only once per move, and the pair closest
     * to the wall merges first, so [2, 2, 2, 0] becomes [4, 2, 0, 0].
     *
     * Returns { moved, gained, consumed, spawned }:
     *   consumed: tiles that merged away, with the cell they slide into
     *   spawned:  the new random tile (null if nothing moved)
     * A move that changes nothing does nothing: no spawn, no history entry.
     */
    move(direction) {
      if (!DIRECTIONS.includes(direction)) throw new Error('Unknown direction: ' + direction);
      if (this.isLocked()) return { moved: false, gained: 0, consumed: [], spawned: null };

      const size = this.size;
      const grid = this.buildGrid();
      const plan = [];
      let changed = false;

      // First work out the whole move without touching the board
      for (let line = 0; line < size; line++) {
        const coords = lineCoords(size, direction, line);
        const lineTiles = coords.map(([r, c]) => grid[r * size + c]).filter(Boolean);

        let target = 0;
        let i = 0;
        while (i < lineTiles.length) {
          const a = lineTiles[i];
          const b = lineTiles[i + 1];
          const [r, c] = coords[target];

          if (b && a.value === b.value) {
            plan.push({ type: 'merge', a: a, b: b, r: r, c: c });
            changed = true;
            i += 2;
          } else {
            plan.push({ type: 'move', tile: a, r: r, c: c });
            if (a.r !== r || a.c !== c) changed = true;
            i += 1;
          }
          target++;
        }
      }

      if (!changed) return { moved: false, gained: 0, consumed: [], spawned: null };

      // Then apply it
      this.pushHistory();
      this.tiles.forEach((t) => { t.isNew = false; t.merged = false; });

      const next = [];
      const consumed = [];
      let gained = 0;

      plan.forEach((step) => {
        if (step.type === 'move') {
          step.tile.r = step.r;
          step.tile.c = step.c;
          next.push(step.tile);
        } else {
          const value = step.a.value * 2;
          next.push({ id: this.nextId++, value: value, r: step.r, c: step.c, isNew: false, merged: true });
          consumed.push({ id: step.a.id, r: step.r, c: step.c });
          consumed.push({ id: step.b.id, r: step.r, c: step.c });
          gained += value;
        }
      });

      this.tiles = next;
      this.score += gained;
      const spawned = this.addRandomTile();

      if (!this.won && this.tiles.some((t) => t.value >= Config.WIN_TILE)) this.won = true;
      this.over = !this.canMove();

      return { moved: true, gained: gained, consumed: consumed, spawned: spawned };
    }

    /** After winning, carry on playing for a higher score. */
    continueAfterWin() {
      if (this.won) this.keepPlaying = true;
    }

    // ---------- undo and saving ----------

    toState() {
      return {
        tiles: this.tiles.map((t) => ({ id: t.id, value: t.value, r: t.r, c: t.c })),
        score: this.score,
        nextId: this.nextId,
        won: this.won,
        keepPlaying: this.keepPlaying
      };
    }

    restore(state) {
      this.tiles = state.tiles.map((t) => ({
        id: t.id, value: t.value, r: t.r, c: t.c, isNew: false, merged: false
      }));
      this.score = state.score;
      this.nextId = state.nextId;
      this.won = state.won;
      this.keepPlaying = state.keepPlaying;
      this.over = !this.canMove();
    }

    pushHistory() {
      this.history.push(this.toState());
      if (this.history.length > Config.UNDO_LIMIT) this.history.shift();
    }

    canUndo() {
      return this.history.length > 0;
    }

    /** Go back one move. Returns false when there is nothing to undo. */
    undo() {
      const snapshot = this.history.pop();
      if (!snapshot) return false;
      this.restore(snapshot);
      return true;
    }
  }

  const api = { Game, DIRECTIONS, sanitizeState, isTileValue };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Game2048 = root.Game2048 || {};
    Object.assign(root.Game2048, api);
  }
})(typeof window !== 'undefined' ? window : globalThis);