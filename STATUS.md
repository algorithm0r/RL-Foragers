# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-18 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
DEVPLAN Stage 2 — Receptive-field learners + confidence coupling  `[ ACTIVE ]`

## State
Stage 1 complete + receptive-field decoupled from arena size: `GridForager` (toroidal
`gridN`×`gridN` arena, `receptiveField` window sensed independently → partial observability) +
one tabular Q-learner, in-browser (window footprint drawn) and headless. smoke PASS (eat-reflex,
decoupling, clean partial-obs run). Default is now the realistic regime: 10×10 arena, 5×5 window,
sparse food (density 0.1).

## Metrics
- Eat reflex (1×1): Q(food,eat)=1.00 vs Q(food,move)=−0.10, best = eat ✓
- Fully-observable wall: 5×5 window=arena → 185k Q-states, steps-to-clear stuck ~300
- Partial obs (10×10 arena): 1×1 win →~500 stc / 18 states; 3×3 →~140 / 2.4k; 5×5 →~155 / 89k

## Branches
- `main`

## Open
- Stage 2: add L1/L3/L5 receptive-field extractors + count-weighted Q combination.
- Multi-channel cells still deferred (single food bit today).

## Next action
DEVPLAN Stage 2 — build the receptive-field state extractors `φ_L` and the confidence coupling.

## Blockers
- none
