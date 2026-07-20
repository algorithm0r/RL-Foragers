// Scale sweep: does relevance filtering (U-Tree) degrade LESS than flat QLearner as the raw state
// count grows with arena size? layered-1357 / layered-13579, QLearner vs U-Tree, across N∈{10,14,20},
// food at density 0.1, maxSteps ∝ N². egreedy 0.01. Oracle anchor per size. → 'scale' collection.
//   node scale.mjs [--reps N] [--ticks N] [--sizes 10,14,20] [--collection scale]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ie = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'agent.js', 'world.js']) {
  ie(readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^\s*(['"])use strict\1;?/, ''));
}
const { PARAMETERS: P, World, GameEngine } = globalThis;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const REPS = parseInt(flag('reps', '3'), 10);
const TICKS = parseInt(flag('ticks', '300000'), 10);
const SAMPLE = parseInt(flag('sample', '5000'), 10);
const COLL = flag('collection', 'scale');
const SIZES = flag('sizes', '10,14,20').split(',').map(Number);
const DENSITY = 0.1;

const BASE = {
  agent: 'layered', enableWater: false, enableShelter: false, enablePits: false,
  alpha: 0.1, gamma: 0.95, confidenceK: 30, rewardStep: -1, rewardGather: 1, defaultQ: 0,
  explore: 'egreedy', epsilon: 0.01,
  utreeMinSamples: 200, utreeMinChild: 15, utreeSplitThreshold: 0.3, utreeCheckInterval: 150,
};
const CONFIGS = [
  { name: '1357-QL', layers: [1, 3, 5, 7], utree: false },
  { name: '1357-UT', layers: [1, 3, 5, 7], utree: true },
  { name: '13579-QL', layers: [1, 3, 5, 7, 9], utree: false },
  { name: '13579-UT', layers: [1, 3, 5, 7, 9], utree: true },
];

const SEED0 = 12345;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tdir(a, b, N) { const d = (b - a + N) % N; return d === 0 ? 0 : (d <= N - d ? 1 : -1); }
function greedyPolicy(w) {
  const EAT = w.actions.indexOf('eat');
  if (w.cell(0, 0) === World.FOOD) return EAT;
  const N = w.N; let best = Infinity, bx = 0, by = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (w.grid[y][x] !== World.FOOD) continue;
    const ddx = Math.min((x - w.ax + N) % N, (w.ax - x + N) % N), ddy = Math.min((y - w.ay + N) % N, (w.ay - y + N) % N);
    const d = Math.max(ddx, ddy); if (d < best) { best = d; bx = x; by = y; }
  }
  if (best === Infinity) return EAT;
  const sx = tdir(w.ax, bx, N), sy = tdir(w.ay, by, N);
  for (let i = 0; i < 8; i++) if (World.DIRS[i][0] === sx && World.DIRS[i][1] === sy) return i;
  return EAT;
}
function qStates(w) { return w.agent.layers ? w.agent.layers.reduce((s, L) => s + L.learner.numStates(), 0) : 0; }

function runOne(N, cfg, seed, policy) {
  const food = Math.max(1, Math.round(N * N * DENSITY)), maxSteps = N * N * 10;
  Object.assign(P, BASE, {
    gridN: N, nFood: food, maxStepsPerEpisode: maxSteps,
    layers: cfg ? cfg.layers : [1, 3, 5, 7], relevanceFilter: cfg ? cfg.utree : false,
  });
  Math.random = mulberry32(seed);
  const w = new World(800, 600), e = new GameEngine();
  if (policy) w.agent = { act: (world) => world.applyAction(policy(world)) };
  const curve = [];
  for (let t = 1; t <= TICKS; t++) {
    e.tick = t; w.update(e);
    if (t % SAMPLE === 0) curve.push({ tick: t, stc: +w.meanStepsToClear().toFixed(1), cleared: w.cleared });
  }
  return { food, maxSteps, final: +w.meanStepsToClear().toFixed(1), cleared: w.cleared, qStates: qStates(w), curve };
}

async function main() {
  const db = createDB({ transport: 'direct', mongoUrl: P.db.mongoUrl, db: flag('db', 'rllayers') });
  const jobs = [];
  for (const N of SIZES) {
    for (const cfg of CONFIGS) for (let r = 0; r < REPS; r++) jobs.push({ N, cfg, rep: r, policy: null });
    for (let r = 0; r < Math.min(2, REPS); r++) jobs.push({ N, cfg: { name: 'oracle' }, rep: r, policy: greedyPolicy });
  }
  console.log('scale: ' + jobs.length + ' runs, ' + TICKS + ' ticks each → ' + COLL);
  let n = 0;
  for (const j of jobs) {
    const seed = SEED0 + j.rep, t0 = Date.now();
    const res = runOne(j.N, j.policy ? null : j.cfg, seed, j.policy);
    db.config.run = 'N' + j.N + '-' + j.cfg.name + '-r' + j.rep;
    const pkt = db.packet(P, {
      experiment: 'scale', N: j.N, config: j.cfg.name, rep: j.rep, seed,
      food: res.food, maxSteps: res.maxSteps, isReference: !!j.policy,
      final: res.final, cleared: res.cleared, qStates: res.qStates, curve: res.curve,
    });
    const ins = await db.insert(COLL, pkt);
    n++;
    console.log('  [' + n + '/' + jobs.length + '] N=' + j.N + ' ' + j.cfg.name + ' r' + j.rep +
      ' → final=' + res.final + ' cleared=' + res.cleared + ' qStates=' + res.qStates.toLocaleString() +
      ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ok=' + ins.ok + ')');
  }
  console.log('done. ' + (await db.count(COLL, { experiment: 'scale' })).count + ' scale packets.');
  await db.close();
}
main().catch((e) => { console.error('scale failed:', e); process.exit(1); });
