// Replay-K sweet-spot sweep: how many Dyna-Q replays per real step buy how much, and where's the knee?
// Layered agent on the 12×12 sparse arena (where replay mattered) — steps-to-clear vs qReplayK, plus
// wall-clock so we can see the compute/benefit tradeoff. K=0 = no replay (the 137±49 baseline). → `replayk`.
//   node replayk.mjs [--reps N] [--ticks N] [--ks 0,4,8,16,32,64]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ie = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'dqn.js', 'agent.js', 'world.js']) {
  ie(readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^\s*(['"])use strict\1;?/, ''));
}
const { PARAMETERS: P, World, GameEngine } = globalThis;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const REPS = parseInt(flag('reps', '3'), 10);
const TICKS = parseInt(flag('ticks', '200000'), 10);
const COLL = flag('collection', 'replayk');
const KS = flag('ks', '0,4,8,16,32,64').split(',').map(Number);

const BASE = {
  enableShelter: false, enableWater: false, enablePits: false, strategicLayer: false, relevanceFilter: false,
  agent: 'layered', layers: [1, 3, 5], receptiveField: 5,
  alpha: 0.1, gamma: 0.95, confidenceK: 30, rewardStep: -1, rewardGather: 1, defaultQ: 0,
  explore: 'egreedy', epsilon: 0.01, qReplayCap: 20000, qReplayWarmup: 1000,
  gridN: 12, nTypes: 1, nFood: 12, maxStepsPerEpisode: 1440,
};
const SEED0 = 12345;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function runOne(K, seed) {
  Object.assign(P, BASE, { qReplay: K > 0, qReplayK: K });
  Math.random = mulberry32(seed);
  const w = new World(800, 600), e = new GameEngine();
  for (let t = 1; t <= TICKS; t++) { e.tick = t; w.update(e); }
  return { final: +w.meanStepsToClear().toFixed(1), cleared: w.cleared, size: w.agent.layers.reduce((s, L) => s + L.learner.numStates(), 0) };
}

async function main() {
  const db = createDB({ transport: 'direct', mongoUrl: P.db.mongoUrl, db: flag('db', 'rllayers') });
  const jobs = [];
  for (const K of KS) for (let r = 0; r < REPS; r++) jobs.push({ K, rep: r });
  console.log('replayk: ' + jobs.length + ' runs, ' + TICKS + ' ticks each → ' + COLL);
  let n = 0;
  for (const j of jobs) {
    const seed = SEED0 + j.rep, t0 = Date.now();
    const res = runOne(j.K, seed);
    db.config.run = 'K' + j.K + '-s' + j.rep;
    const pkt = db.packet(P, { experiment: 'replayk', replayK: j.K, rep: j.rep, seed, final: res.final, cleared: res.cleared, size: res.size });
    const ins = await db.insert(COLL, pkt);
    n++;
    console.log('  [' + n + '/' + jobs.length + '] K=' + j.K + ' s' + j.rep + ' → final=' + res.final +
      ' cleared=' + res.cleared + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ok=' + ins.ok + ')');
  }
  console.log('done.');
  await db.close();
}
main().catch((e) => { console.error('replayk failed:', e); process.exit(1); });
