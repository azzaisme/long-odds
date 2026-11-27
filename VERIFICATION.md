# Verification report

Checked on Node 22 and headless Chromium (software WebGL, 1280×720, 16–27 fps).

## Automated: `npm test` — 15 of 15 pass

| Acceptance point | Test | Result |
| --- | --- | --- |
| Both elevations work; yield and flood risk differ | plants one floodplain and one ridge field over 200 seeds × 10 years | floodplain yield 3.0 vs ridge 1.7; floodplain crop loss > 8% of plantings, ridge < 1% |
| All jump lengths take 30 s and land on the exact year | drives `Playback` with synthetic clocks at 144, 60, 24 and 4 fps and an irregular frame time | every length lands on year + N with exactly N × 4 ticks, on the first frame at or after 30 000 ms |
| No early finish, no running ahead; a stalled tab still lands | clock sampled at 14 999 ms, 29 999 ms and 90 000 ms | ticks done equal the formula; finishes only at ≥ 30 s |
| Same result across frame rates and split vs. uninterrupted jumps | state fingerprint after 111 years direct, as 1 + 10 + 100 played back, and as 100 + 10 + 1 | identical fingerprints, 5 seeds |
| Same seed + same actions = same result | full five-visit scripted run, twice | identical; different seed differs |
| Odds estimates leave the live simulation untouched | fingerprint and RNG state before and after 40 trial futures, then 50 more years against an untouched twin | identical |
| Unfarmed village collapses early | 200 seeds, no actions | all collapse; median by year 6, latest by year 15; cause "No field was ever planted…" |
| 1,000-year jump with early collapse, decay, correct score | lowland-only village through one 1,000-year run | one collapse event; `collapse.year` fixed; state reaches year 1,000 with fields overgrown and houses fallen; further years leave the record unchanged |
| Recovery traceable to player actions | build ridge store, demonstrate, carry seed, run 100 years | a post-flood replanting recorded with `storeBuiltBy: 'Ama'`, `storeBuiltYear: 0`, worked by a household whose practice has `root: 'demo', by: 'Ama'` |
| Teaching and plain-language risks | demonstrate to two households; read risks | untrained villager cannot teach; risk text includes "No working farms", "Only one household knows how to save seed", "Every farm is … flood line" |
| Mixed elevation + ridge seed store beats lowland-only | 150 seeds per strategy | passes with > 20 points' margin at year 500 |
| Growth to the Hold | 120 seeds × 2 strategies | stages reached in order; in a living Hold every household is housed in it and knows seed saving; lowland-only reaches it far less often |
| Weather and disasters | 300 seeds × 1,211 years | heavy rain, landslides, tornadoes, volcano smoke and eruptions all occur; houses are torn down and fields buried; some collapses are attributed to an eruption or tornado |
| Eruption warning | 5 eruptions followed year by year | each is preceded by exactly 3 years of smoke; ash is on the fields afterwards |

## Headless balance run: `npm run sim -- 1000`

1,000 seeds, jumps 1 + 10 + 100 + 100 + 1,000 = 1,211 years, three work actions per visit.

| Strategy | Median years | ≥ 10 y | ≥ 100 y | ≥ 500 y | ≥ 1,211 y | Reached the Hold |
| --- | --- | --- | --- | --- | --- | --- |
| No farms | 5 | 1% | 0% | 0% | 0% | 0% |
| Lowland only | 8 | 35% | 4% | 3% | 3% | 2% |
| Lowland + teaching | 16 | 66% | 24% | 18% | 18% | 14% |
| Ridge only + teaching | 200 | 97% | 60% | 45% | 45% | 35% |
| Mixed, no ridge store | 73 | 88% | 44% | 34% | 33% | 26% |
| Mixed + ridge seed store | 55 | 82% | 46% | 44% | 43% | 36% |

These figures include the weather and disaster systems. Mixed-elevation farming with ridge seed
storage is still standing at year 500 in 44% of seeds against 3% for lowland-only (18% with
teaching added). Before disasters were added the same comparison was 53% against 5%; disaster
chances were lowered twice (the second time on request: tornado 0.4%, landslide 0.5%, volcano
waking 0.1% a year). Earlier tuning from these
runs: opening food went from 14 to 22, departures per hungry winter were softened, villages were
made to keep ridge seed as a reserve rather than plant it every spring, and to copy a ridge
field once they have seen one.

