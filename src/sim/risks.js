// Plain-language condition report, plus optional numerical odds from cloned simulations.
import { BALANCE } from './balance.js';
import { hashSeed } from './rng.js';
import { BRIDGE } from './decisions.js';
import { cloneSim, runYears, knowers, builtPlots, yearOf, isAlive, stageBlock, forestCover } from './sim.js';

export function summary(st) {
  const built = builtPlots(st);
  return {
    year: yearOf(st),
    stage: st.civ.stage,
    stageName: BALANCE.stages.names[st.civ.stage],
    households: st.households.length,
    people: st.people.length,
    wood: st.forest.wood,
    coverWest: forestCover(st, 'west'),
    coverEast: forestCover(st, 'east'),
    game: st.forest.game.west + st.forest.game.east,
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
  const built = builtPlots(st);
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
  const pct = (v) => `${Math.round(v * 100)}%`;
  const fuel = st.people.length * B.forest.fuel;
  if (s.coverEast === 0 && s.coverWest === 0) add('danger', 'Both forests are gone. There is no timber, no firewood and no game, and nothing left to seed new trees.');
  else {
    if (s.coverEast < 0.35) add(s.coverEast === 0 ? 'danger' : 'warn', s.coverEast === 0 ? 'The east forest is gone. The bare ridge slides more easily.' : `Only ${pct(s.coverEast)} of the east forest still stands.`);
    if (s.coverWest < 0.35) add(s.coverWest === 0 ? 'danger' : 'warn', s.coverWest === 0 ? 'The west forest is gone. Without it the river floods more often.' : `Only ${pct(s.coverWest)} of the west forest still stands.`);
  }
  if (st.forest.cold > 0.2) add('warn', 'Last winter there was not enough firewood. Cold winters kill.');
  else if (s.wood < fuel) add('warn', 'The woodpile will not last the winter.');
  if (st.forest.game.east < 1 && st.forest.game.west < 1) add('warn', 'There is no game left in either forest.');
  else if (st.forest.game.east < 6 && st.forest.game.east > 0) add('warn', 'Game is scarce in the east forest. Hunt it harder and it will be gone.');
  if (s.coverEast > 0.7 && s.coverWest > 0.7 && s.game > 30) add('good', 'Both forests stand, and there is game in them.');
  const br = st.bridge;
  const farFields = built.filter((p) => p.far).length;
  if (br.built === 'rope') add('warn', `The far bank hangs on a footbridge. Any high water may take it${farFields ? `, and ${farFields} field${farFields === 1 ? '' : 's'} with it` : ''}.`);
  else if (br.built === 'timber') add('good', 'A timber bridge stands. High water will not move it; a real flood might.');
  else if (br.built === 'stone') add('good', 'A stone bridge stands. Only a great flood threatens it.');
  if (!br.built && farFields) add('danger', `${farFields} far-bank field${farFields === 1 ? ' is' : 's are'} cut off: there is no bridge.`);
  if (br.plan && br.plan !== br.built) add('note', `Planned: a ${BRIDGE[br.plan].name.toLowerCase()}, ${br.progress} of ${BRIDGE[br.plan].years} years built${br.stalled ? ', stalled for want of someone who knows stone' : ''}.`);
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
