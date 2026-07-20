'use strict';
// The forager's policy. Two flavours share one contract — act(world) → {reward, done} — so the
// World (and everything else) is agnostic to which is in play. makeAgent() picks by PARAMETERS.agent.
//
//  FlatAgent    — Stage 1 baseline: ONE learner over a single window.
//  LayeredAgent — Stage 2: a stack of receptive-field learners (L1/L3/L5), each its own Q-table,
//                 combined at decision time by COUNT-BASED CONFIDENCE. Each layer learns
//                 independently (bootstraps on its own next-state max); the combination is the
//                 behaviour policy. (The combined-bootstrap and residual variants are Stage-3.)

var FlatAgent = class FlatAgent {
  constructor(nActions) {
    this.nActions = nActions;
    this.learner = new QLearner(nActions);
    this.lastAction = null;
  }

  viewRadius() { return (PARAMETERS.receptiveField - 1) >> 1; }

  act(world) {
    const state = world.senseState();
    const action = PARAMETERS.explore === 'ucb' ? this.learner.selectUCB(state, PARAMETERS.ucbC)
      : PARAMETERS.explore === 'egreedy' ? this.learner.select(state)
        : this.learner.bestAction(state); // 'greedy' — exploration comes from the strategic init
    const outcome = world.applyAction(action);
    const nextState = outcome.done ? null : world.senseState();
    this.learner.learn(state, action, outcome.reward, nextState);
    this.lastAction = action;
    return outcome;
  }
};

var LayeredAgent = class LayeredAgent {
  constructor(nActions) {
    this.nActions = nActions;
    // Layers are different FEATURE FILTERS, not just spatial scales. Spatial 'window' layers sense a
    // pure local window (reflexes/navigation that GENERALIZE across bearing/satiety); an optional
    // 'internal' layer senses ONLY shelter-bearing + satiety (the homing/rest decision) in its own
    // tiny state space. Keeping them separate is what stops the state count from exploding.
    this.layers = PARAMETERS.layers.map((size) => ({
      kind: 'window', size, r: (size - 1) >> 1, label: 'L' + size,
      learner: PARAMETERS.relevanceFilter ? new UTreeLearner(nActions) : new QLearner(nActions),
    }));
    if (PARAMETERS.strategicLayer && PARAMETERS.enableShelter) { // only meaningful when there's a home to return to
      this.layers.push({ kind: 'internal', label: 'INT', learner: new QLearner(nActions) });
    }
    this.lastWeights = this.layers.map(() => 0); // instrumentation: last coupling weights
    this.lastAction = null;
  }

  viewRadius() {
    let m = 0;
    for (const L of this.layers) if (L.kind === 'window' && L.r > m) m = L.r;
    return m;
  }

  // saturating count → confidence in [0,1): a layer that has seen its abstract state many times
  // is trusted; a layer facing a novel (low-count) state contributes little.
  confidence(count) { return count / (count + PARAMETERS.confidenceK); }

  // each layer's abstract state: a pure local window ('window' layers) or the internal bearing+satiety
  // code ('internal' layer). No cross-augmentation → the spatial reflexes stay reusable.
  statesFor(world) {
    return this.layers.map((L) => (L.kind === 'window' ? world.senseWindow(L.r) : world.internalCode()));
  }

  // confidence-weighted combined Q over actions. Returns {q:[...], weights:[...] normalized}.
  combine(states) {
    const raw = this.layers.map((L, i) => this.confidence(L.learner.getStateCount(states[i])));
    let sum = 0; for (const w of raw) sum += w;
    const weights = sum > 0 ? raw.map((w) => w / sum) : raw.map(() => 1 / this.layers.length);
    const q = new Array(this.nActions).fill(0);
    for (let i = 0; i < this.layers.length; i++) {
      const w = weights[i];
      if (w === 0) continue;
      const learner = this.layers[i].learner, st = states[i];
      for (let a = 0; a < this.nActions; a++) q[a] += w * learner.getQ(st, a);
    }
    return { q, weights };
  }

  argmax(q) {
    let m = -Infinity; const best = [];
    for (let a = 0; a < q.length; a++) {
      if (q[a] > m) { m = q[a]; best.length = 0; best.push(a); }
      else if (q[a] === m) best.push(a);
    }
    return best[randomInt(best.length)];
  }

  // UCB over the combined Q with a confidence-WEIGHTED exploration bonus: each layer's uncertainty
  // counts only as much as we rely on it (same weights as the value combination), so we don't chase
  // the uncertainty of a down-weighted, never-settling fine-window layer. An untried (state,action)
  // in any relied-on layer forces that action (infinite bonus → tried first).
  selectUCB(states, combined) {
    const c = PARAMETERS.ucbC, w = combined.weights, q = combined.q;
    let m = -Infinity; const best = [];
    for (let a = 0; a < this.nActions; a++) {
      let bonus = 0, forced = false;
      for (let i = 0; i < this.layers.length; i++) {
        if (w[i] === 0) continue;
        const learner = this.layers[i].learner;
        if (learner.getCount(states[i], a) === 0) { forced = true; break; }
        bonus += w[i] * learner.ucbBonus(states[i], a, c);
      }
      const v = forced ? Infinity : q[a] + bonus;
      if (v > m) { m = v; best.length = 0; best.push(a); }
      else if (v === m) best.push(a);
    }
    return best[randomInt(best.length)];
  }

  act(world) {
    const states = this.statesFor(world);
    const combined = this.combine(states);
    this.lastWeights = combined.weights;
    const action = PARAMETERS.explore === 'ucb' ? this.selectUCB(states, combined)
      : PARAMETERS.explore === 'egreedy' ? (Math.random() < PARAMETERS.epsilon ? randomInt(this.nActions) : this.argmax(combined.q))
        : this.argmax(combined.q); // 'greedy' — exploration comes from the strategic init (defaultQ)

    const outcome = world.applyAction(action);
    const nextStates = outcome.done ? null : this.statesFor(world);

    // each layer learns on its OWN abstracted transition, bootstrapping on its own next-state max
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].learner.learn(states[i], action, outcome.reward, nextStates ? nextStates[i] : null);
    }
    this.lastAction = action;
    return outcome;
  }
};

