# RL Foragers

**Layered, receptive-field tabular Q-learning for forager agents in discrete grid worlds.**

An agent on a toroidal grid learns to sweep up resources. Instead of one Q-table over the whole
view — which faces a combinatorial wall and never generalizes across the random grids it sees —
the agent runs a **stack of nested receptive-field learners** (1×1, 3×3, 5×5, …) and combines
their Q-values by **count-based confidence weighting**. The goal isn't RL state-of-the-art; it's a
*reusable, reliable* policy-learning component for agent-based models — one that stays tabular, so
it stays interpretable and statistically predictable.

Vanilla JS + Canvas. **No build step, no framework, no modules** — the same `src/` files run in
the browser *and* headless (loaded into the main V8 realm via indirect `eval`), so every finding
is reproducible from the command line.

## The core bet

Flat tabular Q-learning can't generalize across states, so on an N×N grid whose state is the full
cell pattern it hits a combinatorial wall (2²⁵ states for a 5×5 window). With a *fresh random grid
each episode*, it essentially never revisits a state — and stays a random policy forever. We buy
back generalization *by hand*:

```
Q(s,a) = Σ_L  w_L(s) · Q_L(φ_L(s), a),   w_L(s) ∝ count_L(φ_L(s)) / (count_L + K)   (normalized)
```

Each layer `L` is a tabular Q-table over an agent-centered window of a different size. A layer that
has seen its current pattern many times (the 1×1 "food under me → eat" hits its 2 states
constantly) gets high weight; a fresh wide-window pattern gets near-zero weight until it has
genuinely been seen enough. The right layer dominates each decision with **no hand-tuned
arbitration** — the eat-value routes to 1×1, navigation to the wider windows, automatically.

## What the experiments show

All results are multi-seed and written to a local database as self-describing packets. Highlights:

- **Layering is the whole game — and it beats any single window by ~8×.** A stack of receptive
  fields clears the arena dramatically faster than any one flat window, which either can't navigate
  (1×1 random-walks) or drowns in state count (wide windows).
- **It's the *layering*, not the confidence weighting.** A **subsumption** control (fixed-priority
  arbitration: the narrowest window with a goal in view acts) matches the confidence-weighted agent
  on performance with **33–80× fewer states**. The weighting is a convenience; the multi-scale
  decomposition is what does the work.
- **A complementary trade.** Concentration (dense resources) favors subsumption's state-efficiency;
  response-diversity (many resource *types*, each with its own collect action) favors confidence
  weighting's richer representation. Neither dominates — which one you want depends on the world.
- **The monolithic learner doesn't actually explode.** At forager sparsity the states *visited* are
  bounded by the trajectory, not by the combinatorial enumeration — so the Q-table stays flat in the
  number of resource types, and per-resource factoring (splitting into one learner per resource)
  *loses*: it compresses memory but discards the cross-resource structure an efficient sweep needs.
- **ε-greedy (0.01) is the robust explorer.** Foraging is a *coverage* problem; UCB anneals and
  thrashes on wide, perpetually-novel layers.

Representative numbers (steps to clear, lower is better; oracle greedy ≈ 77; N=12, K resource types):

| agent | K=1 | K=2 | K=5 | K=10 | Q-states @ K=10 |
|---|---|---|---|---|---|
| layered tabular (monolithic) | 88 | 95 | 108 | 119 | ~526k |
| subsumption | 82 | 91 | 128 | 201 | ~33k |
| per-resource factored (WTA) | 88 | 123 | 607 | 565 | ~13k |

## Run

- **Browser:** open `index.html`. Watch an agent forage; the control panel exposes every parameter,
  and the HUD draws the per-layer Q-tables and confidence weights.
- **Headless smoke test (no database):** `node smoketest.mjs` — asserts the model invariants and
  prints the metrics.
- **Headless experiment sweeps:** `node experiment.mjs` and `node scale.mjs` run multi-seed sweeps
  and write packets to a local MongoDB (`mongodb://127.0.0.1:27017`). `node analyze.mjs` reads them
  back and prints the comparison tables. A database is only needed for the sweeps, not to run the
  sim.

## Layout

- `src/` — the headless-safe sim core: `world` (the grid + dynamics), `agent` (flat / layered /
  subsumption / per-resource variants), `qlearner`, `utree` (a learned-relevance filter, built and
  benchmarked), `params` (one config object), `engine`, `util`. Plus `observer`/`charts` (Canvas
  rendering), `ui`/`main` (browser-only — all DOM lives here), and `db.js` (database client).
- `runner.mjs`, `smoketest.mjs`, `experiment.mjs`, `scale.mjs`, `analyze.mjs` — headless entry points.
- `DEVPLAN.md` — the architecture and staged roadmap. `DEVLOG.md` — an append-only history of what
  each session found. `STATUS.md` — a one-screen snapshot of where the system is right now.

## Background

The design leans on standard ideas: tile coding / sparse coarse coding (Sutton 1996), state
abstraction theory (Li–Walsh–Littman 2006), optimism-under-uncertainty for the confidence signal
(R-max / MBIE-EB), subsumption architectures (Brooks 1986), and the G-algorithm / U-Tree lineage
of learned input generalization (Chapman & Kaelbling 1991; McCallum 1995). See `DEVPLAN.md` for the
full map and references.

## License

MIT — see [LICENSE](LICENSE).
