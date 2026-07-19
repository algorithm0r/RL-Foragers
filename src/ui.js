'use strict';
// ALL DOM lives here (and in index.html). The sim classes never touch the document, which
// is what lets the same files run headlessly. Builds the control panel from PARAM_SCHEMA
// and writes changes straight back into PARAMETERS.
function buildControls() {
  const panel = document.getElementById('controlPanel');
  for (const spec of PARAM_SCHEMA) {
    if (spec.type === 'checkbox') { panel.appendChild(buildCheckbox(spec)); continue; }
    panel.appendChild(buildSlider(spec));
  }
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
