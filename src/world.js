'use strict';
// GridForager: a MODULAR forager on an N×N toroidal grid. Environment features are TOGGLES, so we
// build up from the base model and study each addition in isolation:
//   base              food only. Collect (eat) ALL food → the "day" ends. Metric: steps-to-clear.
//   + enableWater     a 2nd resource (drink). The day ends when all food AND water are collected.
//   + enableShelter   REST at the shelter (×1) ends the day early, banking reward = rewardPerUnit ·
//                     (min(food,water) if water else food). Adds a shelter bearing + satiety sense.
//   + enablePits      entering a pit is death (terminal, −pitPenalty).
//   + enableRocks     rocks block movement (bump = stay put, normal step cost) — neutral obstacles.
//   + enableGoats     goats: prey AGENTS (shared species learner, GoatBrain) that eat food, drink
//                     water, die in pits, learn. Forager gains ATTACK: fell an ADJACENT goat → its
//                     cell becomes FOOD (carcass) → step on and eat. Goats are solid (block moves).
// Cells: empty/food/water/shelter/pit/rock (+GOAT/AGENT as percept overlays — goats occlude the
// terrain they stand on). The agent is always at the view centre (torus wraps), so absolute
// position isn't in the state. The world holds all state; the Observer draws it.
var World = class World {
  constructor(width, height) {
    this.width = width; this.height = height;
    this.actions = World.buildActions();          // dynamic: moves(+eat)(+drink)(+rest)(+attack)
    this.agent = makeAgent(this.actions.length);  // flat or layered; nActions matches the mode
    // the goats' shared species-level brain — persists across episodes (goats learn as a population)
    this.goatActions = World.buildGoatActions();
    this.goatBrain = PARAMETERS.enableGoats ? new GoatBrain(this.goatActions.length) : null;
    this.episodes = 0; this.cleared = 0; this.rested = 0; this.died = 0; this.collapsed = 0;
    this.goatsKilled = 0; this.goatPitDeaths = 0; this.goatEaten = 0; // hunts / goat pit losses / resources goats consumed
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
    if (PARAMETERS.enableShelter) { // reserve the cell; it only becomes a visible/rest-able SHELTER once active
      const s = place(World.EMPTY); this.sx = s % N; this.sy = (s / N) | 0;
      this.shelterActive = PARAMETERS.shelterActivate === 'always';
      if (this.shelterActive) this.grid[this.sy][this.sx] = World.SHELTER;
    }
    if (PARAMETERS.enablePits) for (let i = 0; i < PARAMETERS.nPits; i++) place(World.PIT);
    if (PARAMETERS.enableRocks) for (let i = 0; i < PARAMETERS.nRocks; i++) place(World.ROCK);
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
    // goats spawn on unclaimed cells (terrain under them stays whatever it is — they occlude it)
    this.goats = []; this.goatAt = new Array(N * N).fill(-1); // cell index → goat index (occupancy)
    if (PARAMETERS.enableGoats) for (let i = 0; i < PARAMETERS.nGoats; i++) {
      const c = cells[k++]; const g = { x: c % N, y: (c / N) | 0, alive: true, lastStates: null, lastAction: -1 };
      this.goats.push(g); this.goatAt[c] = i;
    }
    // living goats count toward clearing → hunting is on the critical path, not an optional extra
    if (PARAMETERS.enableGoats && PARAMETERS.goatsCountToClear) this.remaining += this.goats.length;
    this.food = 0; this.water = 0; this.steps = 0;
  }

  // put a resource of `type` on a random empty cell (goat-respawn: net-zero to the agent's supply).
  // returns false if the board is full (caller then lets the count actually drop).
  respawnResource(type) {
    const N = this.N, empties = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.grid[y][x] === World.EMPTY && this.goatIndexAt(x, y) < 0 && !(x === this.ax && y === this.ay)) empties.push(y * N + x);
    }
    if (!empties.length) return false;
    const c = empties[randomInt(empties.length)]; this.grid[(c / N) | 0][c % N] = type; return true;
  }

  goatIndexAt(x, y) { return this.goatAt[y * this.N + x]; } // -1 if none

  // a slain goat becomes food: FOOD on its own cell, plus (if goatExplodeRadius>0) on every EMPTY
  // cell in that Chebyshev radius — the spatial hunt premium. Only EMPTY cells fill (a burst never
  // overwrites resources, shelter, hazards, or a living goat) and each new FOOD bumps `remaining`.
  dropCarcass(cx, cy) {
    const N = this.N, R = PARAMETERS.goatExplodeRadius;
    const fill = (x, y) => {
      if (this.goatIndexAt(x, y) >= 0) return;
      if (this.grid[y][x] === World.EMPTY) { this.grid[y][x] = World.FOOD; this.remaining++; }
    };
    if (this.grid[cy][cx] === World.EMPTY) this.remaining++;
    this.grid[cy][cx] = World.FOOD; // the goat's own cell always becomes the carcass
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx === 0 && dy === 0) continue;
      fill(((cx + dx) % N + N) % N, ((cy + dy) % N + N) % N);
    }
  }

  // terrain at an absolute cell with the GOAT overlay: a living goat occludes what it stands on.
  // (The human is NOT overlaid here — this is the human's own percept; see senseGoatWindow.)
  cellAbs(x, y) {
    if (PARAMETERS.enableGoats && this.goatIndexAt(x, y) >= 0) return World.GOAT;
    return this.grid[y][x];
  }

  cell(dx, dy) { const N = this.N; return this.cellAbs(((this.ax + dx) % N + N) % N, ((this.ay + dy) % N + N) % N); }

  // a goat's percept: window around IT — terrain, other goats as GOAT, the forager as AGENT.
  // (Its own cell shows the terrain under it, so "food underfoot" is visible to eat.)
  senseGoatWindow(g, r) {
    const N = this.N;
    let s = '';
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = ((g.x + dx) % N + N) % N, y = ((g.y + dy) % N + N) % N;
      if (x === this.ax && y === this.ay) { s += World.AGENT.toString(36); continue; }
      const gi = this.goatIndexAt(x, y);
      s += (gi >= 0 && !(dx === 0 && dy === 0)) ? World.GOAT.toString(36) : this.grid[y][x].toString(36);
    }
    return s;
  }

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
      const nx = ((this.ax + dir[0]) % N + N) % N, ny = ((this.ay + dir[1]) % N + N) % N;
      // rocks and living goats block: the bump wastes the step but the agent stays put
      const blocked = (PARAMETERS.enableRocks && this.grid[ny][nx] === World.ROCK) ||
        (PARAMETERS.enableGoats && this.goatIndexAt(nx, ny) >= 0);
      if (!blocked) { this.ax = nx; this.ay = ny; }
      if (PARAMETERS.enablePits && this.grid[this.ay][this.ax] === World.PIT) return { reward: -PARAMETERS.pitPenalty, done: true, died: true, event: 'pit' };
      out = { reward: PARAMETERS.rewardStep, done: false, event: 'step' };
    } else if (act === 'attack') {
      // the hunt, first half: fell an ADJACENT goat → its cell becomes FOOD (carcass, +1 to
      // remaining) — the payoff comes from the second half (walk on, eat). Attack itself costs a
      // step, succeed or fail; the value gap (defaultQ=0 > wander −1) gets it tried strategically.
      out = { reward: PARAMETERS.rewardStep, done: false, event: 'step' };
      for (let a = 0; a < 8; a++) {
        const d = World.DIRS[a], N = this.N;
        const gx = ((this.ax + d[0]) % N + N) % N, gy = ((this.ay + d[1]) % N + N) % N;
        const gi = this.goatIndexAt(gx, gy);
        if (gi >= 0) {
          const g = this.goats[gi];
          g.alive = false; this.goatAt[gy * this.N + gx] = -1; this.goatsKilled++;
          if (PARAMETERS.enableGoats && PARAMETERS.goatsCountToClear) this.remaining--; // the goat is off the board
          // teach the species brain the death: one extra terminal update on the goat's last (s,a)
          if (g.lastStates) this.goatBrain.learn(g.lastStates, g.lastAction, -PARAMETERS.pitPenalty, null);
          if (PARAMETERS.goatHuntOneAction) {
            // ONE-ACTION hunt: the attack itself consumes the goat — cost and reward in one action,
            // like eating a food cell that fought back. No carcass to walk to.
            this.food++; out = this.gatherResult(); out.collected = World.FOOD;
          } else {
            this.dropCarcass(gx, gy); // two-action hunt: carcass FOOD (+ burst) to walk onto and eat
          }
          break;
        }
      }
    } else if (act === 'rest') {
      // rest at the shelter banks a SUPERLINEAR reward in the day's haul: rewardPerUnit·stock² (stock =
      // food+water), MINUS restStickC per resource still uncollected — the "stick" that makes resting with
      // food left on the table go negative (breaks rest-on-contact), while a cleared field rests penalty-free.
      if (this.cell(0, 0) === World.SHELTER) { const s = this.bankedStock(); return { reward: PARAMETERS.rewardPerUnit * s * s - PARAMETERS.restStickC * this.remaining, done: true, rested: true, event: 'rest', stock: s }; }
      out = { reward: PARAMETERS.rewardStep, done: false, event: 'step' };
    } else {
      // collect actions: 'eat'=type 1, 'drink'=type 2, 'c'+t=type t. Succeeds iff that type is underfoot.
      const type = act === 'eat' ? World.FOOD : act === 'drink' ? World.WATER : parseInt(act.slice(1), 10);
      if (this.cell(0, 0) === type) {
        this.grid[this.ay][this.ax] = World.EMPTY;
        if (type === World.FOOD) this.food++; else if (type === World.WATER) this.water++;
        this.remaining--;
        out = this.gatherResult(); out.collected = type; // which type → per-resource reward routing
      } else {
        out = { reward: PARAMETERS.rewardStep, done: false, event: 'step' };
      }
    }
    // SHELTER ACTIVATION: the rest option can be gated to appear only after the field is CLEARED, or after
    // a TIME — so it can't tempt an early rest during foraging, and its appearance cues the return.
    if (PARAMETERS.enableShelter && !this.shelterActive) {
      const trig = PARAMETERS.shelterActivate, clr = this.remaining === 0, dusk = this.steps >= PARAMETERS.shelterActivateTime;
      if ((trig === 'cleared' && clr) || (trig === 'time' && dusk) || (trig === 'clearedOrTime' && (clr || dusk))) {
        this.shelterActive = true; this.grid[this.sy][this.sx] = World.SHELTER;
      }
    }
    // END OF DAY (shelter mode): maxStepsPerEpisode is the day length. If it just expired and the day
    // hasn't already ended (rest / clear / death), the agent COLLAPSES in the field — terminal, −M.
    if (PARAMETERS.enableShelter && !out.done && this.steps >= PARAMETERS.maxStepsPerEpisode) {
      return { reward: -PARAMETERS.collapsePenalty, done: true, collapsed: true, event: 'collapse' };
    }
    return out;
  }

  // a successful eat/drink. In sweep mode (no shelter), clearing the last item ends the day with a
  // bonus; otherwise gathering pays 0 (value is realized at rest).
  gatherResult() {
    if (!PARAMETERS.enableShelter && this.remaining === 0) return { reward: this.totalItems(), done: true, cleared: true, event: 'clear' };
    return { reward: PARAMETERS.rewardGather, done: false, event: 'gather' };
  }

  totalItems() { return PARAMETERS.enableShelter ? PARAMETERS.nFood + (PARAMETERS.enableWater ? PARAMETERS.nWater : 0) : (PARAMETERS.nTypes || 1) * PARAMETERS.nFood; }

  // one goat's turn: sense → select → apply → learn, on the SHARED species brain. lastStates/action
  // are kept so an attack on the human's turn can deliver the terminal lesson to the right (s,a).
  goatStep(g, i) {
    const states = this.goatBrain.statesFor(this, g);
    const action = this.goatBrain.select(states);
    const res = this.applyGoatAction(g, i, action);
    const next = res.done ? null : this.goatBrain.statesFor(this, g);
    this.goatBrain.learn(states, action, res.reward, next);
    g.lastStates = states; g.lastAction = action;
  }

  // goat dynamics mirror the forager's: moves blocked by rocks/active shelter/other goats/the
  // human; pits kill (terminal for THAT goat); eat/drink consume the terrain underfoot.
  applyGoatAction(g, i, actionIndex) {
    const act = this.goatActions[actionIndex], N = this.N;
    if (typeof act === 'number') {
      const d = World.DIRS[act];
      const nx = ((g.x + d[0]) % N + N) % N, ny = ((g.y + d[1]) % N + N) % N;
      const t = this.grid[ny][nx];
      const blocked = (PARAMETERS.enableRocks && t === World.ROCK) || t === World.SHELTER ||
        this.goatIndexAt(nx, ny) >= 0 || (nx === this.ax && ny === this.ay);
      if (!blocked) {
        this.goatAt[g.y * N + g.x] = -1;
        g.x = nx; g.y = ny;
        if (PARAMETERS.enablePits && this.grid[ny][nx] === World.PIT) {
          g.alive = false; this.goatPitDeaths++;
          if (PARAMETERS.goatsCountToClear) this.remaining--; // a goat that dies on its own is off the board
          return { reward: -PARAMETERS.pitPenalty, done: true };
        }
        this.goatAt[ny * N + nx] = i;
      }
      return { reward: PARAMETERS.rewardStep, done: false, event: 'step' };
    }
    const want = act === 'eat' ? World.FOOD : World.WATER;
    if (this.grid[g.y][g.x] === want) {
      this.grid[g.y][g.x] = World.EMPTY; this.goatEaten++;
      // respawn elsewhere (net-zero to the agent's supply) so goats aren't COMPETITORS; only if that
      // fails (board full) does the resource actually leave the field.
      if (!(PARAMETERS.goatEatRespawn && this.respawnResource(want))) this.remaining--;
      return { reward: PARAMETERS.rewardGather, done: false };
    }
    return { reward: PARAMETERS.rewardStep, done: false, event: 'step' };
  }

  update(engine) {
    const res = this.agent.act(this);
    // goats take their turns after the forager, unless its action just ended the day. Stationary
    // goats skip their turn entirely — food-like prey that sit still (isolates the motion variable).
    if (!res.done && PARAMETERS.enableGoats && !PARAMETERS.goatStationary) {
      for (let i = 0; i < this.goats.length; i++) { const g = this.goats[i]; if (g.alive) this.goatStep(g, i); }
    }
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
  if (PARAMETERS.enableGoats) a.push('attack');
  return a;
};

// the goats' action set: 8 moves + eat (+ drink when water exists in the world)
World.buildGoatActions = function () {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 'eat'];
  if (PARAMETERS.enableWater || (PARAMETERS.nTypes || 1) >= 2) a.push('drink');
  return a;
};

// cell types (values 3+ collide with high-K sweep resource types — hazards/obstacles are for K ≤ 2).
// GOAT/AGENT are percept-overlay values only, never stored in the terrain grid.
World.EMPTY = 0; World.FOOD = 1; World.WATER = 2; World.SHELTER = 3; World.PIT = 4; World.ROCK = 5;
World.GOAT = 6; World.AGENT = 7;
// 8 move directions [dx, dy]: N, NE, E, SE, S, SW, W, NW (y grows downward)
World.DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
