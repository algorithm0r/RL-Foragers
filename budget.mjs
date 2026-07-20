// Budget × representation 2×2: decompose the DQN's win into UPDATE BUDGET vs REPRESENTATION.
//   layered        tabular, 1 update/step         (low budget,  table)
//   layered-replay tabular + Dyna-Q replay K=32   (high budget, table)
//   dqn-1to1       DQN, 1 grad-sample/step        (low budget,  net)
//   dqn-32         DQN, 32 grad-samples/step       (high budget, net)
// Same env/reward/seeds/metric (steps-to-clear). The decisive setting is the 12×12 sparse arena where
// the two diverged; base-8 is the everyone-solves-it control. → `budget` collection.
//   node budget.mjs [--reps N] [--ticks N] [--collection budget] [--only substr]
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
const TICKS = parseInt(flag('ticks', '250000'), 10);
const SAMPLE = parseInt(flag('sample', '5000'), 10);
const COLL = flag('collection', 'budget');
const ONLY = flag('only', null);

const BASE = {
  enableShelter: false, enableWater: false, enablePits: false, strategicLayer: false, relevanceFilter: false,
  alpha: 0.1, gamma: 0.95, confidenceK: 30, rewardStep: -1, rewardGather: 1, defaultQ: 0,
  explore: 'egreedy', epsilon: 0.01,
  qReplay: false, qReplayK: 32, qReplayCap: 20000, qReplayWarmup: 1000,
  dqnField: 5, dqnHidden: 64, dqnAlpha: 0.0025, dqnBatch: 32, dqnReplay: 20000,
  dqnTargetSync: 1000, dqnTrainEvery: 1, dqnWarmup: 1000, dqnEpsStart: 1.0, dqnEpsEnd: 0.05, dqnEpsDecaySteps: 60000,
};

const SETTINGS = [
  { name: 'base-8-K1', N: 8, K: 1, nFood: 6 },
  { name: 'arena-12-K1', N: 12, K: 1, nFood: 12 },
];
let CONFIGS = [
  { name: 'layered', agent: 'layered', layers: [1, 3, 5], over: {} },
  { name: 'layered-replay', agent: 'layered', layers: [1, 3, 5], over: { qReplay: true, qReplayK: 32 } },
  { name: 'dqn-1to1', agent: 'dqn', over: { dqnTrainEvery: 32, dqnBatch: 32 } },
  { name: 'dqn-32', agent: 'dqn', over: { dqnTrainEvery: 1, dqnBatch: 32 } },
];
if (ONLY) CONFIGS = CONFIGS.filter((c) => c.name.includes(ONLY));

const SEED0 = 12345;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tdir(a, b, N) { const d = (b - a + N) % N; return d === 0 ? 0 : (d <= N - d ? 1 : -1); }
function greedyPolicy(w) {
  const K = P.nTypes || 1, here = w.cell(0, 0);
  if (here >= 1 && here <= K) return w.actions.indexOf(here === 1 ? 'eat' : here === 2 ? 'drink' : 'c' + here);
  const N = w.N; let best = Infinity, bx = 0, by = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = w.grid[y][x]; if (t < 1 || t > K) continue;
    const ddx = Math.min((x - w.ax + N) % N, (w.ax - x + N) % N), ddy = Math.min((y - w.ay + N) % N, (w.ay - y + N) % N);
    const d = Math.max(ddx, ddy); if (d < best) { best = d; bx = x; by = y; }
  }
  if (best === Infinity) return 0;
  const sx = tdir(w.ax, bx, N), sy = tdir(w.ay, by, N);
  for (let i = 0; i < 8; i++) if (World.DIRS[i][0] === sx && World.DIRS[i][1] === sy) return i;
  return 0;
}
function agentSize(w) { const A = w.agent; if (A.layers) return A.layers.reduce((s, L) => s + L.learner.numStates(), 0); if (A.numStates) return A.numStates(); return 0; }

function runOne(set, cfg, seed, policy) {
  Object.assign(P, BASE, {
    gridN: set.N, nTypes: set.K, nFood: set.nFood, maxStepsPerEpisode: set.N * set.N * 10,
    agent: cfg ? cfg.agent : 'layered', layers: cfg && cfg.layers ? cfg.layers : [1, 3, 5], receptiveField: 5,
  }, cfg ? cfg.over : {});
  Math.random = mulberry32(seed);
  const w = new World(800, 600), e = new GameEngine();
  if (policy) w.agent = { act: (world) => world.applyAction(policy(world)) };
  const curve = [];
  for (let t = 1; t <= TICKS; t++) {
    e.tick = t; w.update(e);
    if (t % SAMPLE === 0) curve.push({ tick: t, stc: +w.meanStepsToClear().toFixed(1), cleared: w.cleared });
  }
  return { final: +w.meanStepsToClear().toFixed(1), cleared: w.cleared, size: policy ? 0 : agentSize(w), curve };
}

async function main() {
  const db = createDB({ transport: 'direct', mongoUrl: P.db.mongoUrl, db: flag('db', 'rllayers') });
  const jobs = [];
  for (const set of SETTINGS) {
    for (const cfg of CONFIGS) for (let r = 0; r < REPS; r++) jobs.push({ set, cfg, rep: r, policy: null });
    for (let r = 0; r < Math.min(2, REPS); r++) jobs.push({ set, cfg: { name: 'oracle' }, rep: r, policy: greedyPolicy });
  }
  console.log('budget: ' + jobs.length + ' runs, ' + TICKS + ' ticks each → ' + COLL);
  let n = 0;
  for (const j of jobs) {
    const seed = SEED0 + j.rep, t0 = Date.now();
    const res = runOne(j.set, j.policy ? null : j.cfg, seed, j.policy);
    db.config.run = j.set.name + '-' + j.cfg.name + '-s' + j.rep;
    const pkt = db.packet(P, {
      experiment: 'budget', setting: j.set.name, N: j.set.N, config: j.cfg.name, rep: j.rep, seed,
      isReference: !!j.policy, final: res.final, cleared: res.cleared, size: res.size, curve: res.curve,
    });
    const ins = await db.insert(COLL, pkt);
    n++;
    console.log('  [' + n + '/' + jobs.length + '] ' + j.set.name + ' ' + j.cfg.name + ' s' + j.rep +
      ' → final=' + res.final + ' cleared=' + res.cleared + ' size=' + res.size.toLocaleString() +
      ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ok=' + ins.ok + ')');
  }
  console.log('done. ' + (await db.count(COLL, { experiment: 'budget' })).count + ' budget packets.');
  await db.close();
}
main().catch((e) => { console.error('budget failed:', e); process.exit(1); });
