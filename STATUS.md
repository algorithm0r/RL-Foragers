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
- **Evolution v1a works** (`evosmoke.mjs`, 30×30 / pop 16 / K4×life500 / 25 gens, seeded): mean fitness
  **97→327**, meanAge **0→9.3** (trained elites persist across generations, as designed). Genes evolution
  CHOSE on a dense renewable world: **ε≈0.04** (near-greedy), **α≈0.39** (moderate), **γ≈0.71** — γ stays
  HIGHER than the earlier cold-restart cut (~0.5): with tables persisting across many lives a longer
  horizon pays off. (One seeded run — held loosely.) ⇒ Stage-6 Done-when partly met (loop + readable
  choices + low-noise shared-map eval); culture/hunting hypothesis still ahead.
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
Build **v1b**: full genome + per-action instinct vectors + placed-shelter regime + generation viz.

## Blockers
- none
