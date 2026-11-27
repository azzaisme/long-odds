// Every decision the player can leave behind is data in this file: practices that households
// learn and pass on, customs the whole village keeps, and the crop grown on each field.
// The simulation reads these tables; adding a row adds a decision.

// Ideas live in individual people. The six base ideas can be demonstrated by the god. Every
// other idea has two parents (`from`) and can only be worked out by a person who holds both,
// which usually means the child of a marriage between families that each kept one of them.
// `fx` are effects on the simulation, each scaled by the share of households that hold the idea.
export const IDEAS = [
  { id: 'seed', name: 'Seed saving', base: true, does: 'Keeps 1.5 seed from each field instead of 0.3, restores silted fields, and carries spare seed uphill.', fx: {} },
  { id: 'dry', name: 'Drying and smoking food', base: true, does: 'Stored food spoils up to half as fast.', fx: { spoilCut: 0.5 } },
  { id: 'terrace', name: 'Terracing', base: true, does: 'Ridge fields yield up to 30% more.', fx: { ridgeYield: 0.3 } },
  { id: 'marks', name: 'Flood marks', base: true, does: 'Stock is hauled up before a flood: up to 60% less lost from the lowland granary.', fx: { granarySave: 0.6 } },
  { id: 'watch', name: 'Watching the mountain', base: true, does: 'In a killing eruption, up to 60% of those who would have died get out in time.', fx: { eruptionSave: 0.6 } },
  { id: 'stone', name: 'Building in stone', base: true, does: 'Up to 50% fewer houses lost to a tornado; a landslide takes less from the ridge store.', fx: { tornadoSave: 0.5, slideSave: 0.4 } },

  { id: 'jars', name: 'Seed jars', from: ['seed', 'dry'], does: 'Dried seed sealed in clay: stored seed spoils up to 60% slower.', fx: { seedKeep: 0.6 } },
  { id: 'selection', name: 'Seed selection', from: ['seed', 'terrace'], does: 'Sowing only from the best plants: every field yields up to 12% more.', fx: { yieldAll: 0.12 } },
  { id: 'sealed', name: 'Sealed granary', from: ['dry', 'stone'], does: 'A stone granary: less spoilage and up to 30% less lost to floods.', fx: { spoilCut: 0.2, granarySave: 0.3 } },
  { id: 'levee', name: 'Levee', from: ['marks', 'stone'], does: 'A bank along the river: up to 80% of high-water crop losses avoided.', fx: { highWaterSave: 0.8 } },
  { id: 'walls', name: 'Retaining walls', from: ['terrace', 'stone'], does: 'The slope is held: landslides do far less, ridge fields yield a little more.', fx: { slideSave: 0.6, ridgeYield: 0.1 } },
  { id: 'irrigation', name: 'Irrigation channels', from: ['terrace', 'marks'], does: 'Water led to the fields: up to 70% of drought losses avoided.', fx: { droughtSave: 0.7 } },
  { id: 'almanac', name: 'Almanac', from: ['watch', 'marks'], does: 'Years of sky and river written down: floodplain fields yield up to 10% more and warnings come sooner.', fx: { lowYield: 0.1, eruptionSave: 0.2, granarySave: 0.1 } },
  { id: 'refuge', name: 'Refuge on the ridge', from: ['watch', 'stone'], does: 'A strong house to run to: fewer lost to tornadoes and eruptions.', fx: { tornadoSave: 0.3, eruptionSave: 0.2 } },

  { id: 'canals', name: 'Canals', from: ['levee', 'irrigation'], does: 'The river put to work: floodplain fields yield up to 25% more.', fx: { lowYield: 0.25 } },
  { id: 'vault', name: 'Seed vault', from: ['jars', 'sealed'], does: 'Seed kept for generations, and safe from water.', fx: { seedKeep: 0.4, granarySave: 0.2 } },
  { id: 'school', name: 'School', from: ['almanac', 'jars'], does: 'Children are taught what the village knows, not only what their parents know.', fx: { schooling: 1 } },
  { id: 'guild', name: 'Masons’ guild', from: ['walls', 'levee'], does: 'Built to last: everything yields a little more and storms break less.', fx: { yieldAll: 0.1, tornadoSave: 0.2 } },
];
IDEAS.forEach((idea, i) => (idea.bit = 1 << i));
export const IDEA = Object.fromEntries(IDEAS.map((p) => [p.id, p]));
for (const idea of IDEAS) idea.need = idea.from ? IDEA[idea.from[0]].bit | IDEA[idea.from[1]].bit : 0;
export const DERIVED = IDEAS.filter((i) => i.from);
export const PRACTICES = IDEAS.filter((p) => p.base); // what the god can demonstrate
export const PRACTICE = IDEA;

