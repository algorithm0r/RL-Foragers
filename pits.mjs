// Pits grid (Stage 3F): who learns to survive AND still clear? Agents × explorers × pit density,
// EPISODE-budgeted, with per-bin death curves and DEATH ATTRIBUTION (was the fatal move the ε
// random draw or the learned argmax?) → the noise-vs-policy decomposition. Pilot headlines this
// harness pins down: UCB catastrophic; greedy-init survives but stops clearing (0% clear with any
// pits); ε-greedy does both but pays a declining blood tax (24%→6% over 16k episodes at ε=0.01),
// with ε=0.005 matching 0.01's coverage at ~30% fewer deaths. → `pits` collection.
//   node pits.mjs [--reps N] [--episodes N] [--collection pits]
// Subsumption note: its act() is always ε-greedy, so its 'greedy' condition is realized as ε=0 and
// its UCB cell is SKIPPED (unimplemented — running ε-greedy there and calling it UCB would lie).
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
const EPISODES = parseInt(flag('episodes', '16000'), 10);
const COLL = flag('collection', 'pits');
const CAP = 12_000_000; // tick safety net (greedy-with-pits times out every episode → ~8M ticks)

const BASE = {
  enableShelter: false, enableWater: false, enableRocks: false, enablePits: false,
  strategicLayer: false, relevanceFilter: false, qReplay: false,
  alpha: 0.1, gamma: 0.95, confidenceK: 30, rewardStep: -1, rewardGather: 1, defaultQ: 0,
  ucbC: 1.0, pitPenalty: 50,
  gridN: 10, nTypes: 1, nFood: 10, maxStepsPerEpisode: 500,
};
const AGENTS = [
  { name: 'flat1', agent: 'flat', receptiveField: 1 },
  { name: 'flat3', agent: 'flat', receptiveField: 3 },
  { name: 'flat5', agent: 'flat', receptiveField: 5 },
  { name: 'layered', agent: 'layered', layers: [1, 3, 5], receptiveField: 5 },
  { name: 'subsumption', agent: 'subsumption', layers: [1, 3, 5], receptiveField: 5 },
];
const EXPLORERS = [
  { name: 'greedy', explore: 'greedy', epsilon: 0 },       // strategic-init only; subsumption: ε=0
  { name: 'eg005', explore: 'egreedy', epsilon: 0.005 },
  { name: 'eg01', explore: 'egreedy', epsilon: 0.01 },
  { name: 'ucb', explore: 'ucb', epsilon: 0 },
];
const PITS = [0, 3, 6];
const SEED0 = 12345;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function numStates(agent) {
  if (agent.layers) return agent.layers.reduce((s, L) => s + L.learner.numStates(), 0);
  return agent.learner ? agent.learner.numStates() : 0;
}

function runOne(cond, seed) {
  Object.assign(P, BASE, cond, { enablePits: cond.nPits > 0 });
  Math.random = mulberry32(seed);
  const w = new World(800, 600), e = new GameEngine();
  const out = []; // per-episode { died, randomDeath, cleared, steps }
  let lastEp = 0, lastDied = 0, lastCleared = 0, ticks = 0;
  while (out.length < EPISODES && ticks < CAP) {
    const prevSteps = w.steps;
    ticks++; e.tick = ticks; w.update(e);
    if (w.episodes > lastEp) {
      const died = w.died > lastDied;
      out.push({ died, randomDeath: died && w.agent.lastRandom === true, cleared: w.cleared > lastCleared, steps: prevSteps + 1 });
      lastEp = w.episodes; lastDied = w.died; lastCleared = w.cleared;
    }
  }
  const frac = (a, f) => a.filter(f).length / (a.length || 1);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const BIN = 1000, curve = [];
  for (let b = 0; b * BIN < out.length; b++) curve.push(+frac(out.slice(b * BIN, (b + 1) * BIN), (o) => o.died).toFixed(4));
  const tail = out.slice(-Math.floor(out.length / 4) || -1);
  const deaths = out.filter((o) => o.died);
  return {
    episodes: out.length, ticks,
    deathCurve: curve,
    death: +frac(tail, (o) => o.died).toFixed(4),
    clear: +frac(tail, (o) => o.cleared).toFixed(4),
    steps: mean(tail.filter((o) => o.cleared).map((o) => o.steps)),
    deaths: deaths.length,
    randomDeathFrac: deaths.length ? +frac(deaths, (o) => o.randomDeath).toFixed(4) : null,
    tailRandomDeathFrac: (() => { const d = tail.filter((o) => o.died); return d.length ? +frac(d, (o) => o.randomDeath).toFixed(4) : null; })(),
    qStates: numStates(w.agent),
  };
}

async function main() {
  const db = createDB({ transport: 'direct', mongoUrl: P.db.mongoUrl, db: flag('db', 'rllayers') });
  const jobs = [];
  for (const A of AGENTS) for (const E of EXPLORERS) {
    if (A.name === 'subsumption' && E.name === 'ucb') continue;
    for (const nPits of PITS) for (let rep = 0; rep < REPS; rep++) jobs.push({ A, E, nPits, rep });
  }
  console.log('pits: ' + jobs.length + ' runs, ' + EPISODES + ' episodes each → ' + COLL);
  let n = 0;
  for (const j of jobs) {
    const seed = SEED0 + j.rep, t0 = Date.now();
    const cond = Object.assign({}, j.A, j.E, { nPits: j.nPits });
    delete cond.name;
    const res = runOne(cond, seed);
    db.config.run = j.A.name + '-' + j.E.name + '-p' + j.nPits + '-s' + j.rep;
    const pkt = db.packet(P, Object.assign({
      experiment: 'pits', agentName: j.A.name, explorer: j.E.name, epsilon: j.E.epsilon,
      nPits: j.nPits, rep: j.rep, seed,
    }, res));
    const ins = await db.insert(COLL, pkt);
    n++;
    console.log('  [' + n + '/' + jobs.length + '] ' + db.config.run + ' → death=' + res.death +
      ' clear=' + res.clear + ' steps=' + (res.steps === null ? '--' : res.steps.toFixed(1)) +
      ' deaths=' + res.deaths + ' randFrac=' + res.randomDeathFrac +
      ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ok=' + ins.ok + ')');
  }
  console.log('done.');
  await db.close();
}
main().catch((e) => { console.error('pits failed:', e); process.exit(1); });
