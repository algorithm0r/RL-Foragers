// Stage 6 v1b.3 — the central-place (placed-shelter) regime. Foragers forage a renewable world; a
// shelter opens at the arena centre only for the LAST QUARTER of the lifetime; they must return + REST
// to BANK their carried stock. Fitness = banked stock (never resting banks 0). This checks the regime
// works: banked-stock fitness rises as the population learns forage-then-home, and we read the felt
// rest reward evolution chose. Frozen greedy-eval reads the LEARNED policy (5a lesson).
//   node evoshelter.mjs
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
const { PARAMETERS: P, evolve, greedyEval } = globalThis;
Math.random = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(20260722);

// central-place regime: NO INT layer / NO bearing (the no-INT finding) — a forager finds a shelter only
// by SEEING a SHELTER cell in its window; multiple spaced shelters raise the find-chance. Renewable food,
// no goats/pits. maxStepsPerEpisode huge + shelterActivate='cleared' so World's steps-based
// collapse/activation never fire (EvoWorld drives the tick-based reveal itself).
P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.strategicLayer = false; P.relevanceFilter = false; P.qReplay = false;
P.enableShelter = true; P.shelterActivate = 'cleared'; P.maxStepsPerEpisode = 1e9; P.restStickC = 0;
P.enableWater = false; P.enablePits = false; P.enableRocks = false; P.enableGoats = false;
P.nTypes = 1; P.gridN = 20; P.nFood = 40;
P.evoPopSize = 16; P.evoGenerations = 25; P.evoRuns = 4; P.evoBatchSize = 8; P.evoProtect = 2;
P.evoLifetime = 400; P.evoShelterFrac = 0.25; P.evoShelterGrid = 3; P.evoCull = 0.5; P.evoMutRate = 0.5;

const { history: hist, pop } = evolve(P.evoGenerations, P.evoPopSize);
const ev = greedyEval(pop, 6);

const G = hist.length, q = Math.max(1, Math.floor(G / 4));
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const first = avg(hist.slice(0, q).map((h) => h.mean)), last = avg(hist.slice(G - q).map((h) => h.mean));

console.log('gen  bankedFit  meanAge    ε      α      γ    | rGather rStep  rRest  restExp');
for (const i of [0, Math.floor(G / 4), Math.floor(G / 2), Math.floor((3 * G) / 4), G - 1]) {
  const h = hist[i], g = h.genes;
  console.log(String(i).padStart(3) + '  ' + h.mean.toFixed(1).padStart(8) + '  ' + h.meanAge.toFixed(1).padStart(5) +
    '   ' + g.epsilon.toFixed(3) + '  ' + g.alpha.toFixed(3) + '  ' + g.gamma.toFixed(3) +
    '  | ' + g.rewardGather.toFixed(2).padStart(6) + ' ' + g.rewardStep.toFixed(2).padStart(6) + ' ' + g.rewardRest.toFixed(2).padStart(6) + ' exp ' + g.restExponent.toFixed(2));
}
// PASS = the population learns central-place foraging: banked-stock fitness climbs, and the greedy
// (frozen) policy banks a positive stock (foragers actually return + rest, not just forage-and-collapse).
const pass = last > first && last > 1 && ev.foodPerRun > 0;
console.log('\nevo-shelter: pop=' + P.evoPopSize + ' gens=' + G + ' life=' + P.evoLifetime + ' grid=' + P.gridN +
  ' shelter=last' + Math.round(P.evoShelterFrac * 100) + '% | bankedFit ' + first.toFixed(1) + '→' + last.toFixed(1) +
  ' | greedy banked/run ' + ev.foodPerRun.toFixed(1) + ' -> ' + (pass ? 'PASS' : 'FAIL'));
process.exit(pass ? 0 : 1);
