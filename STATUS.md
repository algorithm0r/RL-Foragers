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

## Metrics (this session) — 8-seed REPLICATED (`evoreps`), supersedes earlier one-seed numbers
- **CONFIRMED across 8 seeds:** the evolutionary loop raises fitness (8/8 in every condition); the **pit
  knife-edge** (`full` fitRise 55±19 vs `full-pits` 2.6±2.9, deaths 1.44); **hunting BEHAVIOR tracks
  scarcity** (greedy kills scarce ~16–18 vs dense ~3–4).
- **REFUTED by replication** (were one-seed noise): "attack INSTINCT tracks scarcity" — evolved attack
  initialQ ~0 in ALL conditions (scarce 0.01±0.13, dense 0.00±0.13; 4/8 = chance), and hunting is the SAME
  instincts-ON vs OFF → hunting is driven by **learning + scarcity, NOT the gene** (instinct vectors built
  correctly but INERT here). "Felt-step softening" — food rStep −0.78±0.29, within noise of init ~−0.85.
- **Full genome + regimes built + proven:** felt reward (gather/step/perUnit/confidenceK), per-action
  instincts, central-place no-INT multi-shelter, combined world (+pits), persistent Lamarckian individuals,
  K shared-map batched eval + juvenile protection, browser evo viz. 64-rep DB in `evoreps`.
- **Prior (unchanged):** hunting resolved by replay (greedy kills 0.05→~3.0, 3 seeds); no-INT shelter wins
  EV; pits layered+ε-greedy survives+clears. All universal "unlearnable" claims retracted.

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
**Combined full world built** (`evofull.mjs`): shelter (no-INT, multi) + goats + food (+ pits), full genome,
fitness = banked stock. v1b.5 (no pits): bankedFit 30→111, evolved a POSITIVE attack instinct (+0.54) under
scarcity — foraging + hunting + homing co-evolve. v1b.6 (pits): a KNIFE-EDGE — 8 pits stall the loop
(training exploration-deaths drown the signal), 3 pits survive weakly though the learned greedy policy is
competent (banked 5.0, kills 5.3, deaths 1.8). **v1b DONE incl. replicates.** 8-seed `evoreps` replication CONFIRMED the loop + pit knife-edge + hunting-
behavior-tracks-scarcity, and REFUTED the one-seed attack-instinct-tracks-scarcity + felt-step-softening
claims (the instinct gene is inert; hunting is learned). **Next: v1c — culture** (per-agent tables +
`broadcastRange`: ∞≡shared, local≡culture, 0≡individual) — now the promising route to a hunting population,
since the innate instinct gene doesn't get selected. Deferred: pit signal-collapse fix (many knobs available).

## Blockers
- none
