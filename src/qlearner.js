'use strict';
// Tabular Q-learning over string-keyed states. Stores, per (state, action), both the Q-value
// AND a visit count — the count is unused by the flat Stage-1 learner but is the confidence
// signal the Stage-2 layered coupling weights by (conventions: see DEVPLAN "coupling").
// Declared `var X = class X` so it's a global in the browser AND the headless main realm.
var QLearner = class QLearner {
  constructor(nActions) {
    this.nActions = nActions;
    this.Q = new Map();       // "state|action" -> value
    this.counts = new Map();  // "state|action" -> times updated (confidence)
  }

  key(state, action) { return state + '|' + action; }

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

  // Q(s,a) ← Q(s,a) + α[r + γ·maxₐ' Q(s',a') − Q(s,a)]; nextState === null means terminal (no bootstrap)
  learn(state, action, reward, nextState) {
    const k = this.key(state, action);
    const cur = this.getQ(state, action);
    const target = nextState === null ? reward : reward + PARAMETERS.gamma * this.maxQ(nextState);
    this.Q.set(k, cur + PARAMETERS.alpha * (target - cur));
    this.counts.set(k, (this.counts.get(k) || 0) + 1);
  }
};
