# rllayers — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-21 — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-18 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
**Stage 5a (goats) — built, first batch done** (autonomous, per Chris's clearance while away). Goats
are PREY AGENTS on a shared species brain; the forager got a two-action ATTACK→eat hunt. Headline:
**cheap prey become competitors, not quarry** — the forager ignores them and forages the free food;
hunting must PAY (premium or one-action hunt) before it emerges. Prior arc: Stage 3F (pits) DONE —
lethal worlds, layered+ε-greedy alone survives and clears. Next: Chris picks the hunt-payoff lever,
then wolves (HP/bite-back → forces the ⚠ conjunction-state decision).

## State
`GridForager` toggles: food sweep · +water · +shelter (gated `clearedOrTime`) · +pits (death) ·
+rocks (block) · **+goats (prey agents, NEW)**. Agents: flat / layered / subsumption (+opt-in
`subsumptionHazardArb`) / multis / DQN. **Goats:** `GoatBrain` shared species learner (layers [1,3],
ε=.05), `World.GOAT`/`AGENT` percept overlays, occupancy map, solid-entity blocking, goats
eat/drink/die-in-pits/learn. Forager `attack` fells adjacent goat → carcass FOOD → eat. INT
(strategic) layer confirmed a safety governor and left OFF by default in shelter experiments.
smoke PASS @ v0.6.0 (goat mechanics ×5 + goat-world stability; also the pit-learning bar and all
prior bars).

## Metrics (goats arc; grid in DB `goats` 18 packets; probes in DEVLOG)
- **Competition cost saturates:** harvest 1.64 (0 goats) → 1.0 (3) → 0.99 (6). Goats eat ~7
  resources/ep (> forager's bank).
- **Emergent shared clock:** collapse 39%→17% with goats (they clear the field → shelter fires
  sooner). The `clearedOrTime` gate is accelerable by other species.
- **Hunting doesn't emerge — mechanism = OPPORTUNITY COST** (nailed 2026-07-22 after Chris killed
  my credit-assignment guess: moving is the same delayed-reward shape and IS learned). Attack's
  learned value stays ~0.5 vs foraging 4–8; greedy-eval shows the learned policy NEVER hunts even
  after UCB forces attack exploration (cold-start refuted). NOT the two-action shape, NOT budget, NOT
  exploration. Spatial 9-food carcass premium (`goatExplodeRadius`) does NOT fix it; only the
  one-action hunt (`goatHuntOneAction`) makes hunting emerge, partly by fiat (immediate +1).
- **Prey learn no fear — correctly** (Q toward human −0.22 > away −0.34; predation is ε-noise).
- **Scarcity doesn't rescue hunting** (nFood 6→1, kills still decay) → two-action+banked+discounted
  hunt loses to direct foraging even when hungry. Premium/one-action hunt REQUIRED.
- Prior (pits, in DB `pits` 171 packets): layered+ε-greedy alone survives AND clears; flat-5 wall
  turns lethal; subsumption can't learn danger (arbitration starvation); in lethal worlds the
  confidence WEIGHTING is what matters. No-INT shelter: dropping INT trades collapse for harvest, EV+.

## Branches
- `main` (pushed to origin)

## Open
- **Hunt-payoff lever (Chris's fork, now informed):** a premium alone does NOT work (opportunity
  cost — carcass value < foraging's 4–8 even at 9-food burst). Real options: (a) one-action hunt
  (`goatHuntOneAction`, accept reward-by-fiat), (b) carcass genuinely worth > foraging (wolf-tier),
  (c) prey as sole food (but nFood=0 also breaks forage-navigation training). Decides quarry vs
  competitor.
- **Wolves (5b):** HP, bite-back, ~3-bite death → forces the ⚠ conjunction-state decision (health×
  window; the pits gauntlet proved factored INT+window can't express conditional-risk policies).
- Evolution (post-multi-agent): gene tiers sketched — valences first, then γ/ε, then architecture.
- Rocks remain the standing hard case (state pollution); Stage-4 relevance filtering the likely fix.

## Next action
Chris returns: review the two 2026-07-21 DEVLOG entries (no-INT shelter, goats), pick the hunt-payoff
lever, then build wolves.

## Blockers
- none
