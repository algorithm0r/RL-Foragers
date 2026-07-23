// Long-run drift probe: 200 generations WITH old-age turnover (evoMaxAge), scarce-hunt world, neutral
// initialQ init. Tracks a NEUTRAL gene (initialQ[attack]) against SELECTED genes (rewardGather, epsilon)
// so we can watch drift (wander) vs selection (converge+hold) once immortal elites can't freeze the pool.
//   node evodrift.mjs <seed>
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'dqn.js', 'agent.js', 'world.js', 'evolution.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^\s*(['"])use strict\1;?/, '');
  indirectEval(src);
}
const P = globalThis.PARAMETERS, { World, evolve, Genome } = globalThis;
const seed = parseInt(process.argv[2] || '20260722', 10);
Math.random = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(seed);

P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.strategicLayer = false; P.relevanceFilter = false; P.qReplay = false;
P.enableGoats = true; P.nGoats = 6; P.goatStationary = true; P.goatsCountToClear = false; P.goatEatRespawn = true;
P.enableShelter = false; P.enablePits = false; P.enableWater = false; P.enableRocks = false;
P.nTypes = 1; P.gridN = 30; P.nFood = 15;                 // scarce hunt world
P.evoPopSize = 16; P.evoRuns = 4; P.evoBatchSize = 8; P.evoProtect = 2; P.evoMaxAge = 10; P.evoLifetime = 400;
P.evoCull = 0.5; P.evoMutRate = 0.5; P.evoUseInstincts = true; P.evoGenerations = 200;
Genome.VGENES.initialQ.init = [0, 1];                     // neutral full-range init

const ATT = World.buildActions().indexOf('attack');
const { history: H } = evolve(P.evoGenerations, P.evoPopSize);

console.log('seed=' + seed + '  (neutral: initialQ[attack];  selected: rewardGather, epsilon)');
console.log('gen  meanFit  meanAge |  initQ[att]  |  rGather   epsilon');
for (let g = 0; g < H.length; g += 20) {
  const h = H[g];
  console.log(String(g).padStart(3) + '  ' + h.mean.toFixed(1).padStart(7) + '  ' + h.meanAge.toFixed(1).padStart(6) +
    '  |  ' + h.vgenes.initialQ[ATT].toFixed(3).padStart(7) + '    |  ' + h.genes.rewardGather.toFixed(2).padStart(6) + '   ' + h.genes.epsilon.toFixed(3));
}
const last = H[H.length - 1];
console.log('end  ' + last.mean.toFixed(1) + '  age ' + last.meanAge.toFixed(1) +
  '  | initQ[att] ' + last.vgenes.initialQ[ATT].toFixed(3) + ' | rGather ' + last.genes.rewardGather.toFixed(2) + ' eps ' + last.genes.epsilon.toFixed(3));
