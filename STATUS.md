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
flat / layered / subsumption / multis / DQN. **Evolution (`src/evolution.js`):** `Genome` {ε,α,γ}
(random/crossover/Gaussian-mutate/clone); `EvoWorld extends World` — multi-forager, renewable food,
time-boxed lifetime, per-agent Q-tables, reusing World's grid/sensing/applyAction unchanged (per tick it
aims `ax/ay` + global ε/α/γ at each forager, calls its own `agent.act`, reads back move + food delta as
fitness). Discrete generations: `runGeneration`/`reproduce`/`evolve`. **UI:** `PARAM_SCHEMA` rows carry
`group` (collapsible sections) + `showIf` (contextual visibility) — panel shows only what applies to the
current model. smoke PASS @ v0.7.0-1-g9cde8f2 (all bars incl. new `E evo`).

## Metrics (this session)
- **Evolution v1a works** (`evosmoke.mjs`, 30×30 / pop 16 / 25 gens, seeded): mean fitness **20.6→55.5**
  (first-quarter 35.0 → last-quarter 50.7, Δ15.7). Genes evolution CHOSE on a dense renewable world:
  **ε 0.222→0.002** (near-greedy: coverage is free when food is everywhere + respawns), **α 0.305→0.653**
  (fast adaptation in a short life), **γ 0.807→0.623** (short horizon: reward is immediate). Legible ⇒
  Stage-6 Done-when partly met (loop + readable choices); culture/hunting hypothesis still ahead.
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
