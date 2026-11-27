# Verification report

Checked on Node 22 and headless Chromium (software WebGL, 1280×720, 16–27 fps). This report
describes the build as it stands: individual people and family lines, ideas, customs, crops,
bridges, disasters, the god's exit and return, and settlement stages.

## Automated: `npm test` — 29 of 29 pass (about 100 s)

| What | How | Result |
| --- | --- | --- |
| Both elevations work and differ | one floodplain and one ridge field, 200 seeds × 10 years | floodplain yield 3.0 vs ridge 1.7; floodplain crop loss > 8% of plantings, ridge < 1% |
| Every jump length takes 30 s and lands on the exact year | `Playback` driven by synthetic clocks at 144, 60, 24 and 4 fps and an irregular frame time | lands on year + N with exactly N × 4 ticks, on the first frame at or after 30 000 ms |
| No early finish; a stalled tab still lands | clock sampled at 14 999, 29 999 and 90 000 ms | ticks equal the formula; finishes only at ≥ 30 s |
| Frame rate and split jumps do not change the result | fingerprint after 111 years direct, as 1 + 10 + 100 played back, and as 100 + 10 + 1 | identical, 5 seeds |
| Same seed + same decisions = same result | scripted five-visit run twice; and a run with practices and customs set, 60 seeds × 300 years, against a twin | identical fingerprints |
| Odds estimates leave the live simulation untouched | fingerprint and RNG state before and after 40 trial futures, then 50 more years against a twin | identical |
| Unfarmed village collapses early | 200 seeds, no actions | all collapse; half by year 6, 95% by year 11, the last by year 15 (hunting carries them slightly longer than before) |
| Collapse inside a 1,000-year jump | lowland-only village | one collapse event, year fixed, state reaches year 1,000 with fields overgrown and houses fallen |
| Recovery traceable to the player | ridge store + demonstration + carried seed, 100 years | post-flood replanting recorded with the store's builder and year, worked by a household taught by the demonstration |
| Mixed farms + ridge store beat lowland-only | 80 seeds per strategy to year 500 | passes by more than 10 points over lowland + teaching and 25 over lowland only |
| Stages up to the Hold | 60 seeds × 2 strategies | in a living Hold every household is housed in it and every grown person holds every idea it knows |
| Weather and disasters | 120 seeds × 1,211 years | rain, landslides, tornadoes, smoke and eruptions occur and do damage; some collapses are attributed to them; every eruption follows exactly 3 years of smoke |
| Work has no count limit, costs food | clear every site in one visit | more than three fields built; the store is refused once food is short; free decisions still work |
| Every practice, custom setting and crop matters | fixed opening + one extra decision, 60 seeds × 311 years, 27 variants | all give different futures from the baseline and from each other |
| People are born, marry between houses and die; lines mix | 30 seeds × 80 years | births and weddings occur, spouses are mutual, everyone lives in a house, nobody passes 110, and all but at most one surviving village has people of mixed lines |
| A planned match produces a new idea, traceably | one house keeps drying, another stone; promise a child of each; 60 years | the pairing is listed as able to reach the sealed granary; the promise is kept; the sealed granary is worked out by one of the pair or their child, and the betrothal is in the action log |
| Ideas die with their last holder; teachers spread them; houses move | single old keeper, 20 seeds; teacher vs none, 40 seeds | lost when the keeper dies in at least 3 of 20; more holders with a teacher; a move costs 2 food |
| Bridges are planned at once and built over years | each kind planned on 40 well-fed seeds, 60 years | nothing stands when planned; far bank unreachable until built; earliest finish = 1 year (footbridge), 6 (timber); stone never earlier than 25 |
| Small bridges are lost more, and strand crops | each kind standing, well-fed, 40 seeds × 80 years | losses: footbridge > 2× timber > 2× stone; the footbridge strands the most far-bank crops |
| A hungry village puts bridge work off | timber planned, 30 seeds, one year with 8 food vs 400 | no progress in any hungry year; progress in every fed one |
| A stone bridge stalls without stone-builders | plan it with nobody knowing stone, then teach it | no progress and a stall notice; work starts once someone knows it |
| Felling and clearing | fell, re-fell, clear; west forest with and without a bridge | timber and food accounted for; felled ground stays forest ground; cleared ground is a field; the west forest is refused without a bridge |
| Regrowth and running out | one stand felled among neighbours vs the whole east forest felled, nobody cutting, 60 and 200 years | the single stand regrows past 8 of 10; the bare forest stays at 0, is reported gone once, and its game is 0; the west forest is untouched |
| Forest customs change the outcome | default vs greedy (fell nearest, hunt everything, always clear) vs careful (hunt lightly, never clear), 40 seeds × 311 years | greedy leaves less east forest and hunts game out more often; careful leaves more game |
| Timber and firewood matter | fed villages with and without any timber, 30 seeds × 25 years | no houses founded without timber, more than 20 with; deaths more than 20% higher without firewood |

## Headless balance run: `npm run sim -- 100`

100 seeds, jumps 1 + 10 + 100 + 100 + 1,000 = 1,211 years. The scripted players take three
actions a visit so the rows stay comparable; the game itself has no cap. About three minutes.

