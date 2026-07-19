'use strict';
// The forager's policy: a thin wrapper over a QLearner. It holds no environment state (the
// grid and the agent's position live in the World); it only senses, decides, acts, and learns.
// Stage 1 = one FLAT learner over the whole-grid window. Stage 2 will swap this for a stack of
// receptive-field learners combined by confidence — same act() contract, so nothing else changes.
var Agent = class Agent {
  constructor(nActions) {
    this.nActions = nActions;
    this.learner = new QLearner(nActions);
    this.lastAction = null;
  }

  // one decision cycle inside `world`. Returns {reward, done} so the world can track episodes.
  act(world) {
    const state = world.senseState();
    const action = this.learner.select(state);
    const outcome = world.applyAction(action);
    const nextState = outcome.done ? null : world.senseState(); // null = terminal (no bootstrap)
    this.learner.learn(state, action, outcome.reward, nextState);
    this.lastAction = action;
    return outcome;
  }
};
