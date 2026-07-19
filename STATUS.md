# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-18 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
DEVPLAN Stage 2 — Receptive-field learners + confidence coupling  `[ ACTIVE ]`

## State
Stage 1 complete: `GridForager` (N×N toroidal food grid, 9 actions, +N/0/−1 reward) + one flat
tabular Q-learner run in-browser and headless. smoke PASS (1×1 learner learns to eat). Flat
baseline characterised headless: 3×3 learns (steps-to-clear 15→10, ~4.6k Q-states); 5×5 hits
the combinatorial wall (185k Q-states, steps-to-clear stuck ~300) — the floor Stage 2 must beat.

## Metrics
- 1×1: Q(food,eat)=1.00 vs Q(food,move)=−0.10, best action = eat ✓
- 3×3: mean steps-to-clear 15.2 → ~10 over 200k ticks; 4.6k Q-states
- 5×5: mean steps-to-clear 561 → 304 (barely); 185k Q-states (~1 new state/step)

## Branches
- `main`

## Open
- Stage 2: add L1/L3/L5 receptive-field extractors + count-weighted Q combination.
- Multi-channel cells still deferred (single food bit today).

## Next action
DEVPLAN Stage 2 — build the receptive-field state extractors `φ_L` and the confidence coupling.

## Blockers
- none
