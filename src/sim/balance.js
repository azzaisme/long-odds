// Every tuning value for Long Odds lives here. The simulation reads nothing else.
// Units: "food" feeds one household for half a year at consumption 2; "seed" plants one plot.
export const BALANCE = {
  ticksPerYear: 4,
  playbackMs: 30000,
  visitsPerRun: 5,
  actionsPerVisit: 3,
  jumpChoices: [1, 10, 100, 1000],

  start: { households: 6, food: 22, seed: 6, knowing: 1 },

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
  teachWitnesses: 2, // onlookers one demonstration can teach
};
