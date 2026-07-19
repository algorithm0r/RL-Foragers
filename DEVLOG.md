# rllayers — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-07-19 — Modular environment: feature toggles + UI checkboxes
**Done:** made the environment features TOGGLES so we build up from the base model and study each
addition, and added checkbox controls (should have done this before hardwiring v2). `world.js` is now
feature-flag driven: base = food-only sweep (clear all food, metric = steps-to-clear, 9 actions);
`enableWater` adds a 2nd resource + `drink` (10 actions, clear food AND water); `enableShelter` adds
`rest` (11 actions, day ends at rest banking rewardPerUnit·(min(food,water)|food), metric = banked
reward, + bearing/satiety sense + INT layer); `enablePits` adds terminal death. Action set + metric +
INT layer + observation augmentation all adapt to the flags. Restored layers `[1,3,5]` (dropping the
5×5 was wrong — its value is marginal, not average). `ui.js` renders checkboxes from `PARAM_SCHEMA`
(`type:'checkbox'`, with onVal/offVal so the agent flat/layered flip is a checkbox too).
**Changed:** `world.js` (full modular rewrite), `params.js` (enable* flags + checkbox schema),
`agent.js` (INT layer gated on shelter), `ui.js` (checkbox support), `observer.js`/`datamanager.js`/
`main.js`/`runner.mjs` (mode-adaptive metric), `smoketest.mjs` (per-toggle mechanics + base learning).
**State:** smoke PASS. All toggle combos run; structure adapts (acts 9/10/11, INT only with shelter,
metric switches). Base sweep learns near-optimally (steps-to-clear 32→21 ≈ oracle). Findings: +water
sweep 69 steps; shelter modes still under-gather (~0.4 banked, the ranged-sensing gap); **pits-only =
97% death** (catastrophic UCB with no shelter escape) — a vivid safe-exploration motivator.
**Next:** relevance filtering (G-algorithm-style per-layer feature masks) so wide layers stay useful
without exploding — the thing that makes [1,3,5] coherent under multi-type cells.

## 2026-07-18 — GridForager-v2 (central-place foraging) + feature-filter layers
**Done:** rebuilt the environment as central-place foraging. Cells are empty/food/water/shelter(×1)/
pit; 11 actions (8 moves + eat + drink + rest); reward = rewardPerUnit·min(food,water) banked at
`rest` on the shelter (ends episode); entering a pit is terminal death (−pitPenalty); −1/step.
Observation augmented with a shelter **bearing** (path-integration home vector) + bucketed **satiety**.
Mechanics unit-tested (eat/drink/rest/pit) — all pass.
**Architecture:** generalized layers from spatial scales to **feature filters**: `window` layers sense
a pure local window (reflexes that generalize), plus an optional `internal` (strategic) layer that
senses ONLY bearing+satiety (the homing/rest decision) in its own tiny state space. Same confidence
coupling. `world.internalCode()`; `PARAMETERS.strategicLayer`.
**Findings (the interesting part):**
- Augmenting *every* layer with bearing+satiety re-exploded the state count (~1 new state/tick, 1.1M
  and climbing) and killed generalization. Splitting into a dedicated internal layer fixed it
  (Q-states bounded ~30k).
- 5-type categorical cells make a 5×5 window ~5^25 → the coupling auto-down-weights it to ~0 (dead
  weight); dropped L5, default layers `[1,3]`.
