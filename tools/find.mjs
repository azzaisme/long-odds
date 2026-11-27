// Finds seeds where a given event type happens early, for watching in the browser:
//   node tools/find.mjs eruption 40
import * as S from '../src/sim/sim.js';
const type = process.argv[2] || 'eruption', within = Number(process.argv[3] || 40);
for (let seed = 1, found = 0; seed <= 3000 && found < 6; seed++) {
  const st = S.createSim(seed);
  S.buildPlot(st, 0, 'Ama'); S.buildRidgeStore(st, 'Ama'); S.buildPlot(st, 9, 'Ama');
  let hit = null;
  S.runYears(st, within, (ev) => ev.forEach((e) => { if (e.type === type && !hit && S.isAlive(st)) hit = e; }));
  if (hit) { found++; console.log(`seed ${seed}: year ${hit.year}: ${hit.text}`); }
}
