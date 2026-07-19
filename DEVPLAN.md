# rllayers — DEVPLAN
*Living document, not frozen. Update as the design evolves.*

## What we're actually building
A reusable, **reliable** policy-learning component for the discrete agent-based models we
build — foragers in grid worlds with changing food and (later) other moving agents to eat or
avoid. The RL is a means, not the end: the bar is "an agent that dependably learns a good
policy in a parameterized ABM," not "beat a benchmark."

The core bet: **flat tabular Q-learning cannot generalize across states**, so in a grid whose
state is the full NxN cell pattern it faces a combinatorial wall (2^25 states for 5x5; with
*random* grids per episode it essentially never revisits a state, so it stays a random policy
forever). We buy back generalization *by hand* with **nested receptive-field learners** whose
Q-values are **combined by confidence (visit counts)** — keeping the interpretability and
statistical predictability of tabular methods that a neural net would throw away.

## Built
- Engine v2 scaffold (vanilla-JS canvas, model/view split, vendored DB client, headless
  `runner.mjs` + `smoketest.mjs`). Demo "drifters" model still in place — Stage 1 replaces it.
- Legacy letters-puzzle Q-learner lives only in the initial commit (`51e9fc5`) as reference.

## Not yet built
- Everything below. The grid-forager environment, the receptive-field learners, the coupling,
  and the Experiment #1 harness.

---

## The environment — `GridForager`
- **Grid:** N×N, **toroidal**. The agent is always at the **center** of its view (moving
  re-centers the torus), so absolute position is *not* part of the state — translation
  invariance is baked in, which is exactly what makes the receptive-field abstraction sound.
- **Cells are multi-channel bit-vectors** from day one, even though only one channel is used
  first: `food` (0/1) now; `agent`, `predator`, `prey` reserved. This is deliberate — the
  long-term goal (learn which *bits* of a cell are relevant per sub-behavior) needs channels
  to exist in the representation early. State = the bit pattern over the receptive field.
- **Actions (9):** 8 moves (N, NE, E, SE, S, SW, W, NW) + `eat`.
- **Reward (as specified):** successful `eat` → `0`; **every other action → `-1`** (moves, and
  failed eats); clearing the board → **`+N`** where N = food count at episode start. So `eat`
  (0) strictly dominates a wasted move (−1) locally — a built-in gradient toward eating that
  exists *before* the terminal bonus — and the −1/step pressures efficient navigation.
- **Episode:** ends when all food eaten (ship +N, new random grid) or at a step cutoff.
- **Curriculum sizes:** 1×1 (trivial: eat-if-food), 3×3, 5×5 — progressively harder.

## The learners — nested receptive fields
Each is a tabular Q-table over its own **abstracted** state (the bit pattern within its window),
storing **mean Q *and a visit count* per (state, action)** — the count is the confidence signal.

| Layer | Receptive field | State size | Learns |
|------|------|------|------|
| L1 | 1×1 (center cell) | 2 | "food under me → eat" (a *lossless* abstraction for `eat`) |
| L3 | 3×3 | 2^9 = 512 | "step toward adjacent food" |
| L5 | 5×5 | 2^25 | longer-range navigation |

## The coupling — count-based confidence weighting
```
Q(s,a) = Σ_L  w_L(s) · Q_L(φ_L(s), a),   w_L(s) ∝ count_L(φ_L(s))   (normalized over L)
```
- **Why counts:** L1 hits its 2 states constantly → high count → high weight → it dominates the
  `eat` decision *exactly when food is present*, with **no hand-tuned arbitration**. A fresh 5×5
  pattern has count ≈ 0 → near-zero weight → L5 only speaks once it has genuinely seen enough.
  The behavior you wanted ("1×1 provides the eat value and it wins") falls out for free.
- **Hazard being avoided:** a *naïve* average of three estimates of the same return mis-scales,
  because each layer is a **biased** estimator (L1 literally can't see the food it's navigating
  toward). Confidence-normalization lets the well-informed layer dominate instead of being
  diluted. A **residual** variant (L1 = prior, L3/L5 learn corrections) is the boosting-style
  alternative and is a Stage-3 condition.

---

## Stages

### Stage 1 — `GridForager` environment + one flat tabular learner  [ ACTIVE ]
Replace the demo. Multi-channel toroidal grid, 9 actions, the reward above, one flat Q-learner
over the full window as the (deliberately weak) baseline.
- [ ] `params.js`: grid size N, channels, reward constants (+N / 0 / −1), α, γ, ε, step cutoff;
      add `PARAM_SCHEMA` entries.
- [ ] `world.js`: torus state, food spawn, `eat`/move dynamics, reward, episode reset.
- [ ] `agent.js`: sense window → pick action → act → learn.
- [ ] `qlearner.js` (new file — add to `index.html` script tags **and** the vm load lists in
      `smoketest.mjs`/`runner.mjs`): tabular Q with per-entry visit counts, ε-greedy.
- [ ] `observer.js`: draw the grid + agent + food; `datamanager.js`: metric = steps-to-clear.
**Done when:** an agent forages a toroidal food grid in-browser, and `smoketest.mjs` asserts a
real invariant (e.g. a 1×1 learner clears a food-present board within a bounded number of steps),
not the demo drift check.

### Stage 2 — Receptive-field learners + confidence coupling  [ PLANNED ]
Add L1/L3/L5 abstractions over the same world, plus the count-weighted combination.
- [ ] receptive-field state extractors `φ_L` (window slice of the torus).
- [ ] count-weighted Q combination for action selection and the TD target.
- [ ] instrument the per-layer weights so we can *see* `eat` routing to L1.
**Done when:** the layered agent reliably clears 3×3, and logged weights show L1 dominating the
`eat` decision while L3/L5 dominate navigation.

