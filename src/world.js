'use strict';
// GridForager-v2: central-place foraging on an N×N TOROIDAL grid. Each cell is one of
// {empty, food, water, shelter(×1), pit}. The agent gathers food + water, then RESTS at the
// shelter to bank reward = rewardPerUnit·min(food,water); entering a pit is death (terminal).
//
// The agent is always at the centre of its view (torus wraps), so absolute position isn't in the
// state. The observation is the agent-centered window (categorical cells) AUGMENTED with a shelter
// BEARING (which way / how far home) and bucketed SATIETY (food/water gathered) — the internal
// state a reactive window can't provide, needed for the "when to head home" and "which way" calls.
//
// The world holds all state and advances it; it draws nothing (the Observer renders).
var World = class World {
  constructor(width, height) {
    this.width = width; this.height = height;
    this.agent = makeAgent(World.NUM_ACTIONS); // flat or layered per PARAMETERS.agent
    this.episodes = 0; this.rested = 0; this.died = 0;
    this.emaReward = null; this.emaSteps = null; this.emaDeath = null;
    this.spawn();
  }

  // fresh episode: place shelter, pits, food, water on distinct cells; drop the agent on an empty one
  spawn() {
    const N = this.N = PARAMETERS.gridN;
    this.grid = [];
    for (let y = 0; y < N; y++) { const row = []; for (let x = 0; x < N; x++) row.push(World.EMPTY); this.grid.push(row); }
    const cells = [];
    for (let i = 0; i < N * N; i++) cells.push(i);
    for (let i = cells.length - 1; i > 0; i--) { const j = randomInt(i + 1); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    let k = 0;
    const place = (type) => { const c = cells[k++]; this.grid[(c / N) | 0][c % N] = type; return c; };
    const shelter = place(World.SHELTER);
    this.sx = shelter % N; this.sy = (shelter / N) | 0;
    for (let i = 0; i < PARAMETERS.nPits; i++) place(World.PIT);
    for (let i = 0; i < PARAMETERS.nFood; i++) place(World.FOOD);
    for (let i = 0; i < PARAMETERS.nWater; i++) place(World.WATER);
    const a = cells[k++]; this.ax = a % N; this.ay = (a / N) | 0; // agent on a remaining empty cell
    this.food = 0; this.water = 0; this.steps = 0;
  }

  // cell at (dx, dy) relative to the agent, torus wraparound
  cell(dx, dy) { const N = this.N; return this.grid[((this.ay + dy) % N + N) % N][((this.ax + dx) % N + N) % N]; }

  // agent-centered window of radius r as a categorical string (one digit per cell)
  senseWindow(r) {
    let s = '';
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += this.cell(dx, dy);
    return s;
  }

  // compact "home vector": signed step toward shelter on each axis (like path integration) + a
  // coarse distance bucket. 3 chars: dirx∈{0,1,2}, diry∈{0,1,2}, distBucket∈{0..3}.
  bearingCode() {
    const N = this.N;
    const sdx = (this.sx - this.ax + N) % N, sdy = (this.sy - this.ay + N) % N;
    const dirx = sdx === 0 ? 0 : (sdx <= N - sdx ? 1 : -1);
    const diry = sdy === 0 ? 0 : (sdy <= N - sdy ? 1 : -1);
    const dist = Math.max(Math.min(sdx, N - sdx), Math.min(sdy, N - sdy));
    const db = dist === 0 ? 0 : (dist <= 2 ? 1 : (dist <= 4 ? 2 : 3));
    return '' + (dirx + 1) + (diry + 1) + db;
  }

  // bucketed satiety: food and water gathered, each capped at 3 (0,1,2,3+)
  satietyCode() { const b = (c) => (c >= 3 ? 3 : c); return '' + b(this.food) + b(this.water); }

  // the internal (non-spatial) state: shelter bearing + satiety. Its own tiny state space, so the
  // strategic layer that senses only this fills up and gains confidence fast.
  internalCode() { return this.bearingCode() + this.satietyCode(); }

  // window + internal state → the flat agent's full observation ('|' separates spatial from internal)
  augment(win) { return win + '|' + this.internalCode(); }

  // the flat agent's single observation
  senseState() { return this.augment(this.senseWindow((PARAMETERS.receptiveField - 1) >> 1)); }

  // apply an action. 0..7 = moves, 8 = eat, 9 = drink, 10 = rest. Returns {reward, done, rested?, died?}.
  applyAction(a) {
    this.steps++;
    if (a === World.EAT) {
      if (this.cell(0, 0) === World.FOOD) { this.grid[this.ay][this.ax] = World.EMPTY; this.food++; return { reward: PARAMETERS.rewardGather, done: false }; }
      return { reward: PARAMETERS.rewardStep, done: false };
    }
    if (a === World.DRINK) {
      if (this.cell(0, 0) === World.WATER) { this.grid[this.ay][this.ax] = World.EMPTY; this.water++; return { reward: PARAMETERS.rewardGather, done: false }; }
      return { reward: PARAMETERS.rewardStep, done: false };
    }
    if (a === World.REST) {
      if (this.cell(0, 0) === World.SHELTER) { return { reward: PARAMETERS.rewardPerUnit * Math.min(this.food, this.water), done: true, rested: true }; }
      return { reward: PARAMETERS.rewardStep, done: false };
    }
    // move (8 king directions); entering a pit is death
    const dir = World.DIRS[a], N = this.N;
    const nx = ((this.ax + dir[0]) % N + N) % N, ny = ((this.ay + dir[1]) % N + N) % N;
    this.ax = nx; this.ay = ny;
    if (this.grid[ny][nx] === World.PIT) return { reward: -PARAMETERS.pitPenalty, done: true, died: true };
    return { reward: PARAMETERS.rewardStep, done: false };
  }

  update(engine) {
    const res = this.agent.act(this);
    const ema = (p, v) => (p === null ? v : 0.98 * p + 0.02 * v);
    const end = (banked, died) => {
      this.episodes++;
      this.emaReward = ema(this.emaReward, banked);
      this.emaSteps = ema(this.emaSteps, this.steps);
      this.emaDeath = ema(this.emaDeath, died ? 1 : 0);
      this.spawn();
    };
    if (res.done) {
      if (res.rested) { this.rested++; end(Math.min(this.food, this.water), false); }
      else { this.died++; end(0, true); } // pit death
    } else if (this.steps >= PARAMETERS.maxStepsPerEpisode) {
      end(0, false); // timed out, banked nothing
    }
  }

  // metrics: mean banked reward (min food,water) per episode, and the death rate. Higher reward = better.
  meanReward() { return this.emaReward === null ? 0 : this.emaReward; }
  deathRate() { return this.emaDeath === null ? 0 : this.emaDeath; }
};

// cell types
World.EMPTY = 0; World.FOOD = 1; World.WATER = 2; World.SHELTER = 3; World.PIT = 4;
// 8 move directions [dx, dy]: N, NE, E, SE, S, SW, W, NW (y grows downward)
World.DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
World.EAT = 8; World.DRINK = 9; World.REST = 10;
World.NUM_ACTIONS = 11;
