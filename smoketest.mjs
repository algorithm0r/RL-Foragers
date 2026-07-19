// No-DB sanity run. Trains the flat learner on the trivial 1×1 grid and asserts it LEARNS the
// one thing that has to be true — "if food is under you, eat" — then checks the default 5×5
// grid runs without error. Prints the numbers that belong in the DEVLOG entry. Non-zero on fail.
//   node smoketest.mjs
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

// --- Invariant A: on a 1×1 grid, the learner must learn to EAT when food is present ---
P.gridN = 1;
P.receptiveField = 1;
const world = new World(800, 600);
const engine = new GameEngine();
for (let t = 1; t <= 5000; t++) { engine.tick = t; world.update(engine); }

const L = world.agent.learner;
const qEat = L.getQ('1', World.EAT);
const qMove = L.getQ('1', 0);
const best = L.bestAction('1');
const learnedToEat = best === World.EAT && qEat > qMove;
const cleared = world.episodes > 100; // the trivial board should be cleared many times over 5000 ticks

// --- Invariant B: the default 5×5 grid runs without throwing and populates the Q-table ---
P.gridN = 5;
P.receptiveField = 7;
let ranClean = true;
try {
  const w5 = new World(800, 600);
  const e5 = new GameEngine();
  for (let t = 1; t <= 1000; t++) { e5.tick = t; w5.update(e5); }
  ranClean = w5.agent.learner.Q.size > 0;
} catch (err) {
  ranClean = false;
  console.error('5×5 run threw:', err.message);
}

const ok = learnedToEat && cleared && ranClean;
console.log('smoke: 1×1 Q(food,eat)=' + qEat.toFixed(3) + ' Q(food,move)=' + qMove.toFixed(3) +
  ' best=' + best + '(eat=' + World.EAT + ') episodes=' + world.episodes +
  ' | 5×5 clean=' + ranClean + ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
