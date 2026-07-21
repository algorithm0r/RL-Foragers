// Goats experiment #1 (Stage 5a): hunt vs forage. The forager (layered, no INT, egreedy .01) in a
// clearedOrTime shelter world now shares it with goat AGENTS (shared species brain) that eat its
// food, drink its water, and die to its new ATTACK action. Arms: nGoats {0,3,6} × pits {0,3}.
// Questions: (a) what do competitors cost, and does hunting pay it back? (b) does hunting emerge
// (kills/ep rising as the forager learns)? (c) do the goats learn — pit deaths falling, kills/ep
// falling (harder prey), forage rate rising? → `goats` collection, per-quarter curves in packets.
//   node goats.mjs [--reps N] [--episodes N] [--collection goats]
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
const COLL = flag('collection', 'goats');

const BASE = {
  enableShelter: true, enableWater: true, enableRocks: false, relevanceFilter: false, qReplay: false,
  agent: 'layered', layers: [1, 3, 5], receptiveField: 5, strategicLayer: false, // no INT (Chris)
  alpha: 0.1, gamma: 0.95, confidenceK: 30, rewardStep: -1, rewardGather: 1, defaultQ: 0,
  rewardPerUnit: 50, collapsePenalty: 50, restStickC: 0, pitPenalty: 50, timeBuckets: 4,
  explore: 'egreedy', epsilon: 0.01, ucbC: 1.0,
  gridN: 10, nTypes: 1, nFood: 6, nWater: 4, maxStepsPerEpisode: 100,
  shelterActivate: 'clearedOrTime', shelterActivateTime: 60,
  goatLayers: [1, 3], goatEpsilon: 0.05,
};
const SEED0 = 12345;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function runOne(nGoats, nPits, seed) {
  Object.assign(P, BASE, { enableGoats: nGoats > 0, nGoats, enablePits: nPits > 0, nPits });
  Math.random = mulberry32(seed);
  const w = new World(800, 600), e = new GameEngine();
  const out = []; // per-episode { died, collapsed, rested, banked, kills, eaten, gPits }
  let last = { ep: 0, died: 0, col: 0, rest: 0, kill: 0, eat: 0, gp: 0 };
  let ticks = 0;
  while (out.length < EPISODES && ticks < 20_000_000) {
    const prevStock = w.bankedStock();
    ticks++; e.tick = ticks; w.update(e);
    if (w.episodes > last.ep) {
      const rested = w.rested > last.rest;
      out.push({
        died: w.died > last.died, collapsed: w.collapsed > last.col, rested,
        banked: rested ? prevStock : 0,
        kills: w.goatsKilled - last.kill, eaten: w.goatEaten - last.eat, gPits: w.goatPitDeaths - last.gp,
      });
      last = { ep: w.episodes, died: w.died, col: w.collapsed, rest: w.rested, kill: w.goatsKilled, eat: w.goatEaten, gp: w.goatPitDeaths };
    }
  }
  const frac = (a, fn) => a.filter(fn).length / (a.length || 1);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const q = Math.floor(out.length / 4) || 1;
  const quarters = (sel) => [0, 1, 2, 3].map((i) => +mean(out.slice(i * q, (i + 1) * q).map(sel)).toFixed(3));
  const tail = out.slice(-q);
  return {
    episodes: out.length, ticks,
    death: +frac(tail, (o) => o.died).toFixed(4), collapse: +frac(tail, (o) => o.collapsed).toFixed(4),
    rest: +frac(tail, (o) => o.rested).toFixed(4), harvest: +mean(tail.map((o) => o.banked)).toFixed(3),
    killsQ: quarters((o) => o.kills), eatenQ: quarters((o) => o.eaten), goatPitsQ: quarters((o) => o.gPits),
    harvestQ: quarters((o) => o.banked),
  };
}

async function main() {
  const db = createDB({ transport: 'direct', mongoUrl: P.db.mongoUrl, db: flag('db', 'rllayers') });
  const jobs = [];
  for (const nGoats of [0, 3, 6]) for (const nPits of [0, 3]) for (let rep = 0; rep < REPS; rep++) jobs.push({ nGoats, nPits, rep });
  console.log('goats: ' + jobs.length + ' runs, ' + EPISODES + ' episodes each → ' + COLL);
  let n = 0;
  for (const j of jobs) {
    const seed = SEED0 + j.rep, t0 = Date.now();
    const res = runOne(j.nGoats, j.nPits, seed);
    db.config.run = 'g' + j.nGoats + '-p' + j.nPits + '-s' + j.rep;
    const pkt = db.packet(P, Object.assign({ experiment: 'goats', nGoats: j.nGoats, nPits: j.nPits, rep: j.rep, seed }, res));
    const ins = await db.insert(COLL, pkt);
    n++;
    console.log('  [' + n + '/' + jobs.length + '] ' + db.config.run + ' → harvest=' + res.harvest +
      ' collapse=' + res.collapse + ' death=' + res.death +
      ' kills/ep=' + res.killsQ.join('→') + ' eaten/ep=' + res.eatenQ.join('→') +
      ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's, ok=' + ins.ok + ')');
  }
  console.log('done.');
  await db.close();
}
main().catch((e) => { console.error('goats failed:', e); process.exit(1); });
