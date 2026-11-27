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

## Controls

| Key | Button | Action |
| --- | --- | --- |
| `A` / `D` or `←` / `→` | | Walk |
| `E` | | Inspect the nearest field site, store, house or building |
| `1` | gold button in the inspect panel | Do the work shown there (build, repair, carry seed) |
| `T` | "Demonstrate seed saving" | Teach the two nearest untrained villagers within reach |
| `Q` | "Switch to …" | Switch to the other villager; the one you leave goes back to their routine |
| `J` | "Plan the jump" | Condition report, then `1`–`4` to pick 1 / 10 / 100 / 1,000 years |
| `Enter` / `Esc` | Commit / Back | Confirm or cancel the jump; `Enter` also continues after arrival |

Walking, inspecting and switching are free. Building, repairing, carrying seed and demonstrating
each cost one of the visit's three work actions. A run is five visits; each visit ends in a jump.

## How a run goes

1. **Visit.** Year 0: six households, 22 food, 6 seed, a lowland granary, no farms. Only Ama's
   household knows how to save seed (villagers who know it carry a gold seed mark).
2. **Plan.** The jump panel states food, seed by location, households, fields and the risks in
   plain language. Choosing a jump length also runs trial futures on *copies* of the village and
   shows the share that still have households at the destination.
3. **Playback.** Thirty real seconds, whatever the length. The simulation runs every seasonal
   tick in order; captions come from real simulation events. Nothing can be changed.
4. **Arrival.** Turning points of the jump, and any recoveries traced back to your ridge store or
   your demonstration. If the village is alive, the next visit begins. If not, you walk the ruins
   and score the year the last household left.
5. After the fifth jump a surviving settlement scores its destination year: **Still standing**.

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
| Heavy rain | 8% | Flood chances × 1.5, landslide chance × 4, floodplain harvest × 0.85 |
| Drought | 9% in years without a flood | Ridge harvest × 0.35, floodplain × 0.8 |
| Landslide | 0.8% | Buries the two ridge fields nearest the slope; half the time it breaks into the ridge store and takes 30–70% of its stock |
| Tornado | 0.8% | Crosses either the floodplain or the ridge: each household there has a 25% chance of losing its house and leaving, 60% of crops in its path are stripped, the store there loses 30% of its food |
| Volcano | 0.2% that it wakes | Smokes for three years as a warning, then erupts: harvests at 25% that year and 60% for two more, a mudflow flood, and likely landslides. Three eruptions in ten also send fire and mud into the valley: half the households are lost and every field is buried. Twelve years of richer soil follow |

The Hold shelters its households from tornadoes and from most of a severe eruption. The volcano
stands behind the valley in the backdrop; it smokes while it is waking and shows lava afterwards.

## How the simulation works

`src/sim/` is plain JavaScript with no browser or engine imports. State is one JSON-compatible
object; `step(state)` advances one season:

- **Spring** — trained households restore silted fields; households plant while seed and hands
  last. Lowland seed first; ridge seed is a reserve opened after a flood.
- **Summer** — the river: high water, flood, or great flood (and drought in dry years). One flood
  hits every lowland field and the lowland granary together.
- **Autumn** — harvest. Floodplain 3.0 food per field, ridge 1.7. Households that know seed
  saving keep 1.5 seed per field (others 0.3) and carry spare seed to a ridge store.
- **Winter** — stores spoil and are eaten; hunger drives households away; knowledge is taught,
  inherited or lost at generational turnover; fed villages grow, clear fields (uphill after
  repeated floods) and work toward the next stage; abandoned fields and houses decay.

Jump length only decides how many times `step` runs. Simulation randomness comes from one seeded
generator stored in the state; visual effects use `Math.random` and never touch it.

All balance values are in [`src/sim/balance.js`](src/sim/balance.js).

## Layout

```
src/sim/balance.js     every tuning value
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
