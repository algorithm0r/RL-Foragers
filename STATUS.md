# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-23 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
**Stage 5a (goats) — subsystem built, hunting question RESOLVED.** Multi-agent prey + a two-action
attack→eat hunt; hunting doesn't emerge individually (broken credit-assignment chain) but **replay
solves it**. **Stage 6 (EVOLUTION) is spec'd and is the next build** (Chris, 2026-07-23) — evolve the
meta-params we've been hand-tuning; a hunting *culture* via update-broadcast is the cross-agent
analogue of the replay fix. Prior arcs done: pits (3F), no-INT shelter, DQN/budget, layered thesis.

## State
`GridForager` toggles: food sweep · +water · +shelter (gated `clearedOrTime`) · +pits · +rocks ·
**+goats** (prey agents). Agents: flat / layered / subsumption (+`subsumptionHazardArb`) / multis /
DQN. **Goats:** `GoatBrain` shared species learner; `attack` fells adjacent goat → carcass → eat.
Goat knobs: `goatEatRespawn` (non-competing), `goatsCountToClear` (hunting on the critical path),
`goatStationary`, `goatExplodeRadius` (spatial premium), `goatHuntOneAction` (swallow-whole).
Replay: `qReplay`/`qReplayK`/`qReplayRecent` (backward). smoke PASS @ v0.6.0-4-gd871acf (all bars,
seeded-deterministic; goat mechanics + one-action-hunt-emergence + pit-learning + shelter + DQN).

## Metrics (this session; DB `goats` 18 + `pits` 171; probes in DEVLOG)
- **Hunting RESOLVED by replay:** two-action hunt greedy-policy kills 0.05 (no replay) → ~3.0
  (K=4 replay), confirmed 3 seeds; Q(attack) 0.35→~4. Chain probe: replay lifts the dead middle link
  (navigate-to-carcass Q 0.2→2.9) so attack bootstraps. Prey MOTION not the barrier (stationary alone
  0.01). Barrier was CREDIT ASSIGNMENT. Refines replay rule: helps multi-step-credit tasks (sweep,
  hunting), hurts rare-critical-transition tasks (shelter homing).
- **Goats as competitors:** ~40% harvest cost, saturating; emergent shared clock (goats clear field →
  shelter sooner → collapse 39%→17%). One-action hunt learns (food-scarce) but isn't hunting.
- **No-INT shelter:** dropping the INT layer trades collapse for harvest, wins on EV (percept-gated
  shelter substitutes for internal state).
- **Pits (3F):** layered+ε-greedy alone survives AND clears; flat-5 wall turns lethal; subsumption
  can't learn danger (arbitration starvation); in lethal worlds the confidence WEIGHTING is what matters.
- All universal "unlearnable" claims retracted (unprovable) — findings = "did not emerge under conditions tested."

## Branches
- `main` (pushed to origin)

## Open / decisions pending
- **Stage 6 v1a — awaiting Chris's go on scope:** discrete generations (his spec reads discrete),
  30×30 / pop 16 start (sweepable), 1-gene (ε) genome to prove the loop. Then full genome (meta-params
  + per-action initial-Q/bonus instinct vectors), per-agent tables + `broadcastRange` (culture), DB
  persistence of genomes/tables. New world regime: time-boxed lifetimes, food respawn, placed shelters.
- Wolves (5b): HP/bite-back → the conjunction-state (health×window) question.
- Curriculum "eat then hunt" — Chris has another idea (TBD).

## Next action
Chris confirms Stage-6 v1a scope (discrete generations + 30×30/pop-16) → build the evolutionary loop.

## Blockers
- none
