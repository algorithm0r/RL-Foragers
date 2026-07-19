// No-DB sanity run. Asserts the invariants that must hold, then prints the numbers that belong
// in the DEVLOG entry. Non-zero exit on failure.
//   node smoketest.mjs
//   A) flat eat reflex: on a 1×1 arena the flat learner learns "food underfoot → eat"
//   B) decoupling: sensed-state length is receptiveField², INDEPENDENT of arena size
//   C) partial obs: a small window on a large arena runs clean and populates the Q-table
//   D) layered coupling: L1/L3/L5 + confidence clears an arena, EATS when food is underfoot,
//      and MOVES (not eats) when food is merely adjacent — the eat/navigate division of labour
//
// Loads the SAME browser sim files into the MAIN V8 realm via indirect eval (NOT vm — see
// conventions §4: vm adds a ~7-10x hot-loop tax on per-tick global reads, which RL leans on).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'agent.js', 'world.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, '');
  indirectEval(src);
}
const { PARAMETERS: P, World, GameEngine } = globalThis;
const clearGrid = (w) => { for (let y = 0; y < w.N; y++) for (let x = 0; x < w.N; x++) w.grid[y][x] = 0; };

// --- A: flat learner, 1×1 arena, must learn to EAT when food is present ---
P.agent = 'flat'; P.gridN = 1; P.receptiveField = 1;
const wA = new World(800, 600), eA = new GameEngine();
for (let t = 1; t <= 5000; t++) { eA.tick = t; wA.update(eA); }
const LA = wA.agent.learner;
const qEat = LA.getQ('1', World.EAT), qMove = LA.getQ('1', 0);
const flatEat = LA.bestAction('1') === World.EAT && qEat > qMove && wA.episodes > 100;

// --- B: window size fixes the state length regardless of arena size ---
let decoupled = true;
for (const [N, rf] of [[6, 1], [8, 3], [10, 5], [4, 5]]) {
  P.gridN = N; P.receptiveField = rf;
  if (new World(800, 600).senseState().length !== rf * rf) { decoupled = false; break; }
}

// --- C: 5×5 window on a 10×10 arena (partial observability) runs clean ---
P.agent = 'flat'; P.gridN = 10; P.receptiveField = 5;
let partialClean = true, states5 = 0;
try {
  const w = new World(800, 600), e = new GameEngine();
  for (let t = 1; t <= 2000; t++) { e.tick = t; w.update(e); }
  states5 = w.agent.learner.Q.size; partialClean = states5 > 0;
} catch (err) { partialClean = false; console.error('partial-obs threw:', err.message); }

// --- D: layered agent — clears + eat/navigate routing ---
P.agent = 'layered'; P.layers = [1, 3, 5]; P.gridN = 8; P.foodDensity = 0.15;
const wD = new World(800, 600), eD = new GameEngine();
for (let t = 1; t <= 200000; t++) { eD.tick = t; wD.update(eD); }
const A = wD.agent;
const layeredClears = wD.episodes > 100;

// eat when food is underfoot (center = 1, rest empty)
clearGrid(wD); wD.ax = 4; wD.ay = 4; wD.grid[4][4] = 1;
const cEat = A.combine(A.statesFor(wD));
const eatRouted = A.argmax(cEat.q) === World.EAT;

// move (not eat) when food is one step East (center = 0)
clearGrid(wD); wD.ax = 4; wD.ay = 4; wD.grid[4][5] = 1;
const cNav = A.combine(A.statesFor(wD));
const navAction = A.argmax(cNav.q);
const navMoves = navAction !== World.EAT;
const navEast = navAction === 2; // World.DIRS index 2 = [1,0] = East (diagnostic, not gated)

const ok = flatEat && decoupled && partialClean && layeredClears && eatRouted && navMoves;
console.log('smoke:' +
  ' A flatEat=' + flatEat + ' (Q eat=' + qEat.toFixed(2) + ' move=' + qMove.toFixed(2) + ')' +
  ' | B decoupled=' + decoupled +
  ' | C partialClean=' + partialClean + '(states=' + states5 + ')' +
  ' | D clears=' + wD.episodes + ' eatRouted=' + eatRouted +
  ' w' + cEat.weights.map((x) => x.toFixed(2)).join('/') +
  ' navMoves=' + navMoves + ' navEast=' + navEast +
  ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
