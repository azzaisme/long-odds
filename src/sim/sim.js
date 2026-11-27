// Long Odds simulation. Plain JavaScript, no browser or engine dependencies.
// State is a plain JSON-compatible object: clone with cloneSim(), fingerprint with hashState().
// One call to step() advances one season. Jump length only decides how many times step() runs.
import { BALANCE } from './balance.js';
import { rngNext, hashSeed } from './rng.js';
import { PLOT_SITES, HOUSE_SLOTS, householdName } from './world.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const FLOOD_NAMES = ['', 'High water', 'Flood', 'Great flood'];

export function createSim(seed, B = BALANCE) {
  const st = {
    seed: seed >>> 0,
    rng: { a: hashSeed('long-odds', seed >>> 0) },
    tick: 0,
    nextHid: 0,
    households: [],
    plots: PLOT_SITES.map((s) => ({
      id: s.id, elev: s.elev, state: 'wild', stage: null, since: 0, lastWorked: -1,
      worker: null, workerKnows: false, builtBy: null, builtYear: null,
    })),
    houses: HOUSE_SLOTS.map((h) => ({ id: h.id, elev: h.elev, state: 'gone', hid: null, since: 0 })),
    stores: {
      low: { built: true, food: B.start.food, seed: B.start.seed },
      ridge: { built: false, food: 0, seed: 0, builtBy: null, builtYear: null },
    },
    river: { wet: 1, level: 0, drought: false, floods: [], lastFlood: null },
    floodMemory: 0,
    sky: { rain: false, tornado: null, slide: false, erupted: false, rumble: 0, ash: 0, fertile: 0, lastEruption: null, lastSlide: null, lastTornado: null },
    civ: { stage: 0, progress: 0, reached: [0, null, null, null, null] },
    seedLostYear: null, // last year a flood destroyed stored lowland seed
    everPlanted: false,
    knowersGone: null, // year the last seed-saving household lost the practice
    year0: { planted: 0, harvest: 0, shortage: 0 }, // last completed farm year, for reporting
    collapse: null,
    chronicle: [], // turning points (priority 3)
    recoveries: [], // recoveries traceable to stored ridge seed or taught practice
    actions: [], // player interventions
    stats: { rains: 0, slides: 0, tornadoes: 0, eruptions: 0, peakStage: 0, floods: 0, greatFloods: 0, droughts: 0, peakHouseholds: B.start.households, left: 0, settled: 0 },
  };
  for (let i = 0; i < B.start.households; i++) {
    const h = addHousehold(st, false);
    if (i < B.start.knowing) {
      h.knows = true;
      h.lineage = { root: 'elder', year: 0, by: h.name };
    }
  }
  return st;
}

export const cloneSim = (st) => structuredClone(st);
export const yearOf = (st) => Math.floor(st.tick / 4);
export const seasonOf = (st) => st.tick % 4;
export const isAlive = (st) => st.households.length > 0;
export const knowers = (st) => st.households.reduce((n, h) => n + (h.knows ? 1 : 0), 0);
export const builtPlots = (st) => st.plots.filter((p) => p.state === 'fallow' || p.state === 'planted' || p.state === 'damaged');

