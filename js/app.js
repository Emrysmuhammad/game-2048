(function (root) {
  'use strict';

  const { Config, Game, loadBest, saveBest, loadState, saveState } = root.Game2048;

  /**
   * The controller: it receives the player's actions, asks the Game to apply
   * the rules, then tells the UI what to draw and saves the result.
   */
  class App {
    constructor(ui) {
      this.ui = ui;
      this.overlayTimer = null;

      // Continue the saved game if there is a valid one, otherwise start fresh
      this.game = Game.fromState(loadState(), Config.SIZE) || new Game(Config.SIZE);
      this.best = Math.max(loadBest(), this.game.score);

      this.refresh();
      this.syncOverlay(false);
    }

    // ---------- player actions ----------

    move(direction) {
      if (this.game.isLocked()) return;

      const result = this.game.move(direction);
      if (!result.moved) return;

      this.ui.render(this.game.tiles, { consumed: result.consumed });
      this.ui.setScore(this.game.score);
      if (result.gained > 0) this.ui.showGain(result.gained);

      if (this.game.score > this.best) {
        this.best = this.game.score;
        saveBest(this.best);
        this.ui.setBest(this.best);
      }

      this.ui.setUndoEnabled(this.game.canUndo());
      this.ui.setBoardLabel(this.game.toGrid());
      this.ui.announce('Score ' + this.game.score);

      saveState(this.game.toState());
      this.syncOverlay(true);
    }

    undo() {
      if (!this.game.undo()) return;
      this.refresh();
      saveState(this.game.toState());
      this.syncOverlay(false);
    }

    newGame() {
      this.game = new Game(Config.SIZE);
      this.refresh();
      saveState(this.game.toState());
      this.syncOverlay(false);
    }

    /** After winning: carry on playing for a higher score. */
    keepGoing() {
      this.game.continueAfterWin();
      saveState(this.game.toState());
      this.syncOverlay(false);
    }

    // ---------- drawing ----------

    /** Redraw everything from the current game (no slide animation). */
    refresh() {
      this.ui.render(this.game.tiles);
      this.ui.setScore(this.game.score);
      this.ui.setBest(this.best);
      this.ui.setUndoEnabled(this.game.canUndo());
      this.ui.setBoardLabel(this.game.toGrid());
    }

    /**
     * Show the win or game-over message when it applies, otherwise hide it.
     * After a move it appears a moment later so the tile animation can finish.
     */
    syncOverlay(delayed) {
      clearTimeout(this.overlayTimer);

      let kind = null;
      if (this.game.over) kind = 'over';
      else if (this.game.won && !this.game.keepPlaying) kind = 'won';

      if (!kind) {
        this.ui.hideOverlay();
        return;
      }

      const show = () => this.ui.showOverlay(kind, this.game.score);
      if (delayed) this.overlayTimer = setTimeout(show, Config.OVERLAY_DELAY_MS);
      else show();
    }
  }

  root.Game2048.App = App;
})(typeof window !== 'undefined' ? window : globalThis);