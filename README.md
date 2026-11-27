# Long Odds

*Plant a field. Bet a century.*

A 2D side-scrolling generational survival simulation, built on the PlayCanvas Engine with plain
JavaScript modules and Vite. Keep a riverside settlement alive for as many simulated years as
you can — and, if it lasts, watch it grow from a hamlet into **the Hold**, one great terraced
structure on the ridge that houses every resident.

## Run it

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the address Vite prints (default `http://localhost:5173`) in a desktop browser. Add
`?seed=123` to the address, or type a seed on the title screen, to replay the same valley.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` then `npm run preview` | Production build in `dist/`, served locally |
| `npm test` | Headless simulation tests (determinism, playback timing, collapse, recovery, stages) |
| `node tools/find.mjs eruption 40` | Lists seeds where an event type (eruption, tornado, landslide…) happens within N years, for watching in the browser |
| `npm run sim` | Headless balance run over many seeds; `npm run sim -- 1000 1,10,100,100,1000` sets seed count and jump schedule |

## You are a god

You look after one valley, and the god is the only character you ever play. He walks among the
villagers in his own form: a robed figure of blue light. He does the work himself, and he knows
all six base ideas and can teach them to the houses of whoever is standing near him.

When you step out of the world he vanishes in a column of blue light, the years run, and he
flashes back in at the destination. If the settlement is alive, the arrival report opens. If it
collapsed, the camera pushes in on him standing in the ruins: "Nope. Not like that. They only
made it 51 years." **Try again** has him say "Maybe I could…" while the scene wipes to black and
a new valley wipes in. **What happened** opens the full report; **Walk the ruins** lets you look.

The departure takes about one second and happens before the thirty-second clock starts, so the
playback itself is still exactly thirty seconds.

## The screen

- **Top:** the year, and six readouts (people, food, seed, fields, timber and forest, ideas). Hover one for detail.
- **Middle:** a card appears for whatever you are standing at, with what `E` will do and what
  it costs. On the first visit a short checklist sits at the top left.
- **Bottom:** the action row: Teach, People, Customs, Bridge, and Step out of the world.
- **Panels:** Step out, People, Customs, Bridge and Controls are tabs of one panel; their
  letter keys switch between them and `Esc` closes it.

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or `←` / `→` | Walk |
| `E` | Do the main thing on the card: clear or repair a field, fell a forest stand, build the ridge store, carry seed, meet a household, plan the bridge |
| `2` | Change the crop of the field you are standing at, or clear a forest stand for a field |
| `T`, then `1`–`6` | Teach an idea to everyone old enough in the houses of the three nearest villagers |
| `P` | People: family lines, houses, ideas; from a house: matches, callings, moving |
| `C` | Customs the village keeps while you are away |
| `B` | Plan a bridge |
| `J` | Review the settlement, then `1`–`4` to step out for 1 / 10 / 100 / 1,000 years |
| `H` | All controls |
| `Enter` / `Esc` | Confirm / close or go back |

There is no limit on how much you do in a visit, and no last visit: you keep coming back until
nobody is left. Work is paid for in food from the stores (clear a field 1.5, repair 1, build the
ridge store 3, teach an idea 1, move a household 2; carrying seed is free), so everything
you build comes out of the reserve the village has to live on. Matches, callings, customs,
crops and bridge plans cost nothing to set.

## Planning: the city, the houses, the people

Every decision is a row in [`src/sim/decisions.js`](src/sim/decisions.js), and the simulation
reads those tables. Adding a row adds a decision.

### People and family lines

The valley is lived in by individuals. Each person is born, learns as a child from the grown
people of their own house, marries someone from another house, has children and dies. Six
founding families start six **family lines**; a child belongs to every line either parent
belongs to, and new lines arrive with families from downriver.

**Ideas live in people.** There are 18:

- **Six you can teach** (`T`): seed saving, drying food, terracing, flood marks, watching
  the mountain, building in stone. Everyone old enough in the houses of the three nearest
  villagers learns it.
- **Twelve that nobody can be taught.** Each grows from two others, and only a person who holds
  both can work it out: seed jars (seed saving + drying), sealed granary (drying + stone), levee
  (flood marks + stone), irrigation (terracing + flood marks), and so on, up to canals, a seed
  vault, a school and a masons' guild, which each grow from two of those.

So ideas are made by mixing families. If one house keeps drying and another keeps stone, the
child of a marriage between them can come up with the sealed granary. An idea held by one
person dies with them.

What you can plan, all free except the move (`P` for the whole village, or inspect a house):

- **Matches** — promise two unmarried people from different houses to each other. The list
  shows, for each candidate, which new ideas the pairing would bring within reach. The promise
  is kept when both are 17 and still free.
- **Callings** — make someone a teacher: they pass what they know to other houses five times as
  readily.
- **Houses** — move a household between the riverside and the ridge (2 food).

### Bridges

Inspect the crossing at the river's edge to plan one. Planning is free and immediate; the
village builds it, one fed winter at a time, while you are away.

| Bridge | Time | Food a year | Carried away by high water / flood / great flood |
| --- | --- | --- | --- |
| Footbridge | 1 year | 2 | 50% / certain / certain |
| Timber bridge | 6 years | 2 | 3% / 50% / certain |
| Stone bridge | 25 years, and only while someone knows building in stone | 3 | never / 4% / 40% |

A standing bridge opens two far-bank fields with 10% richer soil, brings new families (and
their ideas and lines) 2.5 times as often, and lets the village trade for 30% of what it lacks
in a hungry winter. If the bridge goes while a crop stands on the far bank, that crop rots
unreached, and the far fields stay out of use until a bridge stands again. The old bridge stays
in use while a bigger one is built, and the village rebuilds whatever is planned. Work is put
off in any year the stores could not cover three-quarters of the coming year's food.

### Forests and wildlife

The valley is about 2,500 wide. Beyond the far bank lies the **west forest** (ten stands, and
only reachable over a bridge); along the ridge before the split cliff lies the **east forest**
(nine stands). Each stand holds 10 timber and stands on ground that could be a field.

Standing at a stand you can **fell it** (`E`, 0.5 food: all its timber goes to the woodpile, and
it grows back only while it or a neighbour still has trees) or **clear it for a field** (`2`,
2 food: no trees grow there while it is farmed).

The village uses the forest on its own, under three customs:

- **Cutting wood** — firewood (0.03 timber a person a year), 2 timber for every new house, and
  timber for each year of bridge work. By default it thins, never taking the last trees of a
  stand; it can be told to fell whatever is nearest, or to leave the forest alone.
- **Hunting** — game lives in each forest (up to 40 food, in proportion to how much of the
  forest stands) and feeds the village on top of foraging. Hunted harder than it breeds, it is
  gone; it only comes back to standing forest, rarely, or over a bridge from the other forest.
- **Forest into fields** — when open ground runs out, the village clears forest for fields in
  a hungry year by default; never, or always, if you say so.

What running out costs: with no timber no new houses are founded and bridge work stops; a
winter without firewood raises deaths; a bare west bank makes floods up to 40% likelier; a bare
east ridge makes landslides up to three times as likely; and a forest cut to nothing has
nothing to seed it. An abandoned forest field returns to forest after 60 years.

### Customs and crops

- **Customs (11, 37 settings)** — village-wide rules, set with `C`: ridge seed reserve, seed and
  food carried uphill, where new fields go, pace of clearing, where newcomers build, planting
  order, whether seed is eaten in a hungry winter, and the three forest customs above. Each drifts back one step toward the
  village default with a 0.3% chance a year.
- **Crops (3 per field, up to 37 fields)** — grain, roots or millet, chosen with `2` while inspecting
  a field. Villages sow new fields with whatever their neighbours grow.

## How a run goes

1. **Visit.** Year 0: six families (about 25 people), 26 food, 6 seed, a lowland granary, no
   farms. Only the two grown people of Ama's house know how to save seed (houses that keep it
   carry a gold seed mark).
2. **Plan.** The jump panel states food, seed by location, households, fields and the risks in
   plain language. Choosing a jump length also runs trial futures on *copies* of the village and
   shows the share that still have households at the destination.
3. **Playback.** Thirty real seconds, whatever the length. The simulation runs every seasonal
   tick in order; captions come from real simulation events. Nothing can be changed.
4. **Arrival.** Turning points of the jump, and any recoveries traced back to your ridge store or
   your demonstration. If the village is alive, the next visit begins. If not, you walk the ruins
   and score the year the last household left.
5. There is no final visit. The score is the year the last household leaves.

### The settlement's growth

A settlement that stays fed at a large enough size accumulates good years and advances:

| Stage | Needs | What changes |
| --- | --- | --- |
| Hamlet | start | |
| Village | 9 households, 10 fed years | Meeting hall; better yields |
| Town | 14 households, 40 fed years, a ridge seed store | Levee: ordinary high water no longer spoils fields; shared housing beyond the old house sites |
| City | 22 households, 100 fed years, 3 ridge fields | Stone blocks on the ridge; lowland stores lose less to floods |
| The Hold | 34 households, 200 fed years, 4 ridge fields | Every household moves into one structure above the flood line with its own seed vault; seed saving can no longer be forgotten |

A hungry winter costs five of the accumulated years. A town or city that empties falls back a
stage. If the settlement collapses, the highest stage it reached is what stands in ruins.

### Weather and disasters

All of these are rolled in the simulation each summer, with the same rules at every jump length.

| Hazard | Yearly chance | What it does |
| --- | --- | --- |
| River flood | 26% high water, 6.5% flood, 0.7% great flood (scaled by wet or dry decades) | Spoils or buries floodplain fields and ruins lowland granary stock; a great flood reaches the ridge and can take the lowest bank |
| Heavy rain | 6% | Flood chances × 1.5, landslide chance × 4, floodplain harvest × 0.85 |
| Drought | 9% in years without a flood | Ridge harvest × 0.35, floodplain × 0.8 |
| Landslide | 0.5% | Buries the two ridge fields nearest the slope; half the time it breaks into the ridge store and takes 30–70% of its stock |
| Tornado | 0.4% | Crosses either the floodplain or the ridge: each household there has a 25% chance of losing its house and leaving, 60% of crops in its path are stripped, the store there loses 30% of its food |
| Volcano | 0.1% that it wakes | Smokes for three years as a warning, then erupts: harvests at 25% that year and 60% for two more, a mudflow flood, and likely landslides. Three eruptions in ten also send fire and mud into the valley: half the households are lost and every field is buried. Twelve years of richer soil follow |

The Hold shelters its households from tornadoes and from most of a severe eruption. The volcano
stands behind the valley in the backdrop; it smokes while it is waking and shows lava afterwards.

## Publishing to itch.io

Branch rule: every branch is merged into `testing`, only `testing` is merged into `main`, and
every merge into `main` publishes to itch.io.

`.github/workflows/itch.yml` enforces and carries that out:

- Pull requests into `testing` or `main` run the tests and the build.
- A pull request into `main` from any branch other than `testing` fails a check named
  "only-testing-into-main". To make that binding, protect `main` in the repository settings and
  mark that check and "build and publish" as required.
- Every push to `main` runs the tests, builds, and pushes `dist/` to itch.io with butler.

It expects two Actions secrets: `ITCH_KEY` (an itch.io API key) and `ITCH_URL` (the project
page, such as `https://someone.itch.io/long-odds`). On
itch.io, set the project to "HTML" and the `html5` channel to be played in the browser.

