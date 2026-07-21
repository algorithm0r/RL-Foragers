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
  qReplayCap: 20000,      // replay buffer capacity
  qReplayWarmup: 1000,    // real steps before replay kicks in

  // --- tabular Q-learning ---
  alpha: 0.1,             // learning rate
  gamma: 0.95,            // discount (raised for v2: reward is banked at rest, ~20-40 steps away)
  defaultQ: 0,            // Q for unseen (state, action) pairs

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
  { key: 'enableRocks', label: '+ Rocks (block)', type: 'checkbox' },
  { key: 'enableGoats', label: '+ Goats (prey agents)', type: 'checkbox' },
  { key: 'relevanceFilter', label: 'Relevance filter (U-Tree)', type: 'checkbox' },
  // sliders
  { key: 'gridN', label: 'Arena N', min: 4, max: 20, step: 1, resets: true },
  { key: 'nFood', label: 'Food', min: 0, max: 30, step: 1, resets: true },
  { key: 'nWater', label: 'Water', min: 0, max: 30, step: 1, resets: true },
  { key: 'nPits', label: 'Pits', min: 0, max: 12, step: 1, resets: true },
  { key: 'nRocks', label: 'Rocks', min: 0, max: 24, step: 1, resets: true },
  { key: 'nGoats', label: 'Goats', min: 0, max: 8, step: 1, resets: true },
  { key: 'maxStepsPerEpisode', label: 'Day length', min: 20, max: 1000, step: 20 },
  { key: 'collapsePenalty', label: 'Collapse −M', min: 0, max: 100, step: 5 },
  { key: 'explore', label: 'Exploration', type: 'select', options: ['greedy', 'ucb', 'egreedy'] },
  { key: 'ucbC', label: 'UCB explore c', min: 0, max: 4, step: 0.1 },
  { key: 'epsilon', label: 'ε-greedy ε', min: 0, max: 1, step: 0.01 },
  { key: 'alpha', label: 'Learn α', min: 0.01, max: 1, step: 0.01 },
  { key: 'qReplay', label: 'Replay (Dyna-Q)', type: 'checkbox' },
  { key: 'qReplayK', label: 'Replay K', min: 0, max: 128, step: 4 },
  { key: 'updatesPerDraw', label: 'Speed', min: 1, max: 500, step: 1 },
];
