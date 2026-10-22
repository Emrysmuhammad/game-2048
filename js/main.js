(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const { UI, App, Input, Config } = window.Game2048;

    const ui = new UI(document);
    const app = new App(ui);

    // Keyboard, swipe and drag
    Input.bind(
      ui.el.board,
      {
        onMove: (direction) => app.move(direction),
        onUndo: () => app.undo()
      },
      Config
    );

    // Buttons
    ui.el.undo.addEventListener('click', () => app.undo());
    ui.el.newGame.addEventListener('click', () => app.newGame());
    ui.el.retry.addEventListener('click', () => app.newGame());
    ui.el.keep.addEventListener('click', () => app.keepGoing());

    window.game2048 = app; // handy for debugging in the console
  });
})();