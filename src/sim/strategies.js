// Scripted players for headless balance runs. They use the same action functions as the game
// and obey the same budget: three work actions per visit.
import { BALANCE } from './balance.js';
import { buildPlot, repairPlot, buildRidgeStore, carrySeedUphill, demonstrate, canBuildPlot, knowers } from './sim.js';

const freePlot = (st, elev) => st.plots.find((p) => p.elev === elev && canBuildPlot(st, p.id));
const damaged = (st, elev) => st.plots.find((p) => p.state === 'damaged' && (!elev || p.elev === elev));
const teach = (st) => {
  const t = st.households.find((h) => h.knows);
  const pupils = st.households.filter((h) => !h.knows).slice(0, 2).map((h) => h.id);
  return t && pupils.length ? demonstrate(st, t.id, pupils, t.name).ok : false;
};
const show = (st, id) => {
  const lacking = st.households.filter((h) => !h.ideas[id]);
  if (st.households.length - lacking.length >= 3 || !lacking.length) return false;
  return demonstrate(st, lacking[0].id, lacking.slice(1, 3).map((h) => h.id), lacking[0].name, id).ok;
};
const build = (st, elev) => {
  const p = freePlot(st, elev);
  return p ? buildPlot(st, p.id, 'player').ok : false;
};
const fix = (st, elev) => {
  const p = damaged(st, elev);
  return p ? repairPlot(st, p.id, 'player').ok : false;
};
const store = (st) => buildRidgeStore(st, 'player').ok;
const carry = (st) => st.stores.ridge.seed < 3 && carrySeedUphill(st, 'player').ok;

// Each strategy is an ordered list of wishes; the first three that succeed are the visit's work.
export const STRATEGIES = {
  'no farms': () => [],
  'lowland only': () => [(s) => fix(s, 'low'), (s) => build(s, 'low'), (s) => build(s, 'low'), (s) => build(s, 'low')],
  'lowland + teaching': (st) => [(s) => knowers(s) < 3 && teach(s), (s) => fix(s, 'low'), (s) => build(s, 'low'), (s) => build(s, 'low'), (s) => build(s, 'low')],
  'ridge only + teaching': (st) => [(s) => knowers(s) < 3 && teach(s), (s) => fix(s, 'ridge'), (s) => build(s, 'ridge'), (s) => build(s, 'ridge'), (s) => build(s, 'ridge')],
  'mixed, no ridge store': (st) => [(s) => knowers(s) < 3 && teach(s), (s) => build(s, 'low'), (s) => build(s, 'ridge'), fix, (s) => build(s, 'low'), (s) => build(s, 'ridge')],
  'mixed + store + practices': (st, visit) =>
    visit === 0
      ? [(s) => build(s, 'low'), (s) => build(s, 'ridge'), store]
      : [(s) => knowers(s) < 3 && teach(s), store, carry, ...['marks', 'dry', 'terrace', 'stone', 'watch'].map((id) => (s) => show(s, id)), (s) => build(s, 'ridge'), fix],
  'mixed + ridge seed store': (st, visit) =>
    visit === 0
      ? [(s) => build(s, 'low'), (s) => build(s, 'ridge'), store]
      : [(s) => knowers(s) < 3 && teach(s), store, carry, (s) => build(s, 'ridge'), fix, (s) => build(s, 'low'), (s) => build(s, 'ridge')],
};

export function playVisit(st, name, visit, B = BALANCE) {
  let left = B.actionsPerVisit;
  for (const wish of STRATEGIES[name](st, visit)) {
    if (left <= 0) break;
    if (wish(st)) left--;
  }
}
