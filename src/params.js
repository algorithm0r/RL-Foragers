'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND in the headless main-realm context.
var PARAMETERS = {
  // --- environment (GridForager: a gridN×gridN TOROIDAL food arena) ---
  // Arena size and the learner's receptive field are INDEPENDENT: the agent roams a large arena
  // but senses only a `receptiveField`-sized window centered on itself. With window < arena this
  // is PARTIALLY OBSERVABLE (empty windows are common, and two arenas can look identical through
  // the window — perceptual aliasing), which is the realistic foraging regime.
  gridN: 10,              // arena side length (torus; may be any size, need not be odd)
  foodDensity: 0.1,       // P(cell starts as food). Low + big arena → sparse food, lots of empty space
  maxStepsPerEpisode: 2000, // step cutoff → abandon + respawn (guards against endless wandering)

  // --- agent architecture ---
  agent: 'layered',       // 'flat' (Stage-1 baseline, one window) | 'layered' (Stage 2: L1/L3/L5 + confidence)

  // flat agent: the single odd window side it senses, centered on the agent. >= gridN recovers
  // fully-observable mode; < gridN is realistic partial observability. (Unused when agent='layered'.)
  receptiveField: 5,

  // layered agent: one Q-learner per window size, combined by count-based confidence weighting:
  //   Q(s,a) = Σ_L w_L·Q_L(φ_L,a),  w_L ∝ conf(count_L(φ_L)),  conf(c) = c/(c+confidenceK)  (normalized)
  layers: [1, 3, 5],      // receptive-field window sizes (odd, ascending) — L1 eat-reflex → L5 long-range
  confidenceK: 30,        // saturation of the count→confidence curve; higher = slower to trust a layer

  // --- reward (as specified): eat=0, everything else=-1, clearing the board=+N (initial food) ---
  rewardEat: 0,           // a successful eat that does NOT clear the board
  rewardStep: -1,         // every other action: any move, and a failed eat (no food underfoot)
  // (the +N terminal reward is the episode's initial food count, computed in world.js)

  // --- tabular Q-learning ---
  alpha: 0.1,             // learning rate
  gamma: 0.9,             // discount
  epsilon: 0.1,           // ε-greedy exploration
  defaultQ: 0,            // Q for unseen (state, action) pairs

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
var PARAM_SCHEMA = [
  { key: 'gridN', label: 'Arena N', min: 1, max: 20, step: 1, resets: true },
  { key: 'receptiveField', label: 'Window', min: 1, max: 9, step: 2, resets: true },
  { key: 'foodDensity', label: 'Food density', min: 0.02, max: 1, step: 0.02, resets: true },
  { key: 'epsilon', label: 'Explore ε', min: 0, max: 1, step: 0.01 },
  { key: 'alpha', label: 'Learn α', min: 0.01, max: 1, step: 0.01 },
  { key: 'gamma', label: 'Discount γ', min: 0, max: 0.99, step: 0.01 },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];
