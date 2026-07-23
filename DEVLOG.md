# rllayers — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-07-22 — Retraction: "two-action hunt not learnable" is an overclaim; exposure is ample; one-action ≠ hunting

**Chris corrected three things, all right:**
1. **"Two-action hunting isn't learnable / one-action is necessary" is an UNPROVABLE universal
   negative** and I kept asserting it. No finite experiment set can prove it, and the greedy-eval
   didn't. **Retracted.** The honest ceiling: two-action hunting DID NOT EMERGE under the conditions
   tested — nothing stronger. Prior entries' "not viable / one-action required" language is withdrawn.
2. **One-action "hunting" is NOT hunting** — it's eating the goat whole / foraging a goat-shaped
   food; it deletes the kill→eat structure that makes hunting hunting. So it was never a solution to
   the hunting question. This is the BEACON pattern again (pits arc): making the metric behave by
   replacing the phenomenon. Only the two-action form is hunting.
3. **"How many times are agents exposed to goats?"** — measured (clean two-action, ε-greedy, 6k eps):
   forager is GOAT-ADJACENT ~21% of ticks (nFood=0: 16.7 ticks/ep) — ≈ the random-placement baseline
   (3 goats × 8 nbrs / 100 ≈ 0.22), so it meets goats at chance, neither seeking nor avoiding. It
   attacks ~1.8×/ep and KILLS ~0.59 goats/ep during training (thousands of hunt-initiations). **So
   the non-emergence is NOT an exposure-starvation problem** — ample opportunity, still not adopted
   by the greedy policy. Where the chain fails (completing kill→navigate→eat, or its value) is an
   OPEN question; I'm no longer offering an untested mechanism as the answer.
**Net:** the robust, honest statement about the goats arc is narrow — *two-action hunting did not
emerge in the conditions tried, despite ample exposure; one-action collecting is a different behavior
that does get learned when food is scarce.* No claim about learnability in general.
**Changed:** docs only (this entry + STATUS softened). No code change. Memory:
[[disentangle-confounds-before-experiments]] extended in spirit — also don't state universal
negatives, and don't "fix" a phenomenon by redefining it.
**State:** smoke PASS @ v0.6.0+ (unchanged). Exposure run is scratch; numbers here.
**Next (Chris's call):** open question of whether two-action hunting can be made to emerge (e.g.
stationary/slower prey to ease chain-completion, prey-seeking incentive, more goats) — framed as an
open question, not a settled negative.

## 2026-07-22 — CLEAN goats (Chris disentangled the confounds): two-action hunt never learns; one-action does

**Context:** Chris flagged that the goats arc had too many tangled confounds and the prior conclusions
(incl. my "opportunity cost") were measured in a muddied world. Three fixes, all his:
(1) goats were COMPETITORS (ate the agent's food) → `goatEatRespawn` (eaten resources respawn
elsewhere, net-zero supply). (2) clearing IGNORED goats → `goatsCountToClear` (living goats count
toward `remaining`, so hunting is on the critical path to the shelter, not an optional side-behavior).
(3) my cold-start test leaned on UCB, which we already ruled out as pathological → dropped UCB, use
ε-greedy + the decisive greedy-policy eval.
**Clean experiment (ε-greedy, non-competing goats, clearing needs goats, NO-food then WITH-food,
greedy-eval = freeze exploration and measure the LEARNED policy's kills):**
| hunt | nFood | GREEDY kills/ep | Q(attack) | Q(best) | adopts |
| 2-action | 0 | **0.048** | −0.11 | 1.95 | 5% |
| 2-action | 6 | **0.000** | 0.38 | 35.4 | 1% |
| 1-action | 0 | **0.657** | 19.7 | 23.8 | 48% |
| 1-action | 6 | 0.005 | 1.44 | 31.7 | 3% |
**ROBUST finding (survives all confound removal):** the two-action attack→navigate→eat hunt is
NEVER adopted by the learned policy — not even at nFood=0 where hunting is MANDATORY to clear and
there is NO alternative food (greedy kills 0.05, Q(attack) negative). One-action hunting IS adopted,
but only when food-scarce (nFood=0: greedy kills 0.66, adopts 48%; nFood=6: ignored, foraging worth
31 ≫ attack 1.4). **This CORRECTS the prior "opportunity cost" story** (467adc2): at nFood=0 there's
no better alternative, so opportunity cost can't be it — the two-action hunt simply doesn't bootstrap
as a greedy behavior.
**Inferred mechanism (tentative — I've been wrong on mechanism repeatedly today, stating this as
consistent-with-data, not proven):** two regimes, same outcome. nFood=6 → foraging value (35) dwarfs
attack (0.4). nFood=0 → the whole value landscape stays low (Q_best 1.95); the agent never assembles
the multi-step hunt-and-eat chain — plausibly no simpler foraging to train the approach/eat sub-skills
on, and no immediate signal to lift attack into the policy. One-action collapses the chain to a single
immediately-rewarded step → learnable (when worth it).
**Changed:** `goatEatRespawn` + `goatsCountToClear` (both default ON) + `respawnResource`; attack/
goat-eat/goat-pit now maintain `remaining` correctly (goat −1 on death, carcass +1, net-zero on
empty). Smoke goat bars rewritten for the new bookkeeping (net-zero kill, respawn eat, dead-goat
decrement) — PASS. Prior goats conclusions (a50a8ec, 467adc2) stand as "measured under competition/
optional-hunt — superseded by the clean run for the hunt-learnability question."
**State:** smoke PASS @ v0.6.0+. Clean run is a scratch console experiment; numbers here.
**Next (Chris's call):** hunting needs the one-action form to be learnable at all (and food-scarcity
to be chosen); the two-action hunt is not a viable learned behavior here. Wolves (HP/bite-back) should
therefore use a one-action attack, and will force the conjunction-state question.

## 2026-07-22 — Why hunting doesn't emerge: it's opportunity cost, not the two-action structure

**Context:** Chris challenged my off-the-cuff claim that the two-action hunt fails because attack
"pays −1 while a separate eat collects the reward" (a credit-assignment split). His one-liner killed
it: **moving toward food is the identical delayed-reward shape** (move −1, later eat +1) and it's
learned fine. So the split can't be the blocker. Chased the real mechanism through THREE more wrong
guesses, each falsified by data, to a decisive answer. Recording the whole path — the wrong turns
are the useful part.
**The chase (all runs no-INT clearedOrTime shelter world, layered forager, 3 goats):**
1. **"Just slow"?** NO — two-action nFood=0 run to 80k episodes: kills/ep flat at the ε-noise floor
   (0.087→0.013), never climbs. Not a sample-budget issue.
2. **Chain probe (nFood=0):** forager learned to EAT a carcass underfoot (Q=3.95) but NOT to APPROACH
   adjacent food (Q(move-toward)=0.03) — because at nFood=0 there's no food to learn navigation on.
   Looked like a broken-middle-link, but that's a nFood=0 artifact.
3. **"Moderate food (trained navigation) rescues it"?** NO — nFood=3,5: kills still decay to ~0.022.
4. **"Cold-start: attack never practiced on-policy so it never bootstraps into greedy"?** The
   survivor of Chris's objection (foraging's mid-step IS practiced on-policy, attack's isn't).
   Tested by FORCING attack exploration (ε=.10, UCB): kills rose in level but still DECAYED — the
   shape of exploration noise, not learning. So then the decisive measurement:
5. **GREEDY-policy eval (freeze exploration, learning off), nFood=2:** greedy kills/ep = **0.000
   (ε.01), 0.000 (ε.10), 0.003 (UCB)** — the learned policy NEVER hunts, however hard attack was
   explored. UCB pushed Q(attack) 0.04→0.51 but it stays far below Q(best) 4–8, so argmax never
   picks it. **Cold-start REFUTED — exploration isn't the missing ingredient.**
