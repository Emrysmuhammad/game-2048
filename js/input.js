(function (root) {
  'use strict';

  const KEY_TO_DIRECTION = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down'
  };

  /**
   * Turns keyboard, touch and mouse actions into two callbacks:
   *   onMove('left' | 'right' | 'up' | 'down')
   *   onUndo()
   */
  const Input = {
    bind(boardEl, handlers, config) {
      // ----- keyboard -----
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;

        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (KEY_TO_DIRECTION[key]) {
          event.preventDefault();          // stops the page from scrolling
          handlers.onMove(KEY_TO_DIRECTION[key]);
        } else if (key === 'u') {
          handlers.onUndo();
        }
      });

      // ----- swipe (touch) and drag (mouse) on the board -----
      let start = null;

      boardEl.addEventListener('pointerdown', (event) => {
        start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      });

      // Listen on the document so releasing outside the board still counts
      document.addEventListener('pointerup', (event) => {
        if (!start || event.pointerId !== start.id) return;

        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        start = null;

        if (Math.max(Math.abs(dx), Math.abs(dy)) < config.SWIPE_THRESHOLD) return;

        if (Math.abs(dx) > Math.abs(dy)) {
          handlers.onMove(dx > 0 ? 'right' : 'left');
        } else {
          handlers.onMove(dy > 0 ? 'down' : 'up');
        }
      });

      document.addEventListener('pointercancel', () => { start = null; });
    }
  };

  root.Game2048.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);