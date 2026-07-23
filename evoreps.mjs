// Stage 6 v1b.7 — one REPLICATE of an evo test: run a named condition under a given seed, write a
// self-describing packet to the `evoreps` MongoDB collection. Aggregated across seeds by evoreps-agg.mjs
// to turn the one-seed evo findings into mean±std claims with directional-consistency counts.
//   node evoreps.mjs <condition> <seed>
// conditions: food · hunt-scarce-on · hunt-scarce-off · hunt-dense-on · hunt-dense-off · shelter · full · full-pits
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'dqn.js', 'agent.js', 'world.js', 'evolution.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, '');
  indirectEval(src);
}
const P = globalThis.PARAMETERS;
const { World, evolve, greedyEval, Genome } = globalThis;

const condition = process.argv[2] || 'food';
const seed = parseInt(process.argv[3] || '20260722', 10);
Math.random = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(seed);

// shared evo config (no-INT, replay off); conditions override the world + food + instinct switch.
function base() {
  P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.strategicLayer = false; P.relevanceFilter = false; P.qReplay = false;
  P.enableWater = false; P.enableShelter = false; P.enableGoats = false; P.enablePits = false; P.enableRocks = false;
  P.shelterActivate = 'cleared'; P.maxStepsPerEpisode = 1e9; P.restStickC = 0;
  P.nGoats = 6; P.goatStationary = true; P.goatsCountToClear = false; P.goatHuntOneAction = false; P.goatExplodeRadius = 0; P.goatEatRespawn = true;
  P.nTypes = 1; P.gridN = 20; P.nFood = 40;
  P.evoPopSize = 16; P.evoGenerations = 25; P.evoRuns = 4; P.evoBatchSize = 8; P.evoProtect = 2; P.evoLifetime = 400;
  P.evoShelterFrac = 0.25; P.evoShelterGrid = 3; P.evoCull = 0.5; P.evoMutRate = 0.5; P.evoUseInstincts = true;
  P.defaultQ = 0; Genome.VGENES.initialQ.init = [-0.3, 0.3];   // neutral baseline (reset; pessimist conditions override)
}
// pessimistic baseline: untried actions start clearly BAD (initialQ init −2..−1, defaultQ −2), so a forager
// won't try attacking unless evolution actively RAISES initialQ[attack] above the (pessimistic) baseline of
// the other actions. Breaks the degeneracy where 0 was both the gene's init and the reward-neutral optimum
// (Chris, 2026-07-23): the discriminating test of whether the instinct gene is SELECTABLE vs merely undriven.
function pessimist() { P.defaultQ = -2; Genome.VGENES.initialQ.init = [-2, -1]; }
const CONDITIONS = {
  'food':            () => { base(); P.gridN = 30; P.nFood = 60; },                                                        // food-only: loop + felt-step softening
  'hunt-scarce-on':  () => { base(); P.gridN = 30; P.enableGoats = true; P.nFood = 15; P.evoUseInstincts = true; },        // hunt sweep
  'hunt-scarce-off': () => { base(); P.gridN = 30; P.enableGoats = true; P.nFood = 15; P.evoUseInstincts = false; },
  'hunt-dense-on':   () => { base(); P.gridN = 30; P.enableGoats = true; P.nFood = 80; P.evoUseInstincts = true; },
  'hunt-dense-off':  () => { base(); P.gridN = 30; P.enableGoats = true; P.nFood = 80; P.evoUseInstincts = false; },
  'shelter':         () => { base(); P.enableShelter = true; P.gridN = 20; P.nFood = 40; },                                // no-INT multi-shelter banking
  'full':            () => { base(); P.enableShelter = true; P.enableGoats = true; P.gridN = 20; P.nFood = 20; },          // combined world
  'full-pits':       () => { base(); P.enableShelter = true; P.enableGoats = true; P.enablePits = true; P.nPits = 3; P.gridN = 20; P.nFood = 20; }, // + pits (knife-edge)
  // pessimistic-baseline hunt: is the attack instinct SELECTABLE when a positive prior is the ONLY route to hunting?
  'hunt-pess-on':    () => { base(); P.gridN = 30; P.enableGoats = true; P.nFood = 15; P.evoUseInstincts = true;  pessimist(); },
  'hunt-pess-off':   () => { base(); P.gridN = 30; P.enableGoats = true; P.nFood = 15; P.evoUseInstincts = false; pessimist(); },
};
if (!CONDITIONS[condition]) { console.error('unknown condition "' + condition + '"; known: ' + Object.keys(CONDITIONS).join(', ')); process.exit(2); }
CONDITIONS[condition]();

const { history, pop } = evolve(P.evoGenerations, P.evoPopSize);
const ev = greedyEval(pop, 6);
const G = history.length, q = Math.max(1, Math.floor(G / 4));
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const meanFitFirst = avg(history.slice(0, q).map((h) => h.mean)), meanFitLast = avg(history.slice(G - q).map((h) => h.mean));
const gN = history[G - 1].genes;
const ATT = World.buildActions().indexOf('attack');
const attackInitialQ = ATT >= 0 ? pop.reduce((s, A) => s + A.genome.initialQ[ATT], 0) / pop.length : null;
// baseline = population-mean initialQ over ALL actions → attackInitialQ − meanInitialQ isolates attack-SPECIFIC
// selection (did evolution lift attack ABOVE the general baseline, not just shift every action together)
const meanInitialQ = pop.reduce((s, A) => s + A.genome.initialQ.reduce((x, y) => x + y, 0) / A.genome.initialQ.length, 0) / pop.length;

const db = createDB(Object.assign({}, P.db, { transport: 'direct', db: P.db.db }));
db.config.run = 'evoreps';
const pkt = db.packet(P, {
  condition, seed,
  meanFitFirst, meanFitLast, meanFitRise: meanFitLast - meanFitFirst, meanAgeLast: gN ? history[G - 1].meanAge : 0,
  genes: gN, attackInitialQ, meanInitialQ, defaultQ: P.defaultQ,
  greedyBanked: ev.foodPerRun, greedyKills: ev.killsPerRun, greedyDeaths: ev.deathsPerRun,
});
const res = await db.insert('evoreps', pkt);
console.log(condition.padEnd(16) + ' seed=' + seed + ' | fit ' + meanFitFirst.toFixed(1) + '→' + meanFitLast.toFixed(1) +
  ' | attack iQ ' + (attackInitialQ === null ? ' — ' : attackInitialQ.toFixed(2)) +
  ' | greedy banked ' + ev.foodPerRun.toFixed(1) + ' kills ' + ev.killsPerRun.toFixed(1) + ' deaths ' + ev.deathsPerRun.toFixed(1) +
  ' | saved ' + JSON.stringify(res));
await db.close();
