// Summarize the stage3-prelim collection: mean±sd of final steps-to-clear, mean cleared, and the
// "learned" rate (fraction of seeds that cleared > threshold), grouped by exploration × condition.
//   node analyze.mjs [--collection prelim] [--db rllayers] [--learned 100]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient } = require('mongodb');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const COLL = flag('collection', 'prelim');
const DB = flag('db', 'rllayers');
const LEARNED = parseInt(flag('learned', '100'), 10);

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

const c = new MongoClient('mongodb://127.0.0.1:27017');
await c.connect();
const docs = await c.db(DB).collection(COLL).find({ experiment: 'stage3-prelim' }, { projection: { curve: 0 } }).toArray();
await c.close();

const groups = new Map();
for (const d of docs) {
  const key = (d.explore || '?') + ' / ' + d.condition + (d.filter === 'utree' ? ' [utree]' : '');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(d);
}
console.log(COLL + ': ' + docs.length + ' packets  (learned = cleared > ' + LEARNED + ')\n');
console.log('explore / condition        n   final steps-to-clear      mean cleared   learned');
console.log('-'.repeat(78));
const order = ['reference', 'greedy', 'ucb', 'egreedy'];
const keys = [...groups.keys()].sort((a, b) => {
  const ea = order.indexOf(a.split(' / ')[0]), eb = order.indexOf(b.split(' / ')[0]);
  return ea - eb || a.localeCompare(b);
});
for (const k of keys) {
  const g = groups.get(k);
  const finals = g.map((d) => d.final), cleared = g.map((d) => d.cleared);
  const learnedN = g.filter((d) => d.cleared > LEARNED).length;
  console.log(k.padEnd(26) + ' ' + String(g.length).padStart(2) + '   ' +
    (mean(finals).toFixed(1) + ' ± ' + sd(finals).toFixed(1)).padEnd(22) + '  ' +
    Math.round(mean(cleared)).toString().padStart(8) + '     ' + learnedN + '/' + g.length);
}
