# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-24 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
**Stage 7 (NATURAL SELECTION / ecology) — ACTIVE.** The project pivoted from a genetic algorithm to an
endogenous **artificial-life ecology**: no external fitness, no generations — selection IS survival +
reproduction. `EcoWorld` (continuous time, energy/metabolism, reproduce-as-action, starvation/hazard death,
fresh-table offspring, emergent carrying capacity). v2a (food-only) + v2c.1 (central-place: energy only from
resting stock at a shelter) built & self-sustaining. **Stage 6 (GA evolution) DONE** — Genome, EvoWorld,
persistent Lamarckian individuals, K shared-map eval, felt-reward + instinct genome, replicates; culture
(v1c) superseded by this pivot. Prior stages done: goats/hunting (5a, replay), pits (3F), shelter, layered.

## State
`GridForager` (sim) + `EvoWorld` (GA) + `EcoWorld` (ecology) share the agent/genome/cfg/feltReward core.
**Genome:** normalized [0,1] genes, single mutation sd, symmetric sign-free reward genes (gather/step/rest/
pit/reproduce + restExponent/confidenceK) + per-action `initialQ` instinct; agents run off a precomputed
per-agent cfg (no per-tick global-swap) and compute their own felt reward from world `event`s. **Ecology:**
eat→stock, rest-at-shelter→energy (`rewardRest·stock^restExponent`), reproduce (sexual @T each / asexual
@2T), die from starvation/hazard; shelters at precoded spots (count slider). **Browser:** 3 tabs (Sim/Evo/
Ecology, opens on Ecology) with per-mode controls + live eco energetics knobs; gene-distribution histograms
(heat-strips) on the ecology tab. smoke PASS @ v0.7.0-28-gbe5fa6c (non-evo byte-identical, L=33.1).

## Metrics (this session)
- **Ecology self-sustains** (`ecosmoke.mjs`, seeded): food-only carrying capacity ~163; central-place ~78–100
  through a founding bottleneck (dip ~22–28, recovers). rGather selected ↑ (0→~0.7), ε ↓ (0.46→~0.05),
  births≈deaths. Metabolism pinned at 1 (energy constants rescaled, ratio-preserving).
- **Instinct question SETTLED** (8-seed `evoreps` + pess/neutral/opt init): `initialQ[attack]` TRACKS its
  init (pess −0.89 / opt +0.79, no convergence) → a NEUTRAL gene; hunting is LEARNED, not instinct-driven.
  200-gen drift probe: selected genes converge & hold, neutral genes wander (no pole-collapse).
- **GA replicated:** loop-works 8/8; pit knife-edge (`full` fitRise 55±19 vs `full-pits` 2.6±2.9); refuted
  the one-seed attack-instinct-tracks-scarcity + felt-step-softening claims. 80+ packets in Mongo `evoreps`.

## Branches
- `main` (pushed to origin, through v0.7.0-28-gbe5fa6c)

## Open / decisions pending
- **Collapse penalty NOT implemented** — collapsing agents are killed (starvation) but don't LEARN from it
  (selection-only). Add `rewardCollapse` gene + `learnTerminal` so they learn to refuel (Chris's design).
- **v2c.2 water** — immediate second need (`rewardDrink`, die if hydration 0); the food-banked/water-immediate asymmetry.
- **v2c.3/.4 pits + goats** — activates rewardPit; goats = hunting → the instinct-selection climax under real juvenile mortality.
- Central-place bootstrap is somewhat precarious on a harsh seed (harden via more shelters / runway if needed).
- Browser viz confirmed only by syntax + logic (can't render headless) — visual is Chris's to eyeball.

## Next action
Add the **collapse felt-penalty** (`rewardCollapse` + `learnTerminal`) so agents LEARN to return-and-refuel,
then **v2c.2 water**.

## Blockers
- none
