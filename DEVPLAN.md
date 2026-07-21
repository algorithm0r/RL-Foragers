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
  `runner.mjs` + `smoketest.mjs`, main-realm loader — no `vm`).
- **Stage 1: `GridForager` + single tabular learner.** Toroidal `gridN`×`gridN` food arena, 9
  actions, the +N/0/−1 reward, one Q-learner (per-entry visit counts already stored for Stage 2),
  with a **`receptiveField` window decoupled from arena size** (partial observability). Runs
  in-browser (window footprint drawn); smoketest asserts eat-reflex + decoupling + a clean
  partial-obs run. Two regimes measured: fully observable (window=arena) 5×5 drowns at 185k
  Q-states (the combinatorial wall); partial obs (10×10 arena) 3×3 window learns local nav with a
  ~2.4k table — the baseline the layered learner must beat.
- **Stage 2: layered agent (L1/L3/L5) + count-based confidence coupling.** Each window size is
  its own Q-table; combined by `w_L ∝ count/(count+K)` for the behaviour policy; per-layer
  weights drawn in the HUD. **~2× better than any flat window** (56 vs 119/126 steps-to-clear on
  10×10); eat routes to L1; L5 auto-down-weighted on states it hasn't seen.
- **Count-based UCB exploration** (replaces ε-greedy): `argmax_a [Q + ucbC·√(ln N_s / n_{s,a})]`,
  reusing the coupling's visit counts; the layered bonus is confidence-weighted across layers.
  Auto-annealing, no schedule. ~43 steps-to-clear (c=1) vs ε-greedy 48 — ~1.1× the ~40 oracle.
