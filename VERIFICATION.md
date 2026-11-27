# Verification report

Checked on Node 22 and headless Chromium (software WebGL, 1280×720, 16–27 fps). This report
describes the build as it stands: individual people and family lines, ideas, customs, crops,
bridges, disasters, the god's exit and return, and settlement stages.

## Automated: `npm test` — 24 of 24 pass (about 70 s)

| What | How | Result |
| --- | --- | --- |
| Both elevations work and differ | one floodplain and one ridge field, 200 seeds × 10 years | floodplain yield 3.0 vs ridge 1.7; floodplain crop loss > 8% of plantings, ridge < 1% |
| Every jump length takes 30 s and lands on the exact year | `Playback` driven by synthetic clocks at 144, 60, 24 and 4 fps and an irregular frame time | lands on year + N with exactly N × 4 ticks, on the first frame at or after 30 000 ms |
| No early finish; a stalled tab still lands | clock sampled at 14 999, 29 999 and 90 000 ms | ticks equal the formula; finishes only at ≥ 30 s |
| Frame rate and split jumps do not change the result | fingerprint after 111 years direct, as 1 + 10 + 100 played back, and as 100 + 10 + 1 | identical, 5 seeds |
| Same seed + same decisions = same result | scripted five-visit run twice; and a run with practices and customs set, 60 seeds × 300 years, against a twin | identical fingerprints |
| Odds estimates leave the live simulation untouched | fingerprint and RNG state before and after 40 trial futures, then 50 more years against a twin | identical |
| Unfarmed village collapses early | 200 seeds, no actions | all collapse; half by year 6, 95% by year 10, the last by year 20 |
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
| Bridges are planned at once and built over years | each kind planned on 40 seeds, 60 years | nothing stands when planned; far bank unreachable until built; earliest finish = 1 year (footbridge), 6 (timber); stone never earlier than 25 |
| Small bridges are lost more, and strand crops | each kind standing, well-fed, 40 seeds × 80 years | losses: footbridge > 2× timber > 2× stone; the footbridge strands the most far-bank crops |
| A stone bridge stalls without stone-builders | plan it with nobody knowing stone, then teach it | no progress and a stall notice; work starts once someone knows it |

## Headless balance run: `npm run sim -- 100`

100 seeds, jumps 1 + 10 + 100 + 100 + 1,000 = 1,211 years. The scripted players take three
actions a visit so the rows stay comparable; the game itself has no cap. About three minutes.

| Strategy | Median years | ≥ 10 y | ≥ 100 y | ≥ 500 y | ≥ 1,211 y | Reached the Hold |
| --- | --- | --- | --- | --- | --- | --- |
| No farms | 6 | 5% | 0% | 0% | 0% | 0% |
| Lowland only | 8 | 42% | 1% | 1% | 1% | 0% |
| Lowland + teaching | 14 | 62% | 22% | 17% | 17% | 9% |
| Ridge only + teaching | 124 | 93% | 51% | 44% | 44% | 18% |
| Mixed, no ridge store | 48 | 87% | 40% | 34% | 34% | 11% |
| Mixed + ridge seed store | 71 | 85% | 44% | 42% | 42% | 11% |
| Mixed + store + the five other base ideas | 84 | 83% | 46% | 44% | 44% | 44% |
| … + footbridge planned | 61 | 87% | 41% | 38% | 38% | 38% |
| … + timber bridge planned | 83 | 87% | 45% | 42% | 42% | 42% |
| … + timber, then stone bridge | 1,211 | 87% | 53% | 51% | 51% | 51% |

With 100 seeds each figure carries several points of noise. What they show: mixed farming with
ridge seed storage stands at year 500 in 42% of seeds against 1% for lowland-only; teaching the
other base ideas is what gets a village to the Hold (44% against 11%); a footbridge is a net
cost, a timber bridge about neutral, and a stone bridge the best long-run plan.

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
- **Bridges.** Planned a footbridge at the crossing; walking stopped at the bank with no
  bridge; after a 1-year jump the footbridge stood; walked across on the deck and cleared a
  far-bank field.

## Not covered

- Only headless Chromium. Firefox, Safari and real GPUs were not tried. Sound was never heard.
- No full multi-visit playthrough has been run since the people rebuild; the 30-second timing
  code itself was not changed.
- The bridge sprite was drawn too low in the one bridge screenshot; that was corrected
  afterwards and only build-tested. Bridge washouts were checked in the simulation, not watched.
- The itch.io workflow has never run. It assumes secret names (`BUTLER_API_KEY`, `ITCH_USER`,
  `ITCH_GAME`) that may not match the ones in the repository.
- The simulation is about ten times slower than before people were individuals: a 1,000-year
  jump for a full city takes roughly 0.8 s of compute, spread over the 30 seconds. Odds
  estimates for 1,000-year jumps therefore take noticeably longer to fill in.
- The "Still standing" result screen is unreachable in play (there is no last visit).
- Ridge-only farming still survives about as well as mixed farming.
- No scripted player sets customs, crops, matches or callings, so their balance is tested only
  for "changes outcomes", not for "is well tuned".
