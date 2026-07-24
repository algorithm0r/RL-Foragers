'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND in the headless main-realm context.
var PARAMETERS = {
  // --- environment (GridForager: modular, feature-toggled) ---
  // Base model = food-only sweep (collect all food, metric = steps-to-clear). Add features one at a
  // time to study each addition. All toggles OFF = the original v1 model.
  enableWater: false,     // + a 2nd resource (drink); day ends when all food AND water collected
  enableShelter: false,   // + shelter (×1): REST there ends the day, banking reward = rewardPerUnit·
                          //   (min(food,water) if water else food); adds a bearing + satiety sense
  enablePits: false,      // + pits: entering one is death (terminal, −pitPenalty)
  enableRocks: false,     // + rocks: neutral obstacles — moving into one is blocked (stay put, normal
                          //   step cost, so bumping is learnably wasteful through the existing reward)
  gridN: 10,              // arena side length (torus)
  nFood: 10,              // items placed PER resource type each episode
  nWater: 6,              // water items (shelter/central-place mode only)
  nTypes: 1,              // sweep mode: number of distinct resource types, each with its own collect
                          // action (type1='eat', type2='drink', type≥3='c'+t). Cells take values 1..nTypes.
  nPits: 3,               // pits (when enablePits)
  nRocks: 8,              // rocks (when enableRocks)
  enableGoats: false,     // + goats: prey AGENTS on a shared species-level layered learner — they eat
                          //   food, drink water, die in pits, and learn (incl. fear of the forager).
                          //   The forager gains an ATTACK action: fell an ADJACENT goat → its cell
                          //   becomes FOOD (carcass) → step on and eat (the two-action hunt).
  nGoats: 3,              // goats per episode (when enableGoats)
  goatLayers: [1, 3],     // the goats' (simpler) window stack — same confidence coupling
  goatEpsilon: 0.05,      // goat ε-greedy rate (species learner; higher than the forager's — prey
                          //   lifetimes are short and coverage matters more than polish)
  goatExplodeRadius: 0,   // carcass payoff: a killed goat drops FOOD on every EMPTY cell within this
                          //   Chebyshev radius (0 = just its own cell, the base carcass; 1 = a 3×3
                          //   burst, up to +9 food). The spatial hunt PREMIUM — does a big enough
                          //   payoff finally make hunting worth the two-action cost? (Answer: NO.)
  goatHuntOneAction: false, // collapse the hunt to ONE action: a successful ATTACK directly consumes
                          //   the goat (food++ and immediate rewardGather), no walk-to-carcass. Tests
                          //   whether the blocker is the COST/REWARD SPLIT across two actions (attack
                          //   pays −1, a separate eat collects the payoff) rather than the payoff size.
  goatEatRespawn: true,   // when a goat eats a resource, RESPAWN it on a random empty cell (net-zero
                          //   to the agent's supply) — removes the goat-as-COMPETITOR confound so a
                          //   hunting experiment measures hunting, not resource depletion. Goats still
                          //   forage & learn; the agent's larder is untouched.
  goatsCountToClear: true, // living goats count toward `remaining` — CLEARING the field requires
                          //   killing (and consuming) the goats too, so hunting is on the critical
                          //   path to the shelter, not an optional side-behavior.
  goatStationary: false,  // goats DON'T move (skip their turn) — stationary, food-like prey. Isolates
                          //   whether prey MOTION is what breaks the hunt chain (a moving goat's
                          //   carcass is transient; a stationary goat is a stable target to learn on).
  maxStepsPerEpisode: 500, // step cutoff → episode ends. SHELTER mode: this is the DAY LENGTH — reach the
                          //   shelter and REST before it expires, or the agent COLLAPSES (−collapsePenalty).
  timeBuckets: 4,         // shelter mode: granularity of the time-remaining signal in the internal state
                          //   (coarse "how much of the day is left" → lets the agent learn WHEN to head home)
  shelterActivate: 'always', // WHEN the shelter appears / rest becomes available. 'always' (current); 'cleared'
                          //   (only after ALL resources gathered — forage first, then the rest option appears:
                          //   removes rest-on-contact, cues the return); 'time' (after shelterActivateTime steps — a
                          //   diurnal "dusk" curriculum); 'clearedOrTime' (cleared OR dusk — load-full-or-nightfall:
                          //   rewards full sweeps but a dusk safety valve stops the "clear-everything-or-collapse" cliff).
  shelterActivateTime: 40, // for 'time'/'clearedOrTime' — the dusk step at which the shelter appears if not yet cleared

  // --- agent architecture ---
  agent: 'layered',       // 'flat' (Stage-1 baseline, one window) | 'layered' (Stage 2: L1/L3/L5 + confidence)

  // flat agent: the single odd window side it senses, centered on the agent. >= gridN recovers
  // fully-observable mode; < gridN is realistic partial observability. (Unused when agent='layered'.)
  receptiveField: 5,

  // layered agent: one Q-learner per window size, combined by count-based confidence weighting:
  //   Q(s,a) = Σ_L w_L·Q_L(φ_L,a),  w_L ∝ conf(count_L(φ_L)),  conf(c) = c/(c+confidenceK)  (normalized)
  // Spatial window sizes (odd, ascending). Each layer's value is MARGINAL — the 5×5 matters only in
  // states where the 3×3 has no goal in view (else it's redundant). Learned relevance filtering (next)
  // will keep each layer's state space small so wide layers stay useful instead of being down-weighted.
  layers: [1, 3, 5],
  subsumptionHazardArb: false, // subsumption arbitration variant: a HAZARD (pit) in view also claims
                          //   control (Brooks' avoid-layer). Default OFF — the plain goal-gated form
                          //   stays the Stage-3 control; ON tests the pits-grid diagnosis that its
                          //   deaths are ARBITRATION STARVATION (L3 never owns hazard-only states).
  strategicLayer: true,   // in SHELTER mode, add an INTERNAL layer sensing only bearing + satiety (the
                          // homing/rest decision), so the spatial window layers stay pure reflexes
  confidenceK: 30,        // saturation of the count→confidence curve; higher = slower to trust a layer

  // --- relevance filtering (U-Tree per window layer) ---
  // Swap each window layer's flat QLearner for a U-Tree that keys Q on a decision tree over the window
  // cells: starts ignoring all cells, splits a leaf on a cell only when its value predicts the target
  // (relevance). Keeps wide windows cheap; relevance is conditional. (Internal/strategic layer unaffected.)
  relevanceFilter: false,
  utreeMinSamples: 200,   // min leaf visits before it's considered for a split
  utreeMinChild: 15,      // min samples per candidate cell-value-action to trust it
  utreeSplitThreshold: 0.5, // min spread (Q units) of mean-target across a cell's values to split on it
  utreeCheckInterval: 200,  // test a leaf for splitting every N updates

  // --- reward: gather=+1 (eat/drink), any other action=-1, clear/rest bonus, pit = death ---
  // rewardGather ≈ |rewardStep| is deliberate: it puts "about to gather" just above 0 and "searching"
  // just below 0, so the Q-value gap straddles zero and defaultQ=0 is the strategic exploration
  // threshold for free (untried actions beat wandering but lose to a learned good action). Scale-
  // anchored: change rewardStep and scale rewardGather with it. (Measured: gap −0.04 → +0.79 at +1.)
  rewardGather: 1,        // a successful eat or drink
  rewardStep: -1,         // any move, or a failed eat/drink/rest
  rewardPerUnit: 50,      // shelter mode: coefficient on the rest reward = rewardPerUnit·stock² (stock =
                          //   food+water). Superlinear → rewards bigger hauls, fights early-rest under-gathering.
  collapsePenalty: 50,    // shelter mode: penalty for the day expiring in the field (never made it home to
                          //   rest). Flat −M; resting with nothing (0) still beats collapse (−M) → homing dominates.
  restStickC: 0,          // shelter mode: rest reward loses restStickC per RESOURCE still uncollected (uses
                          //   resources-left, not time-left, so a fast forager that CLEARED the field rests
                          //   penalty-free). OFF by default: the sweep showed it doesn't lift harvest — it just
                          //   trades early-rest for collapse (c=15 → 54% collapse). Under-gathering is a
                          //   policy-DISCOVERY problem, not a reward one (stock² carrot also failed).
  pitPenalty: 50,         // reward on entering a pit (terminal death)

  // --- DQN baseline (agent='dqn') — a small dependency-free MLP: one-hot window → hidden ReLU →
  //   Q per action, with experience replay + a target network and a linearly-annealed ε. The honest
  //   monolithic-NN control for the layered tabular stack: same task, same reward, same seeds. ---
  dqnField: 5,            // side of the single window the net sees (one-hot per cell)
  dqnHidden: 64,          // hidden units
  dqnAlpha: 0.0025,       // NN learning rate (SGD; distinct from the tabular alpha)
  dqnBatch: 32,           // minibatch size per gradient step
  dqnReplay: 20000,       // experience-replay capacity (ring buffer)
  dqnTargetSync: 1000,    // steps between target-network copies
  dqnTrainEvery: 1,       // gradient step every N env steps (1 = every tick, 32 = matched to 1 update/step budget)
  dqnWarmup: 1000,        // steps of pure exploration to fill the buffer before learning
  dqnEpsStart: 1.0,       // ε at step 0 (anneals linearly)
  dqnEpsEnd: 0.05,        // ε floor
  dqnEpsDecaySteps: 60000, // steps to anneal ε from start to floor

  // --- tabular experience replay (Dyna-Q) — the budget-matched control for the DQN comparison ---
  // Give the tabular layered agent DQN-style replay: each real step, re-apply qReplayK stored
  // transitions (value-only, so visit counts stay honest). Tests whether the DQN's edge was the
  // 32:1 update budget (replay closes the gap) or genuine generalization (replay plateaus below it).
  qReplay: false,         // OPT-IN, not a blanket default. Big win on SWEEP/coverage foraging (137±40 →
                          //   65 on 12×12, variance crushed), but it HURTS sparse-terminal SHELTER mode
                          //   (collapse 1%→49%: uniform replay drowns the rare head-home transitions).
  qReplayK: 4,            // sweet spot: the K-sweep saturates at 4 (K=4 captures the full benefit; 8/16/
                          //   32/64 add nothing measurable). 4 replays/step, ~8× cheaper than 32.
  qReplayRecent: false,   // replay the LAST K transitions in REVERSE (newest→oldest) instead of K
                          //   random ones — backward credit propagation along the actual trajectory
                          //   (eligibility-trace-like). Aimed at broken multi-step chains (the hunt:
                          //   eat-reward flows back through move back to attack in one step).
  qReplayCap: 20000,      // replay buffer capacity
  qReplayWarmup: 1000,    // real steps before replay kicks in

  // --- tabular Q-learning ---
  alpha: 0.1,             // learning rate
  gamma: 0.95,            // discount (raised for v2: reward is banked at rest, ~20-40 steps away)
  defaultQ: 0,            // Q for unseen (state, action) pairs
  // evolved INSTINCT vectors (per action), set by evolution mode per individual (evolution.js) and NULL
  // everywhere else so ordinary runs use defaultQ / plain greedy. initialQ = prior value of an unseen
  // (state, action); unexploredBonus = selection-time optimism for an untried action.
  initialQ: null,
  unexploredBonus: null,

  // --- exploration ---
  // 'egreedy': ε-random exploration — the DEFAULT (ε=0.01). Stage-3 prelim (N=5) found foraging is a
  //            COVERAGE problem (you must visit every food cell), so SUSTAINED randomness beats fading
  //            optimism: a 1% ε reliably learns across every architecture (5/5), where greedy locks into
  //            deterministic torus loops and UCB anneals into a fixed path that never covers the arena.
  // 'ucb':     optimism via a count bonus, argmax_a [ Q + ucbC·√(ln N_state / n_state,action) ]. Slightly
  //            tighter for the layered agent (40.6±1.6 vs egreedy 42.7±7.3) but fails the weaker agents.
  // 'greedy':  pure argmax; exploration only from the strategic init (defaultQ=0 in the value gap).
  //            Reflex-safe but unreliable on the full task (deterministic loops). Kept for comparison.
  explore: 'egreedy',
  ucbC: 1.0,              // UCB exploration constant (higher = explore longer); only when explore='ucb'
  epsilon: 0.01,          // ε-random rate; only when explore='egreedy'

  // --- evolution (Stage 6) — a population of PERSISTENT forager individuals (each a genome + its own
  //   learned Q-tables) evolves its RL meta-params over DISCRETE generations. Each generation every
  //   individual forages evoRuns SHARED-map runs (fair, low-noise), reshuffled into batches of
  //   evoBatchSize each run (varied co-inhabitants); policies keep learning across the runs. Rank by
  //   food foraged, cull the bottom (mature only), breed the top (crossover + mutation). Survivors keep
  //   their tables across generations (Lamarckian); newborns get a fresh table and evoProtect gens of
  //   grace before they're cull-eligible. Genome (Genome.GENES in evolution.js) starts {ε, α, γ}. ---
  evoPopSize: 16,         // population size — sweepable
  evoGenerations: 40,     // generations to run
  evoRuns: 4,             // K: shared-map runs per generation each individual forages (learning persists across them)
  evoBatchSize: 8,        // foragers per run — the population is reshuffled into batches of this each run
  evoProtect: 2,          // generations a newborn is exempt from culling (grace to learn on its fresh table)
  evoMaxAge: 10,          // OLD AGE: an individual dies at this age regardless of fitness — no immortal /
                          //   dominant elites holding the population (and its neutral genes) frozen forever
  evoLifetime: 800,       // ticks per RUN each forager acts (a life = evoRuns × this ticks of experience)
  evoCull: 0.5,           // fraction culled each generation (bottom 50% of MATURE individuals by fitness)
  evoMutRate: 0.5,        // per-gene probability an offspring's gene takes a Gaussian mutation step
  evoUseInstincts: true,  // apply the per-action instinct vectors (initialQ/unexploredBonus). OFF = the
                          //   CONTROL arm of the hunting sweep: same everything, instincts phenotypically silent.
  evoShelterFrac: 0.25,   // central-place mode: the shelters open for the LAST this-fraction of the lifetime
                          //   (0.25 = last quarter) — forage first, then find a shelter to BANK before it closes.
  evoShelterGrid: 3,      // central-place mode: shelters are a g×g evenly-spaced grid (g² shelters). With NO
                          //   bearing/INT, more shelters = higher chance a SEEKING forager sees one in its window.

  // --- ecology (Stage 7) — NATURAL selection, no GA. Agents forage for ENERGY, pay metabolism each tick,
  //   REPRODUCE as an action at an energy threshold (sexual with an adjacent partner: each pays T; else
  //   asexual solo at 2T), and DIE from starvation (energy≤0) or a random hazard. Continuous time; the
  //   population size is EMERGENT (food supply → carrying capacity). Offspring get FRESH Q-tables. ---
  ecoPop0: 60,            // founding population size
  ecoFoodValue: 24,       // energy gained per food eaten (= foodValue/metab = 24 ticks of life per food)
  ecoMetabolism: 1,       // energy drained per tick (cost of living) — the reference unit
  ecoFoodPerTick: 8,      // NEW food items per tick (a food FLOW) → carrying capacity ≈ ecoFoodPerTick·foodValue/metab
  ecoReproThreshold: 260, // T: energy to reproduce sexually (each parent pays T); asexual needs 2T
  ecoBirthEnergy: 500,    // energy an offspring starts with (its runway = birthEnergy/metab = 500 ticks to learn foraging)
  ecoHazard: 0.0004,      // per-tick random death probability (nothing is immortal)
  ecoFoodDensity: 0.08,   // INITIAL food stock (fraction of cells); thereafter food arrives at ecoFoodPerTick
  ecoMaxPop: 600,         // hard safety cap on population (prevents runaway — a healthy run stays well under)

  // --- engine ---
  updatesPerDraw: 20,     // fast-forward: sim updates per rendered frame (learning is fast, drawing slow)

  // --- data collection ---
  reportingPeriod: 25,    // sample the metric every N ticks
  epoch: 20000,           // a run ends (and ships a packet) at N ticks

  // --- database (the standard vendored client, src/db.js) ---
  db: {
    transport: 'socket',
    server: 'https://research.climbinggiants.com:8888',
    mongoUrl: 'mongodb://127.0.0.1:27017',
    db: 'rllayers',
    run: 'run',
  },
};