- **Modular environment (feature toggles + UI checkboxes).** Build up from the base and study each
  addition: base = food-sweep (v1, steps-to-clear, 9 actions) → `+water` (drink, 10) → `+shelter`
  (rest ends day, banked-reward metric, +bearing/satiety +INT layer, 11) → `+pits` (terminal death).
  Action set / metric / INT layer / observation all adapt to the flags. Layers = feature filters
  (pure `window` layers + optional `internal` bearing/satiety/**time-of-day**). Base sweep learns
  near-optimally (32→21 steps ≈ oracle); pits-only = 97% death (catastrophic UCB).
- **Shelter = central-place foraging, now a real forage-vs-return tradeoff.** `maxStepsPerEpisode` is
  the DAY LENGTH; rest at the shelter banks `rewardPerUnit·gathered`, but if the day expires in the
  field the agent **collapses** (terminal `−collapsePenalty`). A **time-of-day signal** (bucketed day
  remaining) in the INT state makes homing timeable — ablation: the clock ~2× the harvest and ~4×
  fewer collapses vs blind-to-time. ~~The agent learns to forage-then-rest but under-gathers.~~
  **SOLVED by environment-percept shaping, not reward.** Reward-shaping (stock² carrot, resources-left
  stick) and vanilla replay all failed → under-gathering is policy DISCOVERY, not incentive. The fix:
  `shelterActivate` gates *when* the shelter appears — `'cleared'` (after the field is swept: removes the
  rest-on-contact temptation, cues the return) quadrupled harvest, and **`'clearedOrTime'` @ T≈0.6·day**
  (load-full-OR-nightfall, a dusk safety valve) is the best config: N=6 strict win 3.47/0.05 vs cleared
  3.06/0.24, N=10 reliability win (collapse 0.30→0.09). Homing stays an honest in-view goal cell — a
  home-beacon-in-perception was tried and REMOVED (it injects oracle info, undermines partial obs).
- **DQN baseline (`agent='dqn'`, `src/dqn.js`) — the "guard against a straw man" (Stage 3E), built.**
  A small dependency-free MLP (one-hot window → hidden ReLU → Q/action; replay + target net + annealed
  ε). Head-to-head (3 seeds, 250k ticks): **matches** the layered tabular agent on the easy sweep and
  the K=2 sweep, and **beats** it on the hard 12×12 partial-obs arena (58±2 vs 137±49) with lower seed
  variance and fewer parameters — but ~19× the compute. The learned generalization beats the hand-built
  layering on SCORE; the layered agent's honest value narrows to interpretability + compute + no-tuning.
- **Budget×representation control (`budget.mjs`) — the DQN's win was ~90% UPDATE BUDGET.** Gave the
  tabular agent DQN-style Dyna-Q **replay** (`qReplay`, value-only via `QLearner.learnQ` so confidence
  counts stay honest) and the DQN a matched 1:1 update rate (`dqnTrainEvery`). At equal high budget,
  layered-replay 65±1 ≈ dqn-32 58±2 on the 12×12; at equal 1:1 budget the TABLE beats the net (137 vs
  1061). Replay alone halved the tabular agent's steps (137±49 → 65±1) and erased its seed variance —
  a clear default upgrade. The net's genuine (representation) edge over the table is only ~11%.
- Legacy letters-puzzle Q-learner lives only in the initial commit (`51e9fc5`) as reference.

## Not yet built
- **Ranged resource sensing (immediate fork):** the v2 agent can't navigate to food/water it can't
  see. Options — (a) resource *bearings* (scent-gradient, like the shelter bearing; ABM-plausible,
  cheap, learnable); (b) per-channel *binary* windows (keeps vision, but ranged binary windows still
  generalize poorly); (c) *memory* of resource locations (U-Tree/POMDP; hardest). Decide before Stage 3.
- Experiment #1 harness (Stage 3): controls (subsumption, 1×1-only), seeds, DB sweeps, curves.
- Learning-rule variants (combined-bootstrap, residual); learned filters (Stage 4); multi-agent
  stochastic worlds + hunting (Stage 5).

---

## The environment — `GridForager`
- **Arena:** `gridN`×`gridN`, **toroidal**, any size (10×10 is the realistic default). The agent
  is always at the **center of its view** (moving re-centers the torus), so absolute position is
  *not* part of the state — translation invariance is baked in, which is what makes the
  receptive-field abstraction sound.
- **Window ≠ arena (decoupled).** The learner senses only a `receptiveField`-sized window, set
  independently of `gridN`. Window < arena ⇒ **partial observability**: most windows are empty
  (navigating emptiness is part of the fail state), and two different arenas can look identical
  through the window — **perceptual aliasing**, which is exactly the POMDP regime the Stage-4
  learned-filter lineage (U-Tree / selective perception) addresses. Set `receptiveField ≥ gridN`
  to recover fully-observable mode.
- **Cells are multi-channel bit-vectors** from day one, even though only one channel is used
  first: `food` (0/1) now; `agent`, `predator`, `prey` reserved. This is deliberate — the
  long-term goal (learn which *bits* of a cell are relevant per sub-behavior) needs channels
  to exist in the representation early. State = the bit pattern over the receptive field.
- **Actions (9):** 8 moves (N, NE, E, SE, S, SW, W, NW) + `eat`.
- **Reward (as specified):** successful `eat` → `0`; **every other action → `-1`** (moves, and
  failed eats); clearing the board → **`+N`** where N = food count at episode start. So `eat`
  (0) strictly dominates a wasted move (−1) locally — a built-in gradient toward eating that
  exists *before* the terminal bonus — and the −1/step pressures efficient navigation.
- **Episode:** ends when all food eaten (ship +N, new random arena) or at a step cutoff.

## The learners — nested receptive fields
The L1/L3/L5 layers differ only by **window size** (1×1 / 3×3 / 5×5) — they all run on the **same
arena**. Each is a tabular Q-table over its own **abstracted** state (the bit pattern within its
window), storing **mean Q *and a visit count* per (state, action)** — the count is the confidence
signal. Empirically (10×10, ~10 food): the 1×1 eats-on-contact but random-walks (steps-to-clear
~500), 3×3 learns local navigation with a ~2.4k-state table (~140), 5×5's reach costs an 89k-state
table for no gain (~155) — the case for combining them rather than picking one.

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

## Exploration — count-based UCB (not ε-greedy)
`select = argmax_a [ Q(s,a) + ucbC·√(ln N_state / n_{state,action}) ]`. Under-sampled ("unsettled")
actions get a bonus; settled ones ~0; untried ones are tried first (∞). It reuses the coupling's
visit counts, auto-anneals (no schedule), and explores *toward genuine uncertainty* instead of
random. For the layered agent the bonus is **confidence-weighted across layers** (same weights as
the value combination) so we don't chase the uncertainty of a down-weighted, never-settling
fine-window layer. `ucbC ≈ 1` is the sweet spot (c=2 over-explores). ε-greedy kept for baselines.

## Benchmarks — clean sweep of 10 food on a 10×10 torus (king moves, `eat` is its own turn)
Simulated oracles, to scale the learners against:
- **Hard floor 10** (unavoidable eat-turns) · full-vision optimal ≈ 25 · full-vision greedy ≈ **30**.
- **5×5-window greedy ≈ 40** — the *fair* target under our partial observability · blind random ≈ 450.
- Our agents: **layered+UCB ≈ 43**, layered+ε-greedy ≈ 48, flat window-3/5 ≈ 119/126, 1×1 ≈ 500.
  → layered is ~1.1× the windowed oracle; any flat single window is ~3×.
- Note: ~1/3 of the oracle's cost is the separate `eat` action. Folding eat into "enter a food
  cell" would drop the floor to ~20/~30 — a design lever if that fits the ABM use case.

---

## Stages

### Stage 1 — `GridForager` environment + one flat tabular learner  [ DONE ]
Replace the demo. Multi-channel toroidal grid, 9 actions, the reward above, one flat Q-learner
over the full window as the (deliberately weak) baseline.
- [x] `params.js`: grid size N, reward constants (+N / 0 / −1), α, γ, ε, step cutoff;
      `PARAM_SCHEMA` entries. (Channels deferred — single food bit for now.)
- [x] `world.js`: torus state, food spawn, `eat`/move dynamics, reward, episode reset.
- [x] `agent.js`: sense window → pick action → act → learn.
- [x] `qlearner.js` (new file — added to `index.html` script tags **and** the main-realm load
      lists in `smoketest.mjs`/`runner.mjs`): tabular Q with per-entry visit counts, ε-greedy.
- [x] `observer.js`: draws grid + agent + food + HUD; `datamanager.js`: metric = steps-to-clear.
**Done when:** an agent forages a toroidal food grid in-browser, and `smoketest.mjs` asserts a
real invariant (a 1×1 learner learns to eat). ✓ smoke PASS; 3×3/5×5 learning verified headless.

### Stage 2 — Receptive-field learners + confidence coupling  [ DONE ]
L1/L3/L5 learners over the same arena, combined by count-based confidence.
- [x] receptive-field state extractors `φ_L` — `world.senseWindow(r)`, one call per layer.
- [x] count-based confidence coupling for action selection: `Q(s,a)=Σ w_L·Q_L`, with
      `w_L ∝ count_L/(count_L+K)` normalized. Each layer LEARNS independently (bootstraps on its
      own next-state max); the combined value is the behaviour policy. (Combined-bootstrap and
      residual learning-rule variants deferred to Stage 3.)
- [x] per-layer weights instrumented (`agent.lastWeights`, drawn in the HUD).
**Done when:** the layered agent reliably clears the arena and weights route `eat` to L1 while
L3/L5 drive navigation. ✓ smoke PASS; headless (10×10, ~10 food): layered **56** steps-to-clear
vs flat **119/126** (~2×); eat routed to L1; rare-state weights L1/L3/L5 = 0.41/0.41/0.18
(L5 auto-down-weighted when it hasn't seen the pattern).

### Stage 3 — Experiment #1: layered vs flat  [ DONE ]
The headline question: **does the layered learner forage a partially-observed arena better than
any single window?** Preliminary Stage-2 evidence says yes (layered 56 vs flat 119/126 steps-to-
clear on 10×10); Stage 3 makes it rigorous — multiple seeds, learning curves, DB packets, controls.
Conditions, all sharing the same world + reward (default 10×10, sparse food, partial obs):
- (A) **flat single-window** — the floors: window 3 (cheap, ~119) and window 5 (~126, huge table).
- (B) **1×1-only** = eat-reflex + random walk — the *informative* floor (never wastes an `eat`).
- (C) **subsumption control** — fixed priority (L1 eat → L3 near-nav → L5) instead of learned
      weighting; isolates "does the *confidence weighting* matter, vs. just reusing sub-policies."
- (D) **layered + count-confidence** — the treatment (Stage 2).
- (E, optional) **model-based abstracted value iteration** — strong single-agent-deterministic
      baseline (dynamics are analytically known on the torus). Guards against beating a straw man.
- Learning-rule axis for (D): independent per-layer bootstrap (current) vs combined-bootstrap
  (factored target) vs residual (L1 prior → L3/L5 corrections).
- [x] `experiment.mjs`/`scale.mjs` sweep condition × arena/window/density/K-types × seed → self-describing packets to DB.
- [x] metrics: steps-to-clear + Q-state footprint vs training; learning curves stored per packet.
- [x] subsumption control built → isolates "layering" from "confidence weighting" (it's the layering).
**Done when:** curves for A–D (E optional) are saved to the DB and the comparison is decisive,
with the subsumption control separating "layering" from "confidence weighting." ✓ **Decisive:**
layered ≫ any flat window (~8×); LAYERING (not weighting) does the work; ε-greedy 0.01 robust.
**Extensions past the core question (all in the DB, multi-seed):** arena/resource scale, density
sweep (subsumption bounds state count 33–80×), K-type sweep (confidence-weighting wins on response
diversity — complementary trade with density), and **per-resource factoring** (`mL-sum`/`mL-wta`/
`mS-wta`): **factoring loses** — the monolithic learner never explodes at forager sparsity (states
trajectory-bounded, ~flat in K), so there's no ceiling to escape, and per-resource binarization
discards the cross-resource joint structure the sweep needs. Same shape as the U-Tree result.

### Stage 3F — Pits: valence discrimination + safe exploration  [ DONE ]
Pits are the first **negative-valence** percept — until now "approach any non-zero cell" was never
punished, so the multi-type window has never had to discriminate value, only detect. (Mechanics
already built: `World.PIT`, terminal death −`pitPenalty` through `applyAction`, `deathRate` EMA,
placement in sweep and shelter modes. Anchor datapoint in hand: pits-only under UCB = **97% death**.)
Hypotheses, each falsifiable:
- **H1 (layer division of labor):** avoidance lives entirely in the 3×3 — the pit must be seen one
  step *before* entry. flat-1 dies at random-walk rate forever; flat-3 captures ~all survival;
  layered matches flat-3's death rate at layered harvest speed. Interpretability probe: read
  `Q₃ₓ₃(pit-adjacent, move-into) ≈ −pitPenalty` straight from the table; the 1×1 carries nothing.
- **H2 (exploration safety — the headline):** benign-world explorers are *structurally* wrong in
  lethal worlds, and the three we already have make sharply different death predictions. UCB's
  untried-forced rule mandates stepping onto visible pits (the 97% — negative control). ε-greedy
  pays a permanent blood tax: an irreducible, never-annealing floor ≈ ε · P(pit-adjacent) ·
  (lethal/9) — compute it analytically; measured ≈ predicted means the POLICY is fine and deaths
  are pure noise. **greedy + strategic init** injects no noise at all: an early death burst while
  optimism burns off (≈ one death per pit-direction pattern, learned arena-wide via translation
  invariance), then ~zero forever. If greedy-init wins on deaths AND harvest, that's the honest
  safe-explorer — no new mechanism. (A hardwired pit-veto reflex was considered and REJECTED —
  beacon lesson: auto-avoiding pits deletes the avoidance-learning phenomenon pits exist to test.)
- **H3 (cross-arc ties):** death is sparse-terminal → replay should HURT avoidance (same mechanism
  as shelter collapse). Window translation-invariance → "pit-NE" is ONE table entry arena-wide, so
  avoidance should learn *faster* than foraging.
- **Stage C (ABM payoff):** full gauntlet food+water+shelter(`clearedOrTime`)+pits, sweep day
  length — does deadline pressure push agents onto risky paths past pits (death rate rising as the
  day tightens)? Emergent risk-taking under time pressure.
- **Rocks (new cell type, `World.ROCK`):** completes the valence spectrum the window must
  discriminate — approach (food/water) · goal (shelter) · avoid (pit) · **ignore-but-route-around**
  (rock). Move into rock = blocked, stay put, normal −1 step cost (bumping is learnably wasteful
  through the existing reward — no new machinery). Breaks "approach any non-zero cell" a second,
  softer way, and makes navigation spatial: detours, corridors, rock-forced risky routes past pits.
Build: rocks (`enableRocks`/`nRocks`, blocked-move dynamics, observer draw, schema) · `pits.mjs`
harness (agents × explorers × nPits/nRocks, **episode-budgeted**) → `pits` collection · smoke bars
(rock blocks & costs −1; layered death rate falls with training; greedy-init death burst
extinguishes). Metrics reported jointly (deathRate + cleared-rate + steps) — steps conditional on
survival is survivorship-biased.
- [x] rocks: `World.ROCK`, blocked-move in `applyAction`, spawn placement, UI/schema, observer
- [x] `pits.mjs` Stage-A grid: {flat-1,flat-3,flat-5,layered,subsumption} × {greedy,eg005,eg01,ucb}
      × nPits {0,3,6}, 16k episodes, 3 seeds → 171 packets in `pits` (rocks split to its own run).
      DECISIVE: layered+ε-greedy alone survives AND clears; flat-5 wall turns lethal (86–100% death);
      subsumption can't learn danger (goal-gated arbitration, ~24% death, ε-independent); UCB damage
      ∝ state count; layered-greedy survives by quitting; ε .005 vs .01 a tradeoff → default stays .01.
- [x] ~~analytic ε-death-floor~~ → replaced by DEATH ATTRIBUTION (`lastRandom` tag): no fixed floor
      exists (adjacency is policy-shaped — Chris); measured: tail deaths ~61% ε-draw for layered.
- [x] per-layer Q probe for H1: fear is SHALLOW (mean Q(into) −2.5; rank not magnitude decides) and
      lives in ~90 hyper-visited "empty except pit" L3 states. Subsumption's L3 has ZERO of those
      (arbitration starvation, confirmed by fear-band probe). Hazard-aware arbitration variant
      (`subsumptionHazardArb`, opt-in) tested: death 25→17% but clear 75→43% — a fixed-priority
      stack can't avoid AND seek in one step. Layered dominates both corners: **in lethal worlds
      the weighting (blending) is exactly what matters.**
- [x] replay-hurts-avoidance check — **FALSIFIED: replay HELPS pits** (5.7→4.5% death, 90→96%
      clear, K=4). Refined rule: replay hurts iff the critical transition is RARE IN THE BUFFER
      (shelter homing), helps when abundant/generalizing (deaths).
- [x] Stage C gauntlet — **deadline pressure does NOT buy deaths**: death tracks EXPOSURE (rises
      with longer days 4.3→6.7%), collapse absorbs the deadline (21→11%). The clock (INT) and the
      hazard (window) never share a state → deadline-risk-taking is inexpressible. ⚠ Stage-5a
      health-conditional boldness has the same factored structure — likely needs a joint state.
- [x] rocks×pits interaction — **super-additive** (0%/5.7% alone → 25% together @ 8 rocks): rocks
      POLLUTE window states (fear relearned per rock context). 48k check: slow learning, not a wall
      (16.5% and falling) → first real motivation to revisit Stage-4 relevance filtering.
**Done when:** the Stage-A grid is in the DB and decisive on H1/H2 (who carries avoidance; do the
explorers' death signatures match prediction — ε floor vs greedy-init burst vs UCB catastrophe),
and the gauntlet answers whether deadline pressure buys deaths. ✓ **All answered 2026-07-21** (grid
decisive; deadline answer: NO — death tracks exposure; see DEVLOG).

### Stage 4 — Learned filters: which *bits* matter  [ PLANNED — U-Tree probe done & shelved ]
Move from fixed receptive fields to **learned relevance** — the G-algorithm / U-Tree lineage:
split state on a cell/channel bit only when statistics show it changes the Q. This is the
principled home of "filter out irrelevant bits" (e.g. ignore the `agent` channel when eating,
attend to it when hunting) and stays statistically predictable (the reliability property).
~~First probe — `UTreeLearner` (drop-in for `QLearner`, per-action split criterion) built and swept
across scale/resource/density/K.~~ **Shelved:** compresses 100–230× but underperforms *everywhere* —
QLearner is robust to ~565k states here, so the memory-ceiling regime U-Tree pays off in doesn't
exist at forager densities. The relevant-bit *learning* goal (below) is untouched; the tree
machinery is the part shelved. → forward pointer: revisit only if a real state-count wall appears.
**Done when:** an agent learns to ignore an irrelevant added channel (e.g. random noise bits)
without loss of foraging performance, and to attend to a relevant one.

### Stage 5 — Moving entities, then shared worlds  [ ACTIVE — 5a goats built, first batch done ]
⚠ **Design constraint from the 3F gauntlet:** the factored INT+window state cannot express
conditional-risk policies (the clock and the hazard never meet in one state). Health-conditional
boldness (1-HP flees the wolf a 3-HP agent hunts) has the SAME structure — HP in INT, wolf in
window. Before building 5a, decide how the conjunction is represented: a joint INT×window layer, a
health-augmented window, or learned conjunctions (Stage-4 machinery). Otherwise the arc's headline
behavior may be unlearnable BY CONSTRUCTION.
**5a — wolves & goats (scripted movers): moving threats and moving food.** The first
NON-DETERMINISTIC environment — the regime the whole model-free bet exists for. What's new vs pits:
- Avoidance becomes a BEHAVIOR, not a veto: a wolf makes a moving *region* risky; being caught is a
  sequence of positioning mistakes, so danger credit must propagate far further back than pit-death.
- Goats = the mirror: gathering becomes interception; against a fleeing goat, greedy approach may
  never close. Wolf/goat completes the valence symmetry (pit/food with dynamics).
- The window's Markov assumption breaks honestly: a snapshot says "wolf NE," not "closing or
  leaving" — velocity is hidden state. Prediction: snapshot agents handle random-walk movers but
  strain against pursuers → the first PRINCIPLED case for a memory/history layer (two-frame state).
- **Combat / predation economy (Chris's design):** ATTACK an adjacent goat or wolf → it turns to
  FOOD (carcass). Wolves fight back: a bite is a big negative penalty, and ~3 bites KILL the agent.
  So everything is food at a risk price — static food free, goats run, wolves fight — and valence
  becomes CONTINGENT, not fixed per type. Health (HP) is new INTERNAL state and must be in the
  percept (INT layer: health + threat, like satiety/time in shelter mode) or the headline behavior
  is unlearnable: **health-conditional risk attitude** (3-HP agent hunts the wolf; 1-HP agent flees
  the same wolf — same window, opposite action, disambiguated only internally). Cumulative
  bite-death gives a learnable GRADIENT into death (HP-in-state propagates fear up the health
  ladder) vs the pit's cliff. Fight/flight/feed arbitration = subsumption's classic home turf AND
  its predicted failure mode: the right priority ordering is health-dependent, which a fixed stack
  can't express but confidence-weighting + INT can — a clean architecture-discriminating test.
- Design axes: movement policy curriculum (random-walk first, then chase/flee — dynamics before
  adversariality); speed ratios (goats catchable, wolves escapable — e.g. movers act every other
  tick, else degenerate); kill thresholds (goat = 1 hit; multi-hit wolves make hunting a committed
  exchange, not a timing trick); when wolves bite (retaliation only vs every adjacent tick — the
  latter prices the approach, not just the fight); the economy's numbers (wolf carcass ≫ goat or
  nobody rational hunts wolves — sweep carcass value vs expected bite cost for the
  avoider→hunter policy flip).
**5a-GOATS — BUILT & FIRST BATCH DONE (2026-07-21).** Result: **prey become COMPETITORS, not
quarry** — the forager treats cheap goats as furniture that steals food, hunts them only by ε-
accident (attack Q≈0 vs forage Q≈5; no-attack ablation ≈ free), and because it doesn't hunt, the
goats correctly learn no fear. Scarcity doesn't rescue it (starved to nFood=1, hunting still decays).
The two-action + banked + discounted hunt can't beat direct foraging → **carcass premium or one-
action hunt is REQUIRED**, decision pending for Chris. Also found: goats are an emergent shared
ecological clock (they clear the field → shelter appears sooner → collapse 39%→17%). Full write-up
in DEVLOG 2026-07-21. Original scope as built:
- **Goats run a simpler version of the same architecture** (shared species-level layered learner,
  e.g. [1,3], ε-greedy): they eat food, drink water, avoid pits — and can learn to avoid the human
  (their deaths near the human teach fear via their own Q). The human's world goes NON-STATIONARY
  because prey policies change under it — the model-free bet's first real test.
- **Hunting = the two-action sequence: ATTACK, then EAT.** Attack fells an adjacent goat → its cell
  becomes FOOD (carcass); the forager steps on and eats. Goats also DEPLETE the same resources —
  competition: hunt the thieves or lose the harvest.
- Design defaults (my calls, veto-able): sequential per-tick updates (human, then each goat);
  goats painted into the window as their own cell type (the reserved `agent` channel idea);
  goat-on-food occludes the food (one value per cell — realistic); goat eats decrement `remaining`
  (the dusk valve in `clearedOrTime` covers a goat-emptied field); killed/pit-dead goats stay dead
  for the episode, respawn on the next; species-shared Q-tables persist across episodes (goats
  learn as a population); carcass = plain FOOD (+1 — hunting's edge is competition removal, not a
  premium; the premium economy arrives with wolves); world = shelter mode (day structure), water on.
- NO health/HP yet (that's wolves) → the ⚠ conjunction question stays open for Chris; goats-only
  doesn't hit it.
**5b — wolves + shared worlds:** wolves (fight back, bites, HP), then predators/prey as peer learners.
**Done when (5a):** an agent in a wolves+goats world learns to hunt and evade scripted movers, and
we know whether the snapshot window suffices or a memory layer is required.

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
