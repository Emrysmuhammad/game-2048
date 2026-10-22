const test = require('node:test');
const assert = require('node:assert/strict');
const Config = require('../js/config.js');
const { Game, DIRECTIONS, sanitizeState, isTileValue } = require('../js/game.js');

// A tiny deterministic random generator
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const sum = (grid) => grid.reduce((total, row) => total + row.reduce((a, b) => a + b, 0), 0);

/** Move, then blank out the freshly spawned tile so only the slide/merge result remains. */
function slide(game, direction) {
  const result = game.move(direction);
  const grid = game.toGrid();
  if (result.spawned) grid[result.spawned.r][result.spawned.c] = 0;
  return { result, grid };
}

const empty4 = () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
const withRow0 = (row) => { const g = empty4(); g[0] = row; return g; };

// ---------- starting a game ----------

test('a new game starts with two tiles and no score', () => {
  const game = new Game(4, seeded(1));
  assert.equal(game.tiles.length, 2);
  assert.equal(game.score, 0);
  assert.ok(game.tiles.every((t) => t.value === 2 || t.value === 4));
  assert.equal(game.won, false);
  assert.equal(game.over, false);
  assert.equal(game.canUndo(), false);
});

test('a new tile is a 2 most of the time and a 4 sometimes', () => {
  const two = Game.fromGrid(empty4(), () => 0.5);
  assert.equal(two.addRandomTile().value, 2);
  const four = Game.fromGrid(empty4(), () => 0.05);
  assert.equal(four.addRandomTile().value, 4);
});

// ---------- sliding ----------

test('tiles slide all the way to the wall', () => {
  const game = Game.fromGrid(withRow0([0, 0, 0, 2]), seeded(2));
  const { result, grid } = slide(game, 'left');
  assert.equal(result.moved, true);
  assert.deepEqual(grid[0], [2, 0, 0, 0]);
});

test('tiles slide in all four directions', () => {
  assert.deepEqual(slide(Game.fromGrid(withRow0([2, 0, 0, 0]), seeded(2)), 'right').grid[0], [0, 0, 0, 2]);

  const column = empty4();
  column[3][1] = 8;
  const up = slide(Game.fromGrid(column, seeded(2)), 'up').grid;
  assert.equal(up[0][1], 8);
  assert.equal(up[3][1], 0);

  const top = empty4();
  top[0][2] = 8;
  const down = slide(Game.fromGrid(top, seeded(2)), 'down').grid;
  assert.equal(down[3][2], 8);
  assert.equal(down[0][2], 0);
});

test('a tile keeps its id while it slides', () => {
  const game = Game.fromGrid(withRow0([0, 0, 0, 2]), seeded(2));
  const id = game.tiles[0].id;
  game.move('left');
  const tile = game.tiles.find((t) => t.id === id);
  assert.deepEqual([tile.r, tile.c], [0, 0]);
});

// ---------- merging ----------

test('two equal tiles merge into one', () => {
  const game = Game.fromGrid(withRow0([2, 2, 0, 0]), seeded(3));
  const { result, grid } = slide(game, 'left');
  assert.deepEqual(grid[0], [4, 0, 0, 0]);
  assert.equal(result.gained, 4);
  assert.equal(game.score, 4);
});

test('four equal tiles become two merged tiles', () => {
  const { grid, result } = slide(Game.fromGrid(withRow0([2, 2, 2, 2]), seeded(3)), 'left');
  assert.deepEqual(grid[0], [4, 4, 0, 0]);
  assert.equal(result.gained, 8);
});

test('with three equal tiles the pair nearest the wall merges', () => {
  assert.deepEqual(slide(Game.fromGrid(withRow0([2, 2, 2, 0]), seeded(3)), 'left').grid[0], [4, 2, 0, 0]);
  assert.deepEqual(slide(Game.fromGrid(withRow0([2, 2, 2, 0]), seeded(3)), 'right').grid[0], [0, 0, 2, 4]);
});

test('a tile never merges twice in one move', () => {
  assert.deepEqual(slide(Game.fromGrid(withRow0([4, 2, 2, 0]), seeded(3)), 'left').grid[0], [4, 4, 0, 0]);
  assert.deepEqual(slide(Game.fromGrid(withRow0([2, 2, 4, 8]), seeded(3)), 'left').grid[0], [4, 4, 8, 0]);
});

