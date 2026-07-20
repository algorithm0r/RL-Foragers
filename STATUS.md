# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-20 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 3 (Experiment #1) essentially COMPLETE — the layered thesis is validated with multi-seed DB
evidence, and the subsumption control resolved the "why". Next: adaptive reach, then the ABM endgame.

## State
`GridForager`, modular (feature toggles + UI checkboxes): base food-sweep · +water · +shelter · +pits.
Agents share one `act()`: **flat**, **layered** (confidence-weighted receptive-field stack), and
**subsumption** (fixed-priority layers). Exploration dropdown greedy/ucb/**egreedy (default 0.01)**.
Strategic init: gather=+1 so defaultQ=0 sits in the value gap. Experiment harness (`experiment.mjs`,
`scale.mjs`, `analyze.mjs`) writes self-describing packets to local mongo; U-Tree relevance filter
built but shelved. smoke PASS.

## Metrics (all multi-seed, in the DB)
- **Layered ≫ any flat window** (~8×). ε-greedy 0.01 is the robust exploration (foraging = coverage).
- **Reach scales:** 13579-QL near-oracle across arena size AND resources (34/77/236 vs oracle 30/62/129 @ 2 res).
- **Subsumption = confidence-weighting on perf, 33–80× fewer states** (density sweep: subs 8k flat vs conf 273k→664k). → it's the LAYERING, not the weighting.
- **U-Tree** compresses 100–230× but underperforms at every scale/resource/density → shelved.
- Density (not arena size) is the state-explosion driver; QLearner robust to ~360k+ states (tens of MB, no wall yet).

## Branches
- `main`

## Open
- Adaptive reach: layers up to ~arena size; where do they stop paying?
- Adopt subsumption as efficient default for known-resource worlds (keep confidence for unknown-relevance).
- ABM endgame: multiple agents in a shared (stochastic) world; moving prey to hunt / predators to avoid.

## Next action
Pick the fork: (a) adaptive reach sweep, or (b) start the multi-agent / hunting world (the ABM goal).

## Blockers
- none
