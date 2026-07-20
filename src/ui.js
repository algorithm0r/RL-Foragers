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
  constructor(world, graph, graphCtx, qCtx, q3Ctx) {
    this.world = world; this.graph = graph; this.graphCtx = graphCtx; this.qCtx = qCtx; this.q3Ctx = q3Ctx;
  }
  update() {}
  draw() {
    renderStats(this.world);
    if (this.graphCtx) {
      this.graphCtx.clearRect(0, 0, this.graphCtx.canvas.width, this.graphCtx.canvas.height);
      this.graph.draw(this.graphCtx);
    }
    if (this.qCtx) renderQView(this.world, this.qCtx);
    if (this.q3Ctx) renderQ3View(this.world, this.q3Ctx);
  }
};

// Shared column layout so the 1×1 and 3×3 Q-views line up: left column = "no food", right = "food".
var Q_COL_L = 12, Q_COL_R = 190, Q_ROW = 48;

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
  // colour is normalized PER STATE (each grid to its own action range), so it shows the DECISION
  // within a state (green = best action) independent of the state's overall value level.
  ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
  ctx.fillText('1×1 layer Q  (centre=eat, ring=moves; colour = Q per state)', 8, 12);
  drawQGrid(ctx, L1, '0', Q_COL_L, Q_ROW, 'no food', 50);
  drawQGrid(ctx, L1, '1', Q_COL_R, Q_ROW, 'food', 50);
}

function drawQGrid(ctx, L1, state, x0, y0, label, cell) {
  const EAT = 8;
  // per-state range over the 9 actions (visited only)
  let mn = Infinity, mx = -Infinity, best = 0, bestQ = -Infinity;
  for (let a = 0; a < 9; a++) {
    if (L1.getCount(state, a) === 0) continue;
    const q = L1.getQ(state, a);
    if (q < mn) mn = q; if (q > mx) mx = q;
    if (q > bestQ) { bestQ = q; best = a; }
  }
  if (mn === Infinity) { mn = 0; mx = 1; }
  ctx.fillStyle = '#cdd2da'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label + '  [' + mn.toFixed(1) + '…' + mx.toFixed(1) + ']', x0 + 1.5 * cell, y0 - 4);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const dx = col - 1, dy = row - 1;
      let a = EAT;
      if (dx !== 0 || dy !== 0) { a = -1; for (let i = 0; i < 8; i++) if (World.DIRS[i][0] === dx && World.DIRS[i][1] === dy) { a = i; break; } }
      const q = L1.getQ(state, a);
      const px = x0 + col * cell, py = y0 + row * cell;
      ctx.fillStyle = L1.getCount(state, a) > 0 ? qColorRange(q, mn, mx) : '#242a33';
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      if (a === best) { ctx.strokeStyle = '#7fd1ff'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4); }
      else if (a === EAT) { ctx.strokeStyle = '#e8b23a'; ctx.lineWidth = 1; ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4); }
      ctx.fillStyle = '#e9edf2'; ctx.font = '10px monospace';
      ctx.fillText(q.toFixed(1), px + cell / 2, py + cell / 2 + 3.5);
    }
  }
}

// data-driven colour: red at the range min → green at the range max (uses util.js hsl()). Because
// the range is the actual visited min/max, a best action near 0 still reads as green.
function qColorRange(q, mn, mx) {
  const t = mx > mn ? Math.max(0, Math.min(1, (q - mn) / (mx - mn))) : 0.5;
  return hsl(120 * t, 62, 42); // hue 0 (red) → 120 (green)
}