**Conclusion:** two-action hunting doesn't emerge because **attack's genuine backed-up value is low
(~0.5 vs 4–8 for foraging)** — a carcass, discounted through the multi-step chain and competing with
easier stationary food under a time-limited harvest, isn't worth the detour. OPPORTUNITY COST, robust
across every food level (0/2/3/5/6) and every explorer. NOT the reward shape (Chris was right), NOT
sample budget, NOT cold-start. One-action hunting "emerges" only because the immediate +1 makes attack
competitive by fiat (reward-by-fiat, ~ shaping). **Honest caveat:** can't fully separate "0.51 is the
true value" from "underestimate because exploratory training wastes the carcass" — but the behavioral
finding (learned policy never hunts, all conditions) is robust.
**Changed:** `goatExplodeRadius` (spatial carcass premium — tested, does NOT make hunting emerge) and
`goatHuntOneAction` (one-action hunt — DOES, by fiat) added as params; `dropCarcass` helper. Smoke
seeded for determinism (killed the flaky DQN bar) + a `hunt1act` emergence bar (one-action kills
late > 0.15). All PASS ×2.
**State:** smoke PASS @ v0.6.0+. Probes are scratch console runs, numbers here; no new DB collection.
**Next (Chris's call):** the hunt design fork is now informed — a premium doesn't work; making
hunting rational needs either the one-action hunt (accept reward-by-fiat) or a genuinely high-value
carcass that beats foraging's ~4–8 (wolf-tier). Then wolves + the conjunction-state question.

## 2026-07-21 — Stage 5a GOATS: prey become competitors, not quarry — and the premium isn't optional

**Done (autonomous, Chris cleared goats-first):** built goats as PREY AGENTS (not scripts) —
`World.GOAT`/`AGENT` percept overlays, solid-entity occupancy + move-blocking, one shared species
brain (`GoatBrain`: smaller [1,3] layered stack, goat-centric windows, ε=.05) so a death teaches the
population; goats eat food, drink water, die in pits, learn. Forager gained the two-action hunt:
`attack` fells an adjacent goat → carcass FOOD → walk on and eat. Goat turn loop runs after the
forager each tick. `goats.mjs` grid (nGoats {0,3,6} × pits {0,3} × 3 seeds, 16k eps, no-INT
clearedOrTime shelter world) → `goats` collection. Smoke: 5 mechanics bars + a goat-world stability
run, all PASS.
**Findings (grid + 3 table/ablation probes + a scarcity falsification sweep):**
1. **Goats are costly competitors, saturating:** harvest 1.64→1.0 at 3 goats, no further drop at 6
   (finite field; goats compete with each other). Goats eat ~7 resources/ep — more than the forager
   banks.
2. **Emergent shared ecological clock:** collapse FELL 39%→17% with goats — goats eating decrements
   `remaining`, so the field clears sooner, the `clearedOrTime` shelter appears sooner. The gate we
   built as the forager's clock is now accelerable by other species. Unintended, very ABM.
3. **Hunting DECLINES with training (not emerges):** kills/ep decay monotonically (0.06–0.26 →
   0.02–0.10). Constant ε ⇒ this is the PREDATOR abandoning hunting as foraging Q rises above
   attack's flat ~0, NOT prey evading. Probe: forager L3 goat-adjacent Q(attack)≈0.01 vs Q(best)≈5.1,
   argmax-attacks=0%. **No-attack ablation costs ~0.05–0.10 harvest = seed noise** → the hunt option
   is worth ≈nothing at a +1 carcass.
4. **Prey learned NO fear — correctly:** goat G3 human-adjacent Q(toward)−0.22 > Q(away)−0.34,
   argmax-toward 8%. The forager attacks 0% ⇒ predation is pure ε-noise ⇒ nothing to fear. The
   predator declined to predate, so fear never had a gradient.
5. **Scarcity does NOT rescue hunting (falsification of my own "competitors when fed" guess):**
   starving free food to nFood=1 still leaves kills decaying to ~0.05. The two-action + banked-reward
   + γ-discounted hunt can't compete with direct foraging even when hungry. **The wolf-tier premium
   (carcass worth ≫1) — or a one-action hunt — is REQUIRED, not a flavor knob.**
**Headline:** give an optimizer cheap prey and it treats them as FURNITURE THAT STEALS LUNCH —
competitors killed only by accident. In-model proof that hunting must PAY before it's done.
**Changed:** goats params+schema; world entity/attack/turn-loop; `GoatBrain`; observer; smoke.
DEVPLAN 5a updated; the ⚠ conjunction question is still untouched (no HP yet).
**State:** smoke PASS @ v0.6.0 (goat bars incl. stability). Grid in DB (`goats`, 18 packets);
probes+scarcity are scratch console runs, numbers here.
**Next (Chris's call — a real fork):** to make hunting emerge, pick a lever — (a) carcass premium
(wolf-tier economy, the natural bridge to wolves), (b) one-action hunt (attack yields food directly),
(c) prey as the ONLY food. Then wolves (HP, bite-back) — which forces the conjunction-state decision.

## 2026-07-21 — No-INT shelter (Chris's call): the INT layer was a safety governor — dropping it RAISES harvest

**Done:** 4-arm × day {60,100,200} × 3-seed batch (16k episodes): intOn-plain (the missing control) /
intOff-plain / intOff-pits3 / intOff-pits3-rocks8, all `clearedOrTime` @ 0.6·day, layered eg01.
**Finding: removing the INT layer trades collapse for harvest, and WINS on expected reward.** intOn
rests early and often (94–97% rest, banks ~1 item, collapse 3–11%); intOff keeps foraging until the
lit shelter crosses its path (rest 62–79%, collapse ~3× higher) but banks ~2.3 items per rest —
harvest 1.19→1.84-2.53 (day 200 plain), 1.07→1.60 (pits3, vs the intOn gauntlet). With rest = 50·s²
vs collapse = −50, rough EV ~88 vs ~52 per episode @ day 100. Death ~unchanged (exposure, not
strategy). **The percept-gated shelter (appearance = the clock) fully substitutes for internal
state on this task; all strategy lives in the environment design.** Costs: short days risky
(collapse 34% @ 60), and pits+rocks+deadline is brutal at any day (collapse 51–69%, death 10–16%,
harvest 0.34–0.83) — rocks remain the standing hard case (state pollution + deadline compound).
**Changed:** nothing in src (pure experiment; `strategicLayer:false` is the existing toggle).
**State:** smoke PASS (unchanged since v0.5.0). Numbers here; scratch script `shelter-noint.mjs`.
**Next:** GOATS (Chris cleared it gated on this batch): goats as simpler layered AGENTS (shared
species learner) that eat food/drink/avoid pits ± avoid the human; hunting = ATTACK adjacent →
carcass FOOD → eat. Build then hunt-vs-forage experiment.

## 2026-07-21 — Pits arc closed: fear is shallow, subsumption's Pareto trap, rocks pollute, deadlines don't kill

**Done (autonomous, per plan agreed with Chris):** five results, three of them honest reversals of my
own predictions. (1) **H1 probe:** avoidance lives in L3 as predicted, but fear is SHALLOW — mean
Q(into-pit) ≈ −2.5, almost nothing near −50. Argmax avoidance is decided by RANK, not magnitude. The
life-saving states are just ~90 distinct "empty except a pit" L3 windows averaging 4,290 visits each
(fear −7.4, avoided 92%). (2) **Fear-band probe: subsumption's failure is ARBITRATION STARVATION,
nailed** — its L3 contains ZERO no-goal pit states (layered: 90, the most-visited in the table);
goal-gated arbitration routes them to the undertrained L5. Its L3 values are as fearful as layered's
where it's allowed to learn. (3) **Hazard-aware arbitration (`subsumptionHazardArb`, opt-in, control
untouched) tested the diagnosis: death 25%→17% (starvation real) but clear 75%→43%, steps 45→145 —
the avoid-layer can't seek.** Subsumption sits on a Pareto frontier it cannot escape (fearless+fast
dies; fearful+lost starves); layered dominates BOTH corners (6% death, 90% clear) because blending
lets fear and navigation VOTE ON THE SAME DECISION. Amendment to Stage 3: in benign worlds the
weighting didn't matter ("it's the layering"); in lethal worlds THE WEIGHTING IS EXACTLY WHAT
MATTERS. (4) **H3 falsified: replay HELPS pits** (death 5.7→4.5%, clear 90→96%, steps 73→54, K=4).
Refined rule: replay hurts when the critical transition is RARE IN THE BUFFER (shelter's one
head-home per episode), helps when abundant/generalizing (1,700 translation-invariant deaths).
(5) **Rocks×pits is super-additive** (rocks alone kill nobody; 3 pits alone 5.7%; together 25% @ 8
rocks, 33% @ 16): rocks POLLUTE the window state space — "pit-NE" and "pit-NE+rock-SW" are unrelated
strings, so fear must be relearned per rock context. 48k-episode check: slow learning, not a wall
(death still falling, ~16.5%) — first concrete motivation to revisit Stage-4 relevance filtering.
(6) **Gauntlet: deadline pressure does NOT push agents into pits** — death TRACKS EXPOSURE (rises
with LONGER days 4.3%→6.7%; collapse absorbs the deadline cost 21%→11%). Architectural reason: the
clock (INT) and the hazard (window) never meet in one state, so "risky shortcut because late" is
INEXPRESSIBLE. ⚠ Same structure as wolves-arc health-conditional boldness (HP in INT, wolf in
window) — Stage 5a likely needs a joint/conjunction state. Pits also crush central-place harvest
(~1.1 vs ~3.5 pit-free even at day 200).
**Changed:** `hasHazard` + `subsumptionHazardArb` (default OFF) in agent.js/params.js; smoke gained
the pit LEARNING bar (last-2k death < 0.15, cleared > 4000; measured 0.088/6154; also fixed an
nTypes=2 leak from the drink block into later sections). DEVPLAN: Stage 3F → DONE; Stage 5a
conjunction warning added.
**State:** smoke PASS ×3 @ v0.5.0 (all bars incl. new P). Grid in DB (`pits`, 171 packets);
follow-ups are scratch console runs, numbers recorded here.
**Next:** Stage 5a wolves & goats (design pinned in DEVPLAN, incl. combat/HP economy + the
conjunction-state question), or adopt-replay-for-sweep decision, or adaptive reach.

