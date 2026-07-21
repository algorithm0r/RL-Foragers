# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-21 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
**Stage 3F (pits) DONE** — the lethal-world arc, run autonomously while Chris away (2026-07-20/21
per agreed plan). Headline: **layered+ε-greedy is the only architecture that both survives and
clears**; in lethal worlds the confidence WEIGHTING is exactly what matters (subsumption is trapped
on a Pareto frontier). Next: **Stage 5a wolves & goats** (design pinned, incl. combat/HP economy and
the ⚠ conjunction-state constraint), evolution beyond that (genes tiers sketched in conversation).

## State
`GridForager` toggles: food sweep · +water · +shelter (gated, `clearedOrTime`) · +pits (terminal
death) · **+rocks (block, NEW)**. Agents: flat / layered / subsumption (+ opt-in
`subsumptionHazardArb` variant, default OFF — control untouched) / per-resource multis / DQN.
**Death attribution** instrumented (`lastRandom` at every ε-draw): deaths decompose noise vs policy.
`pits.mjs` harness → `pits` collection (171 packets, 16k episodes × 3 seeds). Follow-up probes
(fear-band, hazard-arb, rocks-long, gauntlet) were scratch runs — numbers live in the DEVLOG.
smoke PASS ×3 @ v0.5.0 (new **P** bar: layered@3pits last-2k death < 0.15, measured 0.088; fixed an
nTypes leak between smoke sections).

## Metrics (pits arc; multi-seed; grid in DB, probes in DEVLOG)
- **Grid (10×10, 10 food):** layered eg01 @ 3 pits: ~6% tail death, 90% clear, 77 steps (curve still
  falling; ~61% of tail deaths are the ε-draw itself → policy deaths ~2.2%). flat-3: 3× the deaths,
  half the clears. **flat-5 PERISHES (86–100% death)** — the state wall turns lethal (never revisits
  → never learns). flat-1 structurally blind (deaths ∝ ε).
- **Explorers:** UCB damage ∝ state count (flat-3 13% / layered 53% / flat-5 96%+). Layered-greedy
  survives by QUITTING (~64 deaths then 0 deaths, 0 clears). ε .005 vs .01 = real tradeoff (−1pp
  death, −7pp clear) → **default stays ε=0.01**.
- **Subsumption ~24% death, ε-independent = ARBITRATION STARVATION** (its L3 has ZERO "pit but no
  goal" states; layered's 90 such states carry the fear, 4,290 visits each). Hazard-aware variant:
  17% death but clear 75→43% — fixed priority can't avoid AND seek; **blending dominates both
  corners**. Fear is SHALLOW (rank, not magnitude, decides argmax).
- **Replay HELPS pits** (5.7→4.5% death, K=4) — H3 falsified; rule: replay hurts iff the critical
  transition is rare in the buffer (shelter), helps when abundant/generalizing (deaths, coverage).
- **Rocks×pits super-additive** (0% + 5.7% → 25% @ 8 rocks): state POLLUTION (fear relearned per
  rock context); 48k: slow learning not a wall → first real Stage-4 relevance-filtering motivation.
- **Gauntlet: deadlines don't buy deaths** — death tracks EXPOSURE (4.3→6.7% as days lengthen),
  collapse absorbs the deadline (21→11%). Cause: INT clock and window hazard never share a state →
  conditional risk-taking inexpressible (⚠ same structure as wolves-arc health-conditional boldness).

## Branches
- `main` (pushed to origin)

## Open
- **Stage 5a wolves & goats**: settle the conjunction-state representation FIRST (joint INT×window /
  health-augmented window / learned conjunctions) — else health-conditional boldness may be
  unlearnable by construction. Then: scripted movers, combat/carcass/HP economy, speed ratios.
- Evolution (post-multi-agent): gene tiers sketched — valences first (the reward-shaping arc's
  principled answer), then γ/ε (mortality-coupled), then architecture (layers as genes).
- Replay: task-dependent map now has 3 points (sweep helps / shelter hurts / pits helps) — consider
  per-mode default or leave opt-in.
- Adaptive reach; ABM endgame (multi-agent shared worlds).

## Next action
Chris returns: review pits-arc DEVLOG entries (two, 2026-07-20/21) + decide Stage 5a conjunction
representation, then build wolves & goats.

## Blockers
- none
