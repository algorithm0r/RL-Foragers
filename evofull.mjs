// Stage 6 v1b.5 — the COMBINED full world: renewable food + stationary goats (prey) + no-INT
// multi-shelter, one population, full genome (ε/α/γ + felt gather/step/perUnit/confidenceK + per-action
// instincts incl. attack). Fitness = banked stock; carcass food counts (a hunt is food you carry home).
// The question: do foraging, hunting, and shelter-seeking CO-EVOLVE under one selection pressure? Food is
// scarce-ish so hunting is worth it. Replay OFF. Frozen greedy-eval reads the LEARNED policy (5a lesson).
//   node evofull.mjs
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

// the full world: shelter (no-INT, multi) + goats (stationary renewable prey) + renewable scarce food
P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.strategicLayer = false; P.relevanceFilter = false; P.qReplay = false;
P.enableShelter = true; P.shelterActivate = 'cleared'; P.maxStepsPerEpisode = 1e9; P.restStickC = 0;
P.enableGoats = true; P.nGoats = 6; P.goatStationary = true; P.goatsCountToClear = false; P.goatHuntOneAction = false; P.goatExplodeRadius = 0; P.goatEatRespawn = true;
P.enablePits = true; P.nPits = 3;                     // terminal death — a survival hazard to evolve avoidance of
P.enableWater = false; P.enableRocks = false;
P.nTypes = 1; P.gridN = 20; P.nFood = 20;             // scarce-ish → hunting is worth it
P.evoPopSize = 16; P.evoGenerations = 25; P.evoRuns = 4; P.evoBatchSize = 8; P.evoProtect = 2;
P.evoLifetime = 400; P.evoShelterFrac = 0.25; P.evoShelterGrid = 3; P.evoCull = 0.5; P.evoMutRate = 0.5; P.evoUseInstincts = true;

const ATT = World.buildActions().indexOf('attack');
const meanVec = (pop, key, a) => pop.reduce((s, A) => s + A.genome[key][a], 0) / pop.length;

const { history: hist, pop } = evolve(P.evoGenerations, P.evoPopSize);
const ev = greedyEval(pop, 6);

const G = hist.length, q = Math.max(1, Math.floor(G / 4));
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const first = avg(hist.slice(0, q).map((h) => h.mean)), last = avg(hist.slice(G - q).map((h) => h.mean));

console.log('actions: ' + World.buildActions().join(',') + '   (attack idx ' + ATT + ')\n');
console.log('gen  bankedFit  meanAge    ε      α      γ    | perUnit pitPen  attack(iQ/uB)');
for (const i of [0, Math.floor(G / 2), G - 1]) {
  const h = hist[i], g = h.genes;
  console.log(String(i).padStart(3) + '  ' + h.mean.toFixed(1).padStart(8) + '  ' + h.meanAge.toFixed(1).padStart(5) +
    '   ' + g.epsilon.toFixed(3) + '  ' + g.alpha.toFixed(3) + '  ' + g.gamma.toFixed(3) +
    '  | ' + g.rewardPerUnit.toFixed(0).padStart(5) + ' ' + g.pitPenalty.toFixed(0).padStart(5) +
    '     ' + h.vgenes.initialQ[ATT].toFixed(2) + ' / ' + h.vgenes.unexploredBonus[ATT].toFixed(2));
}
const pass = last > first && ev.foodPerRun > 0 && ev.killsPerRun >= 0;
console.log('\nevo-full: shelter+goats+food+PITS (no-INT) | bankedFit ' + first.toFixed(1) + '→' + last.toFixed(1) +
  ' | greedy banked/run ' + ev.foodPerRun.toFixed(1) + ' kills/run ' + ev.killsPerRun.toFixed(1) + ' deaths/run ' + ev.deathsPerRun.toFixed(1) +
  ' | evolved attack iQ ' + meanVec(pop, 'initialQ', ATT).toFixed(2) + ' felt pitPenalty ' + hist[G - 1].genes.pitPenalty.toFixed(0) +
  ' -> ' + (pass ? 'PASS' : 'FAIL'));
process.exit(pass ? 0 : 1);
