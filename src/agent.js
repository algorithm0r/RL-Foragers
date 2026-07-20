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
  constructor(nActions, channel) {
    this.nActions = nActions;
    this.channel = channel || null; // if set, window layers see only this resource type (binarized)
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
    // optional experience replay (Dyna-Q): re-apply stored transitions each step to speed value
    // propagation, matching the DQN's update budget. Value-only (learnQ), so the confidence counts
    // still reflect REAL visitation. This is the control for "was the DQN's edge budget or representation?"
    this.replay = PARAMETERS.qReplay ? { buf: new Array(PARAMETERS.qReplayCap), pos: 0, filled: 0, cap: PARAMETERS.qReplayCap, seen: 0 } : null;
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
    return this.layers.map((L) => (L.kind === 'window' ? world.senseWindow(L.r, this.channel) : world.internalCode()));
  }

  // combined Q vector for a set of layer states (also records the coupling weights) — used by
  // MultiResourceAgent to sum per-resource opinions without letting a sub-agent select/learn on its own.
  qVector(states) { const c = this.combine(states); this.lastWeights = c.weights; return c.q; }

  // each layer learns on its own abstracted transition (extracted from act() so MultiResource can
  // drive the shared (action, reward, next) into every sub-agent).
  learnTransition(states, action, reward, nextStates) {
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].learner.learn(states[i], action, reward, nextStates ? nextStates[i] : null);
    }
  }

  // replay update: fit Q only (no count bump), so replayed repeats don't fake visitation
  replayTransition(states, action, reward, nextStates) {
    for (let i = 0; i < this.layers.length; i++) {
      const L = this.layers[i].learner;
      (L.learnQ ? L.learnQ : L.learn).call(L, states[i], action, reward, nextStates ? nextStates[i] : null);
    }
  }

  // store the real transition, then re-apply qReplayK sampled transitions (Dyna-Q planning steps)
  doReplay(states, action, reward, nextStates) {
    const R = this.replay;
    R.buf[R.pos] = { states, action, reward, nextStates }; R.pos = (R.pos + 1) % R.cap; if (R.filled < R.cap) R.filled++;
    if (++R.seen < PARAMETERS.qReplayWarmup) return;
    for (let b = 0; b < PARAMETERS.qReplayK; b++) { const s = R.buf[randomInt(R.filled)]; this.replayTransition(s.states, s.action, s.reward, s.nextStates); }
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
    this.learnTransition(states, action, outcome.reward, nextStates);
    if (this.replay) this.doReplay(states, action, outcome.reward, nextStates);
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
  constructor(nActions, channel) {
    this.nActions = nActions;
    this.channel = channel || null; // if set, window layers see only this resource type (binarized)
    this.layers = PARAMETERS.layers.map((size) => ({
      kind: 'window', size, r: (size - 1) >> 1, label: 'L' + size, learner: new QLearner(nActions),
    }));
    this.lastWeights = this.layers.map(() => 0); // one-hot of the active layer (for the HUD)
    this.lastAction = null;
    this._active = this.layers.length - 1;
  }

  viewRadius() { let m = 0; for (const L of this.layers) if (L.r > m) m = L.r; return m; }
  statesFor(world) { return this.layers.map((L) => world.senseWindow(L.r, this.channel)); }

  // does a window contain a resource? A binarized (channel) view marks its type as '1'; otherwise
  // resources are cell types 1..maxType.
  hasGoal(state) {
    if (this.channel) { for (let i = 0; i < state.length; i++) if (state[i] === '1') return true; return false; }
    const maxType = PARAMETERS.enableShelter ? (PARAMETERS.enableWater ? 2 : 1) : (PARAMETERS.nTypes || 1);
    for (let i = 0; i < state.length; i++) { const v = parseInt(state[i], 36); if (v >= 1 && v <= maxType) return true; }
    return false;
  }

  // the narrowest window layer with a goal in view (else the widest, which wanders)
  activeLayer(states) {
    let active = this.layers.length - 1;
    for (let i = 0; i < this.layers.length; i++) if (this.hasGoal(states[i])) { active = i; break; }
    for (let i = 0; i < this.layers.length; i++) this.lastWeights[i] = i === active ? 1 : 0;
    this._active = active;
    return active;
  }

  // this sub-agent's Q vector = the active layer's Q (for MultiResource summing). Remembers the
  // active layer so learnTransition updates the same one.
  qVector(states) {
    const L = this.layers[this.activeLayer(states)], st = states[this._active];
    const q = new Array(this.nActions);
    for (let a = 0; a < this.nActions; a++) q[a] = L.learner.getQ(st, a);
    return q;
  }

  learnTransition(states, action, reward, nextStates) {
    const a = this._active, L = this.layers[a];
    L.learner.learn(states[a], action, reward, nextStates ? nextStates[a] : null); // only the active layer learns
  }

  act(world) {
    const states = this.statesFor(world);
    const active = this.activeLayer(states), L = this.layers[active], st = states[active];
    const action = Math.random() < PARAMETERS.epsilon ? randomInt(this.nActions) : L.learner.bestAction(st);
    const outcome = world.applyAction(action);
    const next = outcome.done ? null : this.statesFor(world);
    this.learnTransition(states, action, outcome.reward, next);
    this.lastAction = action;
    return outcome;
  }
};

