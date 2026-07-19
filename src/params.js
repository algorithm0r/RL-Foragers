'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND in the headless main-realm context.
var PARAMETERS = {
  // --- environment (GridForager: N×N toroidal food grid, agent always at the view center) ---
  gridN: 5,               // grid side length; keep ODD so the agent has a true center (1,3,5,7)
  foodDensity: 0.5,       // P(cell starts as food). ~half the board, per the 5×5 analysis
  maxStepsPerEpisode: 1000, // step cutoff → abandon + respawn (guards against unsolvable wandering)

  // --- agent receptive field ---
  // Stage 1 is the FLAT baseline: one learner that senses the whole grid. A window >= gridN
  // (clamped to gridN in world.senseState) means it sees every cell, centered on the agent.
  receptiveField: 7,      // odd window side; clamped to gridN → full-grid view for N in {1,3,5,7}

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
  { key: 'gridN', label: 'Grid N', min: 1, max: 7, step: 2, resets: true },
  { key: 'foodDensity', label: 'Food density', min: 0.05, max: 1, step: 0.05, resets: true },
  { key: 'epsilon', label: 'Explore ε', min: 0, max: 1, step: 0.01 },
  { key: 'alpha', label: 'Learn α', min: 0.01, max: 1, step: 0.01 },
  { key: 'gamma', label: 'Discount γ', min: 0, max: 0.99, step: 0.01 },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];
