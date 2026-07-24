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
function startEvolution() {
  gameEngine.clear();
  evoRunner = new EvoRunner(graphCtx());
  gameEngine.add(evoRunner);
  if (typeof setStatus === 'function') setStatus('evolving — ' + PARAMETERS.gridN + '×' + PARAMETERS.gridN + ' · pop ' + PARAMETERS.evoPopSize);
}

// --- Browser ecology viz (Stage 7). A GameEngine entity that runs the continuous natural-selection
// ecology — update() advances one tick (× updatesPerDraw per frame via the Speed knob) and draws the
// living population, a population-over-time curve, and a gene readout. No GA — just survive + reproduce.
// the scalar genes shown as distribution heat-strips (initialQ vector genes excluded for now)
var ECO_HIST_GENES = ['epsilon', 'alpha', 'gamma', 'rewardGather', 'rewardStep', 'rewardRest', 'rewardPit', 'restExponent', 'rewardReproduce', 'confidenceK'];

var EcoRunner = class EcoRunner {
  constructor(graphCtx, qCtx, q3Ctx) {
    this.graphCtx = graphCtx; this.qCtx = qCtx; this.q3Ctx = q3Ctx;
    const genomes = [];
    for (let i = 0; i < PARAMETERS.ecoPop0; i++) genomes.push(Genome.random(ECO_ACTIONS.length));
    this.world = new EcoWorld(genomes);
    this.popHist = []; this.last = null;
    // one distribution heat-strip per scalar gene, laid out across the two data canvases (5 each)
    this.histos = [];
    const per = Math.ceil(ECO_HIST_GENES.length / 2);
    for (let i = 0; i < ECO_HIST_GENES.length; i++) {
      const onQ = i < per, row = onQ ? i : i - per;
      const h = new Histogram(6, row * 76 + 6, 330, 62, { label: ECO_HIST_GENES[i], data: [], means: [] });
      this.histos.push({ gene: ECO_HIST_GENES[i], hist: h, ctx: onQ ? this.qCtx : this.q3Ctx });
    }
  }
  update() {
    this.world.advance();
    if (this.world.time % PARAMETERS.ecoSampleEvery === 0) {   // coarser sampling → strips span more time
      this.last = this.world.snapshot();
      this.popHist.push(this.last); if (this.popHist.length > 400) this.popHist.shift();
      this.sampleGenes();
    }
  }
  // bucket each gene's EXPRESSED value across the population into NB bins over the gene's [min,max] range,
  // and record the normalised population mean — one snapshot per sample, pushed into each strip's data.
  sampleGenes() {
    const NB = 16, agents = this.world.agents, n = agents.length;
    for (const gh of this.histos) {
      const spec = Genome.GENES[gh.gene], b = new Array(NB).fill(0); let sum = 0;
      for (const a of agents) {
        const v = a.genome.expr(gh.gene); let bk = Math.floor((v - spec.min) / (spec.max - spec.min) * NB);
        bk = bk < 0 ? 0 : bk >= NB ? NB - 1 : bk; b[bk]++; sum += v;
      }
      gh.hist.data.push(b);
      gh.hist.means.push(n ? ((sum / n) - spec.min) / (spec.max - spec.min) : 0.5);
      if (gh.hist.data.length > gh.hist.width) { gh.hist.data.shift(); gh.hist.means.shift(); }
    }
  }
  draw(ctx) {
    drawEcoWorld(ctx, this.world);
    if (!this.last) return;
    drawEcoCurve(this.graphCtx, this.popHist);
    renderEcoReadout(this.last);
    if (this.qCtx) this.qCtx.clearRect(0, 0, this.qCtx.canvas.width, this.qCtx.canvas.height);
    if (this.q3Ctx) this.q3Ctx.clearRect(0, 0, this.q3Ctx.canvas.width, this.q3Ctx.canvas.height);
    for (const gh of this.histos) if (gh.ctx) gh.hist.draw(gh.ctx);
  }
};

var ecoRunner = null;
function startEcology() {
  gameEngine.clear();
  const qc = document.getElementById('qCanvas'), q3c = document.getElementById('q3Canvas');
  ecoRunner = new EcoRunner(graphCtx(), qc && qc.getContext('2d'), q3c && q3c.getContext('2d'));
  gameEngine.add(ecoRunner);
  if (typeof setStatus === 'function') setStatus('ecology — ' + PARAMETERS.gridN + '×' + PARAMETERS.gridN + ' · founding pop ' + PARAMETERS.ecoPop0);
}

function graphCtx() { return document.getElementById('graphCanvas').getContext('2d'); }

// --- Tabs: each tab is a sim MODE with its own controls. Selecting a tab switches the running mode
// (Sim / Evolution / Ecology) and shows only that mode's inputs.
var currentTab = 'sim';
function buildAllTabs() {
  buildTab(PARAM_SCHEMA, document.getElementById('panel-sim'), function () { if (currentTab === 'sim') reset(); });
  buildTab(EVO_SCHEMA, document.getElementById('panel-evo'), function () { if (currentTab === 'evo') startEvolution(); });
  buildTab(ECO_SCHEMA, document.getElementById('panel-eco'), function () { if (currentTab === 'eco') startEcology(); });
}
function selectTab(name) {
  currentTab = name;
  if (name === 'eco' && PARAMETERS.gridN < 20) PARAMETERS.gridN = 30;   // a roomy arena for a population
  syncControls();
  for (const t of ['sim', 'evo', 'eco']) {
    const p = document.getElementById('panel-' + t); if (p) p.style.display = t === name ? '' : 'none';
    const b = document.getElementById('tab-' + t); if (b) b.className = 'tab' + (t === name ? ' active' : '');
  }
  evoRunner = null; ecoRunner = null;
  if (name === 'sim') reset();
  else if (name === 'evo') startEvolution();
  else if (name === 'eco') startEcology();
}

window.onload = function () {
  const canvas = document.getElementById('gameWorld');
  gameEngine = new GameEngine();
  gameEngine.init(canvas.getContext('2d'));
  buildAllTabs();
  selectTab('sim');
  gameEngine.start();
};
