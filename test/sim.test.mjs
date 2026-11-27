import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/sim/balance.js';
import { createSim, step, runYears, hashState, cloneSim, yearOf, isAlive, buildPlot, buildRidgeStore, carrySeedUphill, demonstrate, knowers } from '../src/sim/sim.js';
import { Playback } from '../src/sim/playback.js';
import { estimateSurvival, assessRisks } from '../src/sim/risks.js';
import { playVisit } from '../src/sim/strategies.js';
import { PLOT_SITES } from '../src/sim/world.js';

const LOW = PLOT_SITES.filter((p) => p.elev === 'low').map((p) => p.id);
const RIDGE = PLOT_SITES.filter((p) => p.elev === 'ridge').map((p) => p.id);

function prepared(seed) {
  const st = createSim(seed);
  buildPlot(st, LOW[0], 'Ama');
  buildPlot(st, RIDGE[0], 'Ama');
  buildRidgeStore(st, 'Ama');
  return st;
}

// Drives a Playback with a synthetic frame clock, as the game loop would.
function playAt(st, years, frameMs) {
  const pb = new Playback(st, years, 1000);
  let now = 1000;
  let frames = 0;
  while (!pb.finished) {
    now += typeof frameMs === 'function' ? frameMs(frames) : frameMs;
    pb.advance(now);
    frames++;
  }
  return { pb, now, frames };
}

test('floodplain and ridge plots differ in yield and flood exposure', () => {
  let lowFood = 0, ridgeFood = 0, lowHarvests = 0, ridgeHarvests = 0, lowLost = 0, ridgeLost = 0, lowPlanted = 0, ridgePlanted = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const st = prepared(seed);
    st.stores.low.seed = 40;
    for (let t = 0; t < 40; t++) {
      const season = st.tick % 4;
      const before = st.plots.map((p) => p.state);
      const ev = step(st);
      if (season === 0) { lowPlanted += st.plots[LOW[0]].state === 'planted'; ridgePlanted += st.plots[RIDGE[0]].state === 'planted'; }
      if (season === 1) { lowLost += before[LOW[0]] === 'planted' && st.plots[LOW[0]].state === 'damaged'; ridgeLost += before[RIDGE[0]] === 'planted' && st.plots[RIDGE[0]].state === 'damaged'; }
      if (season === 2) { lowHarvests += before[LOW[0]] === 'planted'; ridgeHarvests += before[RIDGE[0]] === 'planted'; }
      void ev;
    }
  }
  assert.ok(BALANCE.yield.low > BALANCE.yield.ridge);
  assert.ok(lowLost / lowPlanted > 0.08, `lowland loss rate ${lowLost / lowPlanted}`);
  assert.ok(ridgeLost / ridgePlanted < 0.01, `ridge loss rate ${ridgeLost / ridgePlanted}`);
  assert.ok(lowPlanted > 500 && ridgePlanted > 500);
});

test('every jump length lands on the exact year after 30 s, at any frame rate', () => {
  for (const years of BALANCE.jumpChoices) {
    const direct = prepared(7);
    runYears(direct, years);
    for (const frame of [1000 / 144, 1000 / 60, 1000 / 24, 250, (i) => 3 + ((i * 7919) % 90)]) {
      const st = prepared(7);
      const { pb, now } = playAt(st, years, frame);
      assert.equal(yearOf(st), years);
      assert.equal(st.tick, years * 4);
      assert.equal(pb.ticksDone, years * 4);
      assert.ok(now - 1000 >= 30000 && now - 1000 < 30000 + 260, 'finishes on the first frame at or after 30 s');
      assert.equal(hashState(st), hashState(direct));
    }
  }
});

