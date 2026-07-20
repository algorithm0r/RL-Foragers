'use strict';
// ALL DOM lives here (and in index.html). The sim classes never touch the document, which
// is what lets the same files run headlessly. Builds the control panel from PARAM_SCHEMA
// and writes changes straight back into PARAMETERS.
function buildControls() {
  const panel = document.getElementById('controlPanel');
  for (const spec of PARAM_SCHEMA) {
    if (spec.type === 'checkbox') { panel.appendChild(buildCheckbox(spec)); continue; }
    if (spec.type === 'select') { panel.appendChild(buildSelect(spec)); continue; }
    panel.appendChild(buildSlider(spec));
  }
}

// a dropdown for a small set of mutually-exclusive string values (e.g. exploration method)
function buildSelect(spec) {
  const wrap = document.createElement('label');
  wrap.className = 'ctl';
  wrap.appendChild(document.createTextNode(spec.label + ' '));
  const sel = document.createElement('select');
  for (const opt of spec.options) {
    const o = document.createElement('option');
    o.value = opt; o.textContent = opt;
    if (PARAMETERS[spec.key] === opt) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = function () {
    PARAMETERS[spec.key] = sel.value;
    if (typeof reset === 'function') reset();
  };
  wrap.appendChild(sel);
  return wrap;
}

// a boolean/enum toggle. `onVal`/`offVal` map the checkbox to non-boolean params (e.g. agent).
function buildCheckbox(spec) {
  const wrap = document.createElement('label');
  wrap.className = 'ctl ctl-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  const on = spec.onVal !== undefined ? spec.onVal : true;
  const off = spec.offVal !== undefined ? spec.offVal : false;
  input.checked = PARAMETERS[spec.key] === on;
  input.onchange = function () {
    PARAMETERS[spec.key] = input.checked ? on : off;
    if (typeof reset === 'function') reset(); // a model flip always rebuilds the sim
  };
  wrap.appendChild(input);
  wrap.appendChild(document.createTextNode(' ' + spec.label));
  return wrap;
}

function buildSlider(spec) {
  const wrap = document.createElement('label');
  wrap.className = 'ctl';
  wrap.appendChild(document.createTextNode(spec.label + ' '));
  const input = document.createElement('input');
  input.type = 'range';
  input.min = spec.min; input.max = spec.max; input.step = spec.step;
  input.value = PARAMETERS[spec.key];
  const val = document.createElement('span');
  val.textContent = ' ' + PARAMETERS[spec.key];
  input.oninput = function () {
    PARAMETERS[spec.key] = parseFloat(input.value);
    val.textContent = ' ' + input.value;
    if (spec.resets && typeof reset === 'function') reset();
  };
  wrap.appendChild(input);
  wrap.appendChild(val);
  return wrap;
}

function setStatus(msg) {
  const s = document.getElementById('status');
  if (s) s.textContent = msg;
}

// Render the live metrics as crisp HTML (monospace text), off the canvas. Reads world state only.
function renderStats(w) {
  const el = document.getElementById('stats');
  if (!el) return;
  const P = PARAMETERS, A = w.agent;
  const feat = 'food' + (P.enableWater ? '+water' : '') + (P.enableShelter ? '+shelter' : '') + (P.enablePits ? '+pits' : '');
  const L = [];
  L.push('model    ' + feat);
  L.push('agent    ' + (A.layers ? 'layered [' + A.layers.map((l) => l.label).join(' ') + ']' : 'flat ' + P.receptiveField + '×' + P.receptiveField));
  L.push('explore  ' + (P.explore === 'ucb' ? 'UCB c=' + P.ucbC : 'ε-greedy ε=' + P.epsilon));
  L.push('arena    ' + w.N + '×' + w.N);
  L.push('');
  L.push('episode  ' + w.episodes);
  L.push(P.enableShelter ? 'rested   ' + w.rested : 'cleared  ' + w.cleared);
  if (P.enablePits) L.push('died     ' + w.died + '  (' + (w.deathRate() * 100).toFixed(0) + '%)');
  if (P.enableShelter || P.enableWater) L.push('carrying food ' + w.food + (P.enableWater ? '  water ' + w.water : ''));
  L.push('steps    ' + w.steps + ' / ' + P.maxStepsPerEpisode);
  const qs = A.layers ? A.layers.reduce((s, l) => s + l.learner.Q.size, 0) : A.learner.Q.size;
  L.push('Q-states ' + qs.toLocaleString());
  if (A.layers) L.push('weights  ' + A.layers.map((l, i) => l.label + ':' + A.lastWeights[i].toFixed(2)).join(' '));
  L.push('');
  L.push(w.metricLabel() + ':  ' + (w.episodes === 0 ? '—' : w.metric().toFixed(2)));
  el.textContent = L.join('\n');
}

// A browser-only engine entity that renders the off-canvas data view each frame: it ignores the
// game ctx passed to draw(), updates the stats DOM, paints the line graph, and draws the Q-view.
var DataView = class DataView {
  constructor(world, graph, graphCtx, qCtx) { this.world = world; this.graph = graph; this.graphCtx = graphCtx; this.qCtx = qCtx; }
  update() {}
  draw() {
    renderStats(this.world);
    if (this.graphCtx) {
      this.graphCtx.clearRect(0, 0, this.graphCtx.canvas.width, this.graphCtx.canvas.height);
      this.graph.draw(this.graphCtx);
    }
    if (this.qCtx) renderQView(this.world, this.qCtx);
  }
};

// The 1×1 layer's Q-values as two 3×3 grids ("no food" = state '0', "food" = state '1'). Spatial
// layout: the centre cell is EAT, the 8 ring cells are the moves placed by their DIRS offset, so
// you read the reflex at a glance. Cells are coloured by Q (red −, green +) on a shared scale; the
// greedy pick is outlined cyan, and eat (when it isn't the pick) is outlined gold.
function renderQView(w, ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const A = w.agent;
  let L1 = null;
  if (A.layers) { const l = A.layers.find((x) => x.size === 1); if (l) L1 = l.learner; }
  else if (PARAMETERS.receptiveField === 1) L1 = A.learner;
  ctx.textAlign = 'left';
  if (!L1) {
    ctx.fillStyle = '#5a5f68'; ctx.font = '11px monospace';
    ctx.fillText('1×1 Q-view — enable a 1×1 layer', 8, 18);
    return;
  }
  ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
  ctx.fillText('1×1 layer Q   (centre = eat, ring = moves)', 8, 13);
  // shared colour scale across both states
  let maxAbs = 0.001;
  for (const st of ['0', '1']) for (let a = 0; a < 9; a++) maxAbs = Math.max(maxAbs, Math.abs(L1.getQ(st, a)));
  drawQGrid(ctx, L1, '0', 16, 30, 'no food', maxAbs);
  drawQGrid(ctx, L1, '1', 156, 30, 'food', maxAbs);
}

function drawQGrid(ctx, L1, state, x0, y0, label, maxAbs) {
  const cell = 40, EAT = 8;
  let best = 0, bestQ = -Infinity;
  for (let a = 0; a < 9; a++) { const q = L1.getQ(state, a); if (q > bestQ) { bestQ = q; best = a; } }
  ctx.fillStyle = '#cdd2da'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x0 + 1.5 * cell, y0 - 4);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const dx = col - 1, dy = row - 1;
      let a = EAT;
      if (dx !== 0 || dy !== 0) { a = -1; for (let i = 0; i < 8; i++) if (World.DIRS[i][0] === dx && World.DIRS[i][1] === dy) { a = i; break; } }
      const q = L1.getQ(state, a);
      const px = x0 + col * cell, py = y0 + row * cell;
      ctx.fillStyle = qColor(q, maxAbs);
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      if (a === best) { ctx.strokeStyle = '#7fd1ff'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4); }
      else if (a === EAT) { ctx.strokeStyle = '#e8b23a'; ctx.lineWidth = 1; ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4); }
      ctx.fillStyle = '#e9edf2'; ctx.font = '10px monospace';
      ctx.fillText(q.toFixed(1), px + cell / 2, py + cell / 2 + 3.5);
    }
  }
}

// diverging colour around 0: green for positive Q, red for negative, magnitude → intensity
function qColor(q, maxAbs) {
  const t = Math.max(-1, Math.min(1, q / maxAbs));
  if (t >= 0) return 'rgb(24,' + Math.round(45 + 150 * t) + ',55)';
  return 'rgb(' + Math.round(45 + 150 * -t) + ',28,42)';
}
