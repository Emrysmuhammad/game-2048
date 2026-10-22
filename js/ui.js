(function (root) {
  'use strict';

  const { Config } = root.Game2048;

  /**
   * Everything that touches the page lives here. It only displays what it
   * is told to display. It never decides what the game should do.
   *
   * Every tile on screen is one <div> remembered by the tile's id. That is
   * what lets tiles slide: the same <div> gets new --r / --c numbers and the
   * CSS transition animates the change.
   */
  class UI {
    constructor(doc) {
      this.doc = doc;
      const $ = (id) => doc.getElementById(id);

      this.el = {
        board: $('board'),
        gridBg: $('grid-bg'),
        layer: $('tiles'),
        score: $('score'),
        best: $('best'),
        scoreBox: $('score-box'),
        undo: $('undo-btn'),
        newGame: $('new-btn'),
        overlay: $('overlay'),
        overlayTitle: $('overlay-title'),
        overlayText: $('overlay-text'),
        retry: $('overlay-retry'),
        keep: $('overlay-keep'),
        live: $('live')
      };

      this.nodes = new Map();   // tile id -> its <div>

      const view = doc.defaultView;
      const reduced = view && view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.moveMs = reduced ? 0 : Config.MOVE_MS;
      doc.documentElement.style.setProperty('--move-ms', this.moveMs + 'ms');

      this.buildBackground(Config.SIZE);
    }

    /** The empty squares behind the tiles. */
    buildBackground(size) {
      this.el.board.style.setProperty('--n', String(size));
      for (let i = 0; i < size * size; i++) {
        const cell = this.doc.createElement('div');
        cell.className = 'cell';
        this.el.gridBg.appendChild(cell);
      }
    }

    // ---------- tiles ----------

    valueClass(value) {
      const color = value <= 2048 ? 'v' + value : 'vbig';
      return 'tile__inner ' + color + ' d' + String(value).length;
    }

    setPosition(el, r, c) {
      el.style.setProperty('--r', String(r));
      el.style.setProperty('--c', String(c));
    }

    createTile(tile) {
      const el = this.doc.createElement('div');
      el.className = 'tile' + (tile.merged ? ' tile--merged' : '');

      const inner = this.doc.createElement('div');
      inner.className = this.valueClass(tile.value) +
        (tile.isNew ? ' is-new' : '') + (tile.merged ? ' is-merged' : '');
      inner.textContent = String(tile.value);

      el.appendChild(inner);
      this.setPosition(el, tile.r, tile.c);
      return el;
    }

    /**
     * Draw the current tiles.
     *  - tiles already on screen slide to their new position
     *  - new and merged tiles are created (and animated by the CSS)
     *  - `consumed` tiles slide into the merge, then disappear
     *  - any other tile on screen (after undo or a new game) is simply removed
     */
    render(tiles, options) {
      const consumed = (options && options.consumed) || [];
      const seen = new Set();

      tiles.forEach((tile) => {
        seen.add(tile.id);
        const existing = this.nodes.get(tile.id);
        if (existing) {
          this.setPosition(existing, tile.r, tile.c);
        } else {
          const el = this.createTile(tile);
          this.nodes.set(tile.id, el);
          this.el.layer.appendChild(el);
        }
      });

      consumed.forEach(({ id, r, c }) => {
        const el = this.nodes.get(id);
        if (!el) return;
        this.nodes.delete(id);
        this.setPosition(el, r, c);
        setTimeout(() => el.remove(), this.moveMs);
      });

      this.nodes.forEach((el, id) => {
        if (!seen.has(id)) {
          el.remove();
          this.nodes.delete(id);
        }
      });
    }

    // ---------- scores and buttons ----------

    setScore(score) {
      this.el.score.textContent = String(score);
    }

    setBest(best) {
      this.el.best.textContent = String(best);
    }

    /** The little "+8" that floats up from the score box. */
    showGain(amount) {
      const span = this.doc.createElement('span');
      span.className = 'score-gain';
      span.textContent = '+' + amount;
      this.el.scoreBox.appendChild(span);
      setTimeout(() => span.remove(), 700);
    }

    setUndoEnabled(enabled) {
      this.el.undo.disabled = !enabled;
    }

    // ---------- win / game over ----------

    showOverlay(kind, score) {
      const won = kind === 'won';
      this.el.overlayTitle.textContent = won ? 'You win! \uD83C\uDF89' : 'Game over';
      this.el.overlayText.textContent = won
        ? 'You made the 2048 tile. Keep going for a higher score?'
        : 'No more moves. Final score: ' + score + '.';
      this.el.keep.hidden = !won;
      this.el.retry.textContent = won ? 'New game' : 'Try again';
      this.el.overlay.hidden = false;
      (won ? this.el.keep : this.el.retry).focus({ preventScroll: true });
    }

    hideOverlay() {
      this.el.overlay.hidden = true;
    }

    // ---------- accessibility ----------

    /** A spoken description of the board for screen readers. */
    setBoardLabel(grid) {
      const rows = grid.map((row, r) =>
        'Row ' + (r + 1) + ': ' + row.map((v) => (v === 0 ? 'empty' : v)).join(', '));
      this.el.board.setAttribute('aria-label', '2048 board. ' + rows.join('. '));
    }

    announce(text) {
      this.el.live.textContent = text;
    }
  }

  root.Game2048.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);