'use strict';
// ALL DOM lives here (and in index.html). The sim classes never touch the document, which
// is what lets the same files run headlessly. Builds the control panel from PARAM_SCHEMA
// and writes changes straight back into PARAMETERS.
// Section order + which sections start collapsed. Rows carry `group`; unknown groups append
// after these in first-seen order. Collapsing the opt-in/rare sections keeps the panel short.
var CONTROL_GROUP_ORDER = ['Model', 'Learning', 'Replay', 'Goats', 'Shelter', 'Advanced'];
var CONTROL_GROUPS_COLLAPSED = ['Replay', 'Advanced'];
var _ctlRows = [];      // { spec, el } for every built row — drives showIf visibility
var _ctlSections = {};  // group name -> its <details> element (hidden when all its rows are)

function buildControls() {
  const panel = document.getElementById('controlPanel');
  _ctlRows = []; _ctlSections = {};
  const groups = {}, order = CONTROL_GROUP_ORDER.slice();
  for (const spec of PARAM_SCHEMA) {
    const g = spec.group || 'Model';
    if (!groups[g]) { groups[g] = []; if (!order.includes(g)) order.push(g); }
    groups[g].push(spec);
  }
  for (const g of order) {
    if (!groups[g]) continue;
    const det = document.createElement('details');
    det.className = 'ctl-group';
    det.open = !CONTROL_GROUPS_COLLAPSED.includes(g);
    const sum = document.createElement('summary');
    sum.textContent = g;
    det.appendChild(sum);
    for (const spec of groups[g]) {
      const el = spec.type === 'checkbox' ? buildCheckbox(spec)
        : spec.type === 'select' ? buildSelect(spec) : buildSlider(spec);
      det.appendChild(el);
      _ctlRows.push({ spec, el });
    }
    _ctlSections[g] = det;
    panel.appendChild(det);
  }
  refreshControlVisibility();
}

