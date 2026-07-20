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
  gridN: 10,              // arena side length (torus)
  nFood: 10,              // food items placed each episode
  nWater: 6,              // water items (when enableWater)
  nPits: 3,               // pits (when enablePits)
  maxStepsPerEpisode: 500, // step cutoff → episode ends (sweep: counts the cutoff; shelter: banks 0)

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
  strategicLayer: true,   // in SHELTER mode, add an INTERNAL layer sensing only bearing + satiety (the
                          // homing/rest decision), so the spatial window layers stay pure reflexes
  confidenceK: 30,        // saturation of the count→confidence curve; higher = slower to trust a layer

  // --- reward: gather=+1 (eat/drink), any other action=-1, clear/rest bonus, pit = death ---
  // rewardGather ≈ |rewardStep| is deliberate: it puts "about to gather" just above 0 and "searching"
  // just below 0, so the Q-value gap straddles zero and defaultQ=0 is the strategic exploration
  // threshold for free (untried actions beat wandering but lose to a learned good action). Scale-
  // anchored: change rewardStep and scale rewardGather with it. (Measured: gap −0.04 → +0.79 at +1.)
  rewardGather: 1,        // a successful eat or drink
  rewardStep: -1,         // any move, or a failed eat/drink/rest
  rewardPerUnit: 50,      // shelter mode: banked reward per balanced (food,water) pair at rest
  pitPenalty: 50,         // reward on entering a pit (terminal death)

  // --- tabular Q-learning ---
  alpha: 0.1,             // learning rate
  gamma: 0.95,            // discount (raised for v2: reward is banked at rest, ~20-40 steps away)
  defaultQ: 0,            // Q for unseen (state, action) pairs

  // --- exploration ---
  // 'greedy':  pure argmax of Q. Exploration comes from the STRATEGIC INIT: unvisited (s,a) return
  //            defaultQ=0, which sits in the value gap — so untried actions beat known-bad wandering
  //            (explore) but lose to a learned good action (the reflex is never overridden). No bonus,
  //            no forcing. Apt for this (deterministic) world; the default.
  // 'ucb':     optimism via a count bonus, argmax_a [ Q + ucbC·√(ln N_state / n_state,action) ]; untried
  //            (s,a) forced first. Scale-free but its forcing can override a confident reflex — kept for
  //            comparison.
  // 'egreedy': ε-random (kept for baselines).
  explore: 'greedy',
  ucbC: 1.0,              // UCB exploration constant (higher = explore longer); only when explore='ucb'
  epsilon: 0.1,           // ε-random rate; only when explore='egreedy'

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
  // model toggles (checkboxes) — build up from the base food-sweep model. Each flip rebuilds the sim.
  { key: 'agent', label: 'Layered agent', type: 'checkbox', onVal: 'layered', offVal: 'flat' },
  { key: 'enableWater', label: '+ Water (2nd resource)', type: 'checkbox' },
  { key: 'enableShelter', label: '+ Shelter (rest ends day)', type: 'checkbox' },
  { key: 'enablePits', label: '+ Pits (death)', type: 'checkbox' },
  // sliders
  { key: 'gridN', label: 'Arena N', min: 4, max: 20, step: 1, resets: true },
  { key: 'nFood', label: 'Food', min: 0, max: 30, step: 1, resets: true },
  { key: 'nWater', label: 'Water', min: 0, max: 30, step: 1, resets: true },
  { key: 'nPits', label: 'Pits', min: 0, max: 12, step: 1, resets: true },
  { key: 'explore', label: 'Exploration', type: 'select', options: ['greedy', 'ucb', 'egreedy'] },
  { key: 'ucbC', label: 'UCB explore c', min: 0, max: 4, step: 0.1 },
  { key: 'epsilon', label: 'ε-greedy ε', min: 0, max: 1, step: 0.01 },
  { key: 'alpha', label: 'Learn α', min: 0.01, max: 1, step: 0.01 },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];
