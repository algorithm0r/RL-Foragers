'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS; the boot sequence is straight — no AssetManager gate.
var gameEngine, world, dataManager, db;

function reset() {
  gameEngine.clear();
  const cv = gameEngine.ctx.canvas;
  world = new World(cv.width, cv.height);
  const graph = new LineGraph(cv.width - 190, cv.height - 110, 180, 90, 'steps to clear');
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db, graph);
  gameEngine.add(world);
  gameEngine.add(new Observer(world));
  gameEngine.add(dataManager);
  gameEngine.add(graph);
  if (typeof setStatus === 'function') setStatus('foraging — ' + world.N + '×' + world.N + ' grid');
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildControls();
  reset();
  gameEngine.start();
};
