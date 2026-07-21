# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-20 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 3 (Experiment #1) **DONE** — layered thesis validated, controls + extensions (subsumption, density,
K-type, per-resource factoring, U-Tree) closed. **Public repo live:** github.com/algorithm0r/RL-Foragers (MIT).
This session added a **DQN baseline + budget decomposition** and **solved shelter/central-place foraging**.
Next: adaptive reach, +pits, or the ABM endgame (multi-agent / hunting).

## State
`GridForager`, modular (feature toggles + UI checkboxes): base food-sweep · +water · +shelter · +pits.
Agents share one `act()`: **flat**, **layered** (confidence-weighted stack), **subsumption**,
**per-resource multi-learners**, and a **DQN** baseline (`src/dqn.js`). Exploration greedy/ucb/**egreedy
(default 0.01)**; strategic init gather=+1. **Shelter** = central-place tradeoff: `maxStepsPerEpisode` is
the DAY, rest banks `rewardPerUnit·stock²`, day-end-in-field = **collapse**; `shelterActivate` gates when
the shelter appears (`always`/`cleared`/`time`/`clearedOrTime`). Opt-in knobs (default off): Dyna-Q
`qReplay` (K=4), `restStickC`. Harnesses `experiment/scale/dqn/budget/replayk.mjs` → local mongo; U-Tree shelved.
smoke PASS @ `1c7d1b1` (mechanics incl. stick/collapse/time + base-sweep 35 steps + shelter + DQN stability).

## Metrics (multi-seed, in the DB unless noted)
- **Layered ≫ any flat window** (~8×); ε-greedy 0.01 the robust explorer (foraging = coverage). Reach scales near-oracle across arena/resources.
- **It's the LAYERING, not the weighting:** subsumption matches confidence-weighting with 33–80× fewer states. Complementary trade: concentration→subsumption, many-types→confidence (subsumption flips & loses by K=5).
- **U-Tree** and **per-resource factoring** both LOSE — no memory ceiling to escape (QL robust to ~565k states; forager sparsity keeps states trajectory-bounded).
- **DQN vs tabular — budget-matched near-tie.** Raw DQN beat layered on 12×12 (58 vs 137) but ~90% was an UPDATE-BUDGET confound; tabular + Dyna-Q replay → 65±1 ≈ dqn-32 58±2, and at 1:1 the table beats the net (137 vs 1061). Net keeps only ~11% real generalization edge.
- **Replay is task-dependent (opt-in, K=4):** big win on coverage/sweep (109→65), HURTS sparse-terminal shelter (collapse 1%→49%).
- **Shelter SOLVED by env-percept shaping, not reward:** stock² carrot, resources-left stick, and replay all failed (it's policy discovery). `shelterActivate:'clearedOrTime'` @ T≈0.6·day is best — N=6 strict win 3.47/0.05 (vs cleared 3.06/0.24), N=10 reliability win collapse 0.30→0.09. Home-beacon-in-perception tried & REMOVED (injects oracle info; undermines partial obs).

## Branches
- `main` (pushed to origin)

## Open
- Adopt `clearedOrTime` @ T≈0.6 as the shelter default; day-length × arena sweep to map the risk/reward frontier.
- **+pits with the gated shelter** — the multi-channel "approach food/home, avoid pits" world; the real value-discrimination test.
- Adaptive reach: layers up to ~arena size; where do they stop paying?
- ABM endgame: multiple agents in a shared (stochastic) world; moving prey to hunt / predators to avoid.

## Next action
Adopt `clearedOrTime` as the shelter default + day/arena sweep, or start +pits, or the ABM endgame.

## Blockers
- none
