import * as S from '../src/sim/sim.js';
import { playVisit } from '../src/sim/strategies.js';
const seed = Number(process.argv[2] || 2);
const st = S.createSim(seed);
const name = process.argv[3] || 'mixed + store + practices';
const marks = { 0: 0, 1: 1, 11: 2, 111: 3, 211: 4 };
const t0 = performance.now();
for (let y = 0; y <= 1200 && S.isAlive(st); y += 1) {
  if (y in marks) playVisit(st, name, marks[y]);
  S.runYears(st, 1);
  if (y % 100 === 0 || y < 3) console.log(S.yearOf(st), 'H', st.households.length, 'people', st.people.length, 'adults', st.households.reduce((a, h) => a + h.adults, 0), 'stage', st.civ.stage, 'food', (st.stores.low.food + st.stores.ridge.food).toFixed(0), 'plots', S.builtPlots(st).length, 'ideas', Object.keys(st.discovered).join(','), 'lines', st.lines.length);
}
console.log('ms', (performance.now() - t0).toFixed(0), st.collapse);
