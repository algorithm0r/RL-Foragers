// No-DB sanity run. Verifies the model invariant and prints the numbers that belong in the
// DEVLOG entry (proof coupled to log). Exits non-zero on failure.
//   node smoketest.mjs
//
// Loads the SAME browser sim files into the MAIN V8 realm via indirect eval (NOT vm).
// Everything in src/ is `var` / `function` / `var X = class X`, so once the leading
// 'use strict' directive is stripped the top-level names attach to globalThis and read as
// fast native globals. This avoids the ~7-10x vm hot-loop tax on per-tick PARAMETERS reads
// (conventions §4) — which matters here because the RL loop hits PARAMETERS every tick.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval; // aliased → runs in the global realm (sloppy), so `var` leaks to globalThis

function loadIntoRealm(files) {
  for (const f of files) {
    let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
    src = src.replace(/^\s*(['"])use strict\1;?/, ''); // strip directive so declarations leak to global
    indirectEval(src);
  }
}

loadIntoRealm(['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js']);

const P = globalThis.PARAMETERS;
const world = new globalThis.World(800, 600);
const engine = new globalThis.GameEngine();
const start = world.meanX();
for (let t = 1; t <= 500; t++) { engine.tick = t; world.update(engine); }
const end = world.meanX();

// invariant: positive drift moves mean-x right, negative moves it left
const ok = P.drift > 0 ? end > start : (P.drift < 0 ? end < start : true);
console.log('smoke: startMeanX=' + start.toFixed(3) + ' endMeanX=' + end.toFixed(3) +
  ' drift=' + P.drift + ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
