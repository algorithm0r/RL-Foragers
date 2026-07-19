# rllayers — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

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
