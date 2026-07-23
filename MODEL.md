# rllayers — evolutionary forager model (Stage 6)

A plain-language description of what the model is, how learning works, how evolution works, and exactly
which genes are deployed. For the staged history see `DEVLOG.md`; for the roadmap see `DEVPLAN.md`.

## 1. The world

A toroidal `gridN × gridN` grid of cells, each `empty / food / water / shelter / pit / rock / goat`.
Features are **toggles** — the model is built up from a food-only base:

- **food** — renewable in evolution mode: eating a food cell respawns one elsewhere (net-zero supply).
- **goats** — prey. Stationary, renewable hunt targets (motion was ruled out as the barrier in Stage 5a).
  A forager's **attack** action fells an adjacent goat → its cell becomes **food (a carcass)** → step on
  and **eat** it. This is the two-action hunt.
- **shelter (central-place mode)** — a `evoShelterGrid²` grid of evenly-spaced shelters, **hidden until
  the last quarter of the lifetime**. A forager **banks** its carried stock by resting on a shelter.
  There is **no bearing / no INT layer** — a forager finds a shelter only by *seeing* one in its window
  (the established no-INT finding); multiple spaced shelters raise the chance a seeking forager finds one.
- **pits** — terminal death on entry.

## 2. The forager (the RL agent)

Each forager is a **layered tabular Q-learner**. It senses nested square windows around itself
(`layers = [1,3,5]` → a 1×1, 3×3, 5×5 receptive field), one Q-table per window. Their opinions are
combined by **count-based confidence weighting**: a layer that has seen its abstract state many times is
trusted more (`w_L ∝ count/(count + confidenceK)`, normalised). Actions: the 8 moves, `eat`, plus
`rest` (shelter mode) and `attack` (goats mode).

**Learning** is standard Q-learning per layer: `Q(s,a) ← Q(s,a) + α·[r + γ·maxₐ' Q(s',a') − Q(s,a)]`.
Exploration is ε-greedy. An unseen `(state, action)` has value `defaultQ` (0) — chosen so, with
`rewardGather ≈ +1` and `rewardStep ≈ −1`, an untried action (value 0) beats a *known-bad* action but
loses to a *known-good* one: "strategic exploration for free."

## 3. Evolution

A fixed **population of P persistent individuals**. Each individual is a **genome + its OWN learned
Q-tables + age + fitness**. Genomes are optimised by selection while the tables keep learning.

- **Evaluation** — each generation, every individual forages `evoRuns` (K) runs on **shared maps** (all
  individuals face the same K worlds → fair, low-noise). Each run the population is **reshuffled into
  batches** of `evoBatchSize` (varied co-inhabitants). **Policies persist across the K runs**, so learning
  accumulates over a whole generation. **Fitness = the TRUE objective**: food foraged (food mode) or stock
  banked at a shelter (central-place mode) — *never* the felt reward below.
- **Selection** — rank by fitness; cull the worst `evoCull·P` **mature** individuals (age ≥ `evoProtect`);
  **survivors keep their trained tables** across generations (Lamarckian) and age; **newborns** (bred from
  survivors) get a **fresh table** and `evoProtect` generations of cull-immunity (juvenile protection).
