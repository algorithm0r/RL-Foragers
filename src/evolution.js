'use strict';
// Stage 6 — EVOLUTION. Stop hand-tuning the RL meta-params; SELECT them. A fixed population of
// foragers shares one renewable world for a time-boxed lifetime; fitness = food foraged; the top
// reproduce (crossover + mutation), the bottom are culled; over generations the genome — the
// meta-params we've been tuning by hand (ε, α, γ, … later the reward weights and evolved instincts)
// — is optimised by selection. This file is the v1a foundation: the loop, proven to raise fitness.
//
// Design (v1a, minimal-but-real):
//   • Genome = {epsilon, alpha, gamma}  (real genes with a known-good regime, so selection is legible)
//   • EvoWorld extends World and REUSES its grid / sensing / applyAction. Each tick it points the
//     world's single-agent slots (ax/ay) and the global ε/α/γ at each forager in turn, calls the
//     forager's own agent.act(this), and reads back its move + food delta as fitness. No fork.
//   • Per-agent Q-tables (each forager owns a makeAgent()), learning INDEPENDENTLY. Update-broadcast
//     / culture (Chris's hunting-culture hypothesis) is a later gene — deferred to v1c.
//   • Renewable + time-boxed: eating RESPAWNS the item elsewhere (gatherResult override) and never
//     clears/terminates; the lifetime is a fixed tick budget. Shelter/pits/goats stay OFF in v1a.
// Declared `var X = class X` / `var f = function` so they're globals in the browser AND the headless
// main realm (indirect-eval loader) — same contract as the rest of src/.

// --- Genome: the evolvable meta-params. One flat record of numbers → serialises cleanly for the DB.
// GENES centralises each gene's bounds + mutation scale + the range initial genomes are drawn from,
// so random()/mutate()/clamp stay DRY as we add genes (reward weights, instinct vectors) in v1b.
var Genome = class Genome {
  constructor(values) { for (const k in Genome.GENES) this[k] = values[k]; }

  static random() {
    const v = {};
    for (const k in Genome.GENES) { const g = Genome.GENES[k]; v[k] = g.init[0] + Math.random() * (g.init[1] - g.init[0]); }
    return new Genome(v);
  }

  clone() { const v = {}; for (const k in Genome.GENES) v[k] = this[k]; return new Genome(v); }

  // uniform crossover: each gene independently inherited from one parent or the other
  crossover(other) {
    const v = {};
    for (const k in Genome.GENES) v[k] = Math.random() < 0.5 ? this[k] : other[k];
    return new Genome(v);
  }

  // Gaussian mutation per gene (scaled by the gene's sd), clamped to bounds. `rate` = per-gene
  // probability of being perturbed. Returns a NEW genome (parents are never mutated in place).
  mutate(rate) {
    const v = {};
    for (const k in Genome.GENES) {
      const g = Genome.GENES[k];
      let x = this[k];
      if (Math.random() < rate) x += gaussian() * g.sd;
      v[k] = Math.max(g.min, Math.min(g.max, x));
    }
    return new Genome(v);
  }
};
// gene → { bounds, mutation sd, [init lo, init hi] }. Init ranges span the good regime AND a lot of
// bad, so a working loop VISIBLY concentrates the population toward what we already know works
// (ε small-positive, α moderate, γ high) — the loop's own sanity check.
Genome.GENES = {
  epsilon: { min: 0,    max: 1,     sd: 0.04, init: [0.0,  0.5]  },
  alpha:   { min: 0.01, max: 1,     sd: 0.05, init: [0.02, 0.6]  },
  gamma:   { min: 0.5,  max: 0.999, sd: 0.03, init: [0.6,  0.99] },
};

