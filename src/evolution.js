'use strict';
// Stage 6 — EVOLUTION. Stop hand-tuning the RL meta-params; SELECT them. A population of PERSISTENT
// forager individuals — each a genome PLUS its own learned Q-tables — is evaluated over several
// shared-map runs per generation; fitness = food foraged; the top breed, the bottom are culled. Over
// generations the genome (the meta-params we've been tuning by hand: ε, α, γ, … later reward weights
// and evolved instincts) is optimised by selection, while individuals keep LEARNING within and across
// their lives. This file is the v1a foundation.
//
// Evaluation regime (Chris, 2026-07-23):
//   • K = evoRuns runs per generation, each on a SHARED map (all individuals face the same K worlds →
//     fair, low-noise scoring). Everyone plays all K maps, one per run.
//   • Each run the population is RESHUFFLED and split into BATCHES of evoBatchSize — different
//     co-inhabitants each run (competition/interaction decorrelated from any one pairing).
//   • Policies PERSIST across the K runs, so an individual keeps learning through its whole generation.
//   • SURVIVORS keep their trained Q-tables across generations (Lamarckian); NEWBORNS get a fresh one.
//   • JUVENILE PROTECTION: a newborn (age < evoProtect generations) forages & learns & is scored but is
//     exempt from culling, so its fresh table has time to catch up before it's judged.
//
// EvoWorld REUSES World's grid / sensing / applyAction unchanged (per tick it aims the world's single-
// agent ax/ay + the global ε/α/γ at each forager, calls that forager's own policy.act, reads back its
// move + food delta as fitness). No fork of the sim core. Renewable food, time-boxed lifetime; shelter/
// pits/goats stay OFF in v1a. Declared `var X = class X` / `var f = function` so they're globals in the
// browser AND the headless main realm (indirect-eval loader) — same contract as the rest of src/.

// --- Genome: the evolvable meta-params. One flat record of numbers → serialises cleanly for the DB.
// GENES centralises each gene's bounds + mutation scale + the range initial genomes are drawn from,
// so random()/mutate()/clamp stay DRY as we add genes (reward weights, instinct vectors) in v1b.
var evoClamp = function (x, lo, hi) { return Math.max(lo, Math.min(hi, x)); };