// Schema drives the auto-generated control panel (ui.js). One entry per live-tunable.
// `group` sorts a row into a collapsible section; `showIf` (a truthy param key OR a
// predicate P => bool) hides the row until it's relevant — so the panel only ever shows
// controls that apply to the current model (the base food-sweep shows a handful; goat /
// shelter / replay knobs appear as you switch those features on). Keeps the panel uncluttered.
var PARAM_SCHEMA = [
  // --- Model: architecture + which features are in play. Count sliders appear per enabled feature. ---
  { key: 'agent', label: 'Architecture', type: 'select', group: 'Model',
    options: ['flat', 'layered', 'subsumption', 'dqn'] },
  { key: 'enableWater', label: '+ Water (2nd resource)', type: 'checkbox', group: 'Model' },
  { key: 'enableShelter', label: '+ Shelter (rest ends day)', type: 'checkbox', group: 'Model' },
  { key: 'enablePits', label: '+ Pits (death)', type: 'checkbox', group: 'Model' },
  { key: 'enableRocks', label: '+ Rocks (block)', type: 'checkbox', group: 'Model' },
  { key: 'enableGoats', label: '+ Goats (prey agents)', type: 'checkbox', group: 'Model' },
  { key: 'gridN', label: 'Arena N', min: 4, max: 20, step: 1, resets: true, group: 'Model' },
  { key: 'nFood', label: 'Food', min: 0, max: 30, step: 1, resets: true, group: 'Model' },
  { key: 'nWater', label: 'Water', min: 0, max: 30, step: 1, resets: true, group: 'Model', showIf: 'enableWater' },
  { key: 'nPits', label: 'Pits', min: 0, max: 12, step: 1, resets: true, group: 'Model', showIf: 'enablePits' },
  { key: 'nRocks', label: 'Rocks', min: 0, max: 24, step: 1, resets: true, group: 'Model', showIf: 'enableRocks' },
  { key: 'nGoats', label: 'Goats', min: 0, max: 8, step: 1, resets: true, group: 'Model', showIf: 'enableGoats' },
  { key: 'maxStepsPerEpisode', label: 'Day length', min: 20, max: 1000, step: 20, group: 'Model' },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1, group: 'Model' },

  // --- Learning: exploration + core RL rates. ε / UCB-c each show only for their method. ---
  { key: 'explore', label: 'Exploration', type: 'select', options: ['greedy', 'ucb', 'egreedy'], group: 'Learning' },
  { key: 'epsilon', label: 'ε-greedy ε', min: 0, max: 1, step: 0.01, group: 'Learning', showIf: (P) => P.explore === 'egreedy' },
  { key: 'ucbC', label: 'UCB explore c', min: 0, max: 4, step: 0.1, group: 'Learning', showIf: (P) => P.explore === 'ucb' },
  { key: 'alpha', label: 'Learn α', min: 0.01, max: 1, step: 0.01, group: 'Learning' },
  { key: 'gamma', label: 'Discount γ', min: 0.5, max: 0.999, step: 0.001, group: 'Learning' },

  // --- Replay (Dyna-Q): opt-in; K and the backward variant appear once replay is on. ---
  { key: 'qReplay', label: 'Replay (Dyna-Q)', type: 'checkbox', group: 'Replay' },
  { key: 'qReplayK', label: 'Replay K', min: 0, max: 128, step: 4, group: 'Replay', showIf: 'qReplay' },
  { key: 'qReplayRecent', label: 'Backward (last-K)', type: 'checkbox', group: 'Replay', showIf: 'qReplay' },

  // --- Goats: whole section hidden until goats are enabled (showIf on every row). ---
  { key: 'goatEatRespawn', label: 'Non-competing (respawn)', type: 'checkbox', group: 'Goats', showIf: 'enableGoats' },
  { key: 'goatsCountToClear', label: 'Must hunt to clear', type: 'checkbox', group: 'Goats', showIf: 'enableGoats' },
  { key: 'goatStationary', label: 'Stationary prey', type: 'checkbox', group: 'Goats', showIf: 'enableGoats' },
  { key: 'goatHuntOneAction', label: 'One-action hunt (swallow)', type: 'checkbox', group: 'Goats', showIf: 'enableGoats' },
  { key: 'goatExplodeRadius', label: 'Carcass burst r', min: 0, max: 3, step: 1, group: 'Goats', showIf: 'enableGoats' },
  { key: 'goatEpsilon', label: 'Goat ε', min: 0, max: 1, step: 0.01, group: 'Goats', showIf: 'enableGoats' },

  // --- Shelter: hidden until shelter is enabled. ---
  { key: 'shelterActivate', label: 'Shelter opens', type: 'select',
    options: ['always', 'cleared', 'time', 'clearedOrTime'], group: 'Shelter', showIf: 'enableShelter' },
  { key: 'collapsePenalty', label: 'Collapse −M', min: 0, max: 100, step: 5, group: 'Shelter', showIf: 'enableShelter' },
  { key: 'strategicLayer', label: 'INT layer (bearing+satiety)', type: 'checkbox', group: 'Shelter', showIf: 'enableShelter' },

  // --- Advanced: research variants, collapsed by default. ---
  { key: 'subsumptionHazardArb', label: 'Subsumption hazard-arb', type: 'checkbox', group: 'Advanced', showIf: (P) => P.agent === 'subsumption' },
  { key: 'relevanceFilter', label: 'Relevance filter (U-Tree)', type: 'checkbox', group: 'Advanced' },
];