// Customs: one setting each for the whole village. `base` is what a village does when nobody
// has told it otherwise; over the centuries a custom drifts back toward it one step at a time.
export const CUSTOMS = [
  { id: 'reserve', name: 'Ridge seed reserve', ask: 'How much ridge seed is left untouched in an ordinary spring?', base: 1,
    options: [{ label: 'None', v: 0, t: ['fields planted+', 'seed kept safe-'] }, { label: '4 seed', v: 4, t: ['seed kept safe+'] }, { label: '8 seed', v: 8, t: ['seed kept safe+', 'fields planted-'] }, { label: '12 seed', v: 12, t: ['seed kept safe+', 'fields planted-'] }] },
  { id: 'uphillSeed', name: 'Seed carried uphill', ask: 'How much of the spare seed do seed-savers carry to the ridge store?', base: 2,
    options: [{ label: 'None', v: 0, t: ['flood losses+', 'landslide losses-'] }, { label: 'A third', v: 0.3, t: ['flood losses-', 'landslide losses+'] }, { label: 'Most', v: 0.6, t: ['flood losses-', 'landslide losses+'] }, { label: 'Nearly all', v: 0.9, t: ['flood losses-', 'landslide losses+'] }] },
  { id: 'uphillFood', name: 'Food stored uphill', ask: 'How much of each harvest is stored on the ridge, safe from floods but in the path of landslides?', base: 1,
    options: [{ label: 'None', v: 0, t: ['flood losses+', 'landslide losses-', 'storm losses-'] }, { label: 'A third', v: 0.3, t: ['flood losses-', 'landslide losses+'] }, { label: 'Half', v: 0.5, t: ['flood losses-', 'landslide losses+', 'storm losses+'] }, { label: 'Most', v: 0.7, t: ['flood losses-', 'landslide losses+', 'storm losses+'] }] },
  { id: 'fields', name: 'Where new fields go', ask: 'When the village clears a field on its own, where?', base: 2,
    options: [{ label: 'Floodplain only', v: 0, t: ['harvest+', 'flood losses+', 'drought losses-'] }, { label: 'Mostly floodplain', v: 0.25, t: ['harvest+', 'flood losses+'] }, { label: 'Balanced', v: 0.4, t: ['harvest-', 'flood losses-'] }, { label: 'Mostly ridge', v: 0.7, t: ['harvest-', 'flood losses-', 'drought losses+'] }] },
  { id: 'pace', name: 'Pace of clearing', ask: 'How readily does the village clear new fields?', base: 1,
    options: [{ label: 'Cautious', v: { seed: 2.0, chance: 0.3 }, t: ['seed in store+', 'fields-'] }, { label: 'Steady', v: { seed: 1.4, chance: 0.6 }, t: [] }, { label: 'Eager', v: { seed: 1.0, chance: 0.9 }, t: ['fields+', 'seed in store-', 'forest-'] }] },
  { id: 'settle', name: 'Where newcomers build', ask: 'Where do new households put their houses?', base: 1,
    options: [{ label: 'By the river', v: 'low', t: ['storm losses+'] }, { label: 'Uphill after floods', v: 'memory', t: ['storm losses-'] }, { label: 'On the ridge', v: 'ridge', t: ['storm losses+'] }] },
  { id: 'plant', name: 'Planting order', ask: 'When seed or hands are short, which fields are planted first?', base: 0,
    options: [{ label: 'Floodplain first', v: 'low', t: ['harvest+', 'flood losses+'] }, { label: 'Ridge first', v: 'ridge', t: ['harvest-', 'flood losses-', 'drought losses+'] }] },
  { id: 'hunger', name: 'Seed in a hungry winter', ask: 'When food runs out, is the seed eaten?', base: 0,
    options: [{ label: 'Only if nobody knows better', v: 'default', t: [] }, { label: 'Never touch the seed', v: 'never', t: ['seed in store+', 'people leaving+'] }, { label: 'Eat seed before anyone leaves', v: 'eat', t: ['seed in store-', 'people leaving-'] }] },
  { id: 'woodcut', name: 'Cutting wood', ask: 'How does the village take its firewood and timber?', base: 1,
    options: [{ label: 'Leave the forest alone', v: 'none', t: ['forest+', 'timber-', 'new houses-', 'winter deaths+'] }, { label: 'Thin it: never the last trees of a stand', v: 'thin', t: ['timber+', 'forest-'] }, { label: 'Fell whatever is nearest', v: 'clear', t: ['timber+', 'forest-', 'game-', 'flood risk+', 'landslide risk+'] }] },
  { id: 'hunt', name: 'Hunting', ask: 'How hard is the game in the forests hunted?', base: 2,
    options: [{ label: 'Never', v: 0, t: ['game+', 'food-'] }, { label: 'Lightly', v: 0.08, t: ['game+', 'food-'] }, { label: 'As the pot needs', v: 0.2, t: ['food+', 'game-'] }, { label: 'All that can be caught', v: 0.45, t: ['food+', 'game-'] }] },
  { id: 'clearing', name: 'Forest into fields', ask: 'When the open ground is all taken, does the village clear forest for fields?', base: 1,
    options: [{ label: 'Never', v: 'never', t: ['forest+', 'game+', 'fields-'] }, { label: 'Only in a hungry year', v: 'hungry', t: ['fields+', 'forest-'] }, { label: 'Whenever land runs out', v: 'always', t: ['fields+', 'forest-', 'game-', 'flood risk+', 'landslide risk+'] }] },
];
export const CUSTOM = Object.fromEntries(CUSTOMS.map((c) => [c.id, c]));