// standard-normal sample (Box–Muller). Uses Math.random, so a seeded harness makes it deterministic.
var gaussian = function () {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// --- EvoWorld: a World driven in multi-forager, renewable, time-boxed mode. It leans entirely on
// World's mechanics (grid build, senseWindow, applyAction) — the ONLY overrides are (a) gatherResult,
// to make food renewable and eating non-terminal, and (b) the stepping, to drive P foragers per tick.
var EvoWorld = class EvoWorld extends World {
  constructor(genomes) {
    super(800, 600);            // World ctor builds the grid + a throwaway single agent; we repopulate
    this.initPopulation(genomes);
  }

  // lay P foragers on distinct empty cells; each OWNS its agent (its own Q-tables). food/water are the
  // shared running eat-counters we diff per forager for fitness.
  initPopulation(genomes) {
    const N = this.N, empties = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.grid[y][x] === World.EMPTY) empties.push([x, y]);
    for (let i = empties.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = empties[i]; empties[i] = empties[j]; empties[j] = t; }
    this.foragers = [];
    for (let i = 0; i < genomes.length; i++) {
      const p = empties[i % empties.length];
      this.foragers.push({ x: p[0], y: p[1], genome: genomes[i], agent: makeAgent(this.actions.length), fitness: 0, alive: true });
    }
    this.food = 0; this.water = 0; this.tick = 0;
  }

  // eating is renewable and never ends the "day": drop the eaten item back on a random empty cell and
  // keep going. (World.applyAction already did food++ and grid→EMPTY before calling this.)
  gatherResult() {
    this.respawnResource(World.FOOD);
    return { reward: PARAMETERS.rewardGather, done: false };
  }

  // one forager's turn: aim the world's single-agent view + the global RL rates at THIS forager, let
  // its own policy act through the normal contract, then read back its new position and food gained.
  stepForager(f) {
    const g = f.genome;
    PARAMETERS.epsilon = g.epsilon; PARAMETERS.alpha = g.alpha; PARAMETERS.gamma = g.gamma;
    this.ax = f.x; this.ay = f.y;
    const before = this.food;
    f.agent.act(this);          // senses via ax/ay, applyAction moves ax/ay + bumps this.food on eat
    f.x = this.ax; f.y = this.ay;
    f.fitness += this.food - before;
  }

  // a lifetime = evoLifetime ticks; every forager acts once per tick (fixed round-robin order)
  runLifetime() {
    for (this.tick = 0; this.tick < PARAMETERS.evoLifetime; this.tick++) {
      for (let i = 0; i < this.foragers.length; i++) this.stepForager(this.foragers[i]);
    }
    return this.foragers;
  }
};

// --- Selection / reproduction: discrete generations (per Chris's spec). Run a lifetime, rank by
// fitness, cull the bottom, let the survivors breed back to full population (elitism keeps the best).

// run ONE generation's lifetime and return foragers ranked best-first (plus the world, for probes)
var runGeneration = function (genomes) {
  const w = new EvoWorld(genomes);
  w.runLifetime();
  const scored = w.foragers.map((f) => ({ genome: f.genome, fitness: f.fitness }));
  scored.sort((a, b) => b.fitness - a.fitness);
  return { scored, world: w };
};

// build the next generation's genomes from this generation's ranked results
var reproduce = function (scored) {
  const P = scored.length;
  const survivors = Math.max(2, Math.round(P * (1 - PARAMETERS.evoCull)));
  const parents = scored.slice(0, survivors).map((s) => s.genome);
  const next = [parents[0].clone()];                       // elitism: the best passes through untouched
  while (next.length < P) {
    const a = parents[randomInt(parents.length)], b = parents[randomInt(parents.length)];
    next.push(a.crossover(b).mutate(PARAMETERS.evoMutRate));
  }
  return next;
};

// per-generation summary: fitness spread + where the population's genes currently sit (so we can read
// what evolution is CHOOSING for the params we used to hand-tune)
var genStats = function (scored) {
  const P = scored.length, fits = scored.map((s) => s.fitness);
  const mean = fits.reduce((a, b) => a + b, 0) / P;
  const g = { epsilon: 0, alpha: 0, gamma: 0 };
  for (const s of scored) for (const k in g) g[k] += s.genome[k];
  for (const k in g) g[k] /= P;
  return { mean, best: fits[0], worst: fits[P - 1], genes: g };
};

// the whole loop: seed a random population, evolve nGenerations, return the per-generation history
var evolve = function (nGenerations, popSize) {
  let genomes = [];
  for (let i = 0; i < popSize; i++) genomes.push(Genome.random());
  const history = [];
  for (let gen = 0; gen < nGenerations; gen++) {
    const { scored } = runGeneration(genomes);
    history.push(genStats(scored));
    genomes = reproduce(scored);
  }
  return history;
};
