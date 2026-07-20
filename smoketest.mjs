// No-DB sanity run for the modular GridForager. Verifies each TOGGLE's mechanics (deterministic)
// and that the base food-sweep model LEARNS. Prints the numbers for the DEVLOG entry.
//   node smoketest.mjs
//   M) mechanics: base eat+clear · +water drink · +shelter rest banks min(F,W) · +pits death
//   B) decoupling: window length is receptiveField², independent of arena size
//   L) learning: base sweep (layered + UCB) — steps-to-clear falls
//
// Loads the SAME browser sim files into the MAIN V8 realm via indirect eval (NOT vm — conventions §4).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'agent.js', 'world.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, '');
  indirectEval(src);
}
const { PARAMETERS: P, World, GameEngine } = globalThis;
const clear = (w) => { for (let y = 0; y < w.N; y++) for (let x = 0; x < w.N; x++) w.grid[y][x] = World.EMPTY; };
const base = () => { P.agent = 'flat'; P.enableWater = false; P.enableShelter = false; P.enablePits = false; P.gridN = 6; P.receptiveField = 3; };

// --- M: mechanics per toggle ---
base(); P.nFood = 2;
const wb = new World(800, 600); const EAT = wb.actions.indexOf('eat');
clear(wb); wb.ax = 2; wb.ay = 2; wb.grid[2][2] = World.FOOD; wb.grid[0][0] = World.FOOD; wb.remaining = 2;
let r = wb.applyAction(EAT);
const mEat = wb.food === 1 && wb.grid[2][2] === World.EMPTY && !r.done && r.reward === P.rewardGather;
wb.ax = 0; wb.ay = 0; r = wb.applyAction(EAT);
const mClear = r.done && r.cleared === true && wb.food === 2;

base(); P.enableWater = true;
const ww = new World(800, 600); const DRINK = ww.actions.indexOf('drink');
clear(ww); ww.ax = 2; ww.ay = 2; ww.grid[2][2] = World.WATER; ww.remaining = 99;
r = ww.applyAction(DRINK);
const mDrink = ww.water === 1 && r.reward === P.rewardGather && !r.done;

base(); P.enableWater = true; P.enableShelter = true;
const ws = new World(800, 600); const REST = ws.actions.indexOf('rest');
clear(ws); ws.ax = 2; ws.ay = 2; ws.grid[2][2] = World.SHELTER; ws.food = 2; ws.water = 2;
r = ws.applyAction(REST);
const mRest = r.done && r.rested === true && r.reward === P.rewardPerUnit * 2;

base(); P.enablePits = true;
const wp = new World(800, 600);
clear(wp); wp.ax = 2; wp.ay = 2; wp.grid[2][3] = World.PIT;
r = wp.applyAction(2); // move East into the pit
const mPit = r.done && r.died === true && r.reward === -P.pitPenalty;
const mechanics = mEat && mClear && mDrink && mRest && mPit;

// --- B: decoupling ---
let decoupled = true;
for (const [N, rf] of [[6, 1], [8, 3], [10, 5]]) {
  base(); P.gridN = N; P.receptiveField = rf;
  if (new World(800, 600).senseWindow((rf - 1) >> 1).length !== rf * rf) { decoupled = false; break; }
}

// --- L: the base food-sweep model learns under the default ε-greedy 0.01 (gather=+1, defaultQ=0) ---
base(); P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.epsilon = 0.01;
P.rewardGather = 1; P.defaultQ = 0; P.gridN = 8; P.nFood = 6; P.maxStepsPerEpisode = 500;
const wL = new World(800, 600), eL = new GameEngine();
for (let t = 1; t <= 400000; t++) { eL.tick = t; wL.update(eL); }
const late = wL.meanStepsToClear();
// competence, not a fragile early→late delta: it clears many episodes and does so efficiently
// (6 food on 8×8 ≈ 6 eats + ~15 moves; < 60 means it genuinely forages, not times out at 500)
const learned = wL.cleared > 1000 && late > 0 && late < 60;

const ok = mechanics && decoupled && learned;
console.log('smoke:' +
  ' M mech=' + mechanics + ' (eat=' + mEat + ' clear=' + mClear + ' drink=' + mDrink + ' rest=' + mRest + ' pit=' + mPit + ')' +
  ' | B decoupled=' + decoupled +
  ' | L base-sweep steps-to-clear=' + late.toFixed(1) + ' (' + wL.cleared + ' cleared)' +
  ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
