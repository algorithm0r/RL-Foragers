// Stage-3 prelim: layered vs flat vs reference foragers on the base food-sweep model. Loads the
// SAME sim core (main-realm indirect eval, not vm) and writes one self-describing packet per run to
// MongoDB (direct → local mongo), collection 'prelim' by default. Reproducible via a seeded RNG.
//   node experiment.mjs [--reps N] [--ticks N] [--sample N] [--collection NAME] [--db NAME] [--only substr]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'agent.js', 'world.js']) {
  indirectEval(readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^\s*(['"])use strict\1;?/, ''));
}
const { PARAMETERS: P, World, GameEngine } = globalThis;

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const REPS = parseInt(flag('reps', '3'), 10);
const TICKS = parseInt(flag('ticks', '250000'), 10);
const SAMPLE = parseInt(flag('sample', '2500'), 10);
const COLL = flag('collection', 'prelim');
const ONLY = flag('only', null); // run only conditions whose name contains this substring

// base food-sweep model — everything fixed except the architecture axis
const BASE = {
  agent: 'layered', layers: [1, 3, 5], enableWater: false, enableShelter: false, enablePits: false,
  gridN: 10, nFood: 10, maxStepsPerEpisode: 1200, alpha: 0.1, gamma: 0.95, confidenceK: 30,
  rewardStep: -1, rewardGather: 1, defaultQ: 0, explore: 'greedy', ucbC: 1, epsilon: 0.1,
};
const CONDITIONS = [
  { name: 'flat-w1', over: { agent: 'flat', receptiveField: 1 } },
  { name: 'flat-w3', over: { agent: 'flat', receptiveField: 3 } },
  { name: 'flat-w5', over: { agent: 'flat', receptiveField: 5 } },
  { name: 'layered-13', over: { agent: 'layered', layers: [1, 3] } },
  { name: 'layered-135', over: { agent: 'layered', layers: [1, 3, 5] } },
];
const REFERENCES = [
  { name: 'oracle-greedy', policy: greedyPolicy },
  { name: 'random', policy: () => 0 /* replaced below */ },
];

const SEED0 = 12345;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tdir(a, b, N) { const d = (b - a + N) % N; return d === 0 ? 0 : (d <= N - d ? 1 : -1); }

// full-vision greedy forager: eat if on food, else king-step toward the nearest food (torus Chebyshev)
function greedyPolicy(w) {
  const EAT = w.actions.indexOf('eat');
  if (w.cell(0, 0) === World.FOOD) return EAT;
  const N = w.N; let best = Infinity, bx = 0, by = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (w.grid[y][x] !== World.FOOD) continue;
    const ddx = Math.min((x - w.ax + N) % N, (w.ax - x + N) % N), ddy = Math.min((y - w.ay + N) % N, (w.ay - y + N) % N);
    const d = Math.max(ddx, ddy);
    if (d < best) { best = d; bx = x; by = y; }
  }
  if (best === Infinity) return EAT;
  const sx = tdir(w.ax, bx, N), sy = tdir(w.ay, by, N);
  for (let i = 0; i < 8; i++) if (World.DIRS[i][0] === sx && World.DIRS[i][1] === sy) return i;
  return EAT;
}
function randomPolicy(w) { return Math.floor(Math.random() * w.actions.length); }

function qStates(w) {
  const A = w.agent;
  if (A.layers) return A.layers.reduce((s, L) => s + L.learner.Q.size, 0);
  if (A.learner) return A.learner.Q.size;
  return 0;
}

// run one config for `ticks`, sampling the steps-to-clear curve. `policy` (if given) overrides the
// agent with a fixed forager (reference conditions).
function runOne(over, seed, policy) {
  Object.assign(P, BASE, over);
  Math.random = mulberry32(seed);
  const w = new World(800, 600), e = new GameEngine();
  if (policy) w.agent = { act: (world) => world.applyAction(policy(world)) };
  const curve = [];
  for (let t = 1; t <= TICKS; t++) {
    e.tick = t; w.update(e);
    if (t % SAMPLE === 0) curve.push({ tick: t, stc: +w.meanStepsToClear().toFixed(2), cleared: w.cleared });
  }
  return { curve, final: +w.meanStepsToClear().toFixed(2), cleared: w.cleared, qStates: qStates(w) };
}

async function main() {
  const db = createDB({ transport: 'direct', mongoUrl: P.db.mongoUrl, db: flag('db', 'rllayers') });
  const jobs = [];
  for (const c of CONDITIONS) for (let r = 0; r < REPS; r++) jobs.push({ name: c.name, over: c.over, rep: r, policy: null });
  for (const ref of REFERENCES) for (let r = 0; r < Math.min(2, REPS); r++) {
    jobs.push({ name: ref.name, over: {}, rep: r, policy: ref.name === 'random' ? randomPolicy : ref.policy });
  }
  const runnable = ONLY ? jobs.filter((j) => j.name.includes(ONLY)) : jobs;
  console.log('stage3-prelim: ' + runnable.length + ' runs, ' + TICKS + ' ticks each, → ' + COLL);
  let n = 0;
  for (const j of runnable) {
    const seed = SEED0 + j.rep;
    const t0 = Date.now();
    const res = runOne(j.over, seed, j.policy);
    db.config.run = j.name + '-r' + j.rep;
    const pkt = db.packet(P, {
      experiment: 'stage3-prelim', condition: j.name, rep: j.rep, seed,
      isReference: !!j.policy, ticks: TICKS,
      final: res.final, cleared: res.cleared, qStates: res.qStates, curve: res.curve,
    });
    const ins = await db.insert(COLL, pkt);
    n++;
    console.log('  [' + n + '/' + runnable.length + '] ' + j.name + ' r' + j.rep +
      ' → final=' + res.final + ' cleared=' + res.cleared + ' qStates=' + res.qStates.toLocaleString() +
      ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ok=' + ins.ok + ')');
  }
  const total = await db.count(COLL, { experiment: 'stage3-prelim' });
  console.log('done. ' + COLL + ' now holds ' + total.count + ' stage3-prelim packets.');
  await db.close();
}
main().catch((e) => { console.error('experiment failed:', e); process.exit(1); });
