// Stage 6 v1b.7 — aggregate the `evoreps` replicates: per-condition mean±std, plus directional
// consistency for the headline findings (attack-instinct tracks scarcity; felt-step softening; pit
// knife-edge). Turns the one-seed evo results into claims with error bars.
//   node evoreps-agg.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
indirectEval(readFileSync(path.join(__dirname, 'src', 'params.js'), 'utf8').replace(/^\s*(['"])use strict\1;?/, ''));
const P = globalThis.PARAMETERS;

const db = createDB(Object.assign({}, P.db, { transport: 'direct', db: P.db.db }));
const { results } = await db.find('evoreps', {}, {});
await db.close();
if (!results || !results.length) { console.log('no evoreps docs found — run evoreps-run.sh first'); process.exit(1); }

// dedup by (condition, seed) — last write wins — so re-runs / test inserts don't double-count
const uniq = {}; for (const r of results) uniq[r.condition + '/' + r.seed] = r;
const docs = Object.values(uniq);
const byCond = {};
for (const r of docs) (byCond[r.condition] = byCond[r.condition] || []).push(r);
const stat = (arr) => { const n = arr.length, m = arr.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / n); return { m, sd, n }; };
const fmt = (s) => (s.m >= 0 ? ' ' : '') + s.m.toFixed(2) + '±' + s.sd.toFixed(2);
const col = (v, w) => String(v).padEnd(w);

const order = ['food', 'hunt-scarce-on', 'hunt-scarce-off', 'hunt-dense-on', 'hunt-dense-off', 'shelter', 'full', 'full-pits'];
console.log('\nEVOREPS — ' + docs.length + ' replicates (deduped by condition+seed)\n');
console.log(col('condition', 17) + col('n', 3) + col('fitRise', 14) + col('greedyBanked', 16) + col('kills', 13) + col('deaths', 12) + col('attackIQ', 13) + 'rStep');
for (const c of order) {
  const rs = byCond[c]; if (!rs) continue;
  const aiq = rs[0].attackInitialQ !== null && rs[0].attackInitialQ !== undefined ? fmt(stat(rs.map((r) => r.attackInitialQ))) : '   —   ';
  console.log(col(c, 17) + col(rs.length, 3) +
    col(fmt(stat(rs.map((r) => r.meanFitRise))), 14) + col(fmt(stat(rs.map((r) => r.greedyBanked))), 16) +
    col(fmt(stat(rs.map((r) => r.greedyKills))), 13) + col(fmt(stat(rs.map((r) => r.greedyDeaths))), 12) +
    col(aiq, 13) + fmt(stat(rs.map((r) => r.genes.rewardStep))));
}

// --- directional findings ---
console.log('\n--- directional consistency ---');
// 1) attack instinct tracks scarcity: per matched seed, scarce iQ > dense iQ
if (byCond['hunt-scarce-on'] && byCond['hunt-dense-on']) {
  const sc = {}; for (const r of byCond['hunt-scarce-on']) sc[r.seed] = r.attackInitialQ;
  let agree = 0, tot = 0;
  for (const r of byCond['hunt-dense-on']) if (r.seed in sc) { tot++; if (sc[r.seed] > r.attackInitialQ) agree++; }
  console.log('attack instinct tracks scarcity (scarce iQ > dense iQ): ' + agree + '/' + tot + ' seeds' +
    '   [scarce ' + fmt(stat(byCond['hunt-scarce-on'].map((r) => r.attackInitialQ))) +
    ', dense ' + fmt(stat(byCond['hunt-dense-on'].map((r) => r.attackInitialQ))) + ']');
  let scPos = byCond['hunt-scarce-on'].filter((r) => r.attackInitialQ > 0).length;
  console.log('  scarce attack instinct POSITIVE: ' + scPos + '/' + byCond['hunt-scarce-on'].length + ' seeds');
}
// 2) felt-step softening (food): evolved rStep vs init midpoint ~ -0.85
if (byCond['food']) {
  const rs = stat(byCond['food'].map((r) => r.genes.rewardStep));
  const soft = byCond['food'].filter((r) => r.genes.rewardStep > -0.85).length;
  console.log('felt-step softening (food): evolved rStep ' + fmt(rs) + ' — softer than init ~-0.85 in ' + soft + '/' + byCond['food'].length + ' seeds');
}
// 3) loop works everywhere: fitRise > 0
console.log('loop raises fitness (fitRise > 0): ' + order.filter((c) => byCond[c]).map((c) => c + ' ' + byCond[c].filter((r) => r.meanFitRise > 0).length + '/' + byCond[c].length).join('  '));
// 4) pit knife-edge
if (byCond['full'] && byCond['full-pits']) {
  console.log('pit knife-edge: full fitRise ' + fmt(stat(byCond['full'].map((r) => r.meanFitRise))) +
    ' vs full-pits ' + fmt(stat(byCond['full-pits'].map((r) => r.meanFitRise))) +
    ' (full-pits deaths ' + fmt(stat(byCond['full-pits'].map((r) => r.greedyDeaths))) + ')');
}