// --- 3×3 layer Q-view -------------------------------------------------------------------------
// The 3×3 layer has 512 states (256 surround configs × center food/no-food). We keep the action
// layout of the 1×1 view (centre=eat, ring=moves) but each action cell becomes a 16×16 heatmap over
// the 256 surround configs, ordered canonically by food count (0→8). Two panels: center no-food /
// food. Grey = never visited (state,action). Only the food/no-food slice of the state space is shown.
var Q3_CANON = null, Q3_STATE0 = null, Q3_STATE1 = null;
function q3Precompute() {
  if (Q3_CANON) return;
  const popcount = (x) => { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; };
  const cfgs = [];
  for (let c = 0; c < 256; c++) cfgs.push(c);
  cfgs.sort((a, b) => (popcount(a) - popcount(b)) || (a - b)); // canonical: fewest food → most food
  Q3_CANON = cfgs;
  const winPos = [0, 1, 2, 3, 5, 6, 7, 8]; // 3×3 window indices of the 8 surround cells (centre=4)
  Q3_STATE0 = new Array(256); Q3_STATE1 = new Array(256);
  for (let k = 0; k < 256; k++) {
    const cfg = cfgs[k], ch = '000000000'.split('');
    for (let j = 0; j < 8; j++) ch[winPos[j]] = (cfg >> j & 1) ? '1' : '0';
    ch[4] = '0'; Q3_STATE0[k] = ch.join('');
    ch[4] = '1'; Q3_STATE1[k] = ch.join('');
  }
}

function renderQ3View(w, ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const A = w.agent;
  let L3 = null;
  if (A.layers) { const l = A.layers.find((x) => x.size === 3); if (l) L3 = l.learner; }
  else if (PARAMETERS.receptiveField === 3) L3 = A.learner;
  ctx.textAlign = 'left';
  if (!L3) { ctx.fillStyle = '#5a5f68'; ctx.font = '11px monospace'; ctx.fillText('3×3 Q-view — enable a 3×3 layer', 8, 18); return; }
  q3Precompute();
  ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
  ctx.fillText('3×3 layer Q — action × 256 surround configs (0→8 food)', 8, 12);
  ctx.fillStyle = '#5a5f68'; ctx.font = '10px monospace';
  ctx.fillText('colour = Q per state (green = best action)   grey = unexplored', 8, 26);
  drawQ3Panel(ctx, L3, Q3_STATE0, Q_COL_L, Q_ROW, 'no food');
  drawQ3Panel(ctx, L3, Q3_STATE1, Q_COL_R, Q_ROW, 'food');
}

function drawQ3Panel(ctx, L3, STATES, px0, py0, label) {
  const cfgPx = 3, cellW = 16 * cfgPx, gap = 5, EAT = 8;
  // per-STATE (per-config) colour range: for each config, min/max over its 9 actions (visited only)
  const cmn = new Float64Array(256).fill(Infinity), cmx = new Float64Array(256).fill(-Infinity);
  for (let k = 0; k < 256; k++) {
    const st = STATES[k];
    for (let a = 0; a < 9; a++) if (L3.getCount(st, a) > 0) { const q = L3.getQ(st, a); if (q < cmn[k]) cmn[k] = q; if (q > cmx[k]) cmx[k] = q; }
  }
  ctx.fillStyle = '#cdd2da'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, px0, py0 - 3);
  for (let arow = 0; arow < 3; arow++) {
    for (let acol = 0; acol < 3; acol++) {
      const dx = acol - 1, dy = arow - 1;
      let a = EAT;
      if (dx !== 0 || dy !== 0) { a = -1; for (let i = 0; i < 8; i++) if (World.DIRS[i][0] === dx && World.DIRS[i][1] === dy) { a = i; break; } }
      const cx = px0 + acol * (cellW + gap), cy = py0 + arow * (cellW + gap);
      for (let k = 0; k < 256; k++) {
        const st = STATES[k];
        ctx.fillStyle = L3.getCount(st, a) > 0 ? qColorRange(L3.getQ(st, a), cmn[k], cmx[k]) : '#242a33';
        ctx.fillRect(cx + (k & 15) * cfgPx, cy + (k >> 4) * cfgPx, cfgPx, cfgPx);
      }
      ctx.strokeStyle = a === EAT ? '#e8b23a' : '#333'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - 0.5, cy - 0.5, cellW + 1, cellW + 1);
    }
  }
}
