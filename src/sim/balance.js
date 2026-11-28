// Every tuning value for Long Odds lives here. The simulation reads nothing else.
// Units: "food" feeds one household for half a year at consumption 2; "seed" plants one plot.
export const BALANCE = {
  ticksPerYear: 4,
  playbackMs: 30000,
  visitsPerRun: 0, // 0 = no limit: the god keeps checking back until the settlement is gone
  actionsPerVisit: 3, // budget for the scripted headless strategies only; the game has no cap
  workCost: { build: 1.5, repair: 1, store: 3, carry: 0, teach: 1 }, // food eaten by the work party
  customDrift: 0.003, // yearly chance each custom slips one step back toward what villages do unprompted
  jumpChoices: [1, 10, 100, 1000],

  start: { households: 6, food: 26, seed: 6, knowing: 1 },

  // Households
  consumption: 2.0, // food eaten per household per year
  forage: 0.5, // food gathered per household per year without farming
  plotsPerHousehold: 2, // labour: plots one household can work
  leaveFactor: 0.8, // departure chance = shortage fraction * this
  leaveMax: 0.95,
  growthChance: 0.14, // yearly chance of one new household when fed and stocked
  growthReserve: 1.2, // food per household needed in store before growth
  turnoverChance: 1 / 25, // yearly chance a household passes to the next generation
  keepKnowledgeAlone: 0.5, // practice survives turnover when no other household holds it
  keepKnowledgeShared: 0.97, // ... when at least one other household also holds it
  teachChance: 0.1, // yearly chance a trained household trains a neighbour
  inheritChance: 0.6, // new household knows the practice with chance = trained share * this

  // People. Households are houses full of individuals; all knowledge lives in people.
  people: {
    adultAge: 16,
    eat: { adult: 0.6, child: 0.25 }, // food per person per year
    forage: 0.12, // food gathered per adult per year (plants, fish); hunting comes on top
    plotsPerAdult: 1,
    death: { infant: 0.02, adult: 0.005, oldFrom: 50, old: 0.03, oldRise: 0.006, hunger: 2 }, // yearly chances
    marryFrom: 17, marryTo: 40, marryChance: 0.5,
    birthTo: 42, birthChance: 0.24, maxChildren: 4, crowded: 8, // household size at which births stop
    learnFrom: 6, learnChance: 0.25, // a child picks up each idea kept in its house, per year
    spouseShare: 0.3, // yearly chance a spouse passes on each idea
    neighbourTeach: 0.012, // yearly chance an adult passes one idea to an adult elsewhere
    teacherBoost: 5, // a person with the teacher's calling does this much more of it
    invent: 0.03, // yearly chance a person holding both parent ideas works out the new one
    newcomerChance: 0.02, // yearly chance a new family arrives when the village is fed
    newcomerIdea: 0.35, // chance they bring one base idea with them
    moveCost: 2, // food to move a household to another house
  },

  // What a standing bridge is worth.
  bridge: {
    farYield: 1.1, // far-bank soil has never been worked
    newcomers: 2.5, // families arrive this much more often over a bridge
    newcomerIdea: 0.6, // and more often bring an idea
    trade: 0.3, // share of a winter shortage made up by trading across the river
    hands: 2, // grown people a building year needs free
    reserve: 0.75, // share of a year's food that must be left in store after paying for the year's work
  },

  // Forests and wildlife.
  forest: {
    standWood: 10, // timber in an untouched stand
    startWood: 6, // cut timber the village starts with
    regrow: 0.35, // growth rate of a stand; fastest when it is half grown
    seedling: 0.3, // timber in a bare stand the year a neighbour seeds it
    seedFrom: 3, // a bare stand only regrows beside a neighbour with at least this much
    thinFloor: 4, // thinning never takes a stand below this
    thinTake: 2, // most timber thinning takes from one stand in a year
    fuel: 0.03, // firewood per person per year
    houseWood: 2, // timber to found a new house
    bridgeWood: { rope: 1, timber: 2, stone: 1 }, // timber per year of bridge work
    coldDeaths: 1.0, // deaths rise by this much in a winter with no firewood at all
    fellCost: 0.5, // food for the god to fell one stand
    clearCost: 2, // food to clear a stand into a field
    returns: 60, // years before an abandoned forest field is forest again
    gameCap: 40, // game a whole forest can carry, in food
    gameGrowth: 0.3,
    startGame: 0.8, // share of capacity at the start
    huntPerAdult: 0.2, // most game each grown person brings home in a year
    recolonise: 0.05, // yearly chance game crosses the bridge into an emptied forest
    wander: 0.01, // yearly chance game wanders back into standing forest from beyond the valley
    runoff: 0.4, // floods are this much likelier with the west forest gone
    slides: 2, // landslides are this many times likelier again with the east forest gone
  },

  // Farms
  yield: { low: 3.0, ridge: 1.7 },
  yieldNoise: 0.2,
  seedSaved: { trained: 1.5, untrained: 0.3 }, // seed kept per harvested plot
  ridgeSeedShare: 0.6, // share of trained households' spare saved seed carried to a ridge store
  ridgeFoodShare: 0.3, // share of harvest food kept uphill once a ridge store exists
  ridgeReserve: 4, // ridge seed households will not touch in an ordinary spring
  ridgeHabitShare: 0.4, // once any ridge field exists, villages keep about this share of fields uphill
  expandSeedPerPlot: 1.4, // seed in store per field before a village clears another
  spoil: { food: 0.15, seed: 0.08 }, // yearly storage losses
  seedCap: 40, // seed beyond this per store is eaten or traded away
  fallowYearsToOvergrow: 4,
  damagedYearsToOvergrow: 5,
  expandPerYear: 2, // most new plots a village clears in one year
  expandChance: 0.6, // yearly chance a stocked village with spare hands clears a new plot
  expandFoodReserve: 0.6, // food per household needed before clearing new plots

  // River
  flood: {
    minorChance: 0.26,
    majorChance: 0.065,
    extremeChance: 0.007,
    minorDamage: 0.35, // chance each planted lowland plot is lost
    majorDamage: 0.9,
    majorFallowDamage: 0.4, // chance an unplanted lowland plot is silted over
    granaryLoss: [0.6, 1.0], // share of lowland granary stock lost in a major flood
    extremeRidgeDamage: 0.3,
    erodeChance: 0.5, // extreme flood takes the lowest plot site
    siltChance: 0.004, // yearly chance an eroded site re-forms
    memoryGain: [0, 0.5, 2, 3],
    memoryDecay: 0.85,
    lineYears: 30, // how long villagers remember a flood line
  },
  drought: { chance: 0.09, low: 0.8, ridge: 0.35 },
  climate: { revert: 0.05, drift: 0.12, min: 0.55, max: 1.6 },

  // Weather and disasters, all resolved in summer before the river.
  hazards: {
    rainChance: 0.06, // heavy-rain year (scaled by wetness)
    rainFloodBoost: 1.5, // flood chances multiply in a heavy-rain year
    rainLowYield: 0.85, // waterlogged floodplain harvest
    slideChance: 0.005, // landslide off the slope onto the near ridge
    slideRainBoost: 4,
    slideEruptBoost: 6,
    slideStoreHit: 0.5, // chance the slide reaches the ridge store
    slideStoreLoss: [0.3, 0.7], // share of ridge store stock buried
    tornadoChance: 0.004,
    tornadoHouseLoss: 0.25, // chance each household in the path loses its house and leaves
    tornadoCropLoss: 0.6,
    tornadoStoreLoss: 0.3, // share of food scattered from the store in the path
    eruptChance: 0.001, // yearly chance the volcano wakes; it then smokes for rumbleYears first
    rumbleYears: 3,
    severeShare: 0.3, // share of eruptions that send fire and mud into the valley
    severeLoss: 0.5, // chance each household is lost in a severe eruption
    severeLossHold: 0.12, // ... if they live in the Hold
    ashYield: [0.25, 0.6, 0.6], // harvest multiplier in the eruption year and the ash years after
    fertileYears: 12, // then volcanic soil pays back
    fertileYield: 1.15,
  },

  // Adaptation
  uphillMemory: 2.5, // flood memory at which households clear ridge fields
  storeMemory: 3, // flood memory at which trained households may build a ridge store
  storeChance: 0.08,
  storeKnowers: 2,

  // Settlement stages. A fed, populous settlement accumulates good years and grows into the next
  // stage; the last is a single great structure on the ridge that houses every resident.
  stages: {
    names: ['Hamlet', 'Village', 'Town', 'City', 'The Hold'],
    households: [0, 9, 14, 22, 34], // households needed to work toward stage i
    years: [0, 10, 40, 100, 200], // fed years at that size needed to reach stage i
    yield: [1, 1.15, 1.4, 2.0, 3.2], // terraces, irrigation, better seed
    capacity: [24, 24, 30, 44, 64], // households the settlement can house
    granaryLoss: [1, 1, 0.85, 0.6, 0], // share of the usual flood loss to lowland stores
    minorFloodProofFrom: 2, // from Town on, a levee keeps ordinary high water off the fields
    needsRidgeStoreFrom: 2, // a Town or larger must keep seed above the flood line
    needsRidgeFields: [0, 0, 0, 3, 4], // ridge fields needed to work toward stage i
    setback: 5, // good years lost to one hungry winter
    shrink: 0.4, // falls back a stage below this share of the stage's households (never from the Hold)
  },

  // Buildings
  houseEmptyToRuin: 12,
  houseRuinToRubble: 60,
  houseRubbleToGone: 250,

  // Player actions
  carryShare: 0.5, // share of lowland seed carried uphill in one work action
  teachRadius: 52, // world pixels
  teachWitnesses: 3, // nearest villagers whose houses one lesson reaches
  // The tutorial's valley: one fixed seed, the floodplain only (the god cannot walk past `wall`),
  // a single jump of `years`, and a river fated to come over the bank every year from `fate.from`
  // to `fate.to`. tools/fate.mjs and a test show that every tutorial playthrough ends in collapse.
  tutorial: { seed: 7, fate: { from: 12, to: 19 }, wall: 975, years: 100 },
};
