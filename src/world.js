'use strict';
// GridForager: a MODULAR forager on an N×N toroidal grid. Environment features are TOGGLES, so we
// build up from the base model and study each addition in isolation:
//   base              food only. Collect (eat) ALL food → the "day" ends. Metric: steps-to-clear.
//   + enableWater     a 2nd resource (drink). The day ends when all food AND water are collected.
//   + enableShelter   REST at the shelter (×1) ends the day early, banking reward = rewardPerUnit ·
//                     (min(food,water) if water else food). Adds a shelter bearing + satiety sense.
//   + enablePits      entering a pit is death (terminal, −pitPenalty).
// Cells: empty/food/water/shelter/pit. The agent is always at the view centre (torus wraps), so
// absolute position isn't in the state. The world holds all state; the Observer draws it.
var World = class World {
  constructor(width, height) {
    this.width = width; this.height = height;
    this.actions = World.buildActions();          // dynamic: moves(+eat)(+drink)(+rest)
    this.agent = makeAgent(this.actions.length);  // flat or layered; nActions matches the mode
    this.episodes = 0; this.cleared = 0; this.rested = 0; this.died = 0; this.collapsed = 0;
    this.emaSteps = null; this.emaReward = null; this.emaDeath = null; this.emaCollapse = null;
    this.spawn();
  }

  // fresh episode: place the enabled features on distinct cells; drop the agent on an empty one
  spawn() {
    const N = this.N = PARAMETERS.gridN;
    this.grid = [];
    for (let y = 0; y < N; y++) { const row = []; for (let x = 0; x < N; x++) row.push(World.EMPTY); this.grid.push(row); }
    const cells = [];
    for (let i = 0; i < N * N; i++) cells.push(i);
    for (let i = cells.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    let k = 0;
    const place = (type) => { const c = cells[k++]; this.grid[(c / N) | 0][c % N] = type; return c; };
    if (PARAMETERS.enableShelter) { const s = place(World.SHELTER); this.sx = s % N; this.sy = (s / N) | 0; }
    if (PARAMETERS.enablePits) for (let i = 0; i < PARAMETERS.nPits; i++) place(World.PIT);
    if (PARAMETERS.enableShelter) { // central-place mode: food (+ water)
      for (let i = 0; i < PARAMETERS.nFood; i++) place(World.FOOD);
      if (PARAMETERS.enableWater) for (let i = 0; i < PARAMETERS.nWater; i++) place(World.WATER);
      this.remaining = PARAMETERS.nFood + (PARAMETERS.enableWater ? PARAMETERS.nWater : 0);
    } else { // sweep mode: nTypes resource types (cell values 1..nTypes), each its own collect action
      const K = PARAMETERS.nTypes || 1;
      for (let t = 1; t <= K; t++) for (let i = 0; i < PARAMETERS.nFood; i++) place(t);
      this.remaining = K * PARAMETERS.nFood;
    }
    const a = cells[k++]; this.ax = a % N; this.ay = (a / N) | 0;
    this.food = 0; this.water = 0; this.steps = 0;
  }

  cell(dx, dy) { const N = this.N; return this.grid[((this.ay + dy) % N + N) % N][((this.ax + dx) % N + N) % N]; }

  // agent-centered window of radius r as a categorical string (one digit per cell), torus wraparound
  // `channel` (a resource type) binarizes the window to that type only ('1'/'0') — for per-resource
  // learners; without it the full multi-type window is returned (base36, one char per cell).
  senseWindow(r, channel) {
    let s = '';
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const v = this.cell(dx, dy);
      s += channel ? (v === channel ? '1' : '0') : v.toString(36);
    }
    return s;
  }

  // compact home vector (shelter mode only): signed step toward shelter per axis + coarse distance
  bearingCode() {
    const N = this.N;
    const sdx = (this.sx - this.ax + N) % N, sdy = (this.sy - this.ay + N) % N;
    const dirx = sdx === 0 ? 0 : (sdx <= N - sdx ? 1 : -1);
    const diry = sdy === 0 ? 0 : (sdy <= N - sdy ? 1 : -1);
    const dist = Math.max(Math.min(sdx, N - sdx), Math.min(sdy, N - sdy));
    const db = dist === 0 ? 0 : (dist <= 2 ? 1 : (dist <= 4 ? 2 : 3));
    return '' + (dirx + 1) + (diry + 1) + db;
  }

  // the day's haul (food + water if enabled) — the raw stock the rest reward squares, and the metric
  bankedStock() { return this.food + (PARAMETERS.enableWater ? this.water : 0); }

  // bucketed satiety: food (and water, if enabled) gathered, each capped at 3
  satietyCode() { const b = (c) => (c >= 3 ? 3 : c); return '' + b(this.food) + (PARAMETERS.enableWater ? b(this.water) : ''); }

  // coarse time-of-day: which bucket of the day is LEFT (timeBuckets levels; '0' = almost out of time,
  // high = fresh). This is what makes "head home before the day ends" LEARNABLE — without a clock in
  // the state the day's end is hidden, and the forage-vs-return tradeoff can't be timed.
  timeCode() {
    const B = PARAMETERS.timeBuckets, rem = PARAMETERS.maxStepsPerEpisode - this.steps;
    let b = Math.floor((rem / PARAMETERS.maxStepsPerEpisode) * B);
    if (b >= B) b = B - 1; if (b < 0) b = 0;
    return b.toString(36);
  }

  // the internal (non-spatial) state — only meaningful in shelter mode (there's a home to return to):
  // bearing to shelter + satiety gathered + how much of the day is left.
  internalCode() { return PARAMETERS.enableShelter ? this.bearingCode() + this.satietyCode() + this.timeCode() : ''; }

  // the flat agent's observation: window, augmented with the internal state only in shelter mode
  senseState() {
    const win = this.senseWindow((PARAMETERS.receptiveField - 1) >> 1);
    return PARAMETERS.enableShelter ? win + '|' + this.internalCode() : win;
  }

  // apply action index i. Returns {reward, done, cleared?/rested?/died?}.
  applyAction(i) {
    this.steps++;
    const act = this.actions[i];
    let out;
    if (typeof act === 'number') { // a move (0..7 → World.DIRS)
      const dir = World.DIRS[act], N = this.N;
      this.ax = ((this.ax + dir[0]) % N + N) % N; this.ay = ((this.ay + dir[1]) % N + N) % N;
      if (PARAMETERS.enablePits && this.grid[this.ay][this.ax] === World.PIT) return { reward: -PARAMETERS.pitPenalty, done: true, died: true };
      out = { reward: PARAMETERS.rewardStep, done: false };
    } else if (act === 'rest') {
      // rest at the shelter banks a SUPERLINEAR reward in the day's haul: rewardPerUnit·stock² (stock =
      // food+water), MINUS restStickC per resource still uncollected — the "stick" that makes resting with
      // food left on the table go negative (breaks rest-on-contact), while a cleared field rests penalty-free.
      if (this.cell(0, 0) === World.SHELTER) { const s = this.bankedStock(); return { reward: PARAMETERS.rewardPerUnit * s * s - PARAMETERS.restStickC * this.remaining, done: true, rested: true }; }
      out = { reward: PARAMETERS.rewardStep, done: false };
    } else {
      // collect actions: 'eat'=type 1, 'drink'=type 2, 'c'+t=type t. Succeeds iff that type is underfoot.
      const type = act === 'eat' ? World.FOOD : act === 'drink' ? World.WATER : parseInt(act.slice(1), 10);
      if (this.cell(0, 0) === type) {
        this.grid[this.ay][this.ax] = World.EMPTY;
        if (type === World.FOOD) this.food++; else if (type === World.WATER) this.water++;
        this.remaining--;
        out = this.gatherResult(); out.collected = type; // which type → per-resource reward routing
      } else {
        out = { reward: PARAMETERS.rewardStep, done: false };
      }
    }
    // END OF DAY (shelter mode): maxStepsPerEpisode is the day length. If it just expired and the day
    // hasn't already ended (rest / clear / death), the agent COLLAPSES in the field — terminal, −M.
    if (PARAMETERS.enableShelter && !out.done && this.steps >= PARAMETERS.maxStepsPerEpisode) {
      return { reward: -PARAMETERS.collapsePenalty, done: true, collapsed: true };
    }
    return out;
  }

  // a successful eat/drink. In sweep mode (no shelter), clearing the last item ends the day with a
  // bonus; otherwise gathering pays 0 (value is realized at rest).
  gatherResult() {
    if (!PARAMETERS.enableShelter && this.remaining === 0) return { reward: this.totalItems(), done: true, cleared: true };
    return { reward: PARAMETERS.rewardGather, done: false };
  }

  totalItems() { return PARAMETERS.enableShelter ? PARAMETERS.nFood + (PARAMETERS.enableWater ? PARAMETERS.nWater : 0) : (PARAMETERS.nTypes || 1) * PARAMETERS.nFood; }

  update(engine) {
    const res = this.agent.act(this);
    const ema = (p, v) => (p === null ? v : 0.98 * p + 0.02 * v);
    if (res.done) {
      this.episodes++;
      if (res.rested) { this.rested++; this.emaReward = ema(this.emaReward, this.bankedStock()); } // metric = harvest (items), not the squared reward
      if (res.collapsed) { this.collapsed++; this.emaReward = ema(this.emaReward, 0); } // day ended in the field → banked nothing
      if (res.cleared) { this.cleared++; this.emaSteps = ema(this.emaSteps, this.steps); }
      if (res.died) this.died++;
      this.emaDeath = ema(this.emaDeath, res.died ? 1 : 0);
      this.emaCollapse = ema(this.emaCollapse, res.collapsed ? 1 : 0);
      this.spawn();
    } else if (this.steps >= PARAMETERS.maxStepsPerEpisode) {
      this.episodes++;
      if (PARAMETERS.enableShelter) this.emaReward = ema(this.emaReward, 0); // timed out, banked nothing
      else this.emaSteps = ema(this.emaSteps, this.steps);                    // timed out, count the cutoff
      this.emaDeath = ema(this.emaDeath, 0);
      this.emaCollapse = ema(this.emaCollapse, 0);
      this.spawn();
    }
  }

  // the primary metric adapts to the mode: banked reward (shelter) or steps-to-clear (sweep)
  metric() { return PARAMETERS.enableShelter ? this.meanReward() : this.meanStepsToClear(); }
  metricLabel() { return PARAMETERS.enableShelter ? 'banked stock' : 'steps to clear'; }
  meanReward() { return this.emaReward === null ? 0 : this.emaReward; }
  meanStepsToClear() { return this.emaSteps === null ? 0 : this.emaSteps; }
  deathRate() { return this.emaDeath === null ? 0 : this.emaDeath; }
  collapseRate() { return this.emaCollapse === null ? 0 : this.emaCollapse; }
};

// the action set for the current mode: 0..7 moves, then eat, (drink), (rest)
World.buildActions = function () {
  const a = [0, 1, 2, 3, 4, 5, 6, 7];
  if (PARAMETERS.enableShelter) { // central-place: eat (+ drink) + rest
    a.push('eat'); if (PARAMETERS.enableWater) a.push('drink'); a.push('rest');
  } else { // sweep: one collect action per resource type (type1='eat', type2='drink', type≥3='c'+t)
    const K = PARAMETERS.nTypes || 1;
    for (let t = 1; t <= K; t++) a.push(t === 1 ? 'eat' : t === 2 ? 'drink' : 'c' + t);
  }
  return a;
};

// cell types
World.EMPTY = 0; World.FOOD = 1; World.WATER = 2; World.SHELTER = 3; World.PIT = 4;
// 8 move directions [dx, dy]: N, NE, E, SE, S, SW, W, NW (y grows downward)
World.DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
