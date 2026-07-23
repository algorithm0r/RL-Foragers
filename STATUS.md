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
**Genome/architecture REFACTORED (Chris, Refactors 1–3):** per-agent precomputed cfg (NO per-tick
global-swap), agent-computed felt reward from world `event`s, genes normalized [0,1] + single mutation sd,
symmetric sign-free reward ranges, `restExponent` gene, pit-as-reward, single `initialQ` instinct
(`unexploredBonus` dropped). smoke PASS (non-evo byte-identical); MODEL.md updated. **Definitive instinct
result** (clean instrument, pess/neutral/opt init × 8 seeds): `initialQ[attack]` TRACKS its init
(pess −0.89, opt +0.79 — no convergence) → a NEUTRAL gene hitchhiking on the elite; hunting is LEARNED, not
instinct-driven. Chris's degeneracy fix turned the ambiguous ~0 into a definitive null. **Next: v1c —
culture** (per-agent tables + `broadcastRange`) — a persistent-effect mechanism, which an evolved
initial-VALUE prior cannot be. Deferred: pit signal-collapse fix; a clean all-new-genome `evoreps` sweep.

## Blockers
- none