- With the internal bearing + pit-avoiding L3, the agent reliably learns the SAFE half: death ~10–15%,
  rests ~65%. But **banked reward ≈ 0.1** — it under-gathers, because with a 1×1/3×3 window it is
  BLIND to food/water at range (shelter has a bearing, resources don't) and can't reach both types.
- UCB's optimism is unsafe near pits (must try "move into pit" once per novel state); the internal
  layer + generalizing L3 kept deaths low anyway.
**State:** smoke PASS on the honest invariant (mechanics + decoupling + death<30% + rests>40%). Banked
reward reported (~0.1), not asserted — the gathering gap is the next decision.
**Next:** ranged resource sensing — resource bearings (scent gradient) vs per-channel binary windows
vs memory. A modeling fork for Chris. γ raised to 0.95; rewardPerUnit 50.

## 2026-07-18 — Count-based UCB exploration (replaces ε-greedy)
**Done:** added UCB action selection — `argmax_a [Q + ucbC·√(ln N_state / n_{state,action})]`,
reusing the visit counts already tracked for the coupling; untried pairs get ∞ (tried first). For
the layered agent the exploration bonus is **confidence-weighted across layers** (same weights as
the value combination), so it doesn't chase the uncertainty of a down-weighted, never-settling
fine-window layer. Auto-annealing (no ε schedule). ε-greedy kept for baselines (`PARAMETERS.explore`).
Also computed the oracle benchmark ladder (10 food, 10×10 torus): floor 10, full-vision greedy ~30,
5×5-window greedy ~40, random ~450 — recorded in DEVPLAN.
**Changed:** `qlearner.js` (ucbBonus + selectUCB), `agent.js` (both agents use UCB when enabled;
LayeredAgent.selectUCB confidence-weighted), `params.js` (explore/ucbC), `PARAM_SCHEMA` (Explore c).
**State:** smoke PASS. Headless (10×10, ~10 food, 250k ticks): layered **UCB c=1 → 43 steps-to-clear
vs ε-greedy 48** (c=2 over-explores → 56). 43 is ~1.1× the ~40 windowed-greedy oracle — the 56→40
gap the flat ε tax was causing is essentially closed, with no schedule.
**Next:** environment expansion (GridForager-v2) — water/shelter/pits/rest + bearing/satiety obs.

## 2026-07-18 — Stage 2: layered agent (L1/L3/L5) + count-based confidence coupling
**Done:** added a `LayeredAgent` — one QLearner per receptive-field window size (`PARAMETERS.layers`
= [1,3,5]), each learning independently on its own abstracted transition, combined at decision time
by count-based confidence: `Q(s,a)=Σ w_L·Q_L`, `w_L ∝ count_L/(count_L+K)` normalized. Kept the
Stage-1 agent as `FlatAgent`; `makeAgent()` picks by `PARAMETERS.agent` so the sim core stays
agent-agnostic. `world.senseWindow(r)` extracts each layer's window; QLearner now tracks per-state
visit counts (the confidence signal); observer draws per-layer weights in the HUD.
**Changed:** `agent.js` (FlatAgent/LayeredAgent/makeAgent), `qlearner.js` (stateCounts), `world.js`
(senseWindow + makeAgent), `params.js` (agent/layers/confidenceK), `observer.js` (viewRadius +
weights HUD), `smoketest.mjs` (layered clears + eat/navigate routing checks).
**State:** smoke PASS. Headless (10×10, ~10 food, 300k ticks): **layered 56 steps-to-clear vs flat
window-3 119 / window-5 126 — ~2× better than any single window.** Eat routed to L1 (food underfoot
→ eat; food one-step-East → move East). Confidence weighting confirmed: common states 0.33/0.33/0.33
(all saturated), but a rare 5×5 pattern L5 had seen only 23× → 0.41/0.41/0.18 (L5 auto-down-weighted).
**Next:** Stage 3 — subsumption + 1×1-only controls, multi-seed DB sweeps, learning curves.

## 2026-07-18 — Decouple receptive field from arena size (partial observability)
**Done:** `receptiveField` is now independent of `gridN` — `senseState()` reads a fixed window
(torus wraparound) instead of clamping to the arena, so the agent roams a large arena seeing only
its window. New defaults are the realistic regime: 10×10 arena, 5×5 window, sparse food (0.1).
Observer now draws the sensed window footprint; HUD splits arena vs window; `PARAM_SCHEMA` exposes
both. This introduces partial observability + perceptual aliasing (ties to the Stage-4 U-Tree
lineage).
**Changed:** `params.js` (split gridN/receptiveField + schema), `world.js` (senseState no clamp),
`observer.js` (window footprint + HUD), `smoketest.mjs` (added decoupling + partial-obs asserts).
**State:** smoke PASS — eat-reflex ✓, decoupled=true (state length = window² for arenas 6/8/10/4),
10×10/5×5 clean (477 states in 2k ticks). Headless learning on 10×10 (~10 food): window 1×1 →
steps-to-clear ~500 (18 states, the blind-forager floor), 3×3 → ~140 (2.4k states), 5×5 → ~155
(89k states) — 3×3 already matches 5×5 with a 36× smaller table; the case for the layered cascade.
**Next:** Stage 2 — L1/L3/L5 receptive-field learners + count-weighted confidence coupling.

## 2026-07-18 — Stage 1: GridForager + flat tabular learner
**Done:** replaced the demo model. `GridForager` (`world.js`) — N×N toroidal food grid, agent
always at the view center (torus wraparound → translation-invariant state), 9 actions (8 moves +
eat), reward eat=0 / everything-else=−1 / clear-board=+N. New `qlearner.js` — tabular Q keyed by
state string, ε-greedy, **stores a visit count per (state,action)** ready for the Stage-2
confidence coupling. `agent.js` senses the window → selects → acts → learns. `observer.js` draws
the grid + forager + HUD; `datamanager.js` metric = EMA steps-to-clear. Wired `qlearner.js` into
`index.html` + the headless load lists.
**Changed:** `params.js` (grid/reward/QL params + schema), `world/agent/observer/datamanager/main`,
`smoketest.mjs` (new invariant), `runner.mjs` (metric). Filled the empty `{{DATE}}`/`{{DESCRIPTION}}`
placeholders the scaffold left blank.
**State:** smoke PASS — 1×1 learner: Q(food,eat)=1.00 vs Q(food,move)=−0.10, best=eat, 4545
episodes cleared; 5×5 runs clean. Headless learning verified: 3×3 steps-to-clear 15→10 (~4.6k
Q-states); 5×5 stuck ~300 with 185k Q-states — the combinatorial wall, exactly the baseline the
layered learner must beat.
**Next:** Stage 2 — receptive-field learners (L1/L3/L5) + count-weighted confidence coupling.

##  — scaffolded
**Done:** project scaffolded from engine v2 — vanilla-JS canvas microframework with
model/view split, the vendored standard DB client, a headless `runner.mjs`, and `smoketest.mjs`.
**Changed:** initial file tree.
**State:** runs (demo drifters model, in-browser + headless); `smoketest.mjs` passes.
**Next:** replace the demo model with the real rllayers dynamics (DEVPLAN Stage 1).
