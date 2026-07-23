// Stage 7 proof: does the natural-selection ecology self-sustain? Seed a random founding population,
// run continuous time, and watch whether the population PERSISTS (neither crashes to 0 nor pins the cap)
// while the genes shift under endogenous selection (esp. rewardReproduce). No GA, no fitness function.
//   node ecosmoke.mjs [seed]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'dqn.js', 'agent.js', 'world.js', 'evolution.js', 'ecology.js']) {
  indirectEval(readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^\s*(['"])use strict\1;?/, ''));
}
const { PARAMETERS: P, runEcology } = globalThis;
const seed = parseInt(process.argv[2] || '20260722', 10);
Math.random = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(seed);

P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.strategicLayer = false; P.relevanceFilter = false; P.qReplay = false;
P.enableShelter = false; P.enableGoats = false; P.enablePits = false; P.enableWater = false; P.enableRocks = false;
P.gridN = 30; P.evoMutRate = 0.5; P.evoUseInstincts = true;
// food FLOW (ecoFoodPerTick) → emergent carrying capacity ≈ 8·12/0.5 ≈ 190, well under the cap.
P.ecoMaxPop = 400;

const H = runEcology(8000, 500);
console.log('seed=' + seed + '  grid=' + P.gridN + '  food=' + Math.floor(P.ecoFoodDensity * P.gridN * P.gridN) + '  T=' + P.ecoReproThreshold + '  foodVal=' + P.ecoFoodValue + '  metab=' + P.ecoMetabolism);
console.log('time    pop  meanE  meanAge | rRepro rGather  eps');
for (const s of H) {
  console.log(String(s.time).padStart(5) + '  ' + String(s.pop).padStart(4) + '  ' + s.meanEnergy.toFixed(0).padStart(5) + '  ' + s.meanAge.toFixed(0).padStart(6) +
    '  | ' + s.genes.rewardReproduce.toFixed(2).padStart(5) + '  ' + s.genes.rewardGather.toFixed(2).padStart(5) + '  ' + s.genes.epsilon.toFixed(3));
}
const last = H[H.length - 1], persisted = last.pop > 0 && last.pop < P.ecoMaxPop;
console.log('\neco: ' + (last.pop === 0 ? 'EXTINCT at t=' + last.time : 'pop=' + last.pop + ' @ t=' + last.time + ' (births=' + last.births + ' starved=' + last.starved + ' hazard=' + last.hazard + ')') +
  ' -> ' + (persisted ? 'PERSISTS' : 'FAIL (crash or cap)'));
process.exit(persisted ? 0 : 1);