export function hashState(st) {
  // Fingerprint of everything that affects the future or the score.
  const { chronicle, recoveries, actions, ...core } = st;
  const s = JSON.stringify(core) + '#' + chronicle.length + '#' + recoveries.length;
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function addHousehold(st, preferRidge, B = BALANCE) {
  const order = preferRidge ? ['ridge', 'low'] : ['low', 'ridge'];
  let slot = null;
  const stage = st.civ.stage;
  if (st.households.length >= B.stages.capacity[stage]) return null;
  for (const elev of stage >= 4 ? [] : order) {
    for (const want of ['empty', 'ruin', 'gone', 'rubble']) {
      slot = st.houses.find((s) => s.elev === elev && s.state === want);
      if (slot) break;
    }
    if (slot) break;
  }
  if (!slot && stage < 2) return null; // from Town on, households without a house of their own live in shared blocks
  const id = st.nextHid++;
  const h = { id, name: householdName(id), knows: false, lineage: null, since: yearOf(st), house: slot ? slot.id : -1, gen: 1 };
  if (slot) {
    slot.state = 'home';
    slot.hid = id;
    slot.since = yearOf(st);
  }
  st.households.push(h);
  return h;
}

function removeHousehold(st, h, year) {
  const slot = st.houses[h.house];
  if (slot) {
    slot.state = 'empty';
    slot.hid = null;
    slot.since = year;
  }
  st.households.splice(st.households.indexOf(h), 1);
}

const tracePractice = (lin) =>
  !lin ? '' : lin.root === 'demo' ? `practice shown by ${lin.by} in year ${lin.year}` : `practice kept from ${lin.by}'s household`;

// ---------------------------------------------------------------------------------------------
// One seasonal tick. Returns the events of this tick: { year, season, p, type, text, ... }.
// p is priority: 1 routine, 2 notable, 3 turning point (also kept in st.chronicle).
export function step(st, B = BALANCE) {
  const year = yearOf(st);
  const season = seasonOf(st);
  const ev = [];
  const say = (p, type, text, extra) => {
    const e = { year, season, p, type, text, ...extra };
    ev.push(e);
    if (p >= 3) {
      st.chronicle.push({ year, type, text });
      if (st.chronicle.length > 400) st.chronicle.splice(0, 100);
    }
  };
  const rand = () => rngNext(st.rng);

  if (season === 0) spring(st, B, year, say);
  else if (season === 1) summer(st, B, year, say, rand);
  else if (season === 2) autumn(st, B, year, say, rand);
  else winter(st, B, year, say, rand);

  st.tick++;
  return ev;
}

export function runYears(st, years, onEvents, B = BALANCE) {
  const n = years * 4;
  for (let i = 0; i < n; i++) {
    const ev = step(st, B);
    if (onEvents && ev.length) onEvents(ev);
  }
  return st;
}

function spring(st, B, year, say) {
  st.river.level = 0;
  st.river.drought = false;
  st.year0 = { planted: 0, harvest: 0, shortage: 0 };
  if (!isAlive(st)) return;

  // Labour slots: trained households first, so the best-kept fields get the seed-savers.
  const slots = [];
  for (const h of st.households) if (h.knows) for (let i = 0; i < B.plotsPerHousehold; i++) slots.push(h);
  const trainedSlots = slots.length;
  for (const h of st.households) if (!h.knows) for (let i = 0; i < B.plotsPerHousehold; i++) slots.push(h);
  let next = 0;

  // Repairs need a trained household: they know how to bring a silted plot back.
  let repaired = 0;
  let repairer = null;
  const seedStock = st.stores.low.seed + st.stores.ridge.seed;
  for (const p of st.plots) {
    if (p.state !== 'damaged') continue;
    if (next >= trainedSlots || repaired >= Math.floor(seedStock)) break;
    repairer = slots[next++];
    p.state = 'fallow';
    p.since = year;
    p.lastWorked = year;
    repaired++;
  }

  // Planting: lowland first (better yield), lowland seed first. Ridge seed is the reserve: it is
  // opened after a flood has taken the lowland seed, or when nothing else could be planted.
  const afterFlood = st.seedLostYear !== null && year - st.seedLostYear <= 1;
  let planted = 0;
  let fromRidge = 0;
  let ridgeWorker = null;
  let unplanted = 0;
  const order = st.plots.filter((p) => p.state === 'fallow').sort((a, b) => (a.elev === b.elev ? a.id - b.id : a.elev === 'low' ? -1 : 1));
  for (const p of order) {
    if (next >= slots.length) break;
    let ridgeSeed = false;
    if (st.stores.low.seed >= 1) st.stores.low.seed -= 1;
    else if (st.stores.ridge.seed >= 1 && (afterFlood || planted === 0 || st.stores.ridge.seed >= B.ridgeReserve + 1)) {
      st.stores.ridge.seed -= 1;
      ridgeSeed = true;
    } else {
      unplanted++;
      continue;
    }
    const h = slots[next++];
    p.state = 'planted';
    p.stage = 'sprout';
    p.worker = h.id;
    p.workerKnows = h.knows;
    p.lastWorked = year;
    planted++;
    if (ridgeSeed) {
      fromRidge++;
      ridgeWorker = h;
    }
  }
  st.year0.planted = planted;
  if (planted > 0) st.everPlanted = true;

  if (fromRidge > 0 && afterFlood) {
    const store = st.stores.ridge;
    const who = store.builtBy === 'village' ? 'the village' : store.builtBy;
    const rec = {
      year, kind: 'ridge-seed', plots: fromRidge,
      storeBuiltBy: store.builtBy, storeBuiltYear: store.builtYear,
      practice: ridgeWorker && ridgeWorker.lineage ? { ...ridgeWorker.lineage } : null,
    };
    st.recoveries.push(rec);
    say(3, 'recovery', `Ridge seed replanted ${plural(fromRidge, 'field')} after the flood (store built by ${who}, year ${store.builtYear}).`, { rec });
  } else if (fromRidge > 0) {
    say(1, 'ridge-seed', `Ridge seed planted ${plural(fromRidge, 'field')}.`);
  }
  if (repaired > 0) {
    const lin = repairer.lineage;
    if (lin && lin.root === 'demo') st.recoveries.push({ year, kind: 'repair', plots: repaired, practice: { ...lin } });
    say(2, 'repair', `Seed-savers restored ${plural(repaired, 'damaged field')}${lin ? ' (' + tracePractice(lin) + ')' : ''}.`, { n: repaired });
  }
  if (planted === 0 && unplanted > 0) {
    say(st.everPlanted ? 3 : 2, 'no-seed', afterFlood ? 'No seed survived the flood. The fields stay bare.' : 'No seed left. The fields stay bare.');
  } else if (planted > 0) {
    say(1, 'plant', `${plural(planted, 'field')} planted.`, { n: planted });
  }
}

// A household destroyed outright (tornado, eruption): the house is left a ruin.
function destroyHousehold(st, h, year) {
  const slot = st.houses[h.house];
  removeHousehold(st, h, year);
  if (slot) slot.state = 'ruin';
  st.stats.left++;
}
function endIfEmpty(st, year, say, cause) {
  if (st.households.length > 0 || st.collapse) return;
  st.collapse = { year, cause };
  say(3, 'collapse', `Nobody is left in the valley. ${cause}`);
}

function summer(st, B, year, say, rand) {
  const F = B.flood;
  const Hz = B.hazards;
  const sky = st.sky;
  const wet = st.river.wet;
  const r = rand();
  const rd = rand();
  const rRain = rand(), rSlide = rand(), rTor = rand(), rSide = rand(), rVol = rand(), rSev = rand();
  const alive = isAlive(st);
  const stage = st.civ.stage;
  Object.assign(sky, { rain: false, tornado: null, slide: false, erupted: false });
  if (sky.ash > 0) sky.ash--;
  else if (sky.fertile > 0) sky.fertile--;

  // The volcano: smoke for a few years, then the eruption.
  let lahar = false;
  if (sky.rumble > 0) {
    sky.rumble--;
    if (sky.rumble === 0) {
      const severe = rSev < Hz.severeShare;
      sky.erupted = severe ? 'severe' : 'ash';
      sky.ash = Hz.ashYield.length;
      sky.fertile = Hz.fertileYears;
      sky.lastEruption = { year, severe };
      st.stats.eruptions++;
      lahar = true;
      if (severe) {
        const lossChance = stage >= 4 ? Hz.severeLossHold : Hz.severeLoss;
        const lost = st.households.filter(() => rand() < lossChance);
        for (const h of lost) destroyHousehold(st, h, year);
        for (const p of st.plots) if (p.state === 'planted' || p.state === 'fallow') Object.assign(p, { state: 'damaged', stage: null, since: year });
        say(3, 'eruption', alive ? `The mountain erupted. Fire and mud came down the valley: ${plural(lost.length, 'household')} lost, every field buried.` : 'The mountain erupted and buried the empty valley in mud.', { severe, n: lost.length });
        endIfEmpty(st, year, say, `The eruption of year ${year} destroyed the settlement.`);
      } else say(alive ? 3 : 2, 'eruption', 'The mountain erupted. Ash is falling on the fields and the river runs thick with mud.', { severe, n: 0 });
    } else if (alive) say(2, 'rumble', 'The mountain is smoking and the ground shakes.');
  } else if (rVol < Hz.eruptChance) {
    sky.rumble = Hz.rumbleYears;
    if (alive) say(3, 'rumble', 'Smoke is rising from the mountain for the first time in living memory.');
  }

  const rain = rRain < Hz.rainChance * wet;
  if (rain) {
    sky.rain = true;
    st.stats.rains++;
  }
  const boost = rain ? Hz.rainFloodBoost : 1;
  let level = 0;
  if (r < F.extremeChance * wet * boost) level = 3;
  else if (r < (F.extremeChance + F.majorChance) * wet * boost) level = 2;
  else if (r < (F.extremeChance + F.majorChance + F.minorChance) * wet * boost) level = 1;
  if (lahar) level = Math.max(level, 2);
  if (rain && level === 0 && isAlive(st)) say(1, 'rain', 'Weeks of heavy rain. The floodplain is waterlogged.');

  // Tornado: one elevation is in its path.
  if (rTor < Hz.tornadoChance) {
    const side = rSide < 0.5 ? 'low' : 'ridge';
    sky.tornado = side;
    sky.lastTornado = { year, side };
    st.stats.tornadoes++;
    let lostCrops = 0;
    for (const p of st.plots) if (p.elev === side && p.state === 'planted' && rand() < Hz.tornadoCropLoss) (p.state = 'fallow'), (p.stage = null), lostCrops++;
    const inPath = stage >= 4 ? [] : st.households.filter((h) => (h.house >= 0 ? st.houses[h.house].elev : 'ridge') === side);
    const lost = inPath.filter(() => rand() < Hz.tornadoHouseLoss);
    for (const h of lost) destroyHousehold(st, h, year);
    const store = side === 'low' ? st.stores.low : st.stores.ridge;
    if (stage < 4) store.food *= 1 - Hz.tornadoStoreLoss;
    const where = side === 'low' ? 'the floodplain' : 'the ridge';
    if (lost.length || lostCrops) say(lost.length ? 3 : 2, 'tornado', `A tornado crossed ${where}: ${[lost.length ? `${plural(lost.length, 'house')} torn down` : '', lostCrops ? `${plural(lostCrops, 'field')} stripped` : ''].filter(Boolean).join(', ')}.`, { side, n: lost.length });
    else say(alive ? 2 : 1, 'tornado', `A tornado crossed ${where}${stage >= 4 && alive ? '; the Hold stood through it' : ''}.`, { side, n: 0 });
    endIfEmpty(st, year, say, `The tornado of year ${year} tore down the last houses.`);
  }

  // Landslide off the slope onto the nearest ridge fields and the ridge store.
  if (rSlide < Hz.slideChance * (rain ? Hz.slideRainBoost : 1) * (sky.erupted ? Hz.slideEruptBoost : 1)) {
    sky.slide = true;
    sky.lastSlide = { year };
    st.stats.slides++;
    let buried = 0;
    for (const p of st.plots.filter((q) => q.elev === 'ridge').slice(0, 2)) if (p.state === 'planted' || p.state === 'fallow') Object.assign(p, { state: 'damaged', stage: null, since: year }), buried++;
    let seedLost = 0;
    const rs = st.stores.ridge;
    if (rs.built && rand() < Hz.slideStoreHit) {
      const share = Hz.slideStoreLoss[0] + rand() * (Hz.slideStoreLoss[1] - Hz.slideStoreLoss[0]);
      seedLost = rs.seed * share;
      rs.seed -= seedLost;
      rs.food *= 1 - share;
    }
    const bits = [buried ? `buried ${plural(buried, 'ridge field')}` : '', seedLost >= 0.5 ? `broke into the ridge store and took ${Math.round(seedLost)} seed` : ''].filter(Boolean);
    say(alive && bits.length ? 3 : 2, 'landslide', bits.length ? `A landslide ${bits.join(' and ')}.` : 'A landslide came down the slope.', { n: buried });
  }
  const drought = level === 0 && rd < B.drought.chance * (2 - wet);
  st.river.level = level;
  st.river.drought = drought;

  if (level > 0) {
    const cropLoss = [0, stage >= B.stages.minorFloodProofFrom ? 0 : F.minorDamage, F.majorDamage, 1][level];
    let lost = 0;
    let lowPlanted = 0;
    let ridgeLost = 0;
    for (const p of st.plots) {
      if (p.elev === 'low') {
        if (p.state === 'planted') {
          lowPlanted++;
          if (rand() < cropLoss) {
            p.state = 'damaged';
            p.stage = null;
            p.since = year;
            lost++;
          }
        } else if (p.state === 'fallow' && level >= 2 && rand() < F.majorFallowDamage) {
          p.state = 'damaged';
          p.since = year;
        }
      } else if (level === 3 && p.state === 'planted' && rand() < F.extremeRidgeDamage) {
        p.state = 'damaged';
        p.stage = null;
        p.since = year;
        ridgeLost++;
      }
    }
    let seedLost = 0;
    let foodLost = 0;
    if (level >= 2) {
      const share = (level === 3 ? 1 : F.granaryLoss[0] + rand() * (F.granaryLoss[1] - F.granaryLoss[0])) * B.stages.granaryLoss[stage];
      const g = st.stores.low;
      seedLost = g.seed * share;
      foodLost = g.food * share;
      g.seed -= seedLost;
      g.food -= foodLost;
      if (seedLost >= 0.5) st.seedLostYear = year;
    }
    st.floodMemory += F.memoryGain[level];
    st.river.floods.push({ year, level });
    st.river.floods = st.river.floods.filter((f) => year - f.year <= F.lineYears);
    st.river.lastFlood = { year, level };
    st.stats.floods++;
    if (level === 3) st.stats.greatFloods++;

    if (level === 1) {
      if (lost > 0) say(2, 'flood', `High water spoiled ${lost} of ${plural(lowPlanted, 'lowland field')}.`, { level, lost });
      else say(1, 'flood', 'The river ran high but the fields held.', { level, lost });
    } else {
      const bits = [];
      if (lost > 0) bits.push(lost === lowPlanted ? 'destroyed the lowland harvest' : `destroyed ${plural(lost, 'lowland field')}`);
      if (seedLost >= 0.5) bits.push(`ruined ${Math.round(seedLost)} seed in the granary`);
      if (ridgeLost > 0) bits.push(`reached ${plural(ridgeLost, 'ridge field')}`);
      const name = FLOOD_NAMES[level];
      const alive = isAlive(st);
      say(alive && (lost > 0 || seedLost >= 0.5) ? 3 : 2, 'flood', bits.length ? `${name} ${bits.join(' and ')}.` : `${name} covered the floodplain.`, { level, lost, seedLost });
    }
    if (level === 3 && rand() < F.erodeChance) {
      const p = st.plots.find((q) => q.elev === 'low' && q.state !== 'eroded');
      if (p) {
        p.state = 'eroded';
        p.stage = null;
        p.since = year;
        say(3, 'erode', 'The river cut a new bank and took the lowest field.');
      }
    }
  } else if (drought) {
    st.stats.droughts++;
    if (isAlive(st) && st.year0.planted > 0) say(2, 'drought', 'Drought. The ridge fields are parched.');
  }
  for (const p of st.plots) if (p.state === 'planted') p.stage = 'ripe';
}

function autumn(st, B, year, say, rand) {
  const drought = st.river.drought;
  const Hz = B.hazards;
  const sky = st.sky;
  const skyMult = sky.ash > 0 ? Hz.ashYield[Hz.ashYield.length - sky.ash] : sky.fertile > 0 ? Hz.fertileYield : 1;
  let food = 0;
  let seed = 0;
  let n = 0;
  let trainedSeed = 0;
  const low = st.stores.low;
  const ridge = st.stores.ridge;
  for (const p of st.plots) {
    if (p.state !== 'planted') continue;
    const noise = 1 + (rand() * 2 - 1) * B.yieldNoise;
    const mult = (drought ? B.drought[p.elev] : 1) * skyMult * (sky.rain && p.elev === 'low' ? Hz.rainLowYield : 1);
    const f = B.yield[p.elev] * B.stages.yield[st.civ.stage] * mult * noise;
    const s = (p.workerKnows ? B.seedSaved.trained : B.seedSaved.untrained) * Math.min(1, mult + 0.2);
    food += f;
    seed += s;
    n++;
    if (p.workerKnows) trainedSeed += s;
    low.seed += s;
    if (ridge.built) {
      ridge.food += f * B.ridgeFoodShare;
      low.food += f * (1 - B.ridgeFoodShare);
    } else low.food += f;
    p.state = 'fallow';
    p.stage = null;
  }
  // Trained households carry seed uphill, but only seed the lowland fields can spare next spring.
  if (ridge.built && trainedSeed > 0) {
    const spare = low.seed - (builtPlots(st).length + n + 1);
    const up = Math.max(0, Math.min(spare, trainedSeed)) * B.ridgeSeedShare;
    low.seed -= up;
    ridge.seed += up;
  }
  low.seed = Math.min(low.seed, B.seedCap);
  ridge.seed = Math.min(ridge.seed, B.seedCap);
  st.year0.harvest = food;
  if (n > 0) say(1, 'harvest', `Harvest: ${plural(n, 'field')} brought in, ${seed.toFixed(0)} seed saved.`, { n, food, seed });
  else if (isAlive(st) && st.everPlanted) say(2, 'no-harvest', 'No harvest this year.');
  st.river.level = 0;
}

function winter(st, B, year, say, rand) {
  const low = st.stores.low;
  const ridge = st.stores.ridge;
  low.food *= 1 - B.spoil.food;
  ridge.food *= 1 - B.spoil.food;
  low.seed *= 1 - B.spoil.seed;
  ridge.seed *= 1 - B.spoil.seed;

  if (isAlive(st)) {
    const H = st.households.length;
    const need = H * B.consumption;
    let left = Math.max(0, need - H * B.forage);
    const take = (store, key) => {
      const t = Math.min(store[key], left);
      store[key] -= t;
      left -= t;
    };
    take(low, 'food');
    take(ridge, 'food');
    if (left > 0 && knowers(st) === 0) take(low, 'seed'); // nobody left who knows why seed must be kept
    const shortage = left / need;
    st.year0.shortage = shortage;

    if (shortage > 0.001) {
      const knew = knowers(st);
      const chance = Math.min(B.leaveMax, shortage * B.leaveFactor);
      const leaving = st.households.filter(() => rand() < chance);
      for (const h of leaving) removeHousehold(st, h, year);
      st.stats.left += leaving.length;
      if (leaving.length && st.households.length > 0) {
        say(leaving.length >= 3 ? 3 : 2, 'leave', `Hunger: ${plural(leaving.length, 'household')} left the valley.`, { n: leaving.length });
        if (knowers(st) === 0 && leaving.some((h) => h.knows)) {
          st.knowersGone = year;
          say(3, 'knowledge-lost', 'The last household that knew how to save seed has gone.');
        }
      }
      if (st.households.length === 0) {
        st.collapse = { year, cause: collapseCause(st, year, knew) };
        say(3, 'collapse', `The last household left the valley. ${st.collapse.cause}`);
      }
    }

    if (isAlive(st)) {
      // Generational turnover and teaching.
      for (const h of st.households) {
        if (rand() >= B.turnoverChance) continue;
        h.gen++;
        if (!h.knows) continue;
        const others = knowers(st) - 1;
        if (rand() >= (st.civ.stage >= 4 ? 1 : others > 0 ? B.keepKnowledgeShared : B.keepKnowledgeAlone)) {
          h.knows = false;
          h.lineage = null;
          if (others === 0) {
            st.knowersGone = year;
            say(3, 'knowledge-lost', `${h.name}'s elder died and seed saving died with them. No household knows it now.`);
          } else say(1, 'knowledge-fade', `${h.name}'s household let seed saving lapse.`);
        }
      }
      let taught = 0;
      for (const h of st.households.filter((x) => x.knows)) {
        if (rand() >= B.teachChance) continue;
        const pupils = st.households.filter((x) => !x.knows);
        if (!pupils.length) break;
        const pupil = pupils[Math.floor(rand() * pupils.length)];
        pupil.knows = true;
        pupil.lineage = { ...h.lineage };
        taught++;
      }
      if (taught) say(1, 'teach', `${plural(taught, 'household')} learned seed saving from a neighbour.`, { n: taught });

      // Growth: larger settlements draw more newcomers.
      const stock = low.food + ridge.food;
      const tries = 1 + Math.floor(st.households.length / 12);
      let settled = 0;
      let where = '';
      for (let i = 0; i < tries; i++) {
        const rg = rand();
        const rk = rand();
        if (shortage > 0.001 || stock < st.households.length * B.growthReserve || rg >= B.growthChance) continue;
        const share = knowers(st) / st.households.length;
        const h = addHousehold(st, st.floodMemory >= B.uphillMemory, B);
        if (!h) break;
        if (st.civ.stage >= 4 || rk < share * B.inheritChance) {
          h.knows = true;
          const parent = st.households.find((x) => x.knows && x !== h);
          h.lineage = parent && parent.lineage ? { ...parent.lineage } : null;
        }
        settled++;
        where = h.house < 0 ? (st.civ.stage >= 4 ? 'in the Hold' : 'in the town') : st.houses[h.house].elev === 'ridge' ? 'on the ridge' : 'by the river';
      }
      if (settled) {
        st.stats.settled += settled;
        st.stats.peakHouseholds = Math.max(st.stats.peakHouseholds, st.households.length);
        say(2, 'settle', settled === 1 ? `A new household settled ${where}.` : `${settled} new households settled.`, { n: settled });
      }
      grow(st, B, year, say, shortage);
      adapt(st, B, year, say, rand);
    }
  }

  // Decay: runs whether or not anyone is left.
  for (const p of st.plots) {
    if (p.state === 'fallow' && year - p.lastWorked >= B.fallowYearsToOvergrow) {
      p.state = 'overgrown';
      p.since = year;
    } else if (p.state === 'damaged' && year - p.since >= B.damagedYearsToOvergrow) {
      p.state = 'overgrown';
      p.since = year;
    } else if (p.state === 'eroded' && rand() < B.flood.siltChance) {
      p.state = 'wild';
      p.since = year;
      say(2, 'silt', 'The river shifted and left new silt where a field once stood.');
    }
  }
  for (const s of st.houses) {
    const age = year - s.since;
    if (s.state === 'empty' && age >= B.houseEmptyToRuin) (s.state = 'ruin'), (s.since = year);
    else if (s.state === 'ruin' && age >= B.houseRuinToRubble) (s.state = 'rubble'), (s.since = year);
    else if (s.state === 'rubble' && age >= B.houseRubbleToGone) (s.state = 'gone'), (s.since = year);
  }
  st.floodMemory *= B.flood.memoryDecay;
  const C = B.climate;
  st.river.wet = Math.max(C.min, Math.min(C.max, st.river.wet + (1 - st.river.wet) * C.revert + (rand() - 0.5) * C.drift));
}

// Settlement stages: Hamlet -> Village -> Town -> City -> the Hold.
function grow(st, B, year, say, shortage) {
  const G = B.stages;
  const civ = st.civ;
  const H = st.households.length;
  if (civ.stage > 0 && civ.stage < 4 && H < G.households[civ.stage] * G.shrink) {
    civ.stage--;
    civ.progress = 0;
    say(3, 'stage-down', `Too few remain to keep it up: the ${G.names[civ.stage + 1].toLowerCase()} has shrunk back to a ${G.names[civ.stage].toLowerCase()}.`);
    return;
  }
  if (civ.stage >= 4) return;
  if (shortage > 0.001) civ.progress = Math.max(0, civ.progress - G.setback);
  else if (H >= G.households[civ.stage + 1] && stageBlock(st, B) === null) civ.progress++;
  if (civ.progress < G.years[civ.stage + 1]) return;
  civ.stage++;
  civ.progress = 0;
  if (civ.reached[civ.stage] === null) civ.reached[civ.stage] = year;
  st.stats.peakStage = Math.max(st.stats.peakStage, civ.stage);
  if (civ.stage === 4) {
    // Everyone moves into one structure on the ridge; the old houses are taken down for stone.
    for (const h of st.households) h.house = -1;
    for (const s of st.houses) Object.assign(s, { state: 'gone', hid: null, since: year });
    if (!st.stores.ridge.built) Object.assign(st.stores.ridge, { built: true, builtBy: 'village', builtYear: year });
    for (const h of st.households) if (!h.knows) (h.knows = true), (h.lineage = (st.households.find((x) => x.lineage) || {}).lineage || null);
    say(3, 'stage', `The Hold is finished: one great terraced house on the ridge, above every flood, with room for all ${H} households and a seed vault at its heart.`);
  } else {
    const what = ['', `${H} households, a meeting hall and a shared threshing floor: the hamlet is a village.`, 'A levee along the bank and a market by the hall: the village is a town.', 'Stone blocks rise on the ridge and terraces climb behind them: the town is a city.'][civ.stage];
    say(3, 'stage', what);
  }
}

// What, apart from numbers and time, stops the settlement working toward its next stage.
export function stageBlock(st, B = BALANCE) {
  const G = B.stages;
  const next = st.civ.stage + 1;
  if (next > 4) return null;
  if (next >= G.needsRidgeStoreFrom && !st.stores.ridge.built) return 'no seed store on the ridge';
  const ridge = builtPlots(st).filter((p) => p.elev === 'ridge').length;
  if (ridge < G.needsRidgeFields[next]) return `only ${ridge} of the ${G.needsRidgeFields[next]} ridge fields it needs`;
  return null;
}

function adapt(st, B, year, say, rand) {
  const r1 = rand();
  const r2 = rand();
  const r3 = rand();
  const built = builtPlots(st);
  if (built.length === 0) return; // no farming tradition to extend
  const H = st.households.length;
  const seed = st.stores.low.seed + st.stores.ridge.seed;
  const food = st.stores.low.food + st.stores.ridge.food;
  const free = (elev) => st.plots.find((p) => p.elev === elev && (p.state === 'wild' || p.state === 'overgrown'));
  const clear = (p) => {
    p.state = 'fallow';
    p.since = year;
    p.lastWorked = year;
    p.builtBy = 'village';
    p.builtYear = year;
  };
  let cleared = 0;
  let uphill = 0;
  for (let i = 0; i < B.expandPerYear; i++) {
    const n = built.length + cleared;
    if (H * B.plotsPerHousehold - n < 1 || seed < (n + 1) * B.expandSeedPerPlot) break;
    const ridgeSite = free('ridge');
    const lowSite = free('low');
    // Villages copy what they see: once someone has farmed the ridge, they keep a share of fields there.
    const nRidge = st.plots.filter((p) => p.elev === 'ridge' && (p.state === 'fallow' || p.state === 'damaged')).length;
    const habit = nRidge > 0 && nRidge < (n + 1) * B.ridgeHabitShare;
    if (st.floodMemory >= B.uphillMemory && ridgeSite) {
      clear(ridgeSite);
      uphill++;
    } else if (habit && ridgeSite && food >= H * B.expandFoodReserve && (i === 0 ? r1 : r3) < B.expandChance) {
      clear(ridgeSite);
    } else if (food >= H * B.expandFoodReserve && (i === 0 ? r1 : r3) < B.expandChance && (lowSite || ridgeSite)) {
      clear(lowSite || ridgeSite);
    } else break;
    cleared++;
  }
  if (uphill) say(2, 'uphill', `After the floods, households cleared ${plural(uphill, 'new field')} on the ridge.`, { n: uphill });
  else if (cleared) say(1, 'expand', `Households cleared ${plural(cleared, 'new field')}.`, { n: cleared });
  const ridge = st.stores.ridge;
  if (!ridge.built && st.floodMemory >= B.storeMemory && knowers(st) >= B.storeKnowers && r2 < B.storeChance) {
    ridge.built = true;
    ridge.builtBy = 'village';
    ridge.builtYear = year;
    say(3, 'store', 'Seed-saving households built a seed store on the ridge.');
  }
}

function collapseCause(st, year, knew) {
  if (!st.everPlanted) return 'No field was ever planted, and the opening stores ran out.';
  const flood = st.river.lastFlood;
  const e = st.sky.lastEruption;
  if (e && year - e.year <= 4) return `Ash from the eruption of year ${e.year} smothered the harvests.`;
  const t = st.sky.lastTornado;
  if (t && year - t.year <= 2) return `The village never recovered from the tornado of year ${t.year}.`;
  if (st.year0.planted === 0) {
    if (st.seedLostYear !== null && year - st.seedLostYear <= 3)
      return st.stores.ridge.built
        ? `The flood of year ${st.seedLostYear} took the lowland seed, and the ridge reserve was too small to replant with.`
        : `The flood of year ${st.seedLostYear} took the seed, and nothing was stored above the water to replant with.`;
    if (st.knowersGone !== null) return `Seed ran out: no household had known how to save it since year ${st.knowersGone}.`;
    if (knew === 0) return 'Seed ran out: no household knew how to save it.';
    return 'The seed ran out and the fields went unplanted.';
  }
  if (flood && flood.year === year && flood.level >= 2) return 'The flood took the harvest and the stores, and hunger did the rest.';
  if (st.river.drought) return 'Drought shrank the harvest below what the households needed.';
  if (flood && year - flood.year <= 3) return `The fields never recovered from the flood of year ${flood.year}.`;
  return 'The harvests could not feed the households that remained.';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------------------------
// Player interventions. Each returns { ok, text } and records itself in st.actions.
// The game controller decides when they are allowed and what they cost.
function record(st, type, by, detail) {
  st.actions.push({ year: yearOf(st), type, by, ...detail });
}

export function canBuildPlot(st, id) {
  const p = st.plots[id];
  return p.state === 'wild' || p.state === 'overgrown';
}
export function buildPlot(st, id, by) {
  if (!canBuildPlot(st, id)) return { ok: false, text: 'Nothing to clear here.' };
  const p = st.plots[id];
  const year = yearOf(st);
  Object.assign(p, { state: 'fallow', since: year, lastWorked: year, builtBy: by, builtYear: year });
  record(st, 'build-plot', by, { plot: id, elev: p.elev });
  return { ok: true, text: `${by} cleared a ${p.elev === 'low' ? 'floodplain' : 'ridge'} field.` };
}
export function repairPlot(st, id, by) {
  const p = st.plots[id];
  if (p.state !== 'damaged') return { ok: false, text: 'This field is not damaged.' };
  const year = yearOf(st);
  Object.assign(p, { state: 'fallow', since: year, lastWorked: year });
  record(st, 'repair-plot', by, { plot: id });
  return { ok: true, text: `${by} dug the silt out of the field.` };
}
export function buildRidgeStore(st, by) {
  const s = st.stores.ridge;
  if (s.built) return { ok: false, text: 'The ridge store already stands.' };
  Object.assign(s, { built: true, builtBy: by, builtYear: yearOf(st) });
  record(st, 'build-store', by, {});
  return { ok: true, text: `${by} built a seed store on the ridge.` };
}
export function carryAmount(st, B = BALANCE) {
  return st.stores.ridge.built ? Math.min(st.stores.low.seed, Math.max(1, Math.ceil(st.stores.low.seed * B.carryShare))) : 0;
}
export function carrySeedUphill(st, by, B = BALANCE) {
  const n = carryAmount(st, B);
  if (!st.stores.ridge.built) return { ok: false, text: 'There is no store on the ridge yet.' };
  if (n < 0.5) return { ok: false, text: 'The granary has no seed to carry.' };
  st.stores.low.seed -= n;
  st.stores.ridge.seed += n;
  record(st, 'carry-seed', by, { amount: n });
  return { ok: true, text: `${by} carried ${Math.round(n)} seed up to the ridge store.` };
}
export function demonstrate(st, teacherHid, witnessHids, by) {
  const teacher = st.households.find((h) => h.id === teacherHid);
  if (!teacher || !teacher.knows) return { ok: false, text: `${by} does not know how to save seed.` };
  const year = yearOf(st);
  const learned = [];
  for (const id of witnessHids) {
    const h = st.households.find((x) => x.id === id);
    if (!h || h.knows) continue;
    h.knows = true;
    h.lineage = { root: 'demo', year, by };
    learned.push(h.name);
  }
  if (!learned.length) return { ok: false, text: 'Nobody nearby still needs to learn this.' };
  record(st, 'demonstrate', by, { learned });
  return { ok: true, text: `${by} showed ${learned.join(' and ')} how to save seed.`, learned };
}
