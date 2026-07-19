# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-18 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
DEVPLAN Stage 3 — Experiment #1: layered vs flat (controls + DB sweeps)  `[ ACTIVE ]`

## State
Stages 1–2 complete. `GridForager` (toroidal arena, receptive-field window decoupled from arena →
partial observability) with two agents sharing one `act()` contract: **flat** (single window) and
**layered** (L1/L3/L5, each its own Q-table, combined by count-based confidence). Runs in-browser
(window footprint + per-layer weights in HUD) and headless. smoke PASS (A flat eat-reflex, B
decoupling, C partial-obs, D layered clears + eat/navigate routing).

## Metrics
- Layered vs flat (10×10, ~10 food, 300k ticks): **layered 56** steps-to-clear vs flat window-3 **119** / window-5 **126** (~2×)
- Eat routing: food underfoot → argmax=eat (L1); food one-step-East → moves East (not eat)
- Confidence weights L1/L3/L5: common state 0.33/0.33/0.33; rare 5×5 (L5 seen 23×) → 0.41/0.41/0.18

## Branches
- `main`

## Open
- Stage 3: subsumption + 1×1-only controls, multi-seed DB sweeps in `runner.mjs`, learning curves.
- Learning-rule variants (combined-bootstrap, residual) still to test.
- Multi-channel cells still deferred (single food bit today).

## Next action
DEVPLAN Stage 3 — add the subsumption + 1×1-only agents, then a seed sweep to the DB.

## Blockers
- none