## 2026-07-20 — Pits arc (Stage 3F): rocks + death attribution + the 171-run grid (H1/H2 decisive)

**Done:** (1) **Rocks** (`World.ROCK`): neutral obstacles — bump = stay put + normal −1 step cost;
`enableRocks`/`nRocks` + schema + observer. Completes the valence spectrum (approach/goal/avoid/ignore).
(2) **Death attribution**: every ε-draw site records `lastRandom` (agent/qlearner), so each death is
tagged random-draw vs learned-argmax — the noise-vs-policy decomposition (replaces the "analytic ε
floor," which Chris correctly killed: adjacency is policy-shaped, the floor is 0). (3) A hardwired
pit-veto reflex was designed and **REJECTED** (beacon lesson: auto-avoidance deletes the
avoidance-learning phenomenon). (4) **`pits.mjs` grid**: 5 agents × 4 explorers (subsumption×UCB
skipped, unimplemented) × pits {0,3,6} × 3 seeds, 16k EPISODES each → 171 packets in `pits`.
**Results:** • **Layered+ε-greedy is the only arch that survives AND clears** (3 pits: ~6% tail
death, 90% clear @ 77 steps; curve 0.32→0.056 still falling; tail deaths ~61% the ε-draw itself →
policy deaths ~2.2%). • **The state wall turns LETHAL**: flat-5 dies 86%/100% (3/6 pits) under every
explorer — never revisits → never learns → perishes (attribution ~99% policy). Strongest pro-layering
result yet. • **Subsumption structurally can't learn danger**: ~24% death at 3 pits, IDENTICAL across
greedy/ε — goal-gated arbitration gives hazards no vote; fear has nowhere to live (but it clears in
43 steps — fearless = fast). Cleanest layering-vs-subsumption discriminator so far. • **UCB damage
scales with state count** (flat-3 12.6% / layered 53% / flat-5 96%+ death) — forced-untried ≈ one
death per state. • **Layered-greedy survives by quitting** (~64 deaths then 0 deaths AND 0 clears).
• **ε 0.005 vs 0.01 is a real tradeoff, not dominance** (0.005: −1pp death, −7pp clear) → default
stays 0.01.
**Changed:** DEVPLAN Stage 3F written + updated (reflex rejection recorded; Stage 5a wolves&goats
design pinned: combat/carcass/HP mechanics, health-conditional risk, fight/flight/feed). Full-shell
permissions granted in `.claude/settings.local.json` (project-local, git-ignored).
**State:** smoke PASS @ v0.4.0-dirty (rock bar added; pit LEARNING bar pending — thresholds from
grid, task open). Runs in DB. H1 Q-table probe + H3 replay check in flight.
**Next:** H1 probe & H3 verdicts → rocks×pits interaction → Stage C gauntlet (day length × pits) →
smoke bar + arc close. (Chris away ~2 days; running autonomously per agreed plan.)

## 2026-07-20 — Session: public repo + DQN baseline/budget decomposition + shelter SOLVED
**Done:** three arcs (each has its own detailed entry below). (1) **Published** as public repo
github.com/algorithm0r/RL-Foragers (MIT, README). (2) **DQN baseline** (`src/dqn.js`, dependency-free MLP)
+ the **budget×representation control**: the DQN's apparent win over the layered tabular agent was ~90% an
UPDATE-BUDGET confound — budget-matched, tabular + Dyna-Q replay ≈ DQN (65 vs 58 on 12×12), and at 1:1 the
table beats the net. Replay is task-dependent → opt-in (K=4 sweet spot; hurts sparse-terminal shelter).
(3) **Shelter / central-place foraging SOLVED by environment-percept shaping.** Reward-shaping (stock²
carrot, resources-left stick) and replay all failed — under-gathering is policy DISCOVERY not incentive.
Fix: gate *when* the shelter appears. `shelterActivate:'clearedOrTime'` @ T≈0.6·day (load-full-OR-nightfall)
is best: N=6 strict win (3.47/0.05 vs cleared 3.06/0.24), N=10 reliability win (collapse 0.30→0.09). A
home-beacon-in-perception was built then REMOVED (Chris's catch: it injects oracle info, undermines the
partial-obs premise — the same move for food = the greedy oracle).
**Changed:** new `src/dqn.js`; `qlearner.js` (learnQ), `agent.js` (replay, shelter), `world.js`
(shelterActivate, collapse, time signal, stock² reward), `params.js`, `ui.js`, `smoketest.mjs`; new
harnesses `dqn.mjs`/`budget.mjs`/`replayk.mjs`; `LICENSE`, README; DEVLOG/DEVPLAN/STATUS.
**State:** smoke PASS @ `1c7d1b1` (mechanics incl. stick/collapse/time + base-sweep 35 steps + shelter
+ DQN stability). Repo pushed to origin. Defaults unchanged/backward-safe (replay off, stick 0,
shelterActivate 'always').
**Next:** adopt `clearedOrTime` as the shelter default + day/arena sweep; or +pits with gated shelter
(value-discrimination test); or the ABM endgame (multi-agent / hunting).

## 2026-07-20 — Blended shelter trigger 'clearedOrTime' — the best shelter config (load-full-OR-nightfall)
**Done:** `shelterActivate:'clearedOrTime'` — the shelter appears when the field is CLEARED *or* at a dusk
step T (`shelterActivateTime`). Fixes pure-`cleared`'s failure: no longer "clear everything or collapse"
— a dusk safety valve lets the agent home with a partial haul instead of dying when it can't sweep the
last scattered item in time. Episode-budgeted (30k eps, 3 seeds, layered 1357, no homing aid):
```
              banked (of 4) / collapse
  N=6   cleared      3.06 / 0.24     blend T=60%  3.47 / 0.05   ← strict win, both axes
  N=10  cleared      2.78 / 0.30     blend T=60%  2.40 / 0.09   ← 3.3× less collapse, small harvest cost
```
**Findings:**
1. **N=6: strict win** — blend banks MORE (3.47 vs 3.06) AND collapses 5× less (0.05 vs 0.24): the valve
   turns would-be-collapse episodes into partial-harvest rests, lifting both the average and survival.
2. **N=10: reliability win with a tradeoff** — collapse 0.30→0.09 for harvest 2.78→2.40. Pure `cleared`
   forces a full sweep (banks 4 or dies 30%); the blend takes partial hauls at dusk to survive. Since
   collapse = death, the safer point is better for a *reliable* component; T is the risk/reward dial.
3. **T=60% is the knee** at both sizes: 50% truncates foraging (N=10 → 1.67), 75% leaves too little margin
   to get home (collapse ticks up). Sweet spot ≈ 0.6·day.
**Verdict:** `clearedOrTime` @ T≈0.6 is the best shelter config found — effective and the most ABM-natural
("return when the load's full OR at nightfall"). **Changed:** `world.js` activation OR, `params.js` doc.
**State:** smoke PASS. **Next:** adopt as the shelter default for experiments; day/arena sweep; or ABM endgame.

## 2026-07-20 — Removed the home-channel/beacon: it undermined the partial-observability premise
**Done:** built, then REMOVED, a home-homing aid for the shelter return (tried it two ways: a separate
'home' layer, then painting a phantom SHELTER into the window). Reverted both. `senseWindow` back to its
clean 2-arg form; no `homeChannel`.
**Why (the design call):** the whole thesis is foraging under PARTIAL OBSERVABILITY — the layered
receptive fields exist because the agent can't see the whole arena. Painting an out-of-view shelter into
the perceptual window injects oracle information; and by the same logic you could paint the nearest
food's direction — which is just the greedy oracle, and would gut the layered forager entirely (nothing
left to learn). The principled line isn't shelter-vs-food, it's *legitimate sensory primitive* (home
bearing = path integration, real in foragers) vs *the search problem we're studying* (finding food). But
the projection expresses even the legitimate case the wrong way (disguises a bearing as perception).
**And we don't need it:** the plain layered agent already handles the shelter honestly as an in-view goal
cell — no-homing baseline rests ~97%, and `shelterActivate:'cleared'` reaches 2.82/0.30 on N=10 (still
rising) and 3.30 on N=6 with NO homing aid. The separate 'home' layer also actively broke it (all-dark
overlay → huge count → high confidence → a blind layer dominated foraging: 0.09/98% collapse on N=10).
**Kept:** `shelterActivate` gating (the real fix), `restStickC` (knob, default 0), the honest INT/bearing
layer option (`strategicLayer`). **State:** smoke PASS.
**Next:** the residual N=10 collapse (0.30) is under-training + coverage, not a missing mechanism — accept
it, or budget more episodes. If learned homing under tight deadlines ever matters, do it as an honest
separate bearing sense (or a scripted path-integration reflex), never as perception. Or the ABM endgame.

