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
    this.episodes = 0; this.cleared = 0; this.rested = 0; this.died = 0;
    this.emaSteps = null; this.emaReward = null; this.emaDeath = null;
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
    for (let i = 0; i < PARAMETERS.nFood; i++) place(World.FOOD);
    if (PARAMETERS.enableWater) for (let i = 0; i < PARAMETERS.nWater; i++) place(World.WATER);
    const a = cells[k++]; this.ax = a % N; this.ay = (a / N) | 0;
    this.food = 0; this.water = 0; this.steps = 0;
    this.remaining = PARAMETERS.nFood + (PARAMETERS.enableWater ? PARAMETERS.nWater : 0);
  }

  cell(dx, dy) { const N = this.N; return this.grid[((this.ay + dy) % N + N) % N][((this.ax + dx) % N + N) % N]; }

  // agent-centered window of radius r as a categorical string (one digit per cell), torus wraparound
  senseWindow(r) {
    let s = '';
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += this.cell(dx, dy);
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

  // bucketed satiety: food (and water, if enabled) gathered, each capped at 3
  satietyCode() { const b = (c) => (c >= 3 ? 3 : c); return '' + b(this.food) + (PARAMETERS.enableWater ? b(this.water) : ''); }

  // the internal (non-spatial) state — only meaningful in shelter mode (there's a home to return to)
  internalCode() { return PARAMETERS.enableShelter ? this.bearingCode() + this.satietyCode() : ''; }

  // the flat agent's observation: window, augmented with the internal state only in shelter mode
  senseState() {
    const win = this.senseWindow((PARAMETERS.receptiveField - 1) >> 1);
    return PARAMETERS.enableShelter ? win + '|' + this.internalCode() : win;
  }

  // apply action index i. Returns {reward, done, cleared?/rested?/died?}.
  applyAction(i) {
    this.steps++;
    const act = this.actions[i];
    if (typeof act === 'number') { // a move (0..7 → World.DIRS)
      const dir = World.DIRS[act], N = this.N;
      this.ax = ((this.ax + dir[0]) % N + N) % N; this.ay = ((this.ay + dir[1]) % N + N) % N;
      if (PARAMETERS.enablePits && this.grid[this.ay][this.ax] === World.PIT) return { reward: -PARAMETERS.pitPenalty, done: true, died: true };
      return { reward: PARAMETERS.rewardStep, done: false };
    }
    if (act === 'eat') {
      if (this.cell(0, 0) === World.FOOD) { this.grid[this.ay][this.ax] = World.EMPTY; this.food++; this.remaining--; return this.gatherResult(); }
      return { reward: PARAMETERS.rewardStep, done: false };
    }
    if (act === 'drink') {
      if (this.cell(0, 0) === World.WATER) { this.grid[this.ay][this.ax] = World.EMPTY; this.water++; this.remaining--; return this.gatherResult(); }
      return { reward: PARAMETERS.rewardStep, done: false };
    }
    if (act === 'rest') {
      if (this.cell(0, 0) === World.SHELTER) { const banked = PARAMETERS.enableWater ? Math.min(this.food, this.water) : this.food; return { reward: PARAMETERS.rewardPerUnit * banked, done: true, rested: true }; }
      return { reward: PARAMETERS.rewardStep, done: false };
    }
  }

  // a successful eat/drink. In sweep mode (no shelter), clearing the last item ends the day with a
  // bonus; otherwise gathering pays 0 (value is realized at rest).
  gatherResult() {
    if (!PARAMETERS.enableShelter && this.remaining === 0) return { reward: this.totalItems(), done: true, cleared: true };
    return { reward: PARAMETERS.rewardGather, done: false };
  }

  totalItems() { return PARAMETERS.nFood + (PARAMETERS.enableWater ? PARAMETERS.nWater : 0); }

  update(engine) {
    const res = this.agent.act(this);
    const ema = (p, v) => (p === null ? v : 0.98 * p + 0.02 * v);
    if (res.done) {
      this.episodes++;
      if (res.rested) { this.rested++; this.emaReward = ema(this.emaReward, PARAMETERS.enableWater ? Math.min(this.food, this.water) : this.food); }
      if (res.cleared) { this.cleared++; this.emaSteps = ema(this.emaSteps, this.steps); }
      if (res.died) this.died++;
      this.emaDeath = ema(this.emaDeath, res.died ? 1 : 0);
      this.spawn();
    } else if (this.steps >= PARAMETERS.maxStepsPerEpisode) {
      this.episodes++;
      if (PARAMETERS.enableShelter) this.emaReward = ema(this.emaReward, 0); // timed out, banked nothing
      else this.emaSteps = ema(this.emaSteps, this.steps);                    // timed out, count the cutoff
      this.emaDeath = ema(this.emaDeath, 0);
      this.spawn();
    }
  }

  // the primary metric adapts to the mode: banked reward (shelter) or steps-to-clear (sweep)
  metric() { return PARAMETERS.enableShelter ? this.meanReward() : this.meanStepsToClear(); }
  metricLabel() { return PARAMETERS.enableShelter ? 'banked reward' : 'steps to clear'; }
  meanReward() { return this.emaReward === null ? 0 : this.emaReward; }
  meanStepsToClear() { return this.emaSteps === null ? 0 : this.emaSteps; }
  deathRate() { return this.emaDeath === null ? 0 : this.emaDeath; }
};

// the action set for the current mode: 0..7 moves, then eat, (drink), (rest)
World.buildActions = function () {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 'eat'];
  if (PARAMETERS.enableWater) a.push('drink');
  if (PARAMETERS.enableShelter) a.push('rest');
  return a;
};

// cell types
World.EMPTY = 0; World.FOOD = 1; World.WATER = 2; World.SHELTER = 3; World.PIT = 4;
// 8 move directions [dx, dy]: N, NE, E, SE, S, SW, W, NW (y grows downward)
World.DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