var Genome = class Genome {
  constructor(values, vectors) {
    for (const k in Genome.GENES) this[k] = values[k];
    for (const k in Genome.VGENES) this[k] = vectors[k];   // per-ACTION vectors (length nActions)
  }

  static random(nActions) {
    const rnd = (g) => { const lo = g.init ? g.init[0] : 0, hi = g.init ? g.init[1] : 1; return lo + Math.random() * (hi - lo); };
    const v = {}; for (const k in Genome.GENES) v[k] = rnd(Genome.GENES[k]);
    const vec = {};
    for (const k in Genome.VGENES) { const g = Genome.VGENES[k]; vec[k] = []; for (let a = 0; a < nActions; a++) vec[k].push(rnd(g)); }
    return new Genome(v, vec);
  }

  clone() {
    const v = {}, vec = {};
    for (const k in Genome.GENES) v[k] = this[k];
    for (const k in Genome.VGENES) vec[k] = this[k].slice();
    return new Genome(v, vec);
  }

  // uniform crossover: each gene (and each element of a vector gene) independently from one parent
  crossover(other) {
    const v = {}, vec = {};
    for (const k in Genome.GENES) v[k] = Math.random() < 0.5 ? this[k] : other[k];
    for (const k in Genome.VGENES) { vec[k] = this[k].map((x, a) => (Math.random() < 0.5 ? x : other[k][a])); }
    return new Genome(v, vec);
  }

  // Gaussian mutation in NORMALIZED [0,1] space with a SINGLE global sd (Genome.MUT_SD) — one magic
  // number for all genes, since every gene lives on the same [0,1] scale. `rate` = per-gene perturb prob.
  mutate(rate) {
    const mut = (x) => (Math.random() < rate ? evoClamp(x + gaussian() * Genome.MUT_SD, 0, 1) : x);
    const v = {}, vec = {};
    for (const k in Genome.GENES) v[k] = mut(this[k]);
    for (const k in Genome.VGENES) vec[k] = this[k].map(mut);
    return new Genome(v, vec);
  }

  // express a stored NORMALIZED [0,1] gene to its actual [min,max] value
  expr(k) { const g = Genome.GENES[k]; return g.min + this[k] * (g.max - g.min); }
  exprVec(k) { const g = Genome.VGENES[k]; return this[k].map((x) => g.min + x * (g.max - g.min)); }

  // precompute the flat NUMERIC cfg an agent runs off of — learning params + felt-reward weights + the
  // per-action instinct vector. Installed once per run (setCfg), so the hot loop reads plain numbers.
  express() {
    return {
      alpha: this.expr('alpha'), gamma: this.expr('gamma'), epsilon: this.expr('epsilon'),
      confidenceK: this.expr('confidenceK'), defaultQ: 0,
      rewardGather: this.expr('rewardGather'), rewardStep: this.expr('rewardStep'),
      rewardRest: this.expr('rewardRest'), rewardPit: this.expr('rewardPit'), restExponent: this.expr('restExponent'),
      rewardReproduce: this.expr('rewardReproduce'),
      initialQ: PARAMETERS.evoUseInstincts ? this.exprVec('initialQ') : null,   // instinct off → null (getQ falls back to defaultQ)
    };
  }
};
// Genes are stored NORMALIZED in [0,1] and expressed to `[min,max]` on read; a single global mutation sd
// (Genome.MUT_SD) covers them all. `init` (optional, in [0,1]) narrows the initial draw; default = full
// range → evolution starts with maximal freedom. Reward genes share [-1,1] with NO forced sign (locking
// rewardStep negative / rewardGather positive would pre-constrain evolution). The reward genes are the
// FELT reward the agent LEARNS on; fitness is the TRUE objective, never the felt reward — so evolution
// can't cheat by inflating a weight, only pick weights whose learned policy forages/banks best.
Genome.MUT_SD = 0.1;
Genome.GENES = {
  epsilon:      { min: 0,  max: 1     }, // ε-greedy rate
  alpha:        { min: 0,  max: 1     }, // learning rate
  gamma:        { min: 0,  max: 0.999 }, // discount (not 1)
  rewardGather: { min: -1, max: 1     }, // felt: value of an eat/drink
  rewardStep:   { min: -1, max: 1     }, // felt: cost/reward of a move / failed act
  rewardRest:   { min: -1, max: 1     }, // felt: rest banks rewardRest · stock^restExponent
  rewardPit:    { min: -1, max: 1     }, // felt: reward on entering a pit (a reward like any other — can be negative)
  restExponent: { min: 0,  max: 2     }, // exponent on stock in the rest reward (was hardcoded 2)
  rewardReproduce: { min: -1, max: 1, init: [0.6, 1.0] }, // felt reward for the REPRODUCE action (ecology). init
                                                          //   positive so the founding population breeds; then selected.
  confidenceK:  { min: 1,  max: 100   }, // layered coupling: count→confidence saturation
};
// per-ACTION vector gene — the single evolved INSTINCT: initialQ[a] = the prior VALUE of an unseen
// (state, a). A positive prior makes action a worth trying before any experience (and propagates via the
// bootstrap). On the same [-1,1] reward scale. (unexploredBonus dropped — initialQ subsumes it.)
Genome.VGENES = {
  initialQ: { min: -1, max: 1 },
};