test('merging works vertically', () => {
  const up = empty4();
  up[0][0] = 2;
  up[3][0] = 2;
  assert.equal(slide(Game.fromGrid(up, seeded(4)), 'up').grid[0][0], 4);

  const down = empty4();
  down[0][0] = 2;
  down[1][0] = 2;
  assert.equal(slide(Game.fromGrid(down, seeded(4)), 'down').grid[3][0], 4);
});

test('the score adds up every merge in a move', () => {
  const game = Game.fromGrid(withRow0([2, 2, 4, 4]), seeded(5));
  const { result } = slide(game, 'left');
  assert.equal(result.gained, 12);
  assert.equal(game.score, 12);
});

test('a merge consumes two tiles and creates one new tile', () => {
  const game = Game.fromGrid(withRow0([2, 2, 0, 0]), seeded(5));
  const [a, b] = game.tiles.map((t) => t.id);
  const result = game.move('left');

  assert.deepEqual(result.consumed.map((x) => x.id).sort(), [a, b].sort());
  result.consumed.forEach((x) => assert.deepEqual([x.r, x.c], [0, 0]));

  const merged = game.tiles.find((t) => t.r === 0 && t.c === 0);
  assert.equal(merged.value, 4);
  assert.equal(merged.merged, true);
  assert.ok(merged.id !== a && merged.id !== b);
});

// ---------- spawning and no-op moves ----------

test('a move that changes the board spawns exactly one new tile', () => {
  const game = Game.fromGrid(withRow0([0, 0, 0, 2]), seeded(6));
  const result = game.move('left');
  assert.equal(game.tiles.length, 2);
  assert.ok(result.spawned && result.spawned.isNew);
  assert.ok(result.spawned.value === 2 || result.spawned.value === 4);
});

test('a move that changes nothing does nothing at all', () => {
  const game = Game.fromGrid(withRow0([2, 4, 2, 4]), seeded(6));
  const result = game.move('left');
  assert.equal(result.moved, false);
  assert.equal(result.spawned, null);
  assert.equal(game.tiles.length, 4);
  assert.equal(game.score, 0);
  assert.equal(game.canUndo(), false);
});

test('an unknown direction is rejected', () => {
  const game = new Game(4, seeded(1));
  assert.throws(() => game.move('sideways'));
});

// ---------- game over ----------

test('a full board with no equal neighbours is game over', () => {
  const game = Game.fromGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 8]
  ], seeded(7));
  assert.equal(game.canMove(), false);
  assert.equal(game.over, true);
  assert.equal(game.isLocked(), true);
  DIRECTIONS.forEach((d) => assert.equal(game.move(d).moved, false));
});

test('a full board with one possible merge is not game over', () => {
  const game = Game.fromGrid([
    [2, 2, 4, 8],
    [4, 8, 2, 4],
    [2, 4, 8, 2],
    [8, 2, 4, 16]
  ], seeded(7));
  assert.equal(game.canMove(), true);
  assert.equal(game.over, false);
});

test('filling the last empty cell with no merges ends the game', () => {
  const game = Game.fromGrid([
    [16, 4, 16, 4],
    [4, 16, 4, 16],
    [8, 2, 8, 2],
    [4, 16, 8, 0]
  ], () => 0.5);          // the new tile is a 2 on the only free cell
  assert.equal(game.over, false);

  const result = game.move('right');
  assert.equal(result.moved, true);
  assert.equal(result.spawned.value, 2);
  assert.equal(game.canMove(), false);
  assert.equal(game.over, true);
});

// ---------- winning ----------

test('making the 2048 tile wins and locks the board until the player continues', () => {
  const game = Game.fromGrid(withRow0([1024, 1024, 0, 0]), seeded(8));
  assert.equal(game.won, false);

  game.move('left');
  assert.equal(game.won, true);
  assert.equal(game.isLocked(), true);
  assert.equal(game.move('right').moved, false);

  game.continueAfterWin();
  assert.equal(game.isLocked(), false);
  assert.equal(game.move('right').moved, true);
});

test('the win message is not repeated after continuing', () => {
  const game = Game.fromGrid(withRow0([1024, 1024, 0, 0]), seeded(8));
  game.move('left');
  game.continueAfterWin();
  game.move('right');
  assert.equal(game.won, true);
  assert.equal(game.keepPlaying, true);
});

// ---------- undo ----------