## How the simulation works

`src/sim/` is plain JavaScript with no browser or engine imports. State is one JSON-compatible
object; `step(state)` advances one season:

- **Spring** — trained households restore silted fields; households plant while seed and hands
  last. Lowland seed first; ridge seed is a reserve opened after a flood.
- **Summer** — the river: high water, flood, or great flood (and drought in dry years). One flood
  hits every lowland field and the lowland granary together.
- **Autumn** — harvest. Floodplain 3.0 food per field, ridge 1.7. Households that know seed
  saving keep 1.5 seed per field (others 0.3) and carry spare seed to a ridge store.
- **Winter** — stores spoil and are eaten; hunger drives households away; then the people's
  year: deaths, children learning, marriages between houses, births, new ideas, new families
  arriving. A year of work goes into the planned bridge. Fed villages clear fields (uphill
  after repeated floods) and work toward the next stage; abandoned fields and houses decay.

Jump length only decides how many times `step` runs. Simulation randomness comes from one seeded
generator stored in the state; visual effects use `Math.random` and never touch it.

All balance values are in [`src/sim/balance.js`](src/sim/balance.js).

## Layout

```
src/sim/balance.js     every tuning value
src/sim/decisions.js   ideas, customs, crops and bridges as data
src/sim/people.js      individuals: birth, learning, marriage, death, new ideas
src/sim/sim.js         state, seasonal tick, player actions, fingerprint
src/sim/risks.js       plain-language risks; odds from cloned simulations
src/sim/playback.js    30-second clock -> due ticks
src/sim/strategies.js  scripted players for headless runs
src/sim/world.js       the valley: terrain profile, field and house sites
src/game/game.js       controller states: title, visit, planning, playback, arrival, ruins, results
src/game/view.js       PlayCanvas scene: orthographic camera, parallax, sprites, water, weather
src/game/sprites.js    procedural pixel art (all original)
src/game/audio.js      synthesised sound (all original)
tools/headless.mjs     many-seed balance report
test/sim.test.mjs      acceptance tests
```

See [VERIFICATION.md](VERIFICATION.md) for what was checked and the measured results.