// Subsumption control (Brooks-style): the layers are the same learned window Q-tables, but arbitration
// is a FIXED PRIORITY instead of a confidence blend — the narrowest window layer that has a goal in
// view acts; if none do, the widest layer wanders. Only the ACTIVE layer learns, so each layer's Q
// covers only its band (states where narrower layers are empty) — which shrinks per-layer state counts.
// This is the control for "does the confidence WEIGHTING matter, or just having the sub-policies?".
var SubsumptionAgent = class SubsumptionAgent {
  constructor(nActions) {
    this.nActions = nActions;
    this.layers = PARAMETERS.layers.map((size) => ({
      kind: 'window', size, r: (size - 1) >> 1, label: 'L' + size, learner: new QLearner(nActions),
    }));
    this.lastWeights = this.layers.map(() => 0); // one-hot of the active layer (for the HUD)
    this.lastAction = null;
  }

  viewRadius() { let m = 0; for (const L of this.layers) if (L.r > m) m = L.r; return m; }
  statesFor(world) { return this.layers.map((L) => world.senseWindow(L.r)); }

  // does a window contain a resource (food '1', or water '2' when enabled)?
  hasGoal(state) {
    for (let i = 0; i < state.length; i++) { const c = state[i]; if (c === '1' || (PARAMETERS.enableWater && c === '2')) return true; }
    return false;
  }

  act(world) {
    const states = this.statesFor(world);
    let active = this.layers.length - 1; // default: widest layer wanders when nothing is in view
    for (let i = 0; i < this.layers.length; i++) if (this.hasGoal(states[i])) { active = i; break; }
    for (let i = 0; i < this.layers.length; i++) this.lastWeights[i] = i === active ? 1 : 0;

    const L = this.layers[active], st = states[active];
    const action = Math.random() < PARAMETERS.epsilon ? randomInt(this.nActions) : L.learner.bestAction(st);
    const outcome = world.applyAction(action);
    const next = outcome.done ? null : world.senseWindow(L.r);
    L.learner.learn(st, action, outcome.reward, next); // only the active layer learns
    this.lastAction = action;
    return outcome;
  }
};

// factory: World builds its agent through this, so the sim core stays agent-agnostic
function makeAgent(nActions) {
  if (PARAMETERS.agent === 'flat') return new FlatAgent(nActions);
  if (PARAMETERS.agent === 'subsumption') return new SubsumptionAgent(nActions);
  return new LayeredAgent(nActions);
}