// Crops: chosen field by field. Multipliers apply to that field's harvest and losses.
export const CROPS = [
  { id: 'grain', name: 'Grain', does: 'The full harvest in a good year.', yield: 1, highWater: 1, drought: 1, t: ['harvest+', 'flood losses+', 'drought losses+'] },
  { id: 'roots', name: 'Roots', does: 'Three-quarters of the harvest, but high water does not spoil it and drought hurts it less.', yield: 0.75, highWater: 0, drought: 0.4, t: ['harvest-', 'flood losses-', 'drought losses-'] },
  { id: 'millet', name: 'Millet', does: 'Slightly less than grain; shrugs off drought, rots twice as readily in high water.', yield: 0.85, highWater: 2, drought: 0, t: ['harvest-', 'drought losses-', 'flood losses+'] },
];
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));

// Bridges: planned by the god, built by the village over years of fed winters. `washout` is the
// chance each kind is carried away by high water, a flood, and a great flood.
export const BRIDGES = [
  { id: 'rope', name: 'Footbridge', years: 1, food: 2, washout: [0.5, 1, 1], rot: 0.08, does: 'Rope and planks. Up in a year. Any high water may take it, and a real flood will.', t: ['far-bank fields+', 'west forest+', 'newcomers+', 'timber-', 'cut-off risk+'] },
  { id: 'timber', name: 'Timber bridge', years: 6, food: 2, washout: [0.03, 0.5, 1], rot: 0.01, does: 'Trestles driven into the bed. Six years of work. Stands through high water; a flood takes it half the time.', t: ['far-bank fields+', 'west forest+', 'newcomers+', 'timber-', 'food-'] },
  { id: 'stone', name: 'Stone bridge', years: 25, food: 3, washout: [0, 0.04, 0.4], rot: 0, needs: 'stone', does: 'Arches on stone piers. Twenty-five years, and only while somebody knows building in stone. Almost nothing moves it.', t: ['far-bank fields+', 'west forest+', 'newcomers+', 'food-', 'cut-off risk-'] },
];
export const BRIDGE = Object.fromEntries(BRIDGES.map((b) => [b.id, b]));

