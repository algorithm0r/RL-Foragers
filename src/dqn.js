'use strict';
// DQNAgent — a deep-Q baseline for the SAME forager task, so we can ask: does a neural net over the
// raw window discover the multi-scale structure the layered tabular agent hand-builds, and at what
// sample cost / reliability? Deliberately a small, dependency-free MLP (no TF.js — that would break
// the no-build/no-modules/main-realm-eval rules): one hidden ReLU layer, experience replay, a target
// network, ε-greedy with a linear anneal. Reproducible under the seeded Math.random like everything else.
//
// Input = the agent-centered window (side `dqnField`), one-hot per cell over the cell categories, so
// the encoding is SPARSE (one active index per cell) — we carry only the active indices for speed.
// Output = one Q per action. It sees a single flat window (the honest monolithic-NN control for the
// layered stack); in shelter mode it does NOT get the internal bearing/time signal (sweep-mode baseline).
var DQNAgent = class DQNAgent {
  constructor(nActions) {
    this.nActions = this.A = nActions;
    const side = PARAMETERS.dqnField;
    this.R = (side - 1) >> 1;
    this.side = side;
    this.C = (PARAMETERS.enableShelter ? 4 : (PARAMETERS.nTypes || 1)) + 1; // cell categories (values 0..C-1)
    this.I = side * side * this.C;         // input width (one-hot per cell)
    this.H = PARAMETERS.dqnHidden;
    this.lr = PARAMETERS.dqnAlpha; this.gamma = PARAMETERS.gamma;
    this.batch = PARAMETERS.dqnBatch; this.cap = PARAMETERS.dqnReplay;
    this.sync = PARAMETERS.dqnTargetSync; this.warmup = PARAMETERS.dqnWarmup;
    this.epsStart = PARAMETERS.dqnEpsStart; this.epsEnd = PARAMETERS.dqnEpsEnd; this.epsDecay = PARAMETERS.dqnEpsDecaySteps;

    // online net
    this.W1 = this.initMat(this.H, this.I); this.b1 = new Float64Array(this.H);
    this.W2 = this.initMat(this.A, this.H); this.b2 = new Float64Array(this.A);
    // target net (periodic copies)
    this.tW1 = this.W1.slice(); this.tb1 = this.b1.slice();
    this.tW2 = this.W2.slice(); this.tb2 = this.b2.slice();
    // gradient accumulators (reused each train step)
    this.gW1 = new Float64Array(this.H * this.I); this.gb1 = new Float64Array(this.H);
    this.gW2 = new Float64Array(this.A * this.H); this.gb2 = new Float64Array(this.A);

    this.buf = new Array(this.cap); this.pos = 0; this.filled = 0; // ring replay buffer
    this.steps = 0; this.lastAction = null; this.layers = null;
  }

  initMat(rows, cols) {
    const m = new Float64Array(rows * cols), lim = Math.sqrt(6 / (rows + cols)); // Xavier uniform
    for (let i = 0; i < m.length; i++) m[i] = (Math.random() * 2 - 1) * lim;
    return m;
  }

  viewRadius() { return this.R; }
  paramCount() { return this.I * this.H + this.H + this.H * this.A + this.A; }
  numStates() { return this.paramCount(); } // so the HUD/harness can report a size for DQN too

  // sparse encoding: the active input index for each window cell (cellPos*C + category)
  encode(world) {
    const side = this.side, R = this.R, C = this.C, idx = new Int32Array(side * side);
    let p = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      let v = world.cell(dx, dy); if (v < 0) v = 0; else if (v >= C) v = C - 1;
      idx[p] = p * C + v; p++;
    }
    return idx;
  }

  // forward pass from sparse active indices → {h, q}. Each active input is 1, so the first layer is
  // a sum of the corresponding weight columns.
  forward(idx, W1, b1, W2, b2) {
    const H = this.H, I = this.I, A = this.A, h = new Float64Array(H), q = new Float64Array(A);
    for (let k = 0; k < H; k++) {
      let z = b1[k], base = k * I;
      for (let j = 0; j < idx.length; j++) z += W1[base + idx[j]];
      h[k] = z > 0 ? z : 0; // ReLU
    }
    for (let a = 0; a < A; a++) {
      let z = b2[a], base = a * H;
      for (let k = 0; k < H; k++) z += W2[base + k] * h[k];
      q[a] = z;
    }
    return { h, q };
  }

  qValues(idx) { return this.forward(idx, this.W1, this.b1, this.W2, this.b2).q; }
  argmax(q) { let m = -Infinity, best = [], a; for (a = 0; a < q.length; a++) { if (q[a] > m) { m = q[a]; best = [a]; } else if (q[a] === m) best.push(a); } return best[randomInt(best.length)]; }
  currentEps() { const t = this.steps; return t >= this.epsDecay ? this.epsEnd : this.epsStart - (this.epsStart - this.epsEnd) * (t / this.epsDecay); }

  store(idx, a, r, nidx, done) { this.buf[this.pos] = { idx, a, r, nidx, done }; this.pos = (this.pos + 1) % this.cap; if (this.filled < this.cap) this.filled++; }

  // one minibatch SGD step on the TD error, target from the frozen target net
  trainStep() {
    const H = this.H, I = this.I, A = this.A, B = this.batch;
    this.gW1.fill(0); this.gb1.fill(0); this.gW2.fill(0); this.gb2.fill(0);
    for (let b = 0; b < B; b++) {
      const s = this.buf[randomInt(this.filled)];
      const f = this.forward(s.idx, this.W1, this.b1, this.W2, this.b2), h = f.h, q = f.q;
      let y = s.r;
      if (!s.done) { const qn = this.forward(s.nidx, this.tW1, this.tb1, this.tW2, this.tb2).q; let m = -Infinity; for (let a = 0; a < A; a++) if (qn[a] > m) m = qn[a]; y += this.gamma * m; }
      const err = q[s.a] - y; // dL/dq for the taken action (MSE, factor 2 folded into lr)
      this.gb2[s.a] += err;
      const base2 = s.a * H;
      for (let k = 0; k < H; k++) {
        this.gW2[base2 + k] += err * h[k];
        if (h[k] <= 0) continue;                 // ReLU gate
        const dz = this.W2[base2 + k] * err, base1 = k * I;
        this.gb1[k] += dz;
        for (let j = 0; j < s.idx.length; j++) this.gW1[base1 + s.idx[j]] += dz; // active inputs are 1
      }
    }
    const step = this.lr / B;
    for (let i = 0; i < this.W1.length; i++) this.W1[i] -= step * this.gW1[i];
    for (let k = 0; k < H; k++) this.b1[k] -= step * this.gb1[k];
    for (let i = 0; i < this.W2.length; i++) this.W2[i] -= step * this.gW2[i];
    for (let a = 0; a < A; a++) this.b2[a] -= step * this.gb2[a];
  }

  syncTarget() { this.tW1.set(this.W1); this.tb1.set(this.b1); this.tW2.set(this.W2); this.tb2.set(this.b2); }

  act(world) {
    const idx = this.encode(world);
    const action = Math.random() < this.currentEps() ? randomInt(this.A) : this.argmax(this.qValues(idx));
    const outcome = world.applyAction(action);
    const nidx = outcome.done ? null : this.encode(world);
    this.store(idx, action, outcome.reward, nidx, outcome.done);
    this.steps++;
    if (this.filled >= this.warmup) this.trainStep();
    if (this.steps % this.sync === 0) this.syncTarget();
    this.lastAction = action;
    return outcome;
  }
};
