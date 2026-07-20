'use strict';
// Tabular Q-learning over string-keyed states. Stores, per (state, action), both the Q-value
// AND a visit count — the count is unused by the flat Stage-1 learner but is the confidence
// signal the Stage-2 layered coupling weights by (conventions: see DEVPLAN "coupling").
// Declared `var X = class X` so it's a global in the browser AND the headless main realm.
var QLearner = class QLearner {
  constructor(nActions) {
    this.nActions = nActions;
    this.Q = new Map();           // "state|action" -> value
    this.counts = new Map();      // "state|action" -> times updated
    this.stateCounts = new Map(); // "state" -> times updated in that state (the coupling's confidence signal)
  }

  key(state, action) { return state + '|' + action; }

  // how many updates this learner has made in `state` (summed over actions) — its "known-ness"
  getStateCount(state) { return this.stateCounts.get(state) || 0; }

  numStates() { return this.stateCounts.size; } // distinct abstract states seen (matches UTreeLearner)

  getQ(state, action) {
    const v = this.Q.get(this.key(state, action));
    return v === undefined ? PARAMETERS.defaultQ : v;
  }

  getCount(state, action) {
    return this.counts.get(this.key(state, action)) || 0;
  }

  // best Q over actions in a state
  maxQ(state) {
    let m = -Infinity;
    for (let a = 0; a < this.nActions; a++) {
      const q = this.getQ(state, a);
      if (q > m) m = q;
    }
    return m;
  }

  // greedy action with uniform random tie-breaking (so an all-default state isn't biased to a=0)
  bestAction(state) {
    let m = -Infinity;
    const best = [];
    for (let a = 0; a < this.nActions; a++) {
      const q = this.getQ(state, a);
      if (q > m) { m = q; best.length = 0; best.push(a); }
      else if (q === m) { best.push(a); }
    }
    return best[randomInt(best.length)];
  }

  // ε-greedy
  select(state) {
    if (Math.random() < PARAMETERS.epsilon) return randomInt(this.nActions);
    return this.bestAction(state);
  }

  // UCB exploration bonus for (state, action): big when the pair is under-sampled ("unsettled"),
  // → 0 as it settles. Never-tried pairs return Infinity so they're tried first (optimism).
  ucbBonus(state, action, c) {
    const n = this.getCount(state, action);
    if (n === 0) return Infinity;
    return c * Math.sqrt(Math.log(this.getStateCount(state) + 1) / n);
  }

  // UCB action selection: argmax_a [ Q(s,a) + ucbBonus ], random tie-break (handles ∞ ties)
  selectUCB(state, c) {
    let m = -Infinity;
    const best = [];
    for (let a = 0; a < this.nActions; a++) {
      const v = this.getQ(state, a) + this.ucbBonus(state, a, c);
      if (v > m) { m = v; best.length = 0; best.push(a); }
      else if (v === m) best.push(a);
    }
    return best[randomInt(best.length)];
  }

  // Q(s,a) ← Q(s,a) + α[r + γ·maxₐ' Q(s',a') − Q(s,a)]; nextState === null means terminal (no bootstrap)
  learn(state, action, reward, nextState) {
    const k = this.key(state, action);
    const cur = this.getQ(state, action);
    const target = nextState === null ? reward : reward + PARAMETERS.gamma * this.maxQ(nextState);
    this.Q.set(k, cur + PARAMETERS.alpha * (target - cur));
    this.counts.set(k, (this.counts.get(k) || 0) + 1);
    this.stateCounts.set(state, (this.stateCounts.get(state) || 0) + 1);
  }
};
