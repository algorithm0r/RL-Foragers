'use strict';
// The view. Reads world state and draws it; never mutates the model. Renders the arena with the
// agent on it; the agent-centered torus is a framing for the *state*, not the picture.
var Observer = class Observer {
  constructor(world) { this.world = world; }

  update() {}

  draw(ctx) {
    const w = this.world, N = w.N;
    const board = Math.min(ctx.canvas.width, ctx.canvas.height);
    const cell = board / N;
    const COLORS = ['#141a22', '#3fbf6f', '#4aa3ff', '#e8b23a', '#7a1f1f', '#6e7681']; // empty food water shelter pit rock

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const t = w.grid[y][x];
        ctx.fillStyle = COLORS[t];
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        if (t === World.PIT) { // an X so pits read as hazards
          ctx.strokeStyle = '#e05a5a'; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(x * cell + 4, y * cell + 4); ctx.lineTo((x + 1) * cell - 4, (y + 1) * cell - 4);
          ctx.moveTo((x + 1) * cell - 4, y * cell + 4); ctx.lineTo(x * cell + 4, (y + 1) * cell - 4); ctx.stroke();
        }
      }
    }

    // receptive-field footprint (wraps with the torus)
    const r = w.agent.viewRadius();
    ctx.strokeStyle = 'rgba(127,209,255,0.4)'; ctx.lineWidth = 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = ((w.ax + dx) % N + N) % N, gy = ((w.ay + dy) % N + N) % N;
        ctx.strokeRect(gx * cell + 1.5, gy * cell + 1.5, cell - 3, cell - 3);
      }
    }

    // the forager
    ctx.fillStyle = '#f32e26'; ctx.beginPath();
    ctx.arc((w.ax + 0.5) * cell, (w.ay + 0.5) * cell, Math.max(3, cell * 0.32), 0, TAU); ctx.fill();
    // (metrics/graph render off-canvas as crisp HTML — see DataView + renderStats in ui.js)
  }
};