test('playback never runs ahead of the clock and never finishes early', () => {
  const st = prepared(3);
  const pb = new Playback(st, 1000, 0);
  pb.advance(14999);
  assert.equal(pb.ticksDone, Math.floor((14999 / 30000) * 4000));
  assert.equal(pb.finished, false);
  pb.advance(29999);
  assert.equal(pb.finished, false);
  assert.ok(pb.ticksDone < 4000);
  pb.advance(90000); // tab was hidden; first frame back
  assert.equal(pb.finished, true);
  assert.equal(yearOf(st), 1000);
});

test('split jumps equal one uninterrupted jump when nothing is done in between', () => {
  for (const seed of [1, 2, 3, 11, 42]) {
    const a = prepared(seed);
    runYears(a, 111);
    const b = prepared(seed);
    for (const y of [1, 10, 100]) playAt(b, y, 16.7);
    const c = prepared(seed);
    for (const y of [100, 10, 1]) runYears(c, y);
    assert.equal(hashState(a), hashState(b));
    assert.equal(hashState(a), hashState(c));
  }
});

test('same seed and same actions give the same result; different seeds differ', () => {
  const run = (seed) => {
    const st = createSim(seed);
    const sched = [1, 10, 100, 100, 1000];
    for (let v = 0; v < 5 && isAlive(st); v++) { playVisit(st, 'mixed + ridge seed store', v); runYears(st, sched[v]); }
    return hashState(st);
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('odds estimates leave the live simulation and its random sequence untouched', () => {
  const st = prepared(9);
  runYears(st, 3);
  const before = hashState(st);
  const rngBefore = st.rng.a;
  let last;
  for (const r of estimateSurvival(st, 100, 40)) last = r;
  assert.equal(last.done, 40);
  assert.equal(hashState(st), before);
  assert.equal(st.rng.a, rngBefore);
  const twin = prepared(9);
  runYears(twin, 3);
  runYears(st, 50);
  runYears(twin, 50);
  assert.equal(hashState(st), hashState(twin));
});

test('an unfarmed village runs out of supplies and collapses early', () => {
  const years = [];
  for (let seed = 1; seed <= 200; seed++) {
    const st = createSim(seed);
    runYears(st, 30);
    assert.ok(st.collapse, 'collapsed');
    assert.match(st.collapse.cause, /No field was ever planted/);
    years.push(st.collapse.year);
  }
  assert.ok(Math.max(...years) <= 15 && years.sort((a, b) => a - b)[100] <= 6, `latest unfarmed collapse: year ${Math.max(...years)}`);
});

test('collapse year and cause are recorded once and decay continues to the destination', () => {
  let found = null;
  for (let seed = 1; seed <= 300 && !found; seed++) {
    const st = createSim(seed);
    for (const id of LOW.slice(0, 3)) buildPlot(st, id, 'Ama');
    const first = [];
    runYears(st, 1000, (ev) => ev.forEach((e) => e.type === 'collapse' && first.push(e)));
    if (st.collapse && st.collapse.year > 5) found = { st, first };
  }
  assert.ok(found, 'found a lowland-only run that collapses during the jump');
  const { st, first } = found;
  assert.equal(first.length, 1);
  assert.equal(first[0].year, st.collapse.year);
  assert.equal(yearOf(st), 1000);
  assert.equal(st.households.length, 0);
  assert.ok(st.plots.every((p) => p.state !== 'planted' && p.state !== 'fallow'), 'fields have grown over');
  assert.ok(st.houses.every((h) => h.state !== 'home' && h.state !== 'empty'), 'houses have fallen in');
  const frozen = { ...st.collapse };
  runYears(st, 100);
  assert.deepEqual(st.collapse, frozen);
});

test('a recovery can be traced back to ridge seed storage and a demonstration', () => {
  let traced = null;
  for (let seed = 1; seed <= 200 && !traced; seed++) {
    const st = createSim(seed);
    buildPlot(st, LOW[0], 'Ama');
    buildRidgeStore(st, 'Ama');
    assert.ok(demonstrate(st, 0, [1], 'Ama').ok);
    runYears(st, 1);
    if (!isAlive(st)) continue;
    carrySeedUphill(st, 'Tobi');
    runYears(st, 100);
    const r = st.recoveries.find((x) => x.kind === 'ridge-seed' && x.storeBuiltBy === 'Ama' && x.practice && x.practice.root === 'demo');
    if (r) traced = { r, st };
  }
  assert.ok(traced, 'ridge-seed recovery worked by a household taught by demonstration');
  assert.equal(traced.r.practice.by, 'Ama');
  assert.equal(traced.r.storeBuiltYear, 0);
  assert.ok(traced.st.actions.some((a) => a.type === 'build-store') && traced.st.actions.some((a) => a.type === 'demonstrate'));
});

test('demonstration teaches witnesses and risks read in plain language', () => {
  const st = createSim(1);
  assert.equal(knowers(st), 1);
  let texts = assessRisks(st).map((r) => r.text).join(' ');
  assert.match(texts, /No working farms/);
  assert.match(texts, /Only one household knows how to save seed/);
  buildPlot(st, LOW[0], 'Ama');
  assert.match(assessRisks(st).map((r) => r.text).join(' '), /Every farm is .*flood/);
  assert.equal(demonstrate(st, 1, [2], 'Tobi').ok, false, 'an untrained villager cannot demonstrate');
  assert.ok(demonstrate(st, 0, [1, 2], 'Ama').ok);
  assert.equal(knowers(st), 3);
  assert.equal(st.households[1].lineage.root, 'demo');
});

test('mixed elevation with ridge seed storage outlasts lowland-only farming across seeds', () => {
  const sched = [1, 10, 100, 100, 1000];
  const standing = (name) => {
    let n = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const st = createSim(seed);
      for (let v = 0; v < 5 && isAlive(st); v++) { playVisit(st, name, v); runYears(st, sched[v]); }
      if ((st.collapse ? st.collapse.year : yearOf(st)) >= 500) n++;
    }
    return n / 150;
  };
  const mixed = standing('mixed + ridge seed store');
  const low = standing('lowland + teaching');
  const lowOnly = standing('lowland only');
  assert.ok(mixed > low + 0.2, `mixed ${mixed} vs lowland+teaching ${low}`);
  assert.ok(low >= lowOnly);
});

test('cloneSim is independent of the original', () => {
  const st = prepared(4);
  const c = cloneSim(st);
  runYears(c, 20);
  assert.equal(yearOf(st), 0);
  assert.notEqual(hashState(st), hashState(c));
});

test('a thriving settlement grows through the stages into the Hold, which houses everyone', () => {
  const sched = [1, 10, 100, 100, 1000];
  let holds = 0, lowHolds = 0, checked = 0;
  for (let seed = 1; seed <= 120; seed++) {
    for (const name of ['mixed + ridge seed store', 'lowland only']) {
      const st = createSim(seed);
      for (let v = 0; v < 5 && isAlive(st); v++) { playVisit(st, name, v); runYears(st, sched[v]); }
      if (st.civ.reached[4] === null) continue;
      if (name === 'lowland only') { lowHolds++; continue; }
      holds++;
      assert.ok(st.civ.reached[1] <= st.civ.reached[2] && st.civ.reached[2] <= st.civ.reached[3] && st.civ.reached[3] <= st.civ.reached[4]);
      if (isAlive(st) && st.civ.stage === 4) {
        checked++;
        assert.ok(st.households.every((h) => h.house === -1 && h.knows), 'every household lives in the Hold and keeps seed');
        assert.ok(st.houses.every((h) => h.state !== 'home'));
        assert.ok(st.stats.peakHouseholds > 24, 'more households than the old houses could hold');
      }
    }
  }
  assert.ok(holds >= 30 && checked >= 30, `Holds: ${holds}`);
  assert.ok(lowHolds < holds / 4, `lowland-only Holds: ${lowHolds}`);
});
