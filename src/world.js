'use strict';
// GridForager: an N×N TOROIDAL grid of cells that are 0 (empty) or 1 (food). One forager
// agent lives on it. The agent is conceptually always at the CENTER of its own view — the
// torus wraps, so state is read relative to the agent's position, which bakes in translation
// invariance (the whole point that makes the receptive-field abstraction sound).
//
// The world holds all state and advances it; it draws nothing (the Observer renders). Multi-
// channel cells are coming (agent/predator/prey), but Stage 1 uses a single food bit per cell.
var World = class World {
  constructor(width, height) {
    this.width = width;   // canvas px (Observer uses these to scale; the sim itself is grid-based)
    this.height = height;
    this.agent = new Agent(World.NUM_ACTIONS); // the policy/learner (see agent.js), loaded before us
    this.episodes = 0;    // completed (cleared) episodes
    this.emaSteps = null; // EMA of steps-to-clear — the learning-curve metric (lower = better)
    this.spawn();
  }

  // start a fresh random episode: new food layout, agent dropped at a random cell
  spawn() {
    const N = this.N = PARAMETERS.gridN;
    this.grid = [];
    let food = 0;
    for (let y = 0; y < N; y++) {
      const row = [];
      for (let x = 0; x < N; x++) {
        const f = Math.random() < PARAMETERS.foodDensity ? 1 : 0;
        row.push(f); food += f;
      }
      this.grid.push(row);
    }
    if (food === 0) { this.grid[randomInt(N)][randomInt(N)] = 1; food = 1; } // guarantee a solvable board
    this.initialFood = food;
    this.foodRemaining = food;
    this.ax = randomInt(N);
    this.ay = randomInt(N);
    this.steps = 0;
  }

  // read the cell at (dx, dy) relative to the agent, with torus wraparound
  cell(dx, dy) {
    const N = this.N;
    return this.grid[((this.ay + dy) % N + N) % N][((this.ax + dx) % N + N) % N];
  }

  // the agent-centered receptive-field window, as a bit string. Stage 1: window clamped to the
  // full grid, so the flat learner sees everything (centered on itself).
  senseState() {
    const r = (Math.min(PARAMETERS.receptiveField, this.N) - 1) >> 1;
    let s = '';
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) s += this.cell(dx, dy);
    }
    return s;
  }

  // apply an action index. 0..7 = the 8 moves (World.DIRS), 8 = eat. Returns {reward, done}.
  applyAction(a) {
    this.steps++;
    if (a === World.EAT) {
      if (this.cell(0, 0) === 1) {
        this.grid[this.ay][this.ax] = 0;
        this.foodRemaining--;
        if (this.foodRemaining === 0) return { reward: this.initialFood, done: true }; // cleared → +N
        return { reward: PARAMETERS.rewardEat, done: false };                          // ate one → 0
      }
      return { reward: PARAMETERS.rewardStep, done: false };  // failed eat (no food underfoot) → -1
    }
    const dir = World.DIRS[a];
    const N = this.N;
    this.ax = ((this.ax + dir[0]) % N + N) % N;
    this.ay = ((this.ay + dir[1]) % N + N) % N;
    return { reward: PARAMETERS.rewardStep, done: false };    // any move → -1
  }

  update(engine) {
    const res = this.agent.act(this);
    if (res.done) {
      this.episodes++;
      const s = this.steps;
      this.emaSteps = this.emaSteps === null ? s : 0.98 * this.emaSteps + 0.02 * s;
      this.spawn();
    } else if (this.steps >= PARAMETERS.maxStepsPerEpisode) {
      this.spawn(); // abandoned (no clear) — respawn without recording, so the metric tracks real clears
    }
  }

  // the metric of interest: EMA of steps taken to clear a board. 0 until the first clear.
  meanStepsToClear() {
    return this.emaSteps === null ? 0 : this.emaSteps;
  }
};

// 8 move directions [dx, dy]: N, NE, E, SE, S, SW, W, NW (y grows downward)
World.DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
World.EAT = 8;
World.NUM_ACTIONS = 9;