// Apply every row's showIf, then hide any section left with no visible rows. Called after any
// control change so toggling a feature reveals/hides its dependent knobs (and its whole section).
function refreshControlVisibility() {
  const P = PARAMETERS;
  for (const r of _ctlRows) {
    const s = r.spec.showIf;
    const show = !s || (typeof s === 'function' ? s(P) : !!P[s]);
    r.el.style.display = show ? '' : 'none';
  }
  for (const g in _ctlSections) {
    const anyVisible = _ctlRows.some((r) => (r.spec.group || 'Model') === g && r.el.style.display !== 'none');
    _ctlSections[g].style.display = anyVisible ? '' : 'none';
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
    refreshControlVisibility();
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
    refreshControlVisibility(); // a feature toggle reveals/hides its dependent knobs
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
  const feat = 'food' + (P.enableWater ? '+water' : '') + (P.enableShelter ? '+shelter' : '')
    + (P.enablePits ? '+pits' : '') + (P.enableRocks ? '+rocks' : '') + (P.enableGoats ? '+goats' : '');
  const L = [];
  L.push('model    ' + feat);
  const bands = A.layers ? ' [' + A.layers.map((l) => l.label).join(' ') + ']' : '';
  const agentDesc = P.agent === 'flat' ? 'flat ' + P.receptiveField + '×' + P.receptiveField
    : P.agent === 'dqn' ? 'dqn ' + P.dqnField + '×' + P.dqnField
    : P.agent + bands; // layered / subsumption / multi-* — name + layer bands
  L.push('agent    ' + agentDesc);
  L.push('explore  ' + (P.explore === 'ucb' ? 'UCB c=' + P.ucbC : 'ε-greedy ε=' + P.epsilon));
  L.push('arena    ' + w.N + '×' + w.N);
  L.push('');
  L.push('episode  ' + w.episodes);
  L.push(P.enableShelter ? 'rested   ' + w.rested : 'cleared  ' + w.cleared);
  if (P.enableShelter) L.push('collapsed ' + w.collapsed + '  (' + (w.collapseRate() * 100).toFixed(0) + '%)');
  if (P.enablePits) L.push('died     ' + w.died + '  (' + (w.deathRate() * 100).toFixed(0) + '%)');
  if (P.enableGoats) L.push('hunted   ' + w.goatsKilled + '  goat-pit ' + w.goatPitDeaths + '  alive ' + w.goats.reduce((n, g) => n + (g.alive ? 1 : 0), 0));
  if (P.enableShelter || P.enableWater) L.push('carrying food ' + w.food + (P.enableWater ? '  water ' + w.water : ''));
  L.push('steps    ' + w.steps + ' / ' + P.maxStepsPerEpisode);
  const qs = A.layers ? A.layers.reduce((s, l) => s + l.learner.numStates(), 0) : (A.learner ? A.learner.numStates() : A.numStates());
  L.push((A.numStates && !A.learner && !A.layers ? 'weights  ' : 'Q-states ') + qs.toLocaleString());
  if (A.layers) L.push('weights  ' + A.layers.map((l, i) => l.label + ':' + A.lastWeights[i].toFixed(2)).join(' '));
  L.push('');
  L.push(w.metricLabel() + ':  ' + (w.episodes === 0 ? '—' : w.metric().toFixed(2)));
  el.textContent = L.join('\n');
}

// --- Evolution viz (browser): a gene readout (text) + a fitness-over-generations curve. Both are
// driven by EvoRunner (main.js). The browser evo is a SIMPLIFIED single-run-per-generation loop for
// smooth watching; the headless runners (evofull/evohunt/evoshelter.mjs) are the faithful science.
function renderEvoReadout(st, gen) {
  const el = document.getElementById('stats');
  if (!el || !st) return;
  const g = st.genes, L = [];
  L.push('EVOLUTION — browser viz (1 run/gen; headless runners are the faithful science)');
  L.push('generation ' + gen);
  L.push('fitness    mean ' + st.mean.toFixed(1) + '   best ' + st.best.toFixed(0));
  L.push('meanAge    ' + st.meanAge.toFixed(1) + '  (generations the elites have persisted)');
  L.push('');
  L.push('genes  ε ' + g.epsilon.toFixed(3) + '   α ' + g.alpha.toFixed(2) + '   γ ' + g.gamma.toFixed(2));
  L.push('felt   gather ' + g.rewardGather.toFixed(2) + '  step ' + g.rewardStep.toFixed(2) +
    (PARAMETERS.enableShelter ? '  rest ' + g.rewardRest.toFixed(2) + '^' + g.restExponent.toFixed(1) : '') +
    (PARAMETERS.enablePits ? '  pit ' + g.rewardPit.toFixed(2) : ''));
  const ai = World.buildActions().indexOf('attack');
  if (ai >= 0 && st.vgenes) L.push('instinct  attack initialQ ' + st.vgenes.initialQ[ai].toFixed(2));
  el.textContent = L.join('\n');
}

// mean (green) + best (gold) banked-fitness per generation, plotted to fill the canvas
function drawEvoCurve(ctx, history) {
  const W = ctx.canvas.width, H = ctx.canvas.height, n = history.length;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  if (!n) return;
  let mx = 1; for (const h of history) if (h.best > mx) mx = h.best;
  const plot = (key, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? 4 + (i / (n - 1)) * (W - 8) : 4;
      const y = H - 4 - (history[i][key] / mx) * (H - 8);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  plot('best', '#e8b23a'); plot('mean', '#3fbf6f');
  ctx.fillStyle = '#5a5f68'; ctx.font = '10px monospace';
  ctx.fillText('fitness/gen  (best gold, mean green)  peak ' + mx.toFixed(0), 6, 12);
}

// --- Ecology viz (Stage 7): a live readout + a population-over-time curve, driven by EcoRunner (main.js).
function renderEcoReadout(s) {
  const el = document.getElementById('stats');
  if (!el || !s) return;
  const g = s.genes, L = [];
  L.push('ECOLOGY — natural selection, no GA (survive + reproduce)');
  L.push('time    ' + s.time);
  L.push('pop     ' + s.pop + (s.pop === 0 ? '   *** EXTINCT ***' : ''));
  L.push('births ' + s.births + '   starved ' + s.starved + '   hazard ' + s.hazard);
  L.push('meanEnergy ' + s.meanEnergy.toFixed(0) + '   meanAge ' + s.meanAge.toFixed(0));
  L.push('');
  L.push('genes  ε ' + g.epsilon.toFixed(3) + '   α ' + g.alpha.toFixed(2) + '   γ ' + g.gamma.toFixed(2));
  L.push('felt   gather ' + g.rewardGather.toFixed(2) + '  step ' + g.rewardStep.toFixed(2) + '  reproduce ' + g.rewardReproduce.toFixed(2));
  el.textContent = L.join('\n');
}

// population over time (green), auto-scaled to the peak seen
function drawEcoCurve(ctx, hist) {
  const W = ctx.canvas.width, H = ctx.canvas.height, n = hist.length;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  if (!n) return;
  let mx = 1; for (const h of hist) if (h.pop > mx) mx = h.pop;
  ctx.strokeStyle = '#3fbf6f'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? 4 + (i / (n - 1)) * (W - 8) : 4, y = H - 4 - (hist[i].pop / mx) * (H - 8);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#5a5f68'; ctx.font = '10px monospace'; ctx.fillText('population / time   peak ' + mx, 6, 12);
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
