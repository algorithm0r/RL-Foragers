# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-23 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
**Stage 6 (EVOLUTION) — ACTIVE. v1a (the loop) is BUILT and proven.** A fixed population of foragers
evolves its RL meta-params over discrete generations on a shared renewable world; fitness = food
foraged; top breed, bottom culled. The evolutionary loop raises fitness and we can READ what evolution
chose for the params we used to hand-tune. Also this session: the **control panel was caught up** to the
sim (goat/replay/shelter knobs, subsumption/dqn) and decluttered (contextual visibility). Prior arcs
done: goats + hunting-by-replay (5a), pits (3F), no-INT shelter, DQN/budget, layered thesis.

## State
`GridForager` toggles: food · +water · +shelter · +pits · +rocks · +goats (prey agents). Agents:
flat / layered / subsumption / multis / DQN. **Evolution (`src/evolution.js`):** `Genome` {ε,α,γ};
PERSISTENT individuals (genome + own learned Q-tables + age + fitness); `EvoWorld extends World` —
multi-forager, renewable food, time-boxed, reusing World's grid/sensing/applyAction unchanged (per tick
it aims `ax/ay` + global ε/α/γ at each forager, calls its own persistent `policy.act`, reads back move +
food delta as fitness). Eval: `evaluatePopulation` runs evoRuns SHARED maps/gen, reshuffling the pop into
batches of evoBatchSize each run (learning persists across runs); `nextGeneration` culls only MATURE
(age ≥ evoProtect) within the worst evoCull·P slots, survivors keep tables (Lamarckian), newborns fresh +
protected. **UI:** `PARAM_SCHEMA` rows carry `group` (collapsible) + `showIf` (contextual). smoke PASS.

## Metrics (this session)
- **Evolution v1b.1 — felt-reward genome** (`evosmoke.mjs`, 30×30 / pop16 / K4×life500 / 25 gens, seeded):
  meanFit **115→342**, meanAge **0→7.9**. Genome now carries the FELT reward (rewardGather/rewardStep/
  confidenceK) the agent learns on; fitness = TRUE food, so evolution can't inflate it — instead it
  **softened the felt step-cost −0.77→−0.31** (hand-tuned −1 is too punishing for dense foraging), held
  rGather ~0.8, drifted confidenceK ~27. ε→0.01, α→0.44, γ→0.62. (One seeded run — held loosely.)
- **v1a eval regime:** persistent individuals, K shared-map batched runs, Lamarckian survivors + juvenile
  protection — meanAge climbs (elites persist), single-run noise removed.
- ⇒ Stage-6 Done-when progressing: loop + low-noise eval + readable felt-reward choices. Ahead: instinct
  vectors (attack/5a wall), shelter regime, culture/hunting hypothesis.
- **Prior (unchanged):** hunting resolved by replay (greedy kills 0.05→~3.0, 3 seeds); goats as
  competitors ~40% harvest cost; no-INT shelter wins EV; pits layered+ε-greedy survives+clears.
- All universal "unlearnable" claims retracted — findings = "did not emerge under conditions tested".

## Branches
- `main` (pushed to origin)

## Open / decisions pending
- **v1b (next build):** full genome (reward weights + confidenceK + shelter-timing) PLUS per-action
  evolved-instinct vectors (initial-Q + unexplored-bonus — the direct attack on the 5a "attack never
  bootstraps" wall); world regime with placed shelters in the last quarter, fitness = banked stock;
  browser viz of generations. Then v1c `broadcastRange` (culture), v1d DB persistence.
- v1a defaults chosen (amendable): discrete generations, 30×30, pop 16, lifetime 1500, cull 50%.
- Wolves (5b): HP/bite-back → the conjunction-state (health×window) question.
- Curriculum "eat then hunt" — Chris has another idea (TBD).

## Next action
**v1b.3a done** — central-place evo regime (`evoshelter.mjs`): one placed shelter opens the last quarter,
fitness = banked stock; population learns forage-then-home (banked fitness 0.3→28.9, greedy banked/run 2.5),
evolution raised felt rewardPerUnit 48→62. Next: **v1b.3b** — MULTIPLE spaced shelters + nearest bearing;
then **v1b.4** browser viz of generations. (Also open: v1b.2 hunting follow-up — harder regime for instinct
necessity — if we return to it.)

## Blockers
- none
