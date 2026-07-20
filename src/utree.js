'use strict';
// U-Tree (McCallum 1995) relevance filter — a per-layer learner that keys Q on a decision TREE over
// the window's cells instead of the raw window. It starts as ONE leaf (all cells ignored → every
// window maps to a single aggregate state) and SPLITS a leaf on a cell only when that cell's value
// significantly predicts the TD target (i.e. the cell is *relevant*). So each layer attends to just
// the cells that matter — keeping wide windows cheap — and relevance is CONDITIONAL: a cell can be
// split only inside the leaf where it matters (e.g. an outer cell only once the inner cells are empty).
//
// Drop-in for QLearner: identical (windowString, action) interface; internally window → leaf. Because
// a G-algorithm global split is just a root-only U-Tree, this subsumes the G-algorithm too.
var UTreeLearner = class UTreeLearner {
  constructor(nActions) {
    this.nActions = nActions;
    this.root = this.newLeaf();
    this.leaves = 1;
  }

  newLeaf() {
    return {
      leaf: true,
      Q: new Array(this.nActions).fill(PARAMETERS.defaultQ),
      counts: new Array(this.nActions).fill(0),
      visits: 0,
      cand: new Map(),  // cellIndex → Map(valueChar → {n, sum})  — running mean of the TD target
      sinceCheck: 0,
    };
  }

  // descend to the leaf a window maps to (creating a child leaf for an unseen split value)
  findLeaf(window) {
    let node = this.root;
    while (!node.leaf) {
      const v = window[node.cell];
      let child = node.children.get(v);
      if (!child) { child = this.newLeaf(); node.children.set(v, child); this.leaves++; }
      node = child;
    }
    return node;
  }

  getQ(window, action) { return this.findLeaf(window).Q[action]; }
  getCount(window, action) { return this.findLeaf(window).counts[action]; }
  getStateCount(window) { return this.findLeaf(window).visits; }

  maxQleaf(L) { let m = -Infinity; for (let a = 0; a < this.nActions; a++) if (L.Q[a] > m) m = L.Q[a]; return m; }
  maxQ(window) { return this.maxQleaf(this.findLeaf(window)); }

  bestActionLeaf(L) {
    let m = -Infinity; const best = [];
    for (let a = 0; a < this.nActions; a++) { if (L.Q[a] > m) { m = L.Q[a]; best.length = 0; best.push(a); } else if (L.Q[a] === m) best.push(a); }
    return best[randomInt(best.length)];
  }
  bestAction(window) { return this.bestActionLeaf(this.findLeaf(window)); }
  select(window) { return Math.random() < PARAMETERS.epsilon ? randomInt(this.nActions) : this.bestAction(window); }

  ucbBonus(window, action, c) {
    const L = this.findLeaf(window), n = L.counts[action];
    return n === 0 ? Infinity : c * Math.sqrt(Math.log(L.visits + 1) / n);
  }
  selectUCB(window, c) {
    const L = this.findLeaf(window); let m = -Infinity; const best = [];
    for (let a = 0; a < this.nActions; a++) {
      const n = L.counts[a], v = L.Q[a] + (n === 0 ? Infinity : c * Math.sqrt(Math.log(L.visits + 1) / n));
      if (v > m) { m = v; best.length = 0; best.push(a); } else if (v === m) best.push(a);
    }
    return best[randomInt(best.length)];
  }

  learn(window, action, reward, nextWindow) {
    const L = this.findLeaf(window);
    const target = nextWindow === null ? reward : reward + PARAMETERS.gamma * this.maxQ(nextWindow);
    L.Q[action] += PARAMETERS.alpha * (target - L.Q[action]);
    L.counts[action]++; L.visits++;
    // accumulate how the target varies with each cell's value, PER ACTION (so we catch cells that
    // change a single action's value — directional navigation cells — not just the state value)
    for (let c = 0; c < window.length; c++) {
      const v = window[c];
      let cm = L.cand.get(c); if (!cm) { cm = new Map(); L.cand.set(c, cm); }
      let s = cm.get(v);
      if (!s) { s = { n: new Float64Array(this.nActions), sum: new Float64Array(this.nActions) }; cm.set(v, s); }
      s.n[action]++; s.sum[action] += target;
    }
    if (++L.sinceCheck >= PARAMETERS.utreeCheckInterval && L.visits >= PARAMETERS.utreeMinSamples) {
      L.sinceCheck = 0; this.maybeSplit(L);
    }
  }

  // split a leaf on the cell whose value best predicts the target (largest spread of mean target
  // across its values), if that spread clears the threshold and each value has enough samples.
  maybeSplit(L) {
    // relevance of a cell = the largest spread, over ACTIONS, of that action's mean target across the
    // cell's values (with enough samples per value). Catches value-changing AND policy-changing cells.
    let bestCell = -1, bestSpread = PARAMETERS.utreeSplitThreshold, bestVals = null;
    for (const [c, cm] of L.cand) {
      if (cm.size < 2) continue; // one value here → no distinction to make
      let cellSpread = 0;
      for (let a = 0; a < this.nActions; a++) {
        let lo = Infinity, hi = -Infinity, cnt = 0;
        for (const s of cm.values()) {
          if (s.n[a] < PARAMETERS.utreeMinChild) continue;
          cnt++; const mean = s.sum[a] / s.n[a]; if (mean < lo) lo = mean; if (mean > hi) hi = mean;
        }
        if (cnt >= 2 && hi - lo > cellSpread) cellSpread = hi - lo;
      }
      if (cellSpread > bestSpread) { bestSpread = cellSpread; bestCell = c; bestVals = cm; }
    }
    if (bestCell < 0) return;
    const children = new Map();
    for (const v of bestVals.keys()) {
      const ch = this.newLeaf();
      ch.Q = L.Q.slice(); ch.counts = L.counts.slice(); ch.visits = L.visits; // inherit parent knowledge
      children.set(v, ch);
    }
    this.leaves += children.size - 1;
    delete L.Q; delete L.counts; delete L.cand;
    L.leaf = false; L.cell = bestCell; L.children = children;
  }

  numStates() { return this.leaves; } // count of distinct abstract states (tree leaves)
};
