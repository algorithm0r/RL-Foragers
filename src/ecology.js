'use strict';
// Stage 7 — NATURAL SELECTION (no GA). A continuous ecology: agents forage for ENERGY, pay METABOLISM
// each tick, REPRODUCE as an action when banked energy crosses a threshold, and DIE from starvation or a
// random hazard. No generations, no external fitness, no cull/breed — selection IS survival + reproduction.
//   • reproduce is an ACTION; its felt reward is the evolved `rewardReproduce` gene (the DRIVE to breed is
//     itself under selection). Two thresholds (Chris): if an adjacent partner also has ≥ T, they mate —
//     each pays T, offspring = crossover(both); else if the agent has hoarded ≥ 2T it reproduces solo,
//     paying 2T, offspring = a mutated clone.
//   • Offspring are born with FRESH Q-tables, so their evolved priors (initialQ / felt rewards) decide
//     whether they survive infancy — which is what finally puts the instinct genes under real selection.
//   • Food is renewable → the population size is EMERGENT (crowding → starvation regulates carrying capacity).
// EcoWorld reuses World's grid + window sensing + the agent/genome/cfg/feltReward machinery.

var ECO_ACTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 'eat', 'reproduce'];

var EcoWorld = class EcoWorld extends World {
  constructor(genomes) {
    super(800, 600);                                  // builds a throwaway grid + agent; we rebuild below
    this.N = PARAMETERS.gridN;
    this.grid = [];
    for (let y = 0; y < this.N; y++) { const row = []; for (let x = 0; x < this.N; x++) row.push(World.EMPTY); this.grid.push(row); }
    this.actions = ECO_ACTIONS; this.nActions = ECO_ACTIONS.length;
    this.goats = []; this.goatAt = new Array(this.N * this.N).fill(-1);
    this.foodCount = 0; this.seedFood(Math.floor(PARAMETERS.ecoFoodDensity * this.N * this.N));
    this.time = 0; this.births = 0; this.starved = 0; this.hazardDeaths = 0;
    this.agents = [];
    const empties = this.emptyCells();
    for (let i = 0; i < genomes.length && empties.length; i++) { const c = empties[i % empties.length]; this.spawnAgent(genomes[i], c % this.N, (c / this.N) | 0, PARAMETERS.ecoBirthEnergy * 3); }
  }

  emptyCells() {
    const N = this.N, e = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.grid[y][x] === World.EMPTY) e.push(y * N + x);
    for (let i = e.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = e[i]; e[i] = e[j]; e[j] = t; }
    return e;
  }

  seedFood(n) { for (let placed = 0, g = 0; placed < n && g++ < this.N * this.N * 4;) { const k = randomInt(this.N * this.N), x = k % this.N, y = (k / this.N) | 0; if (this.grid[y][x] === World.EMPTY) { this.grid[y][x] = World.FOOD; this.foodCount++; placed++; } } }

  // food is a FLOW: a fixed number of new food items appear per tick (not a refill-to-density). This is
  // what makes the carrying capacity emergent — total sustainable population ≈ ecoFoodPerTick·foodValue/metab.
  restockFood() { for (let i = 0; i < PARAMETERS.ecoFoodPerTick; i++) { const k = randomInt(this.N * this.N), x = k % this.N, y = (k / this.N) | 0; if (this.grid[y][x] === World.EMPTY) { this.grid[y][x] = World.FOOD; this.foodCount++; } } }

  spawnAgent(genome, x, y, energy) {
    const policy = makeAgent(this.nActions), cfg = genome.express();
    if (policy.setCfg) policy.setCfg(cfg);              // FRESH table + this genome's precomputed cfg
    this.agents.push({ x, y, genome, policy, cfg, energy, age: 0, alive: true });
  }

  // a coarse energy sense appended to every window state, so the agent can LEARN to reproduce only when
  // it can afford to: '0' below T (can't), '1' sexual-ready (≥T), '2' asexual-ready (≥2T).
  energyCode(e) { const T = PARAMETERS.ecoReproThreshold; return e >= 2 * T ? '2' : e >= T ? '1' : '0'; }
  senseWindow(r, channel) { return super.senseWindow(r, channel) + this.energyCode(this.curAgent.energy); }

  applyAction(i) {
    this.steps++;
    const act = this.actions[i];
    if (act === 'reproduce') return this.doReproduce();
    if (typeof act === 'number') {                     // move (torus; agents don't block each other)
      const d = World.DIRS[act], N = this.N;
      this.ax = ((this.ax + d[0]) % N + N) % N; this.ay = ((this.ay + d[1]) % N + N) % N;
      return { reward: 0, done: false, event: 'step' };
    }
    // eat
    if (this.grid[this.ay][this.ax] === World.FOOD) {
      this.grid[this.ay][this.ax] = World.EMPTY; this.foodCount--;
      this.curAgent.energy += PARAMETERS.ecoFoodValue;
      return { reward: 0, done: false, event: 'gather' };
    }
    return { reward: 0, done: false, event: 'step' };  // ate nothing
  }

  // torus-adjacent (Chebyshev 1, not the same cell) living agent with energy ≥ T
  adjacentPartner(a, T) {
    const N = this.N;
    for (let i = 0; i < this.agents.length; i++) {
      const b = this.agents[i];
      if (b === a || !b.alive || b.energy < T) continue;
      const dx = Math.min((b.x - a.x + N) % N, (a.x - b.x + N) % N), dy = Math.min((b.y - a.y + N) % N, (a.y - b.y + N) % N);
      if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) return b;
    }
    return null;
  }

  doReproduce() {
    const a = this.curAgent, T = PARAMETERS.ecoReproThreshold;
    const partner = a.energy >= T ? this.adjacentPartner(a, T) : null;
    if (partner) {                                     // SEXUAL: each parent pays T, offspring = crossover
      a.energy -= T; partner.energy -= T;
      this.birth(a.genome.crossover(partner.genome).mutate(PARAMETERS.evoMutRate), a);
      return { reward: 0, done: false, event: 'reproduce' };
    }
    if (a.energy >= 2 * T) {                            // ASEXUAL: solo, pays 2T, offspring = mutated clone
      a.energy -= 2 * T;
      this.birth(a.genome.mutate(PARAMETERS.evoMutRate), a);
      return { reward: 0, done: false, event: 'reproduce' };
    }
    return { reward: 0, done: false, event: 'step' };  // couldn't afford it — a wasted step
  }

  birth(genome, parent) {
    if (this.agents.length >= PARAMETERS.ecoMaxPop) return;   // safety cap
    const d = World.DIRS[randomInt(8)], N = this.N;           // drop the offspring on an adjacent cell
    this.spawnAgent(genome, ((parent.x + d[0]) % N + N) % N, ((parent.y + d[1]) % N + N) % N, PARAMETERS.ecoBirthEnergy);
    this.births++;
  }

  stepAgent(a) {
    this.ax = a.x; this.ay = a.y; this.curAgent = a;
    a.policy.act(this);                                // sense (incl. energy) → act (move/eat/reproduce) → learn on felt reward
    a.x = this.ax; a.y = this.ay;
    a.energy -= PARAMETERS.ecoMetabolism; a.age++;
    if (a.energy <= 0) { a.alive = false; this.starved++; }
    else if (Math.random() < PARAMETERS.ecoHazard) { a.alive = false; this.hazardDeaths++; }
  }

  advance() {
    const living = this.agents.slice();                // snapshot: newborns act next tick, not this one
    for (let i = living.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = living[i]; living[i] = living[j]; living[j] = t; }
    for (let i = 0; i < living.length; i++) if (living[i].alive) this.stepAgent(living[i]);
    this.agents = this.agents.filter((a) => a.alive);
    this.restockFood();
    this.time++;
  }

  // running population + gene means (there are no generations to average over)
  snapshot() {
    const n = this.agents.length, g = {}; for (const k in Genome.GENES) g[k] = 0;
    let energy = 0, age = 0;
    for (const a of this.agents) { for (const k in g) g[k] += a.genome.expr(k); energy += a.energy; age += a.age; }
    if (n) { for (const k in g) g[k] /= n; energy /= n; age /= n; }
    return { time: this.time, pop: n, births: this.births, starved: this.starved, hazard: this.hazardDeaths, meanEnergy: energy, meanAge: age, genes: g };
  }

  run(ticks, sampleEvery) {
    const out = [];
    for (let t = 0; t < ticks; t++) { this.advance(); if (t % sampleEvery === 0) out.push(this.snapshot()); if (this.agents.length === 0) { out.push(this.snapshot()); break; } }
    return out;
  }
};

// seed a founding population of random genomes and run the ecology
var runEcology = function (ticks, sampleEvery) {
  const nActions = ECO_ACTIONS.length, genomes = [];
  for (let i = 0; i < PARAMETERS.ecoPop0; i++) genomes.push(Genome.random(nActions));
  return new EcoWorld(genomes).run(ticks, sampleEvery);
};