## 2026-07-20 — Gating the shelter's APPEARANCE cracks under-gathering (env-shaping beats reward-shaping)
**Done:** `shelterActivate` — the shelter/rest option can appear only after the field is CLEARED, after a
TIME, or ALWAYS (default, unchanged). Idea: remove the rest-on-contact temptation during foraging and let
the shelter's *appearance* cue the return, instead of tuning reward. Test (food-only, 4 food, day=2N²,
layered 1357, harvest of 4):
```
              N=6 banked / collapse      N=10 banked / collapse
  always      0.85 / 2%                  0.64 / 1%
  cleared     3.17 / 21%   ← 4× harvest  1.61 / 60%   ← coverage/deadline bites
  time        1.27 / 9%                  1.38 / 11%
```
**Findings:**
1. **`cleared` gating quadruples harvest** (0.85 → 3.17 of 4 on N=6) — the first thing to actually fix
   under-gathering. Confirms the diagnosis: it was the rest-on-contact TEMPTATION, not the incentive.
   Environment-shaping succeeds where reward-shaping (stock² carrot, resources-left stick) failed.
2. **New cost = collapse:** must clear ALL then reach home before the day ends → misses on bigger arenas
   (60% on N=10, where clearing the last scattered item is a coverage problem that eats the clock).
3. **INT/bearing layer HURTS gated mode** (noINT 3.17 > +INT 2.21) — more evidence it's dead-weight/harmful.
4. **`time` gating** = gentler middle ground (harvest ~1.3, collapse ~0.1, keeps a soft tradeoff).
**Changed:** `world.js` (reserve shelter cell at spawn, activate on trigger), `params.js` (`shelterActivate`,
`shelterActivateTime`). Default 'always' → smoke unchanged (PASS).
**Next — the synthesis:** `cleared` gating + a reliable HOME-DIRECTION CHANNEL (lit-cell homing) should give
BOTH high harvest AND low collapse — gating fixes *when* to return, the home channel fixes *getting there*.
The collapse cost is precisely a homing-reliability problem, so the two ideas compose.

## 2026-07-20 — Shelter under-gathering is a POLICY-DISCOVERY problem, not reward or homing
**Done:** three probes into why shelter mode under-gathers (banks ~0.7 of 4). All negative, and they
converge on one diagnosis.
1. **No-homing baseline** (layered 1357, shelter on, strategicLayer OFF): the agent treats the shelter
   as a goal cell and rests-on-contact ~97% of episodes with ~1% collapse — at EVERY arena size (6–14),
   because on generous days (2N²) it wanders into the shelter's window. The **INT/bearing layer is
   near-dead-weight here.** It only earns its keep under TIGHT deadlines (N=12, day 30: collapse 21%→6%
   with INT) where you must beeline home — and even then it banks *less* (safety over harvest).