### Stage 3 — Experiment #1: layered vs flat on 5×5  [ PLANNED ]
The headline question: **can the layered learner navigate/clear 5×5 that flat tabular can't?**
Conditions, all sharing the same world + reward:
- (A) **flat 5×5 tabular** — expected floor (random policy on random grids).
- (B) **1×1-only** = eat-reflex + random walk — the *informative* floor (never wastes an `eat`).
- (C) **subsumption control** — fixed priority (L1 eat → L3 near-nav → L5) instead of learned
      weighting; isolates "does the *confidence weighting* matter, vs. just reusing sub-policies."
- (D) **layered + count-confidence** — the treatment.
- (E, optional) **model-based abstracted value iteration** — strong single-agent-deterministic
      baseline (dynamics are analytically known on the torus). Guards against beating a straw man.
- [ ] `runner.mjs` sweeps over condition × grid size × seed → self-describing packets to DB.
- [ ] metrics: steps-to-clear and food-per-1000-steps vs training episodes; learning curves.
**Done when:** curves for A–D (E optional) are saved to the DB and the layered-vs-flat comparison
is decisive, with the subsumption control separating "layering" from "confidence weighting."

### Stage 4 — Learned filters: which *bits* matter  [ PLANNED ]
Move from fixed receptive fields to **learned relevance** — the G-algorithm / U-Tree lineage:
split state on a cell/channel bit only when statistics show it changes the Q. This is the
principled home of "filter out irrelevant bits" (e.g. ignore the `agent` channel when eating,
attend to it when hunting) and stays statistically predictable (the reliability property).
**Done when:** an agent learns to ignore an irrelevant added channel (e.g. random noise bits)
without loss of foraging performance, and to attend to a relevant one.

### Stage 5 — Shared, stochastic worlds + hunting  [ PLANNED ]
Multiple agents → the env becomes non-deterministic (why the *agent* stays model-free/robust).
Add a `prey`/`predator` channel and hunting/avoidance sub-behaviors composed the same way.
**Done when:** {{NEXT STAGE}}

---

## Design decisions, and the literature they lean on
- **Summing Q across layers** = factored / additive value functions (Guestrin–Koller–Parr;
  VDN, `Q ≈ Σ Qᵢ`). Exact only when reward/transitions factor into those scopes — ours don't
  fully, so we approximate and lean on confidence weighting.
- **Nested receptive fields** = sparse coarse / **tile coding** (Sutton 1996) — multi-resolution
  overlapping tilings, value = sum over resolutions. The whole thing is equivalent-in-the-limit
  to linear FA over multi-resolution binary features; we keep separate tables for the per-layer
  confidence signal and modularity.
- **When combining is safe** = state-abstraction theory (Li–Walsh–Littman 2006). The 1×1 `eat`
  abstraction is lossless; navigation abstractions are lossy-but-bounded.
- **Confidence** = counts now (R-max / MBIE-EB optimism-under-uncertainty), Bayesian variance
  later (Dearden–Friedman–Russell 1998). Ensemble **disagreement** across layers (Bootstrapped
  DQN, Osband 2016) is a spare exploration signal.
- **"Learning the shape of the space"** = model-based / Dyna (Sutton 1990) and the Successor
  Representation (Dayan 1993; Momennejad 2017) — kept as baselines/future, not core, because
  shared worlds break the determinism a planner would exploit.
- **Learned filters (Stage 4)** = input-generalization: the **G-algorithm** (Chapman & Kaelbling
  1991) and **U-Tree / utile distinction + selective perception** (McCallum 1995–96) — grow
  state distinctions only where they improve value prediction. Predictable by design.
- **Food/agents as objects (Stage 5+)** = Object-Oriented MDPs (Diuk–Cohen–Littman 2008),
  polynomial sample complexity in the deterministic case; generalizes across object positions.

## References
- Chapman & Kaelbling 1991, *Input Generalization in Delayed RL* (G-algorithm) — https://www.ijcai.org/Proceedings/91-2/Papers/018.pdf
- Dearden, Friedman & Russell 1998, *Bayesian Q-learning* — https://ai.stanford.edu/~nir/Papers/DFR1.pdf
- Li, Walsh & Littman 2006, *Towards a Unified Theory of State Abstraction for MDPs* — http://rbr.cs.umass.edu/aimath06/proceedings/P21.pdf
- Sutton 1996, *Generalization in RL: Sparse Coarse Coding* (tile coding); Whiteson et al., *Adaptive Tile Coding* — https://www.cs.utexas.edu/~pstone/Papers/bib2html-links/whitesontr07.pdf
- Dietterich 2000, *MAXQ Value Function Decomposition* — https://arxiv.org/abs/cs/9905014
- Osband et al. 2016, *Deep Exploration via Bootstrapped DQN* — https://proceedings.neurips.cc/paper/6501-deep-exploration-via-bootstrapped-dqn.pdf
- McCallum 1995–96, *RL with Selective Perception and Hidden State (U-Tree)* — https://www.semanticscholar.org/paper/5ee38bf9494a91ca8665f9fbe59830464c223b82
- Diuk, Cohen & Littman 2008, *An Object-Oriented Representation for Efficient RL* — https://carlosdiuk.github.io/papers/OORL.pdf
- Momennejad et al. 2017, *The Successor Representation in Human RL* — https://gershmanlab.com/pubs/Momennejad17.pdf