// The EVOLUTION tab (browser GA viz). `resets: true` restarts the run; others take effect on the next
// generation. (The browser evo is the simplified single-run-per-gen loop; evoRuns/evoBatchSize are
// headless-only and omitted here.)
var EVO_SCHEMA = [
  { key: 'enableGoats', label: '+ Goats (prey)', type: 'checkbox', resets: true },
  { key: 'enableShelter', label: '+ Shelter (bank stock)', type: 'checkbox', resets: true },
  { key: 'enablePits', label: '+ Pits (death)', type: 'checkbox', resets: true },
  { key: 'gridN', label: 'Arena N', min: 10, max: 40, step: 2, resets: true },
  { key: 'nFood', label: 'Food', min: 0, max: 120, step: 5, resets: true },
  { key: 'nGoats', label: 'Goats', min: 0, max: 12, step: 1, resets: true, showIf: 'enableGoats' },
  { key: 'nPits', label: 'Pits', min: 0, max: 12, step: 1, resets: true, showIf: 'enablePits' },
  { key: 'evoPopSize', label: 'Population', min: 4, max: 64, step: 2, resets: true },
  { key: 'evoLifetime', label: 'Lifetime (ticks)', min: 100, max: 2000, step: 100 },
  { key: 'evoProtect', label: 'Juvenile protect (gens)', min: 0, max: 10, step: 1 },
  { key: 'evoMaxAge', label: 'Max age (gens)', min: 2, max: 50, step: 1 },
  { key: 'evoCull', label: 'Cull fraction', min: 0.1, max: 0.9, step: 0.05 },
  { key: 'evoMutRate', label: 'Mutation rate', min: 0, max: 1, step: 0.05 },
  { key: 'evoUseInstincts', label: 'Instincts (initialQ)', type: 'checkbox' },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];

