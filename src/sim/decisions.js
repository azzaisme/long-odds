// Every decision the player can leave behind is data in this file: practices that households
// learn and pass on, customs the whole village keeps, and the crop grown on each field.
// The simulation reads these tables; adding a row adds a decision.

// Practices: taught by demonstration, spread to neighbours, lost at generational turnover.
// `share` below means the share of households that hold the practice.
export const PRACTICES = [
  { id: 'seed', name: 'Seed saving', does: 'Keeps 1.5 seed from each field instead of 0.3, restores silted fields, and carries spare seed uphill.' },
  { id: 'dry', name: 'Drying and smoking food', does: 'Stored food spoils up to half as fast.', spoilCut: 0.5 },
  { id: 'terrace', name: 'Terracing', does: 'Ridge fields yield up to 30% more.', ridgeYield: 0.3 },
  { id: 'marks', name: 'Flood marks', does: 'Households read the river and haul stock up before a flood: up to 70% less lost from the lowland granary.', granarySave: 0.7 },
  { id: 'watch', name: 'Watching the mountain', does: 'When the volcano erupts in earnest, up to 80% of those who would have died get out in time.', eruptionSave: 0.8 },
  { id: 'stone', name: 'Building in stone', does: 'Up to 70% fewer houses lost to a tornado, and a landslide takes half as much from the ridge store.', tornadoSave: 0.7, slideSave: 0.5 },
];
export const PRACTICE = Object.fromEntries(PRACTICES.map((p) => [p.id, p]));

// Customs: one setting each for the whole village. `base` is what a village does when nobody
// has told it otherwise; over the centuries a custom drifts back toward it one step at a time.
export const CUSTOMS = [
  { id: 'reserve', name: 'Ridge seed reserve', ask: 'How much ridge seed is left untouched in an ordinary spring?', base: 1,
    options: [{ label: 'None', v: 0 }, { label: '4 seed', v: 4 }, { label: '8 seed', v: 8 }, { label: '12 seed', v: 12 }] },
  { id: 'uphillSeed', name: 'Seed carried uphill', ask: 'How much of the spare seed do seed-savers carry to the ridge store?', base: 2,
    options: [{ label: 'None', v: 0 }, { label: 'A third', v: 0.3 }, { label: 'Most', v: 0.6 }, { label: 'Nearly all', v: 0.9 }] },
  { id: 'uphillFood', name: 'Food stored uphill', ask: 'How much of each harvest is stored on the ridge, safe from floods but in the path of landslides?', base: 1,
    options: [{ label: 'None', v: 0 }, { label: 'A third', v: 0.3 }, { label: 'Half', v: 0.5 }, { label: 'Most', v: 0.7 }] },
  { id: 'fields', name: 'Where new fields go', ask: 'When the village clears a field on its own, where?', base: 2,
    options: [{ label: 'Floodplain only', v: 0 }, { label: 'Mostly floodplain', v: 0.25 }, { label: 'Balanced', v: 0.4 }, { label: 'Mostly ridge', v: 0.7 }] },
  { id: 'pace', name: 'Pace of clearing', ask: 'How readily does the village clear new fields?', base: 1,
    options: [{ label: 'Cautious', v: { seed: 2.0, chance: 0.3 } }, { label: 'Steady', v: { seed: 1.4, chance: 0.6 } }, { label: 'Eager', v: { seed: 1.0, chance: 0.9 } }] },
  { id: 'settle', name: 'Where newcomers build', ask: 'Where do new households put their houses?', base: 1,
    options: [{ label: 'By the river', v: 'low' }, { label: 'Uphill after floods', v: 'memory' }, { label: 'On the ridge', v: 'ridge' }] },
  { id: 'plant', name: 'Planting order', ask: 'When seed or hands are short, which fields are planted first?', base: 0,
    options: [{ label: 'Floodplain first', v: 'low' }, { label: 'Ridge first', v: 'ridge' }] },
  { id: 'hunger', name: 'Seed in a hungry winter', ask: 'When food runs out, is the seed eaten?', base: 0,
    options: [{ label: 'Only if nobody knows better', v: 'default' }, { label: 'Never touch the seed', v: 'never' }, { label: 'Eat seed before anyone leaves', v: 'eat' }] },
];
export const CUSTOM = Object.fromEntries(CUSTOMS.map((c) => [c.id, c]));

// Crops: chosen field by field. Multipliers apply to that field's harvest and losses.
export const CROPS = [
  { id: 'grain', name: 'Grain', does: 'The full harvest in a good year.', yield: 1, highWater: 1, drought: 1 },
  { id: 'roots', name: 'Roots', does: 'Three-quarters of the harvest, but high water does not spoil it and drought hurts it less.', yield: 0.75, highWater: 0, drought: 0.4 },
  { id: 'millet', name: 'Millet', does: 'Slightly less than grain; shrugs off drought, rots twice as readily in high water.', yield: 0.85, highWater: 2, drought: 0 },
];
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export const defaultCustoms = () => Object.fromEntries(CUSTOMS.map((c) => [c.id, c.base]));
export const customValue = (st, id) => CUSTOM[id].options[st.customs[id]].v;
export const holds = (h, id) => (id === 'seed' ? h.knows : !!h.skills[id]);
export const holders = (st, id) => st.households.reduce((n, h) => n + (holds(h, id) ? 1 : 0), 0);
export const share = (st, id) => (st.households.length ? holders(st, id) / st.households.length : 0);

// Number of distinct settings a player can choose between, for the record.
export function decisionCount(households, fields) {
  return {
    practices: PRACTICES.length * households,
    customs: CUSTOMS.reduce((n, c) => n + c.options.length, 0),
    crops: CROPS.length * fields,
  };
}
