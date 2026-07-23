'use strict';
// Browser entry + wiring (not loaded headlessly). reset() rebuilds the world from the
// current PARAMETERS; the boot sequence is straight — no AssetManager gate.
var gameEngine, world, dataManager, db;

function reset() {
  gameEngine.clear();
  const cv = gameEngine.ctx.canvas;
  world = new World(cv.width, cv.height);
  const gc = document.getElementById('graphCanvas');
  const graph = new LineGraph(4, 4, gc.width - 8, gc.height - 8, world.metricLabel());
  db = createDB(PARAMETERS.db);
  dataManager = new DataManager(world, db, graph);
  gameEngine.add(world);
  gameEngine.add(new Observer(world));
  gameEngine.add(dataManager);
  const qc = document.getElementById('qCanvas');
  const q3c = document.getElementById('q3Canvas');
  gameEngine.add(new DataView(world, graph, gc.getContext('2d'),
    qc && qc.getContext('2d'), q3c && q3c.getContext('2d'))); // stats + graph + 1×1 & 3×3 Q-views
  if (typeof setStatus === 'function') setStatus('foraging — ' + world.N + '×' + world.N + ' grid');
}

// --- Browser evolution viz. A GameEngine entity that animates the current population foraging one
// lifetime (update() steps one tick; the engine calls it updatesPerDraw× per frame → the Speed knob
// drives it), then advances one generation (score → cull/breed) and starts the next run. This is a
// SIMPLIFIED single-run-per-generation loop for smooth watching; evofull/evohunt/evoshelter.mjs are
// the faithful K-run science. Reads the current PARAMETERS, so the panel toggles configure the world.
var EvoRunner = class EvoRunner {
  constructor(graphCtx) {
    this.graphCtx = graphCtx;
    this.nActions = World.buildActions().length;
    this.pop = [];
    for (let i = 0; i < PARAMETERS.evoPopSize; i++) this.pop.push(makeIndividual(Genome.random(this.nActions), this.nActions));
    this.gen = 0; this.history = [];
    this.newRun();
  }

  newRun() { for (const A of this.pop) A.fitness = 0; this.show = new EvoWorld(this.pop, makeMap()); }

  update() {
    if (this.show.tick < PARAMETERS.evoLifetime) { this.show.tickOnce(); return; }
    this.history.push(genStats(this.pop));            // this run WAS the generation's evaluation
    this.pop = nextGeneration(this.pop, this.nActions);
    this.gen++;
    this.newRun();
  }

  draw(ctx) {
    drawEvoWorld(ctx, this.show);
    if (this.history.length) { drawEvoCurve(this.graphCtx, this.history); renderEvoReadout(this.history[this.history.length - 1], this.gen); }
  }
};

var evoRunner = null;
function toggleEvolution() {
  if (evoRunner) { evoRunner = null; reset(); return; }   // back to the normal single-agent sim
  gameEngine.clear();
  evoRunner = new EvoRunner(document.getElementById('graphCanvas').getContext('2d'));
  gameEngine.add(evoRunner);
  if (typeof setStatus === 'function') setStatus('evolving — ' + PARAMETERS.gridN + '×' + PARAMETERS.gridN + ' · pop ' + PARAMETERS.evoPopSize);
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildControls();
  reset();
  gameEngine.start();
};
