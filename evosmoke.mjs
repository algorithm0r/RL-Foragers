// Stage 6 v1a proof: does the evolutionary loop actually raise fitness? A population of foragers
// evolves its RL meta-params (ε, α, γ) over discrete generations on a renewable 30×30 world; we
// check that mean food-foraged climbs from the first generations to the last, and PRINT what
// evolution chose for the genes (an observation, not a gate — we don't assume the optimum).
//   node evosmoke.mjs
// Loads the SAME browser sim files into the main V8 realm via indirect eval (NOT vm — conventions §4).
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
const { PARAMETERS: P, World, evolve } = globalThis;
// seed deterministically so the trend is reproducible run-to-run
Math.random = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(20260722);

// --- evolution world regime (v1a): larger arena, renewable food, no shelter/pits/goats yet ---
P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.relevanceFilter = false;
P.enableWater = false; P.enableShelter = false; P.enablePits = false; P.enableRocks = false; P.enableGoats = false;
P.nTypes = 1; P.gridN = 30; P.nFood = 60;            // ~7% food density → foraging is viable on its own
P.evoPopSize = 16; P.evoGenerations = 25; P.evoRuns = 4; P.evoBatchSize = 8; P.evoProtect = 2;
P.evoLifetime = 500; P.evoCull = 0.5; P.evoMutRate = 0.5;

const hist = evolve(P.evoGenerations, P.evoPopSize).history;

const G = hist.length;
const q = Math.max(1, Math.floor(G / 4));
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const first = avg(hist.slice(0, q).map((h) => h.mean));
const last = avg(hist.slice(G - q).map((h) => h.mean));
const rise = last - first;

// per-generation trace (sampled) so the trajectory is legible in the log
const show = [0, Math.floor(G / 4), Math.floor(G / 2), Math.floor((3 * G) / 4), G - 1];
console.log('gen   meanFit  bestFit  meanAge    ε      α      γ    | rGather rStep  confK   (felt reward)');
for (const i of show) {
  const h = hist[i], g = h.genes;
  console.log(
    String(i).padStart(3) + '  ' + h.mean.toFixed(1).padStart(7) + '  ' + h.best.toFixed(0).padStart(6) +
    '   ' + h.meanAge.toFixed(1).padStart(5) + '   ' + g.epsilon.toFixed(3) + '  ' + g.alpha.toFixed(3) + '  ' + g.gamma.toFixed(3) +
    '  | ' + g.rewardGather.toFixed(2).padStart(6) + ' ' + g.rewardStep.toFixed(2).padStart(6) + ' ' + g.confidenceK.toFixed(0).padStart(5));
}

const g0 = hist[0].genes, gN = hist[G - 1].genes;
// PASS = the loop optimises fitness: last-quarter mean clearly above first-quarter mean.
const pass = rise > 0.05 * Math.max(1, first) && last > first;
console.log(
  '\nevo: pop=' + P.evoPopSize + ' gens=' + G + ' life=' + P.evoLifetime + ' grid=' + P.gridN + '×' + P.gridN +
  ' | meanFit ' + first.toFixed(1) + '→' + last.toFixed(1) + ' (Δ' + rise.toFixed(1) + ')' +
  ' | ε ' + g0.epsilon.toFixed(3) + '→' + gN.epsilon.toFixed(3) +
  ' α ' + g0.alpha.toFixed(3) + '→' + gN.alpha.toFixed(3) +
  ' γ ' + g0.gamma.toFixed(3) + '→' + gN.gamma.toFixed(3) +
  ' | felt rGather ' + g0.rewardGather.toFixed(2) + '→' + gN.rewardGather.toFixed(2) +
  ' rStep ' + g0.rewardStep.toFixed(2) + '→' + gN.rewardStep.toFixed(2) +
  ' -> ' + (pass ? 'PASS' : 'FAIL'));

// evolved INSTINCTS for the eat action (the only "special" action in this food world) — the mechanism
// that will target `attack` once goats are in the evo world (v1b.2 goats test / v1b.3).
const eatIdx = World.buildActions().indexOf('eat');
console.log('instinct[eat]: initialQ ' + hist[0].vgenes.initialQ[eatIdx].toFixed(2) + '→' + hist[G - 1].vgenes.initialQ[eatIdx].toFixed(2));
process.exit(pass ? 0 : 1);