// Per-resource decomposition: one sub-agent (layered or subsumption) PER resource type, each seeing
// only its own resource (binarized view). Their Q vectors SUM into the action choice. Factoring by
// resource means each sub-learner is a simple single-resource forager (binary window → small state
// space), and the sum naturally routes each collect action to the learner that owns it.
var MultiResourceAgent = class MultiResourceAgent {
  constructor(nActions, kind, combineMode) { // kind='layered'|'subsumption'; combineMode='sum'|'max'(WTA)
    this.nActions = nActions;
    this.combineMode = combineMode || 'sum';
    const K = PARAMETERS.nTypes || 1;
    this.subs = [];
    for (let t = 1; t <= K; t++) this.subs.push(kind === 'subsumption' ? new SubsumptionAgent(nActions, t) : new LayeredAgent(nActions, t));
    this.layers = [].concat.apply([], this.subs.map((s) => s.layers)); // so qStates sums across sub-agents
    this.lastWeights = this.layers.map(() => 0);
    this.lastAction = null;
  }

  viewRadius() { return this.subs[0].viewRadius(); }

  argmax(q) {
    let m = -Infinity; const best = [];
    for (let a = 0; a < q.length; a++) { if (q[a] > m) { m = q[a]; best.length = 0; best.push(a); } else if (q[a] === m) best.push(a); }
    return best[randomInt(best.length)];
  }

  act(world) {
    const subStates = this.subs.map((s) => s.statesFor(world));
    const qs = this.subs.map((s, i) => s.qVector(subStates[i]));
    let chooseQ;
    if (this.combineMode === 'max') { // winner-take-all: the sub with the highest max-Q dictates the action
      let bestVal = -Infinity; chooseQ = qs[0];
      for (const q of qs) { let mx = -Infinity; for (const v of q) if (v > mx) mx = v; if (mx > bestVal) { bestVal = mx; chooseQ = q; } }
    } else { // sum
      chooseQ = new Array(this.nActions).fill(0);
      for (const q of qs) for (let a = 0; a < this.nActions; a++) chooseQ[a] += q[a];
    }
    const action = Math.random() < PARAMETERS.epsilon ? randomInt(this.nActions) : this.argmax(chooseQ);
    const outcome = world.applyAction(action);
    // REWARD DECOMPOSITION: each resource learner gets only its own resource's reward — the collector
    // sub gets the gather/clear reward, everyone else gets the step cost (that action didn't help them).
    const gained = outcome.collected || 0;
    const nextSub = outcome.done ? null : this.subs.map((s) => s.statesFor(world));
    for (let i = 0; i < this.subs.length; i++) {
      const rt = (gained === i + 1) ? outcome.reward : PARAMETERS.rewardStep;
      this.subs[i].learnTransition(subStates[i], action, rt, nextSub ? nextSub[i] : null);
    }
    this.lastAction = action;
    return outcome;
  }
};

// factory: World builds its agent through this, so the sim core stays agent-agnostic
function makeAgent(nActions) {
  if (PARAMETERS.agent === 'flat') return new FlatAgent(nActions);
  if (PARAMETERS.agent === 'dqn') return new DQNAgent(nActions);
  if (PARAMETERS.agent === 'subsumption') return new SubsumptionAgent(nActions);
  if (PARAMETERS.agent === 'multi-layered') return new MultiResourceAgent(nActions, 'layered', 'sum');
  if (PARAMETERS.agent === 'multi-subsumption') return new MultiResourceAgent(nActions, 'subsumption', 'sum');
  if (PARAMETERS.agent === 'multi-layered-wta') return new MultiResourceAgent(nActions, 'layered', 'max');
  if (PARAMETERS.agent === 'multi-subsumption-wta') return new MultiResourceAgent(nActions, 'subsumption', 'max');
  return new LayeredAgent(nActions);
}