## In the browser, in real time

Three scripted playthroughs used real key presses for walking, inspecting, working, switching,
planning and committing, and waited out every jump.

| Jump | Seeds run | Wall time, commit to arrival | Landed on |
| --- | --- | --- | --- |
| 1 year | 1, 7, 11 | 30.19–30.26 s | exact year |
| 10 years | 1, 7, 11 | 30.16–30.21 s | exact year |
| 100 years | 1, 7 | 30.14–30.22 s | exact year |
| 1,000 years | 1 (twice), 7, 11 | 30.12–30.18 s | exact year |

The extra 0.1–0.3 s is one rendered frame plus the test's polling interval.

- **Locked during playback.** Three seconds into every jump the script pressed Q, E, 1, T, J,
  Esc, Enter, A, D and called the build, teach, switch, plan, commit and next handlers directly.
  The action log length and the controller state did not change in any jump.
- **Work budget.** A fourth work action in a visit was refused (action log stayed at 3).
- **Switching.** Q moved control from Ama to Tobi and back.
- **Early collapse in a long jump.** Seed 11, jumping from year 11 to 1,011: the last household
  left in year 51; playback continued to year 1,011; arrival reported "51 years survived" with
  the cause, and the ruins could be walked.
- **Survive and continue.** Seed 1 ran all five visits to year 2,111: village in year 44, town
  144, city 310, the Hold finished in year 791, 58 households at the end, "Still standing".
- **Fresh run.** Starting again after each playthrough gave year 0, visit 1, six households, no
  fields, no ridge store, an empty action log and no collapse record.
- **Disasters on screen.** Three further runs after the disaster systems were added, no console
  errors: seed 977 (heavy rain, a tornado across the floodplain tearing down two houses, and a
  landslide, all in year 0 of a 1-year jump: funnel, rain and captions visible); seed 125
  (smoke in year 2, eruption in year 5 of a 10-year jump: lava on the cone, ash fall, mudflow
  flood, collapse in year 6 attributed to the eruption); seed 158 (landslide).
- **The god's exit and return.** Two runs, no console errors. Alive (seed 1, 1 year): blue
  beam and sparks at the villager on commit, actions refused during the departure, playback
  clock 30.19 s (31.24 s from commit including the one-second departure), report opens after
  the return flash, Enter begins visit 2 with three actions. Collapsed (seed 125, 10 years):
  camera at twice the normal zoom on the god, speech "Nope. Not like that. They only made it 6
  years.", Try again shows "Maybe I could…", the screen wipes to black, and a new valley with a
  different seed appears at year 0, visit 1, six households, no actions, no collapse record.
- No console errors in any run.

## Not covered

- The three full five-visit playthroughs above were run before the disaster systems went in.
  After that, only the three shorter disaster runs and the automated tests were run; the
  30-second timing code was not changed.
- The volcano was moved lower in the backdrop after the last screenshots; that position was only
  build-tested.
- The disaster screenshots were taken at the earlier, higher disaster odds.
- Median survival for the best scripted strategy fell from 1,211 to 55 years once disasters were
  added: the first decades are now more dangerous than before.

- Only headless Chromium was used. Firefox, Safari and real GPUs were not tried.
- Sound was not listened to; the code path runs without errors.
- Playback timing was measured in an active tab. A hidden tab pauses rendering; the unit test
  shows the first frame back runs the remaining ticks and lands on the exact year.
- "Ridge only + teaching" survives about as often as mixed farming, because villages start
  clearing floodplain fields on their own. Drought is the only thing that punishes ridge-heavy
  farming and it could be made sharper.
- After visit 1, about one run in six with the best scripted strategy still dies inside ten
  years. The opening is harsh by design, and it may be harsher than you want.
- The ruins and results views were checked by screenshot before the last small layout fixes
  (inspect panel position, ruined granary sprite); those fixes were only build- and load-tested.
