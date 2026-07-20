# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-20 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 3 (Experiment #1) **DONE** — the layered thesis is validated with multi-seed DB evidence, the
subsumption control resolved the "why" (it's the layering, not the weighting), and the extension
threads (scale, density, K-type, per-resource factoring) are all closed. Next: pick the fork —
adaptive reach, or the ABM endgame (multi-agent / hunting).

## State
`GridForager`, modular (feature toggles + UI checkboxes): base food-sweep · +water · +shelter · +pits.
Agents share one `act()`: **flat**, **layered** (confidence-weighted receptive-field stack),
**subsumption** (fixed-priority layers), and **per-resource multi-learners** (`multi-layered`,
`-wta`, `multi-subsumption-wta`). Exploration dropdown greedy/ucb/**egreedy (default 0.01)**.
Strategic init: gather=+1 so defaultQ=0 sits in the value gap. Harness (`experiment.mjs`, `scale.mjs`,
`analyze.mjs`) writes self-describing packets to local mongo; U-Tree relevance filter built but shelved.
smoke PASS @ `891187e` (exit 0, this session).

## Metrics (all multi-seed, in the DB)
- **Layered ≫ any flat window** (~8×). ε-greedy 0.01 is the robust exploration (foraging = coverage).
- **Reach scales:** 13579-QL near-oracle across arena size AND resources.
- **Subsumption = confidence-weighting on perf, 33–80× fewer states** (density sweep: subs 8k flat vs conf 273k→664k) → it's the LAYERING, not the weighting.
- **K-type sweep:** confidence-weighting degrades gracefully (88→119, near oracle); subsumption flips and loses by K=5 → complementary trade (concentration favors subsumption, response-diversity favors confidence).
- **Per-resource factoring LOSES** (`types2`, K∈{1,2,5,10}): monolithic QL best at every K (88/95/108/119); mL-wta/mS-wta compress (7×/42×) but lose badly (1406/565 @ K=10). QL state count is ~flat in K — no explosion to escape (forager sparsity ⇒ states trajectory-bounded). Same shape as U-Tree.
- **U-Tree** compresses 100–230× but underperforms at every scale/resource/density/K → shelved.
- Density (not arena size) is the state-explosion driver; QLearner robust to ~565k states (no wall yet).

## Branches
- `main`

## Open
- Adaptive reach: layers up to ~arena size; where do they stop paying?
- Adopt subsumption as efficient default for known-resource, concentrated worlds (keep confidence for many-type / unknown-relevance).
- ABM endgame: multiple agents in a shared (stochastic) world; moving prey to hunt / predators to avoid.
- Probe idea: push density until the monolithic learner *does* strain — does any factored/compressed variant then pay off?

## Next action
Pick the fork: (a) adaptive reach sweep, (b) the density-strain probe, or (c) start the multi-agent / hunting world (the ABM goal).

## Blockers
- none