// standard-normal sample (Box–Muller). Uses Math.random, so a seeded harness makes it deterministic.
var gaussian = function () {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// --- a persistent INDIVIDUAL: a genome + its OWN learned policy (Q-tables) that survive across the
// generation's runs and, if it survives selection, across generations (Lamarckian). `age` = generations
// lived (drives juvenile protection); `fitness` accumulates over a generation's runs and resets each gen.
var makeIndividual = function (genome, nActions) {
  const policy = makeAgent(nActions);
  const ind = { genome, policy, age: 0, fitness: 0, cfg: genome.express() };  // precompute the numeric cfg ONCE
  if (policy.setCfg) policy.setCfg(ind.cfg);
  return ind;
};

// --- a shared MAP: a fixed food layout + spawn cells, generated once per run and REPLAYED (cloned) for
// every batch in that run, so all individuals are scored on identical worlds.
var makeMap = function () {
  const w = new World(800, 600), N = w.N, spawns = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (w.grid[y][x] === World.EMPTY) spawns.push(y * N + x);
  for (let i = spawns.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = spawns[i]; spawns[i] = spawns[j]; spawns[j] = t; }
  return { N, grid: w.grid.map((r) => r.slice()), spawns };
};

// --- EvoWorld: runs ONE batch of persistent individuals on a clone of a shared map for one lifetime.
// Leans entirely on World's mechanics; the only overrides are gatherResult (renewable, non-terminal
// food) and the multi-forager stepping.
var EvoWorld = class EvoWorld extends World {
  constructor(batch, map, evalMode) {
    super(800, 600);                                 // World ctor builds a throwaway grid + agent
    this.evalMode = !!evalMode;                       // eval: freeze ε/α + drop the exploration bonus (read the LEARNED policy)
    this.N = map.N;
    this.grid = map.grid.map((r) => r.slice());      // fresh copy so batches never mutate the shared map
    this.goats = []; this.goatAt = new Array(this.N * this.N).fill(-1);
    this.remaining = 1e9;                             // renewable — never "cleared" (FINITE so rest's restStickC·remaining ≠ NaN)
    this.food = 0; this.water = 0; this.tick = 0; this.deaths = 0;
    this.foragers = batch.map((ind, i) => {
      // install this individual's precomputed cfg on its agent ONCE per run — frozen (ε=0, α=0) for the
      // greedy eval, so we read the LEARNED policy without exploration or further learning.
      if (ind.policy.setCfg) ind.policy.setCfg(this.evalMode ? Object.assign({}, ind.cfg, { epsilon: 0, alpha: 0 }) : ind.cfg);
      const c = map.spawns[i % map.spawns.length];
      return { x: c % this.N, y: (c / this.N) | 0, ind, carry: 0, done: false };
    });
    // CENTRAL-PLACE mode: MULTIPLE placed shelters on an evenly-spaced grid, HIDDEN until the last
    // quarter of the lifetime. NO INT layer / NO bearing (the no-INT finding) — a forager finds a shelter
    // only by SEEING a SHELTER cell in its receptive window (a spatial reflex). Multiple spaced shelters
    // raise the chance a seeking forager stumbles one into view. Rest banks carried stock (= fitness).
    this.shelterCells = [];
    if (PARAMETERS.enableShelter) {
      const g = PARAMETERS.evoShelterGrid, N = this.N;
      for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
        const x = Math.floor(N * (i + 0.5) / g), y = Math.floor(N * (j + 0.5) / g);
        if (this.grid[y][x] === World.SHELTER) continue;
        this.grid[y][x] = World.EMPTY;                // reserve the cell (revealed to SHELTER at the last quarter)
        this.shelterCells.push([x, y]);
      }
      this.shelterActive = false;
    }
    // renewable STATIONARY prey: goats as fixed hunt targets placed after the foragers. Stationary
    // because 5a already ruled prey MOTION out as the barrier (credit assignment was) — keep it clean.
    this.nGoatTarget = PARAMETERS.enableGoats ? PARAMETERS.nGoats : 0;
    for (let i = 0; i < this.nGoatTarget; i++) {
      const c = map.spawns[(this.foragers.length + i) % map.spawns.length];
      const x = c % this.N, y = (c / this.N) | 0;
      if (this.goatIndexAt(x, y) < 0) { this.goats.push({ x, y, alive: true, lastStates: null, lastAction: -1 }); this.goatAt[y * this.N + x] = this.goats.length - 1; }
    }
  }

  // eating is renewable + never ends the day: drop the item back on a random empty cell and continue.
  gatherResult() { this.respawnResource(World.FOOD); return { reward: PARAMETERS.rewardGather, done: false, event: 'gather' }; }

  // one forager's turn: aim the world's single-agent view + global RL rates at THIS individual, let its
  // own persistent policy act, then read back its new position and food gained.
  // tick-based time-of-day (overrides World's steps-based one): the INT layer's "how much of the
  // lifetime is left" signal — what makes "forage now, head home before the shelter closes" learnable.
  timeCode() {
    const B = PARAMETERS.timeBuckets, rem = PARAMETERS.evoLifetime - this.tick;
    let b = Math.floor((rem / PARAMETERS.evoLifetime) * B);
    if (b >= B) b = B - 1; if (b < 0) b = 0;
    return b.toString(36);
  }

  stepForager(f) {
    // the agent already holds its precomputed cfg (installed once per run in the constructor) — NO
    // per-tick global writes. It computes its own felt reward and reads α/γ/ε/initialQ off that cfg.
    this.ax = f.x; this.ay = f.y;
    this.food = f.carry;                              // present THIS forager's carried stock (rest banks stock², satiety senses it)
    const before = this.food;
    const out = f.ind.policy.act(this);
    f.x = this.ax; f.y = this.ay; f.carry = this.food;
    if (out.died) this.deaths++;                      // entered a pit (terminal) — a death this run
    if (PARAMETERS.enableShelter) {
      // central-place: fitness accrues only when BANKED at rest; a collapse / pit-death / never-resting banks nothing
      if (out.done) { f.done = true; if (out.rested) f.ind.fitness += f.carry; f.carry = 0; }
    } else {
      if (out.done) { f.done = true; f.carry = 0; }  // e.g. pit death in food mode — stop stepping this forager
      else f.ind.fitness += this.food - before;      // renewable food mode: fitness = food eaten as it's eaten
    }
  }

  // one lifetime tick: open the shelters at the last quarter, step every live forager, top up prey.
  // Exposed as a single step so the browser can animate a run frame-by-frame (see EvoRunner in main.js).
  tickOnce() {
    const reveal = PARAMETERS.enableShelter ? Math.floor((1 - PARAMETERS.evoShelterFrac) * PARAMETERS.evoLifetime) : -1;
    if (this.tick === reveal) { for (let s = 0; s < this.shelterCells.length; s++) this.grid[this.shelterCells[s][1]][this.shelterCells[s][0]] = World.SHELTER; this.shelterActive = true; } // shelters open
    for (let i = 0; i < this.foragers.length; i++) if (!this.foragers[i].done) this.stepForager(this.foragers[i]);
    if (this.nGoatTarget) this.respawnGoats();       // keep prey density up so hunting stays available
    this.tick++;
  }

  runLifetime() { while (this.tick < PARAMETERS.evoLifetime) this.tickOnce(); return this.foragers; }

  foragerAt(x, y) { for (let i = 0; i < this.foragers.length; i++) if (this.foragers[i].x === x && this.foragers[i].y === y) return true; return false; }

  // top the prey back up to nGoatTarget on empty, unoccupied cells (renewable hunt targets)
  respawnGoats() {
    let alive = 0; for (let i = 0; i < this.goats.length; i++) if (this.goats[i].alive) alive++;
    while (alive < this.nGoatTarget) {
      let c = -1, tries = 0;
      while (tries++ < 30) { const k = randomInt(this.N * this.N), x = k % this.N, y = (k / this.N) | 0;
        if (this.grid[y][x] === World.EMPTY && this.goatIndexAt(x, y) < 0 && !this.foragerAt(x, y)) { c = k; break; } }
      if (c < 0) break;
      const x = c % this.N, y = (c / this.N) | 0;
      this.goats.push({ x, y, alive: true, lastStates: null, lastAction: -1 }); this.goatAt[y * this.N + x] = this.goats.length - 1; alive++;
    }
  }
};

