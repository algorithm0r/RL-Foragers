# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-20 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 3 (Experiment #1) **DONE** — layered thesis validated (multi-seed DB), subsumption control
resolved the "why", extensions (scale, density, K-type, per-resource factoring) closed. **Public repo
live:** github.com/algorithm0r/RL-Foragers (MIT). Now building: **shelter/central-place foraging** (done,
learnable) and a **DQN baseline** (next). Then the ABM endgame (multi-agent / hunting).

## State
`GridForager`, modular (feature toggles + UI checkboxes): base food-sweep · +water · +shelter · +pits.
**Shelter is now a real forage-vs-return tradeoff:** `maxStepsPerEpisode` = the DAY; rest banks
`rewardPerUnit·gathered`, day-end-in-field = **collapse** (`−collapsePenalty`); a bucketed **time-of-day
signal** in the INT state makes homing timeable. Agents share one `act()`: **flat**, **layered**
(confidence-weighted stack), **subsumption**, **per-resource multi-learners** (`multi-layered`/`-wta`/
`multi-subsumption-wta`). Exploration greedy/ucb/**egreedy (default 0.01)**; strategic init gather=+1.
Harness (`experiment.mjs`, `scale.mjs`, `analyze.mjs`) → local mongo; U-Tree built but shelved.
smoke PASS @ pre-commit (exit 0, this session — mechanics + base-sweep + shelter-learning).

## Metrics (all multi-seed, in the DB)
- **Layered ≫ any flat window** (~8×). ε-greedy 0.01 is the robust exploration (foraging = coverage).
- **Reach scales:** 13579-QL near-oracle across arena size AND resources.
- **Subsumption = confidence-weighting on perf, 33–80× fewer states** (density sweep: subs 8k flat vs conf 273k→664k) → it's the LAYERING, not the weighting.
- **K-type sweep:** confidence-weighting degrades gracefully (88→119, near oracle); subsumption flips and loses by K=5 → complementary trade (concentration favors subsumption, response-diversity favors confidence).
- **Per-resource factoring LOSES** (`types2`, K∈{1,2,5,10}): monolithic QL best at every K (88/95/108/119); mL-wta/mS-wta compress (7×/42×) but lose badly (1406/565 @ K=10). QL state count is ~flat in K — no explosion to escape (forager sparsity ⇒ states trajectory-bounded). Same shape as U-Tree.
- **U-Tree** compresses 100–230× but underperforms at every scale/resource/density/K → shelved.
- Density (not arena size) is the state-explosion driver; QLearner robust to ~565k states (no wall yet).
- **Shelter/central-place:** learns forage-then-rest (rested 12k, collapse 0.4%, banked 0.65 @ 250k). Time-of-day signal ~2× harvest & ~4× fewer collapses vs blind-to-time. Risk-averse / under-gathers at collapse:perUnit=1:1 → tune the ratio.
- **DQN vs tabular — budget-matched, it's a near-tie.** Raw DQN beat layered on 12×12 (58 vs 137) — but that was ~90% an UPDATE-BUDGET confound (DQN got 32 grad-samples/step, tabular got 1). Give the table Dyna-Q **replay** and it hits 65±1 ≈ dqn-32 58±2, MORE stable, interpretable, no NN tuning, compute-comparable. DQN keeps only a small (~11%) real generalization edge; at equal 1:1 budget the table *beats* the net (137 vs 1061). **Replay ≫: 137±49 → 65±1 (halved steps, killed variance) — should be a default.**

## Branches
- `main`

## Open
- **Adopt replay as a tabular default** (`qReplay`) + tune `qReplayK` (32 halved steps & killed variance; find the knee). It's the clear practical upgrade from the budget control.
- **Shelter reward-balance sweep:** collapse:perUnit ratio × day length × arena — where does richer foraging (vs safe early-rest) become optimal?
- Adaptive reach: layers up to ~arena size; where do they stop paying?
- ABM endgame: multiple agents in a shared (stochastic) world; moving prey to hunt / predators to avoid.
- Probe idea: push density until the monolithic learner *does* strain — does any factored/compressed variant then pay off?

## Next action
Adopt replay as a tabular default (tune qReplayK), then the shelter reward-balance sweep or the ABM endgame.

## Blockers
- none