// The ECOLOGY tab (natural-selection ecology). Most knobs are read live each tick, so changing them
// steers the running world immediately; only the `resets: true` ones (world size / founding stock) rebuild.
var ECO_SCHEMA = [
  { key: 'gridN', label: 'Arena N', min: 10, max: 60, step: 2, resets: true },
  { key: 'ecoPop0', label: 'Founding pop', min: 10, max: 200, step: 5, resets: true },
  { key: 'ecoFoodPerTick', label: 'Food arriving / tick', min: 0, max: 40, step: 1 },
  { key: 'ecoFoodValue', label: 'Energy per food', min: 1, max: 60, step: 1 },
  { key: 'ecoMetabolism', label: 'Metabolism / tick', min: 0.05, max: 3, step: 0.05 },
  { key: 'ecoReproThreshold', label: 'Reproduce threshold T', min: 20, max: 400, step: 10 },
  { key: 'ecoBirthEnergy', label: 'Birth energy', min: 20, max: 600, step: 10 },
  { key: 'ecoHazard', label: 'Random death / tick', min: 0, max: 0.005, step: 0.0001 },
  { key: 'ecoFoodDensity', label: 'Initial food density', min: 0, max: 0.3, step: 0.01, resets: true },
  { key: 'evoMutRate', label: 'Mutation rate', min: 0, max: 1, step: 0.05 },
  { key: 'ecoMaxPop', label: 'Population cap', min: 50, max: 1500, step: 50, resets: true },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];