// in-place Fisher–Yates (seeded Math.random → deterministic under a seeded harness)
var evoShuffle = function (a) {
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
};

// --- evaluate the whole population: K shared-map runs; each run reshuffle + split into batches; policies
// persist across runs so learning accumulates; fitness sums over the runs (reset at the start).
var evaluatePopulation = function (pop) {
  for (const A of pop) A.fitness = 0;
  const K = PARAMETERS.evoRuns, B = PARAMETERS.evoBatchSize;
  for (let r = 0; r < K; r++) {
    const map = makeMap();                            // one shared world for this run — everyone plays it
    const order = evoShuffle(pop.slice());
    for (let i = 0; i < order.length; i += B) new EvoWorld(order.slice(i, i + B), map).runLifetime();
  }
};

// --- discrete generations with overlapping survivors: rank by fitness; only MATURE individuals (age ≥
// evoProtect) are cull-eligible; cull the worst mature up to evoCull·P; survivors age and KEEP their
// tables; breed newborns (fresh table, age 0) from the fittest survivors to refill to P.
var nextGeneration = function (pop, nActions) {
  const P = pop.length;
  const byFitAsc = pop.slice().sort((a, b) => a.fitness - b.fitness);
  const cullTarget = Math.round(P * PARAMETERS.evoCull), cull = new Set();
  // OLD AGE first: anyone who has reached evoMaxAge dies regardless of fitness — so no immortal/dominant
  // elite can hold the population (and its neutral genes) frozen forever.
  for (const A of pop) if (A.age >= PARAMETERS.evoMaxAge) cull.add(A);
  // then the fitness cull: among the worst cullTarget SLOTS, cull only the MATURE (age ≥ evoProtect) —
  // protected newborns in the bottom are spared, and top-fitness elites are never in the worst set.
  for (let i = 0; i < cullTarget && i < byFitAsc.length; i++) if (byFitAsc[i].age >= PARAMETERS.evoProtect) cull.add(byFitAsc[i]);
  let survivors = pop.filter((A) => !cull.has(A));
  if (survivors.length < 2) survivors = byFitAsc.slice(-2);   // never let the breeding pool collapse (e.g. if a whole cohort ages out at once)
  const parents = survivors.slice().sort((a, b) => b.fitness - a.fitness);
  const nParents = Math.max(2, Math.ceil(parents.length / 2));   // breed from the fitter half of survivors
  for (const A of survivors) A.age++;                            // survivors age; their learned tables persist
  const next = survivors.slice();
  while (next.length < P) {
    const a = parents[randomInt(nParents)].genome, b = parents[randomInt(nParents)].genome;
    next.push(makeIndividual(a.crossover(b).mutate(PARAMETERS.evoMutRate), nActions));
  }
  return next;
};