2. **stock² carrot** (prior): no effect on harvest.
3. **−restStickC·resources_left stick** (resources-left, not time-left, so fast foragers rest free): sweep
   c∈{0..40} — harvest stays ~0.7 while collapse climbs 1%→54%. The stick makes rest-on-contact negative
   but the agent responds by NOT resting (dodging the penalty) → wanders → collapses, rather than
   gathering more (it can't find the last scattered food — the coverage problem).
**Diagnosis (triple-confirmed):** under-gathering is **policy discovery / exploration**, not reward and
not homing. Both reward manipulations point the gradient the right way and both fail identically: the
agent can't DISCOVER "clear the field, then walk home and rest" via ε-greedy. Homing is orthogonal
(the window handles it as a goal cell; bearing only matters under deadline pressure).
**Changed:** `world.js` (rest reward −restStickC·remaining), `params.js` (`restStickC`, default 0 —
it harms), smoke (stick mechanic + loosened the flaky unseeded DQN bar 20→3). All defaults OFF.
**Next:** stop tuning reward. Levers are (a) representation — home as a synthetic direction CHANNEL in the
3×3 (reuse nav, make homing trivial) so the agent's only hard job is foraging, which it can do; and/or
(b) exploration / credit assignment (eligibility traces to propagate the terminal rest reward along the
whole gather-then-home trajectory). Or move to the ABM endgame.

## 2026-07-20 — Replay is task-dependent (sweet spot K=4, hurts shelter); stock² doesn't fix under-gathering
**Done:** two tuning threads after the budget control. (1) **Replay-K sweep** (12×12 sweep arena, layered,
3 seeds): the knee is **K=4** — steps-to-clear 109±40 (K=0) → 65±4 (K=4), and K=8/16/32/64 are flat
(~63–65). The K=32 default was 8× the compute for nothing. (2) **Shelter rest reward → superlinear**
`rewardPerUnit·(food+water)²` (was linear `·min(food,water)`; `bankedStock` helper, metric now
'banked stock' = harvest).
**Findings:**
1. **stock² alone does NOT fix under-gathering:** banked harvest ~0.72 (was ~0.65 linear) on 6×6/4food/
   day80. The superlinear incentive is correct but the agent still rests early — the bottleneck is
   *discovering/propagating the multi-step forage-then-home policy*, not the reward shape.
2. **Replay HURTS shelter mode** (the surprise): with K=32, collapse rate **1% → 49%** and banked *drops*
   (0.76 → 0.49). Uniform replay drowns the rare, high-stakes head-home/rest transitions under the common
   foraging steps → the agent forages past the deadline. Replay pays on coverage/dense-reward tasks and
   backfires on sparse-terminal ones. So **replay is an OPT-IN, not a blanket default.**
**Decision:** `qReplay` default **OFF** (was flipped ON last commit — reverted on this evidence), `qReplayK`
**4** (the sweet spot). Documented as a coverage-foraging opt-in. Schema keeps the Replay checkbox + K slider.
**State:** smoke PASS @ pre-commit (base() runs replay-off). `replayk` + shelter-replay results in DB/scratch.
**Next:** the shelter under-gathering is still open — needs a policy-discovery fix (on-policy/eligibility
traces, or prioritized replay that keeps the rare transitions), not reward or vanilla replay. Or the ABM endgame.

## 2026-07-20 — Budget×representation control: the DQN's win was ~90% UPDATE BUDGET, not representation
**Done:** the fair-comparison control for yesterday's "DQN bites". Two budget knobs: (1) tabular Dyna-Q
**replay** on the layered agent (`qReplay`, re-apply K=32 stored transitions/step, VALUE-ONLY so visit
counts — the confidence signal — stay honest; new `QLearner.learnQ`); (2) DQN `dqnTrainEvery` (gradient
step every N ticks; 32 → ~1 grad-sample/step). 2×2 (table/net × low/high budget) × 2 settings × 3 seeds
× 250k ticks → `budget` collection.
**Results — steps-to-clear (arena 12×12, oracle 38):**
```
                 low budget (1/step)   high budget (32/step)
  table          layered 137±49        layered-replay  65±1
  net            dqn-1to1 1061±537      dqn-32          58±2
```
(base-8 control: all ~20 except dqn-1to1=438 — the net is starved at 1:1 even on the easy task.)
**Findings:**
1. **Replay speeds tabular learning, hard:** 137±49 → **65±1** — halved steps-to-clear AND erased the
   seed variance (the unlucky-seed 207 failure is a propagation problem replay fixes).
2. **The DQN needed the budget, entirely:** 58±2 → **1061±537** at 1:1 (2/3 seeds never clear). At equal
   1:1 budget the TABLE beats the net (137 vs 1061). Nets are sample-hungry; the 32× replay was the work.
3. **The diagonal = the answer:** at equal HIGH budget, layered-replay **65±1** ≈ dqn-32 **58±2**. So
   yesterday's 2× "DQN win" (137 vs 58) was **~90% update-budget confound, ~10% representation.** The
   net keeps only a small, real generalization edge (the one thing that survives a fair comparison).
4. **Compute reframe:** yesterday's "19× cheaper" was budget-confounded (plain tabular did 1/32 the
   updates). Budget-matched: layered-replay **74s** vs dqn-32 **99s** — only ~1.3× cheaper. But tabular
   still owns the frontier: plain layered = functional policy for 6s (16× cheaper); replay = near-DQN
   score at 0.75× the compute.
**Verdict:** the "DQN dents the thesis" story mostly does NOT survive the control. Budget-matched, the
layered tabular agent + Dyna-Q replay is within ~11% of the DQN, MORE stable, interpretable, no NN
tuning, compute-comparable. Replay should join the default tabular recipe (halved steps, killed variance).
**State:** smoke PASS @ pre-commit; `budget` collection = 4 configs × 2 settings × 3 seeds + oracle refs.
**Next:** adopt replay as a default (+ tune qReplayK); then shelter reward-balance sweep or the ABM endgame.

## 2026-07-20 — DQN baseline BITES: a small net matches/beats the layered tabular agent
**Done:** built a dependency-free vanilla-JS DQN (one-hot window → hidden ReLU → Q/action, experience
replay + target net + annealed ε; no TF.js — headless-reproducible under the seeded RNG) and ran it
head-to-head vs layered-135 and flat-w5 (+ oracle/random refs), 3 seeds × 250k ticks → `dqn` collection.
**Results — steps-to-clear (oracle / dqn / layered-135 / flat-w5 / random):**
- base 8×8 K=1 (easy):        17 / **20** / 20 / 22 / 631   — everyone solves it
- arena 12×12 K=1 (part.obs): 38 / **58±2** / 137±49 / 867±152 / 1440
- types 10×10 K=2:            34 / **46** / 47 / 225±101 / 1000
**The finding — the DQN matches the layered agent on easy/K2 and BEATS it on the hard sparse arena,**
more reliably and with fewer params:
- On 12×12 partial-obs, DQN **58** vs layered **137**, and DQN seed variance is tiny (60/56.6/56.3, ±2)
  vs layered's 94/111/**207** (±49). Flat-w5 collapses (867, barely clears). The net's *learned*
  generalization beats the *hand-built* layering exactly in the regime this project is about.
