// Plain-language condition report, plus optional numerical odds from cloned simulations.
import { BALANCE } from './balance.js';
import { hashSeed } from './rng.js';
import { cloneSim, runYears, knowers, builtPlots, yearOf, isAlive, stageBlock } from './sim.js';

export function summary(st) {
  const built = builtPlots(st);
  return {
    year: yearOf(st),
    stage: st.civ.stage,
    stageName: BALANCE.stages.names[st.civ.stage],
    households: st.households.length,
    people: st.people.length,
    knowers: knowers(st),
    food: st.stores.low.food + st.stores.ridge.food,
    foodRidge: st.stores.ridge.food,
    seedLow: st.stores.low.seed,
    seedRidge: st.stores.ridge.seed,
    ridgeStore: st.stores.ridge.built,
    fieldsLow: built.filter((p) => p.elev === 'low').length,
    fieldsRidge: built.filter((p) => p.elev === 'ridge').length,
    damaged: built.filter((p) => p.state === 'damaged').length,
  };
}

// Returns [{ level: 'danger' | 'warn' | 'good', text }], worst first.
export function assessRisks(st, B = BALANCE) {
  const s = summary(st);
  const out = [];
  const add = (level, text) => out.push({ level, text });
  if (!isAlive(st)) return [{ level: 'danger', text: 'Nobody lives here any more.' }];
  const fields = s.fieldsLow + s.fieldsRidge;
  const yearsOfFood = s.food / (s.households * (B.consumption - B.forage));
  const seed = s.seedLow + s.seedRidge;
  const flood = st.river.floods.length ? st.river.floods.reduce((a, f) => (f.level > a.level ? f : a)) : null;

  if (fields === 0) {
    add('danger', `No working farms. The stores feed ${plural(s.households, 'household')} for about ${fmtYears(yearsOfFood)}.`);
  } else {
    if (s.fieldsRidge === 0) add('danger', flood && flood.level >= 2 ? `Every farm is below the flood line of year ${flood.year}.` : 'Every farm is on the floodplain, below the last flood line.');
    else if (s.fieldsLow === 0) add('warn', 'Every farm is on the ridge: safe from floods, but thin harvests and hard hit by drought.');
    else add('good', `${plural(s.fieldsRidge, 'ridge field')} sheltered from ordinary floods, ${plural(s.fieldsLow, 'floodplain field')} for the bigger harvests.`);
    if (fields < s.households) add('warn', `${plural(fields, 'field')} for ${plural(s.households, 'household')}: not enough harvest to go round yet.`);
  }
  const onlyOne = Object.keys(st.discovered).concat(['seed', 'dry', 'terrace', 'marks', 'watch', 'stone']).filter((id) => st.people.filter((p) => p.ideas[id]).length === 1);
  if (onlyOne.length) add('warn', `Held by one person only, and lost if they die: ${onlyOne.join(', ')}.`);
  if (s.knowers === 0) add('danger', 'No household knows how to save seed. What is planted will not come back.');
  else if (s.knowers === 1) add('warn', 'Only one household knows how to save seed. One death could end the practice.');
  else add('good', `${s.knowers} households know how to save seed.`);

  if (seed < 0.5) add('danger', 'There is no seed at all.');
  else if (s.seedRidge < 0.5) add(fields ? 'danger' : 'warn', 'All seed sits in the lowland granary. One flood can take the harvest and the seed together.');
  else add('good', `${Math.round(s.seedRidge)} seed is stored on the ridge, above any ordinary flood.`);
  if (seed >= 0.5 && fields > 0 && seed < fields) add('warn', `Seed for ${Math.floor(seed)} of ${plural(fields, 'field')}.`);

  if (s.damaged > 0) add('warn', `${plural(s.damaged, 'field')} lie under flood silt${s.knowers ? '' : ', and nobody knows how to restore them'}.`);
  if (fields > 0 && yearsOfFood < 1) add('warn', `Food in store covers ${fmtYears(yearsOfFood)}.`);
  const sky = st.sky;
  const year = yearOf(st);
  if (sky.rumble > 0) add('danger', 'The mountain is smoking. An eruption is coming within a few years: ash will starve the harvests, and it may be worse than ash.');
  else if (sky.ash > 0) add('danger', `Ash lies on the fields. Harvests will be thin for ${sky.ash === 1 ? 'another year' : `${sky.ash} more years`}.`);
  else if (sky.fertile > 0 && sky.lastEruption) add('good', 'The old ash has made rich soil: harvests are up for some years.');
  if (sky.lastSlide && year - sky.lastSlide.year <= 10) add('warn', `A landslide came down the slope in year ${sky.lastSlide.year}. The nearest ridge fields and the ridge store are in its path.`);
  if (sky.lastTornado && year - sky.lastTornado.year <= 10) add('warn', `A tornado crossed ${sky.lastTornado.side === 'low' ? 'the floodplain' : 'the ridge'} in year ${sky.lastTornado.year}. Houses on both levels spread that risk.`);
  if (st.river.wet > 1.25) add('warn', 'The river has been running high for years.');
  else if (st.river.wet < 0.75) add('warn', 'These have been dry years. Ridge fields suffer most in drought.');
  // The long goal: a settlement that grows until one great structure houses everyone.
  const G = B.stages;
  const next = st.civ.stage + 1;
  if (next > 4) add('good', 'The Hold houses every household above the flood line, with its own seed vault.');
  else {
    const block = stageBlock(st, B);
    const name = G.names[next] === 'The Hold' ? 'the Hold, one great house for everyone' : `a ${G.names[next].toLowerCase()}`;
    if (s.households < G.households[next]) add('note', `To become ${name}: ${G.households[next]} households (now ${s.households}), then ${G.years[next]} fed years.`);
    else if (block) add('note', `Big enough to become ${name}, but it has ${block}.`);
    else add('good', `Growing toward ${name}: ${st.civ.progress} of ${G.years[next]} fed years.`);
  }
  const rank = { danger: 0, warn: 1, good: 2, note: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtYears = (y) => (y < 0.75 ? 'half a year' : y < 1.5 ? 'one year' : `${Math.round(y)} years`);

// Monte Carlo odds. Works only on clones with independent seeds: the live state and its
// random sequence are never read after cloning and never written.
export function* estimateSurvival(st, years, trials, B = BALANCE) {
  let survived = 0;
  for (let i = 0; i < trials; i++) {
    const c = cloneSim(st);
    c.rng.a = hashSeed('odds', st.seed, st.tick, years, i);
    runYears(c, years, null, B);
    if (isAlive(c)) survived++;
    yield { done: i + 1, trials, survived, p: survived / (i + 1) };
  }
}
