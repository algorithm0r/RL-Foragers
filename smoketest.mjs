// No-DB sanity run. Asserts the three things that must hold, then prints the numbers that
// belong in the DEVLOG entry. Non-zero exit on failure.
//   node smoketest.mjs
//   A) eat reflex: on a 1×1 arena the learner learns "food underfoot → eat"
//   B) decoupling: the sensed-state length is receptiveField², INDEPENDENT of arena size
//   C) partial obs: a small window on a large arena runs clean and populates the Q-table
//
// Loads the SAME browser sim files into the MAIN V8 realm via indirect eval (NOT vm — see
// conventions §4: vm adds a ~7-10x hot-loop tax on per-tick global reads, which RL leans on).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval; // aliased → runs in the global (sloppy) realm, so `var` leaks to globalThis
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'agent.js', 'world.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, ''); // strip directive so declarations leak to global
  indirectEval(src);
}

const { PARAMETERS: P, World, GameEngine } = globalThis;

// --- A: on a 1×1 arena, the learner must learn to EAT when food is present ---
P.gridN = 1; P.receptiveField = 1;
const world = new World(800, 600);
const engine = new GameEngine();
for (let t = 1; t <= 5000; t++) { engine.tick = t; world.update(engine); }
const L = world.agent.learner;
const qEat = L.getQ('1', World.EAT), qMove = L.getQ('1', 0), best = L.bestAction('1');
const learnedToEat = best === World.EAT && qEat > qMove && world.episodes > 100;

// --- B: window size fixes the state length regardless of arena size (decoupling) ---
let decoupled = true;
for (const [N, rf] of [[6, 1], [8, 3], [10, 5], [4, 5]]) {
  P.gridN = N; P.receptiveField = rf;
  const w = new World(800, 600);
  if (w.senseState().length !== rf * rf) { decoupled = false; break; }
}

// --- C: a 5×5 window on a 10×10 arena (partial observability) runs clean & learns state ---
P.gridN = 10; P.receptiveField = 5;
let ranClean = true, states5 = 0;
try {
  const w = new World(800, 600), e = new GameEngine();
  for (let t = 1; t <= 2000; t++) { e.tick = t; w.update(e); }
  states5 = w.agent.learner.Q.size;
  ranClean = states5 > 0;
} catch (err) { ranClean = false; console.error('partial-obs run threw:', err.message); }

const ok = learnedToEat && decoupled && ranClean;
console.log('smoke: A eat Q(food,eat)=' + qEat.toFixed(3) + ' vs Q(move)=' + qMove.toFixed(3) +
  ' best=' + best + ' (eat=' + World.EAT + ')' +
  ' | B decoupled=' + decoupled +
  ' | C 10×10/5×5 clean=' + ranClean + ' states=' + states5 +
  ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