| Strategy | Median years | ≥ 10 y | ≥ 100 y | ≥ 500 y | ≥ 1,211 y | Reached the Hold |
| --- | --- | --- | --- | --- | --- | --- |
| No farms | 6 | 13% | 0% | 0% | 0% | 0% |
| Lowland only | 10 | 52% | 2% | 1% | 1% | 0% |
| Lowland + teaching | 19 | 71% | 26% | 18% | 16% | 0% |
| Ridge only + teaching | 410 | 99% | 64% | 48% | 38% | 0% |
| Mixed, no ridge store | 83 | 85% | 44% | 32% | 32% | 0% |
| Mixed + ridge seed store | 73 | 89% | 42% | 40% | 37% | 0% |
| Mixed + store + the five other base ideas | 93 | 91% | 49% | 46% | 46% | 11% |
| … + footbridge planned | 125 | 94% | 53% | 49% | 49% | 34% |
| … + timber bridge planned | 1,211 | 94% | 57% | 52% | 52% | 24% |
| … + timber, then stone bridge | 126 | 94% | 53% | 48% | 48% | 36% |

With 100 seeds each figure carries several points of noise. What they show now that forests are
in: survival is about where it was (mixed farming with ridge seed storage stands at year 500 in
40% of seeds against 1% for lowland-only), and early years are a little kinder because hunting
adds food. The Hold is much rarer, because growth needs timber: nobody reaches it without
teaching the other ideas, 11% do with them, and 24–36% do with a bridge, which opens the west
forest. No scripted player changes the forest customs.

An earlier version let the village pay for bridge work in years it could not feed itself; a
full browser playthrough showed a village starving while it built. Bridge work now waits until
the stores cover three-quarters of the coming year.

Tuning done from these runs over the build: opening food 14 → 26; departures per hungry winter
softened; ridge seed kept as a reserve; villages copy a ridge field once they have seen one;
disaster chances lowered twice; per-person food set so six founding families eat about what six
households did before.

## In the browser

Real key presses throughout, no console errors in any run.

- **Full five-visit playthroughs (before the people rebuild).** Three runs: every jump length
  took 30.1–30.3 s and landed on the exact year; interventions were refused during playback;
  a collapse in year 51 of a jump to 1,011 played on to the end and scored 51 years.
- **The god's exit and return.** Blue beam and sparks on commit; playback clock 30.1–30.2 s
  (about 31.2 s from commit, including the one-second departure); on a collapse the camera
  pushed in, the god said "Nope. Not like that. They only made it 6 years.", Try again showed
  "Maybe I could…", the screen wiped to black and a new valley appeared at year 0.
- **Disasters.** Tornado + landslide + heavy rain in one year; an eruption with lava, ash and
  mudflow that ended a village; a landslide. (Taken at the earlier, higher disaster odds.)
- **Decisions.** Fields cleared until food ran out; a practice demonstrated; customs changed;
  a crop changed by key and by button.
- **People.** The People panel, a house panel, the match list with "their children could work
  out…", a promise, a teacher's calling and a house move all worked; after a 100-year jump the
  village had 133 people in 29 houses, 11 family lines, and had worked out seed jars.
- **Full playthrough after people and bridges (seed 7).** Four fields and the ridge store built,
  three ideas demonstrated, a timber bridge planned; jumps of 1, 10 and 100 years each ran
  30.10–30.15 s on the playback clock and landed on the exact year; every intervention tried
  during playback was refused; the timber bridge stood by year 11 and drew correctly with a
  villager on its deck; the village collapsed in year 27 and the verdict read "They only made
  it 27 years." The odds panel had given that jump 20%. (Run before the bridge-reserve rule.)
- **God-only play and the new interface.** The player is the god actor from the first frame;
  Q and Tab do nothing; `E` at a staked site cleared a field ("You cleared a floodplain
  field."); `2` changed its crop; `T` then `1` taught seed saving to 11 people in three houses;
  the People, Customs, Bridge, Controls and Step out tabs opened by key and `Esc` closed them;
  the god was absent during playback and every action tried then was refused; the playback
  clock read 30.16 s; he reappeared at the destination and visit 2 began. Screens checked by
  eye: start, the site card, the teach list, the People and Step out tabs, and the return.
- **Forests.** Walked to the east forest, felled a stand (10 timber, 0.5 food) and cleared the
  next for a field; stumps and the new field drew correctly, with deer under the trees; the
  god stopped at x 1862 before the cliff, stopped at the river with no bridge, and reached the
  far edge of the west forest once a bridge stood; the Customs tab listed the three forest
  customs; a 1,000-year jump ran with the whole valley in frame. No console errors.
- **Bridges.** Planned a footbridge at the crossing; walking stopped at the bank with no
  bridge; after a 1-year jump the footbridge stood; walked across on the deck and cleared a
  far-bank field.

## Not covered

- The top-row labels were shortened after the forest screenshots (two were being cut off) and
  only build-tested. A forest being cut down by the village over a long jump was checked in
  the simulation, not watched.
- The bridge in the forest run was switched on directly rather than built.

- The collapse verdict, the ruins and the Customs, Bridge and Controls tabs were not looked at
  again after the interface change; the first-visit checklist's key labels were fixed after
  the last screenshot and only build-tested.
- The interface was checked at 1280×720 only.

- Only headless Chromium. Firefox, Safari and real GPUs were not tried. Sound was never heard.
- One full playthrough has been run since the people rebuild (below); it ended in a collapse at
  year 27, so no long-lived city has been watched in the browser with people and bridges.
- Bridge washouts were checked in the simulation, not watched on screen.
- The itch.io workflow has published once from `main` (run 3, after two failed attempts). The
  itch.io page itself was not looked at.
- The simulation is about ten times slower than before people were individuals: a 1,000-year
  jump for a full city takes roughly 0.8 s of compute, spread over the 30 seconds. Odds
  estimates for 1,000-year jumps therefore take noticeably longer to fill in.
- The "Still standing" result screen is unreachable in play (there is no last visit).
- Ridge-only farming still survives about as well as mixed farming.
- No scripted player sets customs, crops, matches or callings, so their balance is tested only
  for "changes outcomes", not for "is well tuned".
