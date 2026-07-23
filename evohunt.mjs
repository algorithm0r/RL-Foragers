// Stage 6 v1b.2 — the attack-INSTINCT hunting test. The 5a wall was: individual RL can't bootstrap the
// two-action hunt (attack→carcass→eat) because credit can't propagate back through the dead middle link;
// replay fixed it. Here we ask a different question: can EVOLUTION crack it — does an evolved per-action
// instinct (initialQ/unexploredBonus on `attack`) make foragers sample the hunt enough to LEARN it, with
// replay OFF? Sweep: {scarce, dense} food × {instinct ON, OFF (control)}. Read the LEARNED policy with a
// frozen greedy eval (ε=0, α=0, no bonus) — 5a's lesson: never infer hunting from a training-blended metric.
//   node evohunt.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'dqn.js', 'agent.js', 'world.js', 'evolution.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, '');
  indirectEval(src);
}
const { PARAMETERS: P, World, evolve, greedyEval } = globalThis;
Math.random = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(20260722);

// --- common regime: renewable goats present, replay OFF (so only the instinct can crack the hunt) ---
P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.relevanceFilter = false; P.qReplay = false;
P.enableWater = false; P.enableShelter = false; P.enablePits = false; P.enableRocks = false;
P.enableGoats = true; P.nGoats = 6; P.goatStationary = true; P.goatsCountToClear = false;
P.goatHuntOneAction = false; P.goatExplodeRadius = 0; P.goatEatRespawn = true;
P.nTypes = 1; P.gridN = 30;
P.evoPopSize = 16; P.evoGenerations = 20; P.evoRuns = 4; P.evoBatchSize = 8; P.evoProtect = 2;
P.evoLifetime = 400; P.evoCull = 0.5; P.evoMutRate = 0.5;

const ATT = World.buildActions().indexOf('attack');
const meanVec = (pop, key, a) => pop.reduce((s, A) => s + A.genome[key][a], 0) / pop.length;

const conditions = [
  { food: 'scarce', nFood: 15, instincts: true },
  { food: 'scarce', nFood: 15, instincts: false },
  { food: 'dense', nFood: 80, instincts: true },
  { food: 'dense', nFood: 80, instincts: false },
];

console.log('attack action index = ' + ATT + '  (replay OFF, stationary renewable prey, greedy-eval frozen)\n');
console.log('food     instinct | greedy kills/run  food/run | evolved attack: initialQ  unexploredBonus');
for (const c of conditions) {
  P.nFood = c.nFood; P.evoUseInstincts = c.instincts;
  const { pop } = evolve(P.evoGenerations, P.evoPopSize);
  const ev = greedyEval(pop, 6);
  const iq = c.instincts ? meanVec(pop, 'initialQ', ATT).toFixed(2) : '  — ';
  const ub = c.instincts ? meanVec(pop, 'unexploredBonus', ATT).toFixed(2) : '  — ';
  console.log(
    c.food.padEnd(7) + '  ' + (c.instincts ? 'ON ' : 'OFF') + '     | ' +
    ev.killsPerRun.toFixed(2).padStart(10) + '  ' + ev.foodPerRun.toFixed(0).padStart(8) + '   |' +
    '           ' + iq + '        ' + ub);
}
