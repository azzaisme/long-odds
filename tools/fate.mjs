// How long must the tutorial valley's fated floods run for every tutorial playthrough to end in
// collapse within the century? Tries many things a player might do on the lowland in one visit.
// Usage: node tools/fate.mjs [seed]
import { createSim, runYears, isAlive, buildPlot, demonstrate, setCustom, yearOf } from '../src/sim/sim.js';
import { BALANCE } from '../src/sim/balance.js';
import { CUSTOMS, PRACTICES } from '../src/sim/decisions.js';
import { makeRng } from '../src/sim/rng.js';

const seed = Number(process.argv[2] || BALANCE.tutorial.seed);
function play(variant, fate) {
  const st = createSim(seed);
  st.fate = fate;
  st.customs.fields = 0; // the tutorial valley farms the floodplain only
  for (const id of variant.fields) buildPlot(st, id, 'you');
  for (const idea of variant.ideas) demonstrate(st, null, st.households.map((h) => h.id), 'you', idea);
  for (const [c, o] of variant.customs) if (c !== 'fields' && c !== 'plant') setCustom(st, c, o, 'you');
  runYears(st, 100);
  return { alive: isAlive(st), year: st.collapse ? st.collapse.year : null };
}
const variants = [];
const R = makeRng(99); const rnd = () => (R.next ? R.next() : R());
for (let n = 0; n <= 9; n++) variants.push({ fields: [...Array(n).keys()], ideas: ['seed'], customs: [] });
for (const p of PRACTICES) variants.push({ fields: [0, 1, 2], ideas: [p.id], customs: [] });
variants.push({ fields: [0, 1, 2, 3, 4, 5], ideas: PRACTICES.map((p) => p.id), customs: [] });
for (const c of CUSTOMS) c.options.forEach((_, o) => variants.push({ fields: [0, 1, 2, 3], ideas: ['seed'], customs: [[c.id, o]] }));
for (let i = 0; i < 300; i++)
  variants.push({
    fields: [...Array(9).keys()].filter(() => rnd() < 0.6),
    ideas: PRACTICES.filter(() => rnd() < 0.5).map((p) => p.id),
    customs: CUSTOMS.filter(() => rnd() < 0.4).map((c) => [c.id, Math.floor(rnd() * c.options.length)]),
  });
console.log(`seed ${seed}, ${variants.length} playthroughs each`);
for (const [from, len] of [[0, 0], [12, 3], [12, 5], [12, 8], [12, 12], [20, 8], [20, 12], [8, 15]]) {
  const res = variants.map((v) => play(v, len ? { from, to: from + len - 1 } : null));
  const alive = res.filter((r) => r.alive).length;
  const years = res.filter((r) => !r.alive).map((r) => r.year).sort((a, b) => a - b);
  console.log(`${len ? `floods years ${from}-${from + len - 1}` : 'no fate'}: ${alive} survive the century; collapses in years ${years[0]}..${years[years.length - 1]} (median ${years[years.length >> 1]})`);
}
