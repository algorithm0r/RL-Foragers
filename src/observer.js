'use strict';
// The view. Reads world state and draws it; never mutates the model. Renders the actual grid
// with the agent at its (ax, ay) — the agent-centered torus is a conceptual framing for the
// *state*, but drawing the fixed grid with the agent on it is the intuitive picture.
var Observer = class Observer {
  constructor(world) { this.world = world; }

  update() {}

  draw(ctx) {
    const w = this.world, N = w.N;
    const board = Math.min(ctx.canvas.width, ctx.canvas.height); // square board on the left
    const cell = board / N;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        ctx.fillStyle = w.grid[y][x] ? '#3fbf6f' : '#141a22'; // food green / empty dark
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }

    // the forager
    ctx.fillStyle = '#f32e26';
    ctx.beginPath();
    ctx.arc((w.ax + 0.5) * cell, (w.ay + 0.5) * cell, Math.max(3, cell * 0.3), 0, TAU);
    ctx.fill();

    // HUD in the right gutter (canvas is wider than the board)
    ctx.fillStyle = '#cdd2da';
    ctx.font = "14px 'Consolas', monospace";
    let ty = 24;
    const line = (s) => { ctx.fillText(s, board + 16, ty); ty += 20; };
    line('grid    ' + N + '×' + N);
    line('episode ' + w.episodes);
    line('food    ' + w.foodRemaining + ' / ' + w.initialFood);
    line('steps   ' + w.steps);
    line('Q-states ' + w.agent.learner.Q.size);
    ty += 6;
    line('mean steps-to-clear');
    ctx.fillStyle = '#7fd1ff';
    ctx.font = "20px 'Consolas', monospace";
    line(w.episodes === 0 ? '—' : w.meanStepsToClear().toFixed(2));
  }
};