test('undo restores the board and the score', () => {
  const game = Game.fromGrid(withRow0([2, 2, 0, 0]), seeded(9));
  const before = game.toGrid();

  game.move('left');
  assert.equal(game.score, 4);
  assert.equal(game.canUndo(), true);

  assert.equal(game.undo(), true);
  assert.deepEqual(game.toGrid(), before);
  assert.equal(game.score, 0);
  assert.equal(game.canUndo(), false);
  assert.equal(game.undo(), false);
});

test('undo brings back a lost game', () => {
  const game = Game.fromGrid([
    [16, 4, 16, 4],
    [4, 16, 4, 16],
    [8, 2, 8, 2],
    [4, 16, 8, 0]
  ], () => 0.5);
  game.move('right');
  assert.equal(game.over, true);

  game.undo();
  assert.equal(game.over, false);
  assert.equal(game.isLocked(), false);
});

test('the undo history is limited', () => {
  const game = new Game(4, seeded(11));
  const dirs = ['left', 'up', 'right', 'down'];
  for (let i = 0; i < 40 && !game.over; i++) game.move(dirs[i % 4]);
  assert.ok(game.history.length <= Config.UNDO_LIMIT);
});

// ---------- saving ----------

test('a game survives being saved and restored', () => {
  const game = new Game(4, seeded(12));
  ['left', 'up', 'right', 'down', 'left'].forEach((d) => game.move(d));

  const saved = JSON.parse(JSON.stringify(game.toState()));
  const copy = Game.fromState(saved, 4, seeded(13));

  assert.deepEqual(copy.toGrid(), game.toGrid());
  assert.equal(copy.score, game.score);
  assert.equal(copy.won, game.won);
  assert.equal(copy.canUndo(), false);
});

test('sanitizeState rejects data that cannot be trusted', () => {
  assert.equal(sanitizeState(null, 4), null);
  assert.equal(sanitizeState({}, 4), null);
  assert.equal(sanitizeState({ tiles: [] }, 4), null);
  assert.equal(sanitizeState({ tiles: [{ value: 3, r: 0, c: 0 }] }, 4), null);
  assert.equal(sanitizeState({ tiles: [{ value: 2, r: 4, c: 0 }] }, 4), null);
  assert.equal(sanitizeState({ tiles: [{ value: 2, r: 0.5, c: 0 }] }, 4), null);
  assert.equal(sanitizeState({
    tiles: [{ value: 2, r: 0, c: 0 }, { value: 4, r: 0, c: 0 }]
  }, 4), null);

  const tooMany = [];
  for (let i = 0; i < 17; i++) tooMany.push({ value: 2, r: Math.floor(i / 4) % 4, c: i % 4 });
  assert.equal(sanitizeState({ tiles: tooMany }, 4), null);
});

test('sanitizeState repairs harmless problems', () => {
  const clean = sanitizeState({ tiles: [{ value: 2, r: 0, c: 0 }], score: 'x' }, 4);
  assert.equal(clean.score, 0);
  assert.equal(clean.nextId, 2);
  assert.equal(clean.won, false);

  const winning = sanitizeState({ tiles: [{ value: 2048, r: 1, c: 1 }] }, 4);
  assert.equal(winning.won, true);
});

test('fromState returns null for bad data', () => {
  assert.equal(Game.fromState({ tiles: 'nope' }, 4), null);
});

test('isTileValue only accepts powers of two from 2 upwards', () => {
  [2, 4, 2048, 131072].forEach((v) => assert.equal(isTileValue(v), true));
  [0, 1, 3, 6, -2, 2.5, 262144, '4', null].forEach((v) => assert.equal(isTileValue(v), false));
});

// ---------- long random games ----------

test('random play never loses or invents tile value', () => {
  const pick = seeded(21);
  const game = new Game(4, seeded(22));
  let expected = sum(game.toGrid());

  for (let step = 0; step < 300; step++) {
    const direction = DIRECTIONS[Math.floor(pick() * 4)];
    const result = game.move(direction);
    if (result.moved && result.spawned) expected += result.spawned.value;

    assert.equal(sum(game.toGrid()), expected, 'tile total changed at step ' + step);
    assert.equal(new Set(game.tiles.map((t) => t.r * 4 + t.c)).size, game.tiles.length);
    assert.ok(game.score >= 0);

    if (game.over) break;
    if (game.won && !game.keepPlaying) game.continueAfterWin();
  }
});