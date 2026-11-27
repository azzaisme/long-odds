// Headless balance run: node tools/headless.mjs [seeds=400] [schedule=1,10,100,100,1000]
// Plays each scripted strategy over many seeds and reports how long the settlement lasts.
import { createSim, runYears, isAlive, yearOf } from '../src/sim/sim.js';
import { STRATEGIES, playVisit } from '../src/sim/strategies.js';

const seeds = Number(process.argv[2] || 400);
const schedule = (process.argv[3] || '1,10,100,100,1000').split(',').map(Number);
const total = schedule.reduce((a, b) => a + b, 0);
const marks = [10, 100, 500, total];

console.log(`Long Odds headless run: ${seeds} seeds, jumps ${schedule.join(' + ')} = ${total} years, 3 work actions per visit\n`);
const head = ['strategy'.padEnd(26), 'median', '  mean', ...marks.map((m) => `>=${m}y`.padStart(7)), ' recoveries', '  town', '  city', '  Hold', ' Hold yr'];
console.log(head.join(' '));
const t0 = performance.now();
for (const name of Object.keys(STRATEGIES)) {
  const lived = [];
  let recoveries = 0;
  const reached = [0, 0, 0, 0, 0];
  const holdYears = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const st = createSim(seed);
    for (let v = 0; v < schedule.length && isAlive(st); v++) {
      playVisit(st, name, v);
      runYears(st, schedule[v]);
    }
    lived.push(st.collapse ? st.collapse.year : yearOf(st));
    recoveries += st.recoveries.length;
    for (let k = 1; k <= 4; k++) if (st.civ.reached[k] !== null) reached[k]++;
    if (st.civ.reached[4] !== null) holdYears.push(st.civ.reached[4]);
  }
  lived.sort((a, b) => a - b);
  const mean = lived.reduce((a, b) => a + b, 0) / seeds;
  const row = [
    name.padEnd(26),
    String(lived[seeds >> 1]).padStart(6),
    mean.toFixed(0).padStart(6),
    ...marks.map((m) => ((100 * lived.filter((y) => y >= m).length) / seeds).toFixed(0).padStart(6) + '%'),
    (recoveries / seeds).toFixed(1).padStart(11),
    ...[2, 3, 4].map((k) => ((100 * reached[k]) / seeds).toFixed(0).padStart(5) + '%'),
    (holdYears.length ? String(holdYears.sort((a, b) => a - b)[holdYears.length >> 1]) : '-').padStart(8),
  ];
  console.log(row.join(' '));
}
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)  median/mean = years survived; >=Ny = share of seeds still standing at year N; recoveries = traced recoveries per run; town/city/Hold = share of seeds that ever reached that stage; Hold yr = median year the Hold was finished`);
