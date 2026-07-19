'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND in the headless main-realm context.
var PARAMETERS = {
  // --- environment (GridForager-v2: central-place foraging) ---
  // Cells are empty/food/water/shelter(×1)/pit. Gather food + water, then REST at the shelter to
  // bank reward = rewardPerUnit·min(food,water); entering a pit is death. Torus, agent-centered
  // view. The window (receptiveField) is decoupled from arena size → partial observability, so the
  // observation is augmented with a shelter bearing + bucketed satiety (see world.js).
  gridN: 8,               // arena side length (torus)
  nFood: 5,               // food items placed each episode
  nWater: 5,              // water items
  nPits: 3,               // pits (terminal death)
  maxStepsPerEpisode: 300, // step cutoff → episode ends, banked nothing

  // --- agent architecture ---
  agent: 'layered',       // 'flat' (Stage-1 baseline, one window) | 'layered' (Stage 2: L1/L3/L5 + confidence)

  // flat agent: the single odd window side it senses, centered on the agent. >= gridN recovers
  // fully-observable mode; < gridN is realistic partial observability. (Unused when agent='layered'.)
  receptiveField: 5,

  // layered agent: one Q-learner per window size, combined by count-based confidence weighting:
  //   Q(s,a) = Σ_L w_L·Q_L(φ_L,a),  w_L ∝ conf(count_L(φ_L)),  conf(c) = c/(c+confidenceK)  (normalized)
  // Spatial window sizes (odd). NOTE: with 5-type categorical cells a 5×5 window is ~5^25 states and
  // never generalizes (the coupling correctly down-weights it to ~0), so v2 defaults to [1,3] — the
  // fix for ranged sensing is per-channel binary windows / resource bearings (see DEVLOG).
  layers: [1, 3],
  strategicLayer: true,   // add an INTERNAL layer sensing only shelter-bearing + satiety (the homing/
                          // rest decision), so the window layers stay pure and generalize reflexes
  confidenceK: 30,        // saturation of the count→confidence curve; higher = slower to trust a layer

  // --- reward: gather=0 (value realized at rest), any other action=-1, REST at shelter banks
  //     rewardPerUnit·min(food,water) and ends the episode, entering a pit = death (-pitPenalty) ---
  rewardGather: 0,        // a successful eat or drink (banked, not paid immediately)
  rewardStep: -1,         // any move, or a failed eat/drink/rest
  rewardPerUnit: 50,      // banked reward per balanced (food,water) pair at rest
  pitPenalty: 50,         // reward on entering a pit (terminal death)

  // --- tabular Q-learning ---
  alpha: 0.1,             // learning rate
  gamma: 0.95,            // discount (raised for v2: reward is banked at rest, ~20-40 steps away)
  defaultQ: 0,            // Q for unseen (state, action) pairs

  // --- exploration ---
  // 'ucb': optimism under uncertainty — pick argmax_a [ Q(s,a) + ucbC·√(ln N_state / n_state,action) ].
  //        Under-sampled ("unsettled") actions get a bonus; well-sampled ones ~0. Auto-anneals, no
  //        schedule, and reuses the SAME visit counts the layered coupling weights by. Untried (s,a)
  //        get an infinite bonus (tried first). For the layered agent the bonus is confidence-weighted
  //        across layers, so we don't chase never-settling fine-window states.
  // 'egreedy': legacy ε-random (kept for baselines).
  explore: 'ucb',
  ucbC: 1.0,              // UCB exploration constant (higher = explore longer)
  epsilon: 0.1,           // only used when explore = 'egreedy'

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
  { key: 'gridN', label: 'Arena N', min: 4, max: 20, step: 1, resets: true },
  { key: 'receptiveField', label: 'Window', min: 1, max: 9, step: 2, resets: true },
  { key: 'nFood', label: 'Food', min: 0, max: 30, step: 1, resets: true },
  { key: 'nWater', label: 'Water', min: 0, max: 30, step: 1, resets: true },
  { key: 'nPits', label: 'Pits', min: 0, max: 12, step: 1, resets: true },
  { key: 'ucbC', label: 'Explore c', min: 0, max: 4, step: 0.1 },
  { key: 'alpha', label: 'Learn α', min: 0.01, max: 1, step: 0.01 },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];
