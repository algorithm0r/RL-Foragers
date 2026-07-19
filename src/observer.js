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
    const COLORS = ['#141a22', '#3fbf6f', '#4aa3ff', '#e8b23a', '#7a1f1f']; // empty food water shelter pit

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

    // HUD (right gutter)
    ctx.fillStyle = '#cdd2da'; ctx.font = "14px 'Consolas', monospace";
    let ty = 22;
    const line = (s) => { ctx.fillText(s, board + 16, ty); ty += 19; };
    const A = w.agent;
    line('arena   ' + N + '×' + N + '  (F' + PARAMETERS.nFood + ' W' + PARAMETERS.nWater + ' P' + PARAMETERS.nPits + ')');
    if (A.layers) line('layers  ' + A.layers.map((L) => L.label).join(' '));
    else line('window  ' + PARAMETERS.receptiveField + '×' + PARAMETERS.receptiveField);
    line('episode ' + w.episodes + '  rest ' + w.rested + '  die ' + w.died);
    line('carrying  food ' + w.food + '  water ' + w.water);
    line('steps   ' + w.steps + ' / ' + PARAMETERS.maxStepsPerEpisode);
    if (A.layers) {
      let qs = 0; for (const L of A.layers) qs += L.learner.Q.size;
      line('Q-states ' + qs);
      line('weights ' + A.layers.map((L, i) => L.label + ':' + A.lastWeights[i].toFixed(2)).join(' '));
    } else {
      line('Q-states ' + A.learner.Q.size);
    }
    ty += 6;
    line('mean banked reward   death rate');
    ctx.font = "20px 'Consolas', monospace";
    ctx.fillStyle = '#7fd1ff'; ctx.fillText(w.episodes === 0 ? '—' : w.meanReward().toFixed(2), board + 16, ty);
    ctx.fillStyle = '#e0894a'; ctx.fillText(w.episodes === 0 ? '—' : (w.deathRate() * 100).toFixed(0) + '%', board + 176, ty);
  }
};