- **Reproduction** — uniform crossover (each gene / vector-element independently from one parent) + Gaussian
  mutation (per gene, scaled by the gene's `sd`, clamped to bounds).

**How a genome is expressed:** right before an individual acts, its genome values are written into the
global `PARAMETERS` (learning rates, felt-reward weights, instinct vectors), so the agent learns and
explores *as its own genome dictates*. The **felt reward** (what it learns on) is separate from **fitness**
(the true objective) — so evolution cannot cheat by inflating a reward weight; it can only pick felt
weights whose *learned policy* actually forages/banks better. That is the whole point: **stop hand-tuning
the reward and the meta-params — select them.**

## 4. The genes deployed

**Storage:** every gene is stored NORMALIZED in **[0,1]** and expressed to its `[min,max]` on read; a
SINGLE global mutation sd (`Genome.MUT_SD`) covers them all (one magic number, not one per gene). Initial
draw is uniform over the full range unless a gene narrows it — evolution starts with maximal freedom.

### Scalar genes (`Genome.GENES`) — one value each

| gene | range | what it is |
|---|---|---|
| `epsilon` | [0, 1] | ε-greedy exploration rate |
| `alpha` | [0, 1] | learning rate |
| `gamma` | [0, 0.999] | discount factor (not 1) |
| `rewardGather` | [−1, 1] | **felt** reward for an eat/drink |
| `rewardStep` | [−1, 1] | **felt** reward/cost of a move / failed action |
| `rewardRest` | [−1, 1] | **felt** rest-banking coefficient — rest banks `rewardRest · stock^restExponent` |
| `rewardPit` | [−1, 1] | **felt** reward on entering a pit — a reward like any other, can be negative |
| `restExponent` | [0, 2] | exponent on stock in the rest reward (was a hardcoded 2) |
| `confidenceK` | [1, 100] | layered coupling: count→confidence saturation |

All four reward genes share **[−1, 1]** with NO forced sign — locking `rewardStep` negative or
`rewardGather` positive would pre-constrain evolution. The reward genes are the FELT reward the agent
LEARNS on; fitness is the TRUE objective, never the felt reward.

### Vector gene (`Genome.VGENES`) — one value **per action** (length = nActions) — the evolved INSTINCT

| gene | range | what it is |
|---|---|---|
| `initialQ[a]` | [−1, 1] | the prior **value** of an *unseen* `(state, a)`. A positive prior makes action `a` worth trying before any experience, and propagates via the bootstrap. Replaces `defaultQ` for unseen pairs when instincts are on. |

`initialQ` is the *single* instinct knob — `unexploredBonus` was dropped (it fired on the same unvisited
pairs and only `initialQ` also enters the bootstrap, so `initialQ` subsumes it). The hypothesis: an innate
prior on `attack` makes a forager sample the hunt enough to discover its value (the Stage-5a wall).

### Architecture note
Each agent holds a **precomputed numeric cfg** (its genome expressed, or `PARAMETERS` for non-evo runs).
The learner reads α/γ/ε/confidenceK/initialQ off that cfg, and the agent computes its own **felt reward**
from the world's outcome `event` (step/gather/rest/pit) — no per-tick global writes.

### Not genes (fixed / hand-set)
`layers`, `gridN`, resource counts, `evoPopSize/Runs/BatchSize/Protect/Lifetime/Cull/MutRate`,
`evoShelterFrac/Grid`, `defaultQ`, and the world toggles are configuration, not evolved.

## 5. Runners

- `evosmoke.mjs` — food-only loop proof. `evoshelter.mjs` — central-place (no-INT) banking.
- `evohunt.mjs` — hunt sweep {scarce,dense}×{instinct on/off}. `evofull.mjs` — combined world (+pits).
- `evoreps.mjs` / `evoreps-run.sh` / `evoreps-agg.mjs` — 8-seed **replicates** → the `evoreps` DB
  collection → mean±std + directional consistency. (Replication is what corrected the one-seed findings.)
- Browser: **Evolve ⇄ Sim** button animates a population foraging with a live fitness curve + gene readout
  (a *simplified* single-run-per-generation loop for watching; the headless runners are the faithful science).

## 6. Open methodological note (2026-07-23)

The replicated result "the evolved `attack` `initialQ` is ~0 in every condition" is **confounded**: 0 is
both the gene's init centre *and* the reward structure's neutral exploration point, so a drifting gene is
indistinguishable from a selected-optimal one. Testing whether the instinct genes are *selectable at all*
requires moving the neutral point off 0 (pessimistic `initialQ` init / `defaultQ`) so a positive evolved
`attack` prior becomes the *only* route to hunting — then see whether evolution finds it. (Planned.)
