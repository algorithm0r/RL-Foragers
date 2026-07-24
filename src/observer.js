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

    // goats (living only — a dead goat's cell shows its carcass, which is just FOOD terrain)
    if (w.goats) for (const g of w.goats) {
      if (!g.alive) continue;
      ctx.fillStyle = '#d9a066'; ctx.beginPath();
      ctx.arc((g.x + 0.5) * cell, (g.y + 0.5) * cell, Math.max(3, cell * 0.28), 0, TAU); ctx.fill();
    }

    // the forager
    ctx.fillStyle = '#f32e26'; ctx.beginPath();
    ctx.arc((w.ax + 0.5) * cell, (w.ay + 0.5) * cell, Math.max(3, cell * 0.32), 0, TAU); ctx.fill();
    // (metrics/graph render off-canvas as crisp HTML — see DataView + renderStats in ui.js)
  }
};

// Render an EvoWorld (a whole POPULATION of foragers + goats + shelters) for the browser evolution viz.
// Same house colours as the Observer; takes a ctx so it stays DOM-free. Foragers dim once done (rested/dead).
var drawEvoWorld = function (ctx, w) {
  const N = w.N, board = Math.min(ctx.canvas.width, ctx.canvas.height), cell = board / N;
  const COLORS = ['#141a22', '#3fbf6f', '#4aa3ff', '#e8b23a', '#7a1f1f', '#6e7681']; // empty food water shelter pit rock
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = w.grid[y][x];
    ctx.fillStyle = COLORS[t] || '#141a22';
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    if (t === World.PIT) {
      ctx.strokeStyle = '#e05a5a'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x * cell + 4, y * cell + 4); ctx.lineTo((x + 1) * cell - 4, (y + 1) * cell - 4);
      ctx.moveTo((x + 1) * cell - 4, y * cell + 4); ctx.lineTo(x * cell + 4, (y + 1) * cell - 4); ctx.stroke();
    }
  }
  if (w.goats) for (const g of w.goats) {
    if (!g.alive) continue;
    ctx.fillStyle = '#d9a066'; ctx.beginPath();
    ctx.arc((g.x + 0.5) * cell, (g.y + 0.5) * cell, Math.max(2, cell * 0.3), 0, TAU); ctx.fill();
  }
  if (w.foragers) for (const f of w.foragers) {
    ctx.fillStyle = f.done ? '#7a2a26' : '#f32e26';   // dim once banked/collapsed/dead
    ctx.beginPath(); ctx.arc((f.x + 0.5) * cell, (f.y + 0.5) * cell, Math.max(2, cell * 0.3), 0, TAU); ctx.fill();
  }
};

// Render an EcoWorld (a living population): food + agents coloured by ENERGY (dark = starving, bright =
// well-fed / breeding-ready). DOM-free (takes a ctx). This is the natural-selection ecology (Stage 7).
var drawEcoWorld = function (ctx, w) {
  const N = w.N, board = Math.min(ctx.canvas.width, ctx.canvas.height), cell = board / N;
  const T = PARAMETERS.ecoReproThreshold;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (w.grid[y][x] === World.FOOD) {
    ctx.fillStyle = '#2e6b45'; ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
  }
  for (const a of w.agents) {
    const e = Math.max(0, Math.min(1, a.energy / (2 * T)));   // 0 = starving, 1 = asexual-ready
    ctx.fillStyle = hsl(190, 75, 22 + e * 48);                // blue; lightness tracks energy
    ctx.beginPath(); ctx.arc((a.x + 0.5) * cell, (a.y + 0.5) * cell, Math.max(2, cell * 0.34), 0, TAU); ctx.fill();
  }
};
