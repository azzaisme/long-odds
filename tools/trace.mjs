// Prints one scripted run decade by decade: node tools/trace.mjs <seed> [strategy] [step]
import * as S from '../src/sim/sim.js';
import { playVisit } from '../src/sim/strategies.js';
const seed = Number(process.argv[2] || 2);
const name = process.argv[3] || 'mixed + store + practices';
const stepY = Number(process.argv[4] || 20);
const st = S.createSim(seed);
const marks = { 0: 0, 1: 1, 11: 2, 111: 3, 211: 4 };
const ev = {};
for (let y = 0; y <= 600 && S.isAlive(st); y++) {
  if (y in marks) playVisit(st, name, marks[y]);
  S.runYears(st, 1, (es) => es.forEach((e) => (ev[e.type] = (ev[e.type] || 0) + 1)));
  if (y % stepY === 0) console.log(String(S.yearOf(st)).padStart(4), 'H', st.households.length, 'ppl', st.people.length, 'adults', st.households.reduce((a, h) => a + h.adults, 0), 'food', (st.stores.low.food + st.stores.ridge.food).toFixed(0), 'plots', S.builtPlots(st).length, 'wood', st.forest.wood.toFixed(1), 'cold', st.forest.cold.toFixed(2), 'cover', S.forestCover(st, 'west').toFixed(2), S.forestCover(st, 'east').toFixed(2), 'game', st.forest.game.west.toFixed(0), st.forest.game.east.toFixed(0), 'stage', st.civ.stage);
}
console.log(st.collapse, JSON.stringify(ev));
