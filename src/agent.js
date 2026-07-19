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
    const action = PARAMETERS.explore === 'ucb'
      ? this.learner.selectUCB(state, PARAMETERS.ucbC)
      : this.learner.select(state);
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
    // one learner per window size; radius r = (size-1)/2
    this.layers = PARAMETERS.layers.map((size) => ({
      size, r: (size - 1) >> 1, learner: new QLearner(nActions),
    }));
    this.lastWeights = this.layers.map(() => 0); // instrumentation: last coupling weights
    this.lastAction = null;
  }

  viewRadius() {
    let m = 0;
    for (const L of this.layers) if (L.r > m) m = L.r;
    return m;
  }

  // saturating count → confidence in [0,1): a layer that has seen its abstract state many times
  // is trusted; a layer facing a novel (low-count) state contributes little.
  confidence(count) { return count / (count + PARAMETERS.confidenceK); }

  // each layer's abstract state (window slice) at the agent's current position
  statesFor(world) { return this.layers.map((L) => world.senseWindow(L.r)); }

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
    const action = PARAMETERS.explore === 'ucb'
      ? this.selectUCB(states, combined)
      : (Math.random() < PARAMETERS.epsilon ? randomInt(this.nActions) : this.argmax(combined.q));

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

// factory: World builds its agent through this, so the sim core stays agent-agnostic
function makeAgent(nActions) {
  return PARAMETERS.agent === 'flat' ? new FlatAgent(nActions) : new LayeredAgent(nActions);
}
