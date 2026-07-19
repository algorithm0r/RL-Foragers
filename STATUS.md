# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-18 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
GridForager-v2 (central-place foraging) built — resolving the ranged-sensing fork before Stage 3.

## State
Stages 1–2 + UCB done. Environment rebuilt as **GridForager-v2**: cells empty/food/water/shelter/pit,
11 actions (moves+eat+drink+rest), reward = rewardPerUnit·min(food,water) banked at `rest` (ends
episode), pit = terminal death; observation augmented with shelter bearing + satiety. Layers
generalized to **feature filters**: pure spatial `window` layers + an `internal` (bearing+satiety)
strategic layer, same confidence coupling. Mechanics unit-tested; smoke PASS. **Open gap:** the agent
learns the safe half (avoid pits ~10-15% death, home + rest ~65%) but **under-gathers (banked ≈ 0.1)**
— blind to food/water at range. Needs a ranged-sensing decision.

## Metrics
- v2 (8×8, F5 W5 P3, layered [1,3]+INT, UCB): death ~10-15%, rest ~65%, **banked reward ≈ 0.1** (gathering gap)
- Coupling correctly down-weights the 5×5 categorical layer to ~0 (dead weight → dropped)
- (v1 results still valid: layered UCB ≈ 43 steps-to-clear vs flat ≈ 119/126, oracle ≈ 40)

## Branches
- `main`

## Open
- **Environment expansion (GridForager-v2, next milestone):** water (2nd resource), shelter (×1),
  pits (×3, terminal), actions eat/drink/rest → 11; reward banked at rest = total gathered;
  augment observation with shelter-bearing + bucketed satiety (central-place foraging).
- Stage 3: subsumption + 1×1-only controls, multi-seed DB sweeps in `runner.mjs`, learning curves.
- Learning-rule variants (combined-bootstrap, residual) still to test.

## Next action
Resolve the ranged-sensing fork (resource bearings vs per-channel binary windows vs memory) so the
agent can actually gather; then Stage 3.

## Blockers
- none
