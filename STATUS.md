# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-18 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
DEVPLAN Stage 3 — Experiment #1: layered vs flat (controls + DB sweeps)  `[ ACTIVE ]`

## State
Stages 1–2 complete + count-based UCB exploration. `GridForager` (toroidal arena, receptive-field
window decoupled from arena → partial observability) with two agents sharing one `act()` contract:
**flat** (single window) and **layered** (L1/L3/L5, each its own Q-table, combined by count-based
confidence). Exploration is now **UCB** (reuses the coupling counts; layered bonus confidence-
weighted; auto-annealing), ε-greedy kept for baselines. Runs in-browser (window footprint +
per-layer weights in HUD) and headless. smoke PASS (flat eat-reflex, decoupling, partial-obs,
layered clears + eat/navigate routing).

## Metrics
- Benchmark ladder (10 food, 10×10): floor 10 · full-vision greedy ~30 · **5×5-window oracle ~40** · random ~450
- Layered **UCB c=1 ≈ 43** vs ε-greedy ≈ 48; flat window-3/5 ≈ 119/126; 1×1 ≈ 500 (all 10×10, ~10 food)
- Eat routing: food underfoot → eat (L1); food one-step-East → moves East (not eat)
- Confidence weights L1/L3/L5: common 0.33/0.33/0.33; rare 5×5 (L5 seen 23×) → 0.41/0.41/0.18

## Branches
- `main`

## Open
- **Environment expansion (GridForager-v2, next milestone):** water (2nd resource), shelter (×1),
  pits (×3, terminal), actions eat/drink/rest → 11; reward banked at rest = total gathered;
  augment observation with shelter-bearing + bucketed satiety (central-place foraging).
- Stage 3: subsumption + 1×1-only controls, multi-seed DB sweeps in `runner.mjs`, learning curves.
- Learning-rule variants (combined-bootstrap, residual) still to test.

## Next action
Design + build GridForager-v2 (water/shelter/pits/rest + bearing/satiety observation), then Stage 3.

## Blockers
- none