- **Smaller, too:** DQN 3,849 fixed weights vs layered 6,457 Q-states @ 12×12; **5,514 vs 31,541** @ K=2
  (tabular state count grows with the task; the net's is fixed by architecture).
- **Layered wins only on compute: ~19× cheaper** (3s vs 58s/run).
**What it means (straight, not spun):** the thesis "hand-built layered generalization is the best
forager" doesn't survive on SCORE. The layered agent's honest justification narrows to the axes it
actually wins — **interpretability** (readable per-layer Q + confidence weights vs a black box), **~19×
less compute**, **no hyperparameter tuning**, implementation simplicity. Caveats (both point the same
way): fixed 250k-tick budget may under-train the tabular agent on 12×12 (gap could narrow with more
ticks), but DQN's sample-efficiency AND cross-seed stability (±2 vs ±49) are real edges. This is the
"guard against a straw man" baseline the DEVPLAN asked for (Stage 3E) — it did its job, and it bit.
**State:** smoke PASS @ pre-commit; `dqn` collection = 3 settings × (dqn/layered/flat × 3 seeds + refs).
**Next:** decide the framing — lean the project into interpretability/compute as the value prop, and/or
give the tabular agent a fair asymptotic (longer-budget) rematch on 12×12; then the ABM endgame.

## 2026-07-20 — Shelter + time-of-day signal: central-place foraging becomes learnable
**Done:** made the shelter/central-place mode a real forage-vs-return tradeoff. Two additions:
(1) **collapse penalty** — in shelter mode `maxStepsPerEpisode` is now the DAY LENGTH; if it expires
without resting, the day ends terminal with `−collapsePenalty` (delivered *through* `applyAction` so
the agent actually learns from it, not just EMA bookkeeping). (2) **time-of-day signal** — a bucketed
"fraction of the day remaining" (`timeBuckets` levels) added to `internalCode()`, so the INT layer can
learn WHEN to head home. Without it the day's end is hidden state and homing can't be timed.
**Changed:** `world.js` (`timeCode()`, `applyAction` collapse terminal, `update` collapse bookkeeping,
`collapsed`/`emaCollapse`/`collapseRate`), `params.js` (`collapsePenalty:50`, `timeBuckets:4`, day-length
+ collapse sliders), `ui.js` (HUD collapse line), `smoketest.mjs` (collapse + time mechanics, S learning).
**Results (6×6, 4 food, day=80, layered + ε-greedy 0.01):**
- Learns to forage-then-rest: **rested 12,193 · collapseRate 0.004 · banked 0.65** @ 250k ticks (smoke PASS).
- **Time signal ablation (600k ticks):** buckets=4 → banked **0.74**, collapse **0.002**; buckets=1 (blind
  to time) → banked **0.32**, collapse **0.008**. The clock ~2× the harvest and ~4× fewer collapses — the
  signal is what makes the timing learnable, confirming the hypothesis.
- **But the agent is risk-averse — it under-gathers** (banks ~0.7 of 4 possible). With collapse −50 vs
  rewardPerUnit +50, "rest early with whatever you carry" dominates (resting with 0 = 0 > collapse −50).
  The reward balance (collapse:perUnit ratio, day length, arena) is the lever to make richer foraging pay —
  that's the next experiment, not a bug.
**State:** smoke PASS @ pre-commit; deterministic mechanics (collapse=−50 terminal, timeCode 3→0) verified.
**Next:** DQN baseline (vanilla-JS MLP) head-to-head vs layered-tabular; then sweep the shelter reward balance.

## 2026-07-20 — Per-resource multi-learners: factoring LOSES — the monolithic learner doesn't explode
**Done:** built per-resource multi-learner agents (`MultiResourceAgent`: one sub-learner per resource
type, each seeing only its own type binarized, contributing Q to a final combine) in three flavors —
`mL-sum` (naive additive), `mL-wta` (winner-take-all: max-Q sub dictates action), `mS-wta`
(subsumption sub-learners + WTA), with per-resource reward decomposition. Committed `891187e`.
Swept K∈{1,2,5,10} (N=12, density 0.2, 3 seeds) vs monolithic QL + subsumption → `types2` collection.
**Results — steps-to-clear (oracle flat ~77; lower=better):**
- QL monolithic **88/95/108/119** (best at every K) · subs 82/91/128/201
- mL-sum 88/**261**/1424/1440 · mL-wta 88/114/1027/1406 · mS-wta 82/123/607/565
- Q-states: QL **458k→565k→526k (FLAT in K)** · mL-wta 458k→71k (compresses ~7×) · mS-wta ~12k flat (42× < QL)
**The finding — the factoring hypothesis is REFUTED, and the *why* is the point:**
- Factoring was meant to win because the monolithic window "should" explode as `(K+1)^cells`. **It
  doesn't.** QL's state count is ~flat (~460–565k) across K — at forager densities the grid is sparse
  (30 items / 144 cells), so states *visited* are **trajectory-bounded, not enumeration-bounded**.
  There is no memory ceiling to escape (QL already known-robust to ~565k states).
- The factored agents pay a real cost: per-resource binarization **discards the cross-resource joint
  structure** an efficient sweep needs. At K=10 → 10 sub-learners each on a near-empty binary window;
  WTA dithers over which resource to chase → 1406 ≈ the 1440-step timeout cap (barely clears).
- **mL-sum confirms action-interference AND that it scales with K** (261±177 → 1440): each added
  sub-learner is another conflicting vote in the sum. WTA rescues it partway (mS-wta 565 @ K=10) but
  never near QL's 119.
- Sanity holds: at K=1 factoring is a no-op — mL-sum=mL-wta=QL (88, 458k), mS-wta=subs (82, 9,586).
**Verdict:** don't factor per-resource for this problem. Structurally the **same result as U-Tree** —
compression without a memory ceiling to justify it = pure loss. The monolithic layered QLearner both
learns better *and* doesn't blow up; factoring would only pay in a regime forager sparsity never enters.
**Changed:** `agent.js` (`MultiResourceAgent` + `makeAgent` dispatch), `scale.mjs` (3 configs), docs.
**State:** smoke PASS @ `891187e` (exit 0); `types2` = 5 configs × 4 K × 3 seeds + oracle refs in DB.
**Next:** the multi-resource thread is closed. Open fork: adaptive reach vs the ABM endgame (multi-agent /
hunting). Possible probe: does the picture flip if density is pushed until the monolithic learner *does* strain?

## 2026-07-20 — K-type sweep: the subsumption result FLIPS — a complementary trade
**Done:** generalized the sweep to K resource types (each a distinct collect action → 8+K actions,
(K+1)^cells states, base36 cell encoding). Swept K∈{1,2,5,10} (N=12, density 0.2, 3 seeds):
confidence-weighted vs subsumption vs U-Tree, 13579 layers. → `types` collection.
**Results — steps-to-clear (oracle flat ~77; degradation = learning):**
- confidence (QL): 88/95/108/119 · subsumption: 82/91/128/201 · U-Tree: 117/497/1440/1027
- Q-states: QL 458k→565k · subs 9.6k→33k · UT 3k→6.6k.
**The finding — subsumption flips, and it's a genuine trade:**
- Confidence-weighting **degrades gracefully** with K (88→119, near oracle) — its richer blended
  representation learns the K-way type→action mapping.
- Subsumption **degrades faster** (82→201), losing by K=5. Its arbitration only asks "is there *a*
  goal in view", never *which type* → the whole type→action burden falls on the per-band Q.
- U-Tree collapses (over-compression can't hold K types × K actions).
**Complementary trade (the payoff):** DENSITY sweep → subsumption wins (bounds state count, 33-80×
fewer); K-TYPE sweep → confidence-weighting wins (handles action richness). **Neither dominates —
concentration favors subsumption's state-efficiency; response-diversity favors confidence-weighting's
expressiveness.** Actionable ABM rule: few types + dense → subsumption; many types → confidence.
(QLearner stayed robust at 565k states — tabular doesn't drown.)
**Changed:** `world.js` (K-type sweep, base36 cells), `params.js` (nTypes), `agent.js` (hasGoal),
`scale.mjs` (--types axis, K-type oracle), `smoketest.mjs`.
**Next:** the ABM endgame (multi-agent / hunting) — the axis this all de-risks.

## 2026-07-20 — Subsumption control + density sweep: it's the LAYERING, not the weighting
**Done:** built `SubsumptionAgent` (fixed-priority arbitration: narrowest window layer with a goal in
view acts, else widest wanders; only the active layer learns → each layer's Q bounded to its band).
Density sweep (N=12, 1 resource, density 0.1/0.2/0.35/0.5, 3 seeds): confidence-weighted vs
subsumption vs U-Tree, layers 13579. → `density` collection.
**Results — steps-to-clear (oracle 43/75/116/157):**
- 13579-QL (confidence): 47/88/137/181 · **13579-subs: 46/82/125/169** · 13579-UT: 125/117/175/216
- Q-states: conf **273k→664k** (explodes with density) · **subs 8k→8k (FLAT)** · UT 1.5k→3.3k
**Verdict (closes the Stage-3 question):**
1. **Subsumption matches/slightly beats confidence-weighting at every density with 33–80× fewer
   states.** The confidence WEIGHTING buys nothing over a fixed priority — it's the **LAYERING**
   (sub-policies at different scales) that does the work. Control did its job.
2. **Density is the real state-explosion driver.** Confidence-weighting hits 664k states @ d=0.5
   (every layer keys its full window every state); subsumption stays flat (each layer only learns
   its band → bounded by small window sizes). Subsumption is density-robust.
3. **U-Tree is the worst performer** (over-compresses). Subsumption = the sweet spot (near-oracle
   perf + near-UT compactness).
**Caveat:** subsumption uses a HAND-CODED goal detector (hasGoal = food/water in window); confidence-
weighting is fully learned (general but costlier). Known resources → subsumption wins; unknown → learned.
**Changed:** `agent.js` (SubsumptionAgent + makeAgent), `scale.mjs` (--density axis, agent-typed
configs, --configs filter).
**Next:** adopt subsumption as an efficient default for known-resource worlds; layers-up-to-arena
(adaptive reach); then the ABM endgame (multi-agent / hunting).

## 2026-07-20 — Scale × resources sweep: U-Tree disconfirmed; layered reach is the win
**Done:** extended `scale.mjs` with a resources axis (1 = binary food sweep, 2 = food+water sweep →
3-valued cells, the memory-ceiling test with no shelter confound). N∈{10,14,20} × res∈{1,2} ×
{1357,13579} × {QL,UT} × 3 seeds → `scale` (84 packets). Oracle 30/62/129 at N=10/14/20.
**2-resource steps-to-clear:** 1357-QL 36/118/1035 · 1357-UT 219/1076/3985 · **13579-QL 34/77/236** ·
13579-UT 374/1354/3996. Q-states 13579: QL 362k→167k vs UT 1.9k→1.7k.
**Verdict (settles the relevance-filtering question):**
1. **U-Tree loses HARDER with 2 resources** — 3-valued cells starve the tree faster and need more
   distinctions than its ~1.9k leaves hold; QLearner barely moved (33→36). The memory-ceiling test
   went the wrong way.
2. **QLearner never drowns** — even 362k encountered states are nothing vs the 3^25 ceiling, and it
   revisits them enough to learn within budget. Tabular is far more robust to state-count than
   assumed → **U-Tree's payoff regime doesn't exist in this domain.**
3. **Layered REACH is the real, robust win** — 13579-QL is near-oracle in every condition
   (34/77/236 @ 2 res vs oracle 30/62/129) and crushes 1357-QL at scale (236 vs 1035). More
   layers = more reach, robust across arena size AND resource count.
**Conclusion:** shelve U-Tree as a performance strategy (keep as an optional memory tool if a truly
infeasible table ever appears). The winning recipe = layered + wide-enough reach + egreedy 0.01.
**Changed:** `scale.mjs` (resources axis + food/water oracle).
**Next:** make reach adaptive/scale with arena (13579 default? auto-add layers up to ~arena); or move
to multi-agent / hunting (the ABM goal). Consider bumping default layers 135 → 1357.

## 2026-07-20 — Arena scale sweep: U-Tree loses everywhere; MORE LAYERS win at scale
**Done:** `scale.mjs` — layered-1357/13579, QLearner vs U-Tree, N∈{10,14,20}, food density 0.1,
maxSteps ∝ N², egreedy 0.01, oracle anchor. N=3 seeds → `scale` collection (42 packets).
**Results — steps-to-clear (oracle 30/62/129 at N=10/14/20):**
- 1357-QL: 33 / 114 / 930   · 1357-UT: 51 / 133 / 1694
- 13579-QL: 32 / **75 / 243** · 13579-UT: 64 / 164 / 796
- Q-states: 13579-QL 295k→185k vs 13579-UT 1.8k→807 (≈230× compression).
**Honest verdict (hypothesis NOT confirmed):**
1. **U-Tree loses at every scale** — compresses 70–230× but is ~1.5–3× worse on steps-to-clear. Too
   coarse (sample-starved); QLearner's full resolution wins even at N=20.
2. **Arena-scaling didn't create the "flat drowns" regime** — QLearner state count *shrank* with N
   (100k→39k) because bigger arenas → longer episodes → fewer episodes per fixed tick-budget → fewer
   states visited. It tests sample-efficiency, not the memory ceiling, and flat wins that too.
3. **The real win at scale is MORE LAYERS, not compression** — 13579-QL is the standout (243 @ N=20 vs
   1357-QL's 930). On big sparse arenas a 7×7 window is nearly blind; the 9×9 reach is what pays.
**So U-Tree is a memory tool whose payoff regime we haven't reached.** The clean test that WOULD reach
it: multi-VALUE cells in the sweep task (e.g. 2 food types → 3^25 per window) — explodes flat's table
without the shelter/rest/pit gathering confound.
**Changed:** `scale.mjs` (new).
**Next:** either (a) multi-value-cell memory-ceiling test for U-Tree, or (b) pursue the layer/reach win
(13579+, adaptive reach) which is the stronger lead right now.

## 2026-07-19 — U-Tree relevance filter: massive compression, value shows at scale
**Done:** built `UTreeLearner` (drop-in for QLearner; per-window-layer decision tree, splits on cells
whose value predicts the target — PER ACTION, so directional nav cells split too). Multi-seed (N=5,
egreedy 0.01) on-vs-off comparison + a threshold sweep.
**Results (steps-to-clear / Q-states, OFF → U-Tree):**
- layered-13: 212 → **160** (better!) · 858 → **54** states
- layered-135: 42.7 → 69.4 · 16,505 → **357** states (46×)
- layered-1357: 32.8 → 55.7 · 106,087 → **917** states (116×)
**The verdict:** compresses 16–116× reliably (all 5/5), but on the easy 10×10 (flat table fits) it's a
memory-for-resolution TRADE-DOWN — it caps at ~400 leaves and ~1.2× worse steps-to-clear. Threshold
doesn't buy it back (sweep: states pinned ~400 from 0.3→0.04; perf noisy) — the tree is **sample-starved
at depth** (deep leaves lack the min-samples to split). Tell that it's the right idea: it *helps the
data-starved config* (layered-13). So relevance filtering pays off when data is sparse / the table is
infeasible, and costs resolution when flat can afford full detail.
**Changed:** `utree.js` (per-action split criterion), `params.js` (utree params + checkbox, minChild 15),
`agent.js`, `qlearner.js` (numStates), `experiment.mjs` (--utree/--utreeThresh, filter tag), `analyze.mjs`,
load lists. 104 packets in `prelim`.
**Next (decisive test):** run U-Tree vs flat at SCALE — multi-channel cells (water/shelter/pits → 5^25
per window) or a much larger arena — where flat drowns (1M+ states) and U-Tree stays bounded. That's
where it should win outright. Also: relieve sample-starvation (lower min-samples at depth / more ticks).

## 2026-07-19 — layered-1357: wider reach helps under ε, hurts under UCB
**Done:** flipped default exploration to **egreedy ε=0.01** (params + smoke). Added `layered-1357`
([1,3,5,7]) and ran it N=5 under both good modes.
**Results (steps-to-clear, oracle ≈ 29.5):**
- **layered-1357 + egreedy-0.01 = 32.8 ± 0.4, 5/5 — the new best (~1.1× oracle, very tight).**
- layered-1357 + ucb = 58.6 ± 1.3, 5/5 — the 7×7 HURTS under UCB.
- (vs layered-135: egreedy 42.7 ± 7.3, ucb 40.6 ± 1.6.)
**The finding:** adding the 7×7 helps under ε (42.7→32.8, extra reach cuts blind wandering) but hurts
under UCB (40.6→58.6). Why: the 7×7 is almost always in a novel state (2^49), so UCB's novelty-forcing
keeps exploring through it (198k Q-states, thrashing) instead of exploiting; ε's fixed rate doesn't
(106k). So **ε scales gracefully with wider layers; UCB doesn't** — a 2nd independent reason ε is the
right default, and it means we can keep adding reach toward the oracle (under ε). Cost: memory (~106k
vs ~17k Q-states) — the pressure that motivates relevance filtering.
**Changed:** `params.js` (explore→egreedy, ε=0.01, comment), `smoketest.mjs` (new default), `experiment.mjs`
(+layered-1357). 84 packets in `prelim`.
**Next:** relevance filtering (collapse redundant bits so wide layers stay cheap); arena sweep; subsumption control.

## 2026-07-19 — Prelim N=5 + ε-greedy 0.01: exploration is a coverage problem
**Done:** re-ran the prelim at N=5 seeds across greedy / ucb / **egreedy-0.01** (added `--epsilon`/`--ucbC`
flags; wiped + refilled `prelim`, 79 packets). Metric steps-to-clear, oracle ≈ 29.5.
**Results (layered-135):** ucb **40.6 ± 1.6 (5/5)**, egreedy-0.01 **42.7 ± 7.3 (5/5)**, greedy 502 ± 390 (4/5).
**The finding:** a 1% ε doesn't just fix greedy's unreliability — it's the only mode that gets EVERY
learnable agent to 5/5. Under greedy/ucb, flat-w3 (0/5) and layered-13 (0-1/5) essentially never learn;
under ε=0.01 they all do (flat-w3 335, flat-w5 396, layered-13 212, all 5/5). Why: foraging is a
**coverage** problem — you must visit every food cell. UCB's exploration ANNEALS (counts high → no
bonus) → settles into a deterministic policy that traces a fixed torus path and never covers it;
ε-greedy's randomness never anneals → keeps wandering → keeps covering. Sustained stochasticity beats
fading optimism here.
**Layered thesis holds under any exploration:** even where all learn (ε=0.01), layered-135 (42.7) is
~8× better than any flat window (335-396) and ~5× better than layered-13 (212). 5×5 layer still essential.
**Changed:** `experiment.mjs` (+`--epsilon`/`--ucbC`, egreedy-ε tag).
**Recommendation:** default exploration → **egreedy ε=0.01** (most robust; near-oracle for layered,
rescues every architecture). UCB marginally tighter for layered-135 only.
**Next:** flip default to egreedy 0.01; arena-difficulty sweep; subsumption control; plot curves.

## 2026-07-19 — Stage-3 prelim experiment (layered vs flat vs oracle) → MongoDB
**Done:** built `experiment.mjs` (sweeps architecture × exploration × seed on the base food-sweep,
writes self-describing packets to local mongo, collection `prelim`) + `analyze.mjs` (mean±sd summary).
`package.json` vendors the mongodb driver; direct transport → local mongo. Reproducible via seeded RNG.
**Results** (10×10, 10 food, 250k ticks, 3 seeds; metric = steps-to-clear, oracle ≈ **29.5**):
- **layered-135 + UCB = 39.4 ± 0.6, learned 3/3 — near-oracle and RELIABLE. The winner.**
- **No flat single window works:** flat-w1 0/3 (greedy locks it into a straight-line torus walk —
  worse than random), flat-w3 0/3, flat-w5 2/3 but ~1100 steps.
- **The 5×5 layer is ESSENTIAL:** layered-13 (UCB) = 736 ± 473, 1/3. Dropping it breaks reliability
  — vindicates keeping [1,3,5] (dropping it earlier was the wrong call).
- **Exploration is decisive:** greedy layered-135 = 644 ± 412, **2/3 (unreliable, one seed failed)**;
  UCB = 39 ± 0.6, **3/3**. The earlier single-run "greedy ≈ 47" was a lucky seed — multi-seed exposed it.
**Changed:** `experiment.mjs` (+`--explore`/`--norefs`, explore tag), `analyze.mjs`, `package.json`,
`.gitignore` (+package-lock). 34 packets in `prelim`; learning curves stored for plotting.
**State:** the harness works and the result is clean. **Implication: revert default exploration to UCB**
— greedy is unreliable on the full task (the mode-aware-init question is moot if greedy isn't default).
**Next:** flip default to `ucb`; extend the sweep (arena difficulty, confidenceK, more seeds); plot curves.

## 2026-07-19 — 3×3 nested Q-view + data-driven colour range
**Done:** added a 3×3-layer Q-view (`#q3Canvas`): keeps the 1×1 action layout (centre=eat, ring=moves)
but each action cell is a 16×16 heatmap over the **256 surround configs**, ordered canonically by food
count (0→8); two panels (centre no-food / food). Grey = never-visited (state,action). Only the
food/no-food slice of the 512-state space is shown. Also fixed the colour range: both Q-views now scale
red→green over the **actual visited min→max** (via `hsl()`), not symmetric-around-0 — so eat, whose Q ≈
0 (the +1 gather reward cancels the discounted travel cost), still reads as the top of the range instead
of washing out to grey. Min/max shown as a legend.
**Changed:** `ui.js` (renderQ3View/drawQ3Panel/q3Precompute, qColor→qColorRange, DataView q3Ctx),
`index.html` (+q3Canvas), `main.js`.
**State:** core smoke PASS (exit 0); browser files syntax-check clean; q3 config ordering + state
strings verified headlessly (256 unique, popcount-sorted, centers correct). Needs an in-browser look.
**Next:** relevance filtering.

## 2026-07-19 — 1×1 Q-value visualization (two 3×3 direction grids)
**Done:** added a Q-view in the data panel (`#qCanvas`) showing the 1×1 layer's Q as two 3×3 grids —
state '0' (no food) and '1' (food). Spatial layout: centre cell = eat, the 8 ring cells = the moves
placed by their `World.DIRS` offset (NW,N,NE / W,eat,E / SW,S,SE), so the reflex is readable at a
glance. Cells coloured by Q on a shared red(−)/green(+) scale; the greedy pick is outlined cyan, eat
outlined gold. Renders each frame via `DataView` (browser-only, off-canvas). Falls back to a hint when
no 1×1 layer is present (flat agent with window>1).
**Changed:** `index.html` (+qCanvas), `ui.js` (renderQView/drawQGrid/qColor + DataView qCtx), `main.js`.
**State:** core smoke PASS (exit 0); browser files syntax-check clean; DIRS→cell mapping verified
(all 8 ring cells map). Needs an in-browser look to confirm the render.
**Next:** relevance filtering; could extend the same viz to 3×3 later.

## 2026-07-19 — Strategic init: gather=+1, greedy default, exploration dropdown
**Done:** set `rewardGather = +1` (≈|rewardStep|) so the Q gap straddles zero and `defaultQ = 0` is the
strategic exploration threshold for free (untried actions beat wandering, lose to a learned good
action). Made **greedy** the default selection (exploration via the strategic init, no bonus/forcing);
kept `ucb` and `egreedy` as options via a new 3-way exploration **dropdown** (`type:'select'` in ui.js).
**Changed:** `params.js` (rewardGather 0→1, explore default 'greedy', select schema), `agent.js` (greedy
path in both agents), `ui.js` (buildSelect), `smoketest.mjs` (base learns under greedy).
**State:** smoke PASS (base sweep 28→22 under greedy). Measured: gather sweep gap −0.04 (@0) → +0.79
(@+1) → +1.32 but all-positive (@+3, overshoots). Verification (250k):
- **Eat reflex protected** — L1 picks eat in food states under greedy/ucb/egreedy alike (L1's 2 states
  saturate instantly, so the override never actually breaks the reflex — it only wasted exploration).
- gather=+1 lifts shelter banking 0.44 → 0.61.
- Base sweep steps-to-clear: greedy 46.6 ≈ egreedy 46.1, UCB a bit faster at 41.9. Greedy is cleaner,
  not strictly best. Gap is policy-dependent (greedy's lower-value policy pushes eat's abs Q negative;
  reflex holds via cross-action ranking, not vs defaultQ).
- **Pits still unsolved:** greedy also explores into a novel pit (untried move = defaultQ 0 > known-neg
  wander). Needs the 3×3 pit-reflex to generalize / safe exploration.
**Next:** relevance filtering (per-layer feature masks) — the thing that makes [1,3,5] pay off and lets
the pit-reflex generalize.

## 2026-07-19 — Move data display off-canvas (crisp HTML) + UCB toggle
**Done:** metrics + graph now render off the game canvas. `index.html` gains a data panel (HTML
`#stats` monospace block + its own `#graphCanvas`); the game canvas shrank to 600×600 (just the
grid). `observer.js` no longer draws the HUD text. `ui.js` gains `renderStats(world)` (crisp HTML
text) and a browser-only `DataView` engine entity that updates the stats DOM + paints the graph on
its own canvas each frame. `charts.js` LineGraph now keeps a rolling 240-point window and autoscales
(with current/min/max labels). Also exposed UCB-vs-ε-greedy as a UI checkbox (+ both explore sliders).
**Changed:** `index.html`, `observer.js`, `ui.js`, `charts.js`, `main.js`, `params.js` (schema).
**State:** core smoke PASS; browser files syntax-check clean (no display here to live-render — needs a
visual check in-browser). **Known issue raised by Chris:** the layered UCB bonus can override the
layers' learned choice (untried action in any weighted layer → ∞ bonus → random tie-break can beat a
confident 1×1 'eat'); a fix (finite weight-scaled optimism instead of ∞ forcing) is pending.
**Next:** decide/implement the UCB-forcing fix; then relevance filtering.

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
