// No-DB sanity run for the modular GridForager. Verifies each TOGGLE's mechanics (deterministic)
// and that the base food-sweep model LEARNS. Prints the numbers for the DEVLOG entry.
//   node smoketest.mjs
//   M) mechanics: base eat+clear · +water drink · +shelter rest banks min(F,W) · +pits death ·
//                 +rocks block · shelter day-end COLLAPSE (−M) · time-of-day signal buckets the day
//   B) decoupling: window length is receptiveField², independent of arena size
//   L) learning: base sweep (layered + ε-greedy) — steps-to-clear falls
//   S) shelter: with the collapse penalty + time signal, the agent learns to forage-then-rest
//
// Loads the SAME browser sim files into the MAIN V8 realm via indirect eval (NOT vm — conventions §4).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indirectEval = eval;
for (const f of ['util.js', 'params.js', 'engine.js', 'qlearner.js', 'utree.js', 'dqn.js', 'agent.js', 'world.js']) {
  let src = readFileSync(path.join(__dirname, 'src', f), 'utf8');
  src = src.replace(/^\s*(['"])use strict\1;?/, '');
  indirectEval(src);
}
const { PARAMETERS: P, World, GameEngine } = globalThis;
const clear = (w) => { for (let y = 0; y < w.N; y++) for (let x = 0; x < w.N; x++) w.grid[y][x] = World.EMPTY; };
const base = () => { P.agent = 'flat'; P.enableWater = false; P.enableShelter = false; P.enablePits = false; P.enableRocks = false; P.enableGoats = false; P.gridN = 6; P.receptiveField = 3; P.qReplay = false; P.restStickC = 0; }; // replay/stick off → fast, focused; validated separately

// --- M: mechanics per toggle ---
base(); P.nFood = 2;
const wb = new World(800, 600); const EAT = wb.actions.indexOf('eat');
clear(wb); wb.ax = 2; wb.ay = 2; wb.grid[2][2] = World.FOOD; wb.grid[0][0] = World.FOOD; wb.remaining = 2;
let r = wb.applyAction(EAT);
const mEat = wb.food === 1 && wb.grid[2][2] === World.EMPTY && !r.done && r.reward === P.rewardGather;
wb.ax = 0; wb.ay = 0; r = wb.applyAction(EAT);
const mClear = r.done && r.cleared === true && wb.food === 2;

base(); P.nTypes = 2; // sweep with a 2nd resource type → 'drink' collects type 2 (water)
const ww = new World(800, 600); const DRINK = ww.actions.indexOf('drink');
clear(ww); ww.ax = 2; ww.ay = 2; ww.grid[2][2] = World.WATER; ww.remaining = 99;
r = ww.applyAction(DRINK);
const mDrink = ww.water === 1 && r.reward === P.rewardGather && !r.done;

base(); P.enableWater = true; P.enableShelter = true;
const ws = new World(800, 600); const REST = ws.actions.indexOf('rest');
clear(ws); ws.ax = 2; ws.ay = 2; ws.grid[2][2] = World.SHELTER; ws.food = 2; ws.water = 2; ws.remaining = 0; // field cleared
r = ws.applyAction(REST);
const mRest = r.done && r.rested === true && r.reward === P.rewardPerUnit * 16; // stock=4, remaining=0 → perUnit·4² − 0
// the stick: resting with resources still uncollected loses restStickC each (set it explicitly — default is 0)
P.restStickC = 15;
const ws2 = new World(800, 600); clear(ws2); ws2.ax = 2; ws2.ay = 2; ws2.grid[2][2] = World.SHELTER; ws2.food = 2; ws2.water = 2; ws2.remaining = 3;
const r2 = ws2.applyAction(ws2.actions.indexOf('rest'));
const mStick = r2.reward === P.rewardPerUnit * 16 - 15 * 3;
P.restStickC = 0;

base(); P.enablePits = true;
const wp = new World(800, 600);
clear(wp); wp.ax = 2; wp.ay = 2; wp.grid[2][3] = World.PIT;
r = wp.applyAction(2); // move East into the pit
const mPit = r.done && r.died === true && r.reward === -P.pitPenalty;

base(); P.enableRocks = true;
const wr = new World(800, 600);
clear(wr); wr.ax = 2; wr.ay = 2; wr.grid[2][3] = World.ROCK;
r = wr.applyAction(2); // move East into the rock: blocked — stay put, pay the step
const mRock = !r.done && r.reward === P.rewardStep && wr.ax === 2 && wr.ay === 2;

base(); P.enableShelter = true; P.maxStepsPerEpisode = 5; P.collapsePenalty = 50;
const wc = new World(800, 600);
clear(wc); // no shelter underfoot → the day just runs out
let rcol; for (let s = 0; s < 5; s++) rcol = wc.applyAction(0); // walk N until the day (5 steps) ends
const mCollapse = rcol.done && rcol.collapsed === true && rcol.reward === -P.collapsePenalty;

base(); P.enableShelter = true; P.maxStepsPerEpisode = 100; P.timeBuckets = 4;
const wtc = new World(800, 600);
const tFresh = wtc.timeCode(); wtc.steps = 99; const tEnd = wtc.timeCode();
const mTime = tFresh === '3' && tEnd === '0'; // fresh day = top bucket, almost over = bucket 0

// goats: attack fells the ADJACENT goat → carcass FOOD (+1 remaining on empty); walk on and eat it;
// a living goat BLOCKS the forager's move; goats eat terrain underfoot; goats die in pits.
base(); P.enableGoats = true; P.nGoats = 1; P.nFood = 2;
const wg = new World(800, 600); const ATT = wg.actions.indexOf('attack');
clear(wg);
const g0 = wg.goats[0];
wg.goatAt[g0.y * wg.N + g0.x] = -1; wg.ax = 2; wg.ay = 2; g0.x = 3; g0.y = 2; wg.goatAt[2 * wg.N + 3] = 0;
wg.remaining = 5;
r = wg.applyAction(2); // move E into the living goat: blocked
const mGoatBlock = wg.ax === 2 && wg.ay === 2 && r.reward === P.rewardStep;
r = wg.applyAction(ATT);
const mAttack = !g0.alive && wg.grid[2][3] === World.FOOD && wg.remaining === 6 && !r.done;
wg.applyAction(2); // now the carcass cell is walkable
r = wg.applyAction(wg.actions.indexOf('eat'));
const mCarcass = r.reward === P.rewardGather && wg.grid[2][3] === World.EMPTY && wg.ax === 3;

base(); P.enableGoats = true; P.nGoats = 1;
const wq = new World(800, 600); const gq = wq.goats[0];
clear(wq); wq.ax = (gq.x + 3) % wq.N; wq.ay = (gq.y + 3) % wq.N; // human well away from the goat
wq.grid[gq.y][gq.x] = World.FOOD; wq.remaining = 3;
r = wq.applyGoatAction(gq, 0, 8); // 'eat' (index 8: 8 moves then eat)
const mGoatEat = r.reward === P.rewardGather && wq.remaining === 2 && wq.grid[gq.y][gq.x] === World.EMPTY;
P.enablePits = true; wq.grid[gq.y][(gq.x + 1) % wq.N] = World.PIT;
r = wq.applyGoatAction(gq, 0, 2); // move E into the pit
const mGoatPit = r.done && !gq.alive && r.reward === -P.pitPenalty;

const mechanics = mEat && mClear && mDrink && mRest && mStick && mPit && mRock && mCollapse && mTime &&
  mGoatBlock && mAttack && mCarcass && mGoatEat && mGoatPit;

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

// --- S: shelter mode — with the collapse penalty + time signal the agent forages then heads home ---
base(); P.agent = 'layered'; P.layers = [1, 3, 5]; P.strategicLayer = true; P.explore = 'egreedy'; P.epsilon = 0.01;
P.enableShelter = true; P.enableWater = false;
P.rewardGather = 1; P.rewardStep = -1; P.rewardPerUnit = 50; P.collapsePenalty = 50; P.defaultQ = 0;
P.gridN = 6; P.nFood = 4; P.maxStepsPerEpisode = 80; P.timeBuckets = 4;
const wS = new World(800, 600), eS = new GameEngine();
for (let t = 1; t <= 250000; t++) { eS.tick = t; wS.update(eS); }
// competence: it reliably reaches shelter and rests (rarely collapses) and banks positive reward
const sheltered = wS.rested > 3000 && wS.collapseRate() < 0.1 && wS.meanReward() > 0.3;

// --- G: a goat world RUNS — shelter mode + 3 goat agents, no crash, goats actually forage/die ---
base(); P.agent = 'layered'; P.layers = [1, 3, 5]; P.strategicLayer = false; P.explore = 'egreedy'; P.epsilon = 0.01;
P.enableShelter = true; P.enableGoats = true; P.nGoats = 3; P.nTypes = 1;
P.gridN = 10; P.nFood = 6; P.maxStepsPerEpisode = 100; P.shelterActivate = 'clearedOrTime'; P.shelterActivateTime = 60;
P.goatLayers = [1, 3]; P.goatEpsilon = 0.05;
const wG = new World(800, 600), eG = new GameEngine();
for (let t = 1; t <= 100000; t++) { eG.tick = t; wG.update(eG); }
const goatsOk = wG.episodes > 500 && Number.isFinite(wG.meanReward()) && (wG.goatEaten + wG.goatsKilled) > 10;
P.shelterActivate = 'always';

// --- P: pits — the layered agent LEARNS avoidance (death EMA falls well under the untrained ~40%)
base(); P.agent = 'layered'; P.layers = [1, 3, 5]; P.explore = 'egreedy'; P.epsilon = 0.01;
P.enablePits = true; P.nPits = 3; P.gridN = 10; P.nFood = 10; P.nTypes = 1; P.maxStepsPerEpisode = 500;
P.rewardGather = 1; P.defaultQ = 0; // nTypes reset — the drink-mechanics block above leaves it at 2
const wP = new World(800, 600), eP = new GameEngine();
let tP = 0, pEp = 0, pDied = 0; const pOut = [];
while (pOut.length < 8000 && tP < 1_500_000) {
  tP++; eP.tick = tP; wP.update(eP);
  if (wP.episodes > pEp) { pOut.push(wP.died > pDied); pEp = wP.episodes; pDied = wP.died; }
}
// pits grid @16k (3 seeds): death ~8% around episode 8k, clear ~75% cumulative → ~2× headroom bars.
// Last-2000-episode fraction (not the ~50-ep EMA) so the bar is statistically tight (σ≈0.006).
const pTail = pOut.slice(-2000), pDeath = pTail.filter(Boolean).length / (pTail.length || 1);
const pitsOk = pDeath < 0.15 && wP.cleared > 4000;

// --- D: the DQN baseline is wired and numerically stable (learns to clear, no NaN blow-up) ---
base(); P.agent = 'dqn'; P.nTypes = 1; P.gridN = 8; P.nFood = 6; P.maxStepsPerEpisode = 500;
P.dqnField = 5; P.dqnHidden = 64; P.dqnAlpha = 0.0025; P.dqnWarmup = 200; P.dqnEpsDecaySteps = 8000;
const wD = new World(800, 600), eD = new GameEngine();
for (let t = 1; t <= 15000; t++) { eD.tick = t; wD.update(eD); }
const AD = wD.agent; let finiteW = true;
for (const arr of [AD.W1, AD.W2]) for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { finiteW = false; break; }
const qProbe = AD.qValues(AD.encode(wD));
const dqnOk = finiteW && qProbe.every(Number.isFinite) && wD.cleared > 3; // ran, learned to clear some, no blow-up (unseeded → loose bar)

const ok = mechanics && decoupled && learned && sheltered && goatsOk && pitsOk && dqnOk;
console.log('smoke:' +
  ' M mech=' + mechanics + ' (eat=' + mEat + ' clear=' + mClear + ' drink=' + mDrink + ' rest=' + mRest +
  ' stick=' + mStick + ' pit=' + mPit + ' rock=' + mRock + ' collapse=' + mCollapse + ' time=' + mTime +
  ' goatBlock=' + mGoatBlock + ' attack=' + mAttack + ' carcass=' + mCarcass + ' goatEat=' + mGoatEat + ' goatPit=' + mGoatPit + ')' +
  ' | B decoupled=' + decoupled +
  ' | L base-sweep steps-to-clear=' + late.toFixed(1) + ' (' + wL.cleared + ' cleared)' +
  ' | S shelter banked=' + wS.meanReward().toFixed(2) + ' collapseRate=' + wS.collapseRate().toFixed(3) +
  ' (' + wS.rested + ' rested)' +
  ' | G goats eps=' + wG.episodes + ' eaten=' + wG.goatEaten + ' killed=' + wG.goatsKilled +
  ' | P pits death(last2k)=' + pDeath.toFixed(3) + ' (' + wP.cleared + ' cleared)' +
  ' | D dqn=' + dqnOk + ' (cleared=' + wD.cleared + ')' +
  ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
