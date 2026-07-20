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
// game ctx passed to draw(), updates the stats DOM, and paints the line graph on its own canvas.
var DataView = class DataView {
  constructor(world, graph, graphCtx) { this.world = world; this.graph = graph; this.graphCtx = graphCtx; }
  update() {}
  draw() {
    renderStats(this.world);
    const g = this.graphCtx;
    if (!g) return;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    this.graph.draw(g);
  }
};