// per-generation summary: fitness spread, mean age (how much of the population is experienced), and
// where the genes currently sit (what evolution is CHOOSING for the params we used to hand-tune).
var genStats = function (pop) {
  const P = pop.length, fits = pop.map((A) => A.fitness).sort((a, b) => b - a);
  const mean = fits.reduce((a, b) => a + b, 0) / P;
  const g = {}; for (const k in Genome.GENES) g[k] = 0;
  const nA = pop[0].genome.initialQ.length, vg = {};
  for (const k in Genome.VGENES) vg[k] = new Array(nA).fill(0);
  let age = 0;
  for (const A of pop) {
    for (const k in g) g[k] += A.genome.expr(k);                        // report EXPRESSED (actual) values
    for (const k in vg) { const ev = A.genome.exprVec(k); for (let a = 0; a < nA; a++) vg[k][a] += ev[a]; }
    age += A.age;
  }
  for (const k in g) g[k] /= P;
  for (const k in vg) for (let a = 0; a < nA; a++) vg[k][a] /= P;
  return { mean, best: fits[0], worst: fits[P - 1], meanAge: age / P, genes: g, vgenes: vg };
};

// the whole loop: seed a random population of individuals, evolve nGenerations, return the per-generation
// history (stats captured AFTER evaluation, BEFORE breeding, so they reflect the generation just scored).
var evolve = function (nGenerations, popSize) {
  const nActions = World.buildActions().length;
  let pop = [];
  for (let i = 0; i < popSize; i++) pop.push(makeIndividual(Genome.random(nActions), nActions));
  const history = [];
  for (let gen = 0; gen < nGenerations; gen++) {
    evaluatePopulation(pop);
    history.push(genStats(pop));
    pop = nextGeneration(pop, nActions);
  }
  return { history, pop };
};

// read the LEARNED policy (5a lesson: freeze exploration + learning, don't infer from training-blended
// metrics). Run the evolved population greedy (ε=0, α=0, no exploration bonus) over nRuns shared-map
// runs and count hunts (goatsKilled) + food. Learning is frozen so tables/fitness aren't disturbed.
var greedyEval = function (pop, nRuns) {
  const B = PARAMETERS.evoBatchSize;
  let kills = 0, foodSum = 0, deaths = 0;
  for (const A of pop) A.fitness = 0;
  for (let r = 0; r < nRuns; r++) {
    const map = makeMap();
    const order = evoShuffle(pop.slice());
    for (let i = 0; i < order.length; i += B) { const w = new EvoWorld(order.slice(i, i + B), map, true); w.runLifetime(); kills += w.goatsKilled; deaths += w.deaths; }
  }
  for (const A of pop) foodSum += A.fitness;
  return { killsPerRun: kills / nRuns, foodPerRun: foodSum / nRuns, deathsPerRun: deaths / nRuns };
};