// What each decision touches, and which way it pushes: "harvest+" reads "harvest up". These are
// shown beside every choice. They carry no numbers and no verdict; the weighing is the player's.
const FX_TOUCH = {
  spoilCut: 'food spoilage-', ridgeYield: 'ridge harvest+', granarySave: 'flood losses-', eruptionSave: 'eruption deaths-',
  tornadoSave: 'storm losses-', slideSave: 'landslide losses-', seedKeep: 'seed spoilage-', yieldAll: 'harvest+',
  highWaterSave: 'flood losses-', droughtSave: 'drought losses-', lowYield: 'floodplain harvest+', schooling: 'ideas kept+',
};
for (const idea of IDEAS) idea.t = idea.id === 'seed' ? ['seed in store+', 'fields restored+', 'seed kept safe+'] : [...new Set(Object.keys(idea.fx).map((k) => FX_TOUCH[k]))];
// Work done on the ground.
export const WORK_TOUCH = {
  'field-low': ['harvest+', 'flood losses+', 'seed needed+'],
  'field-ridge': ['harvest+', 'drought losses+', 'seed needed+'],
  'field-far': ['harvest+', 'flood losses+', 'cut-off risk+'],
  store: ['seed kept safe+', 'flood losses-', 'landslide losses+'],
  carry: ['seed kept safe+', 'landslide losses+'],
  fell: ['timber+', 'forest-', 'game-'],
  'clear-west': ['fields+', 'timber+', 'forest-', 'game-', 'flood risk+'],
  'clear-east': ['fields+', 'timber+', 'forest-', 'game-', 'landslide risk+'],
  move: { ridge: ['flood losses-', 'storm losses'], low: ['storm losses'] },
};

export const defaultCustoms = () => Object.fromEntries(CUSTOMS.map((c) => [c.id, c.base]));
export const customValue = (st, id) => CUSTOM[id].options[st.customs[id]].v;
export const holds = (h, id) => !!h.ideas[id];
export const holders = (st, id) => st.households.reduce((n, h) => n + (h.ideas[id] ? 1 : 0), 0);
export const share = (st, id) => (st.households.length ? holders(st, id) / st.households.length : 0);
// Total effect of every idea that touches `key`, capped at `cap`.
export function mod(st, key, cap = 0.95) {
  const H = st.households.length;
  if (!H) return 0;
  let v = 0;
  for (const idea of IDEAS) {
    const f = idea.fx[key];
    if (!f) continue;
    let n = 0;
    for (const h of st.households) if (h.ideas[idea.id]) n++;
    v += (f * n) / H;
  }
  return Math.min(cap, v);
}
// Ideas that only this pairing brings within reach: each needs something from both sides.
export function possibleIdeas(a, b) {
  const have = { ...a.ideas, ...b.ideas };
  const alone = (p, i) => p.ideas[i.from[0]] && p.ideas[i.from[1]];
  return IDEAS.filter((i) => i.from && !a.ideas[i.id] && !b.ideas[i.id] && have[i.from[0]] && have[i.from[1]] && !alone(a, i) && !alone(b, i));
}

// Number of distinct settings a player can choose between, for the record.
export function decisionCount(households, fields) {
  return {
    ideas: IDEAS.length,
    practices: PRACTICES.length * households,
    customs: CUSTOMS.reduce((n, c) => n + c.options.length, 0),
    crops: CROPS.length * fields,
  };
}
