# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-18 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Modular environment (feature toggles + UI) done — next: relevance filtering, then Stage 3.

## State
Stages 1–2 + UCB done, and the environment is now **modular via feature toggles** (checkboxes in the
UI): base = food-sweep (v1); `+water` (2nd resource, drink); `+shelter` (rest ends day, banked-reward
metric, adds bearing/satiety + INT layer); `+pits` (terminal death). Action set, metric, INT layer and
observation all adapt to the flags. Layers restored to `[1,3,5]`. Two agents (flat/layered) share one
`act()` contract; UCB exploration; confidence coupling. smoke PASS (per-toggle mechanics + base learning).

## Metrics
- Base sweep (8×8, F6, layered [1,3,5], UCB): steps-to-clear 32 → **21** ≈ oracle
- +water sweep: ~69 steps; shelter modes under-gather (~0.4 banked) — ranged-sensing gap
- **pits-only → 97% death** (catastrophic UCB, no shelter escape); +water+shelter+pits → ~59%
- Coupling still down-weights the 5×5 categorical layer (~0) under multi-type cells — relevance filter next

## Branches
- `main`

## Open
- **Environment expansion (GridForager-v2, next milestone):** water (2nd resource), shelter (×1),
  pits (×3, terminal), actions eat/drink/rest → 11; reward banked at rest = total gathered;
  augment observation with shelter-bearing + bucketed satiety (central-place foraging).
- Stage 3: subsumption + 1×1-only controls, multi-seed DB sweeps in `runner.mjs`, learning curves.
- Learning-rule variants (combined-bootstrap, residual) still to test.

## Next action
Implement relevance filtering (G-algorithm-style per-layer feature masks: start ignoring all cells,
attend only cells that change value) so [1,3,5] stays useful under multi-type cells. Then Stage 3.

## Blockers
- none
