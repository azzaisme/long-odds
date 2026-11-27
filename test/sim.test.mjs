import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/sim/balance.js';
import { createSim, step, runYears, hashState, cloneSim, yearOf, isAlive, buildPlot, buildRidgeStore, carrySeedUphill, demonstrate, knowers } from '../src/sim/sim.js';
import { Playback } from '../src/sim/playback.js';
import { estimateSurvival, assessRisks } from '../src/sim/risks.js';
import { playVisit } from '../src/sim/strategies.js';
import { PLOT_SITES } from '../src/sim/world.js';
import { PRACTICES, CUSTOMS, CROPS, holders, decisionCount } from '../src/sim/decisions.js';
import { setCrop, setCustom, canAfford, betroth, setCalling, moveHousehold } from '../src/sim/sim.js';
import { IDEAS, IDEA, possibleIdeas } from '../src/sim/decisions.js';
import { canBetroth, give } from '../src/sim/people.js';

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
    assert.match(st.collapse.cause, /No field was ever planted|last of them died|tornado|eruption/);
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
  assert.ok(demonstrate(st, 0, [1, 2], 'Ama').ok);
  assert.equal(knowers(st), 3);
  assert.equal(st.households[1].lineage.root, 'demo');
  // The god knows every practice: shown through an untrained villager, that villager learns it too.
  assert.ok(demonstrate(st, 3, [4], 'Renn').ok);
  assert.equal(knowers(st), 5);
  assert.equal(demonstrate(st, 0, [1], 'Ama').ok, false, 'nothing to teach when everyone present knows it');
});

test('mixed elevation with ridge seed storage outlasts lowland-only farming across seeds', () => {
  const sched = [1, 10, 100, 100, 1000];
  const standing = (name) => {
    let n = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const st = createSim(seed);
      const sch = [1, 10, 100, 100, 300];
      for (let v = 0; v < 5 && isAlive(st); v++) { playVisit(st, name, v); runYears(st, sch[v]); }
      if ((st.collapse ? st.collapse.year : yearOf(st)) >= 500) n++;
    }
    return n / 80;
  };
  const mixed = standing('mixed + ridge seed store');
  const low = standing('lowland + teaching');
  const lowOnly = standing('lowland only');
  assert.ok(mixed > low + 0.1 && mixed > lowOnly + 0.25, `mixed ${mixed} vs lowland+teaching ${low} vs lowland only ${lowOnly}`);
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
  for (let seed = 1; seed <= 60; seed++) {
    for (const name of ['mixed + store + practices', 'lowland only']) {
      const st = createSim(seed);
      for (let v = 0; v < 5 && isAlive(st); v++) { playVisit(st, name, v); runYears(st, sched[v]); }
      if (st.civ.reached[4] === null) continue;
      if (name === 'lowland only') { lowHolds++; continue; }
      holds++;
      assert.ok(st.civ.reached[3] <= st.civ.reached[4]);
      if (isAlive(st) && st.civ.stage === 4) {
        checked++;
        assert.ok(st.households.every((h) => h.house === -1 && h.knows), 'every household lives in the Hold and keeps seed');
        const known = new Set(st.people.flatMap((p) => Object.keys(p.ideas)));
        assert.ok(st.people.filter((p) => yearOf(st) - p.born >= 16).every((p) => Object.keys(p.ideas).length === known.size), 'everyone grown in the Hold is taught everything it knows');
        assert.ok(st.houses.every((h) => h.state !== 'home'));
        assert.ok(st.stats.peakHouseholds > 24, 'more households than the old houses could hold');
      }
    }
  }
  assert.ok(holds >= 12 && checked >= 12, `Holds: ${holds}`);
  assert.ok(lowHolds < holds / 4, `lowland-only Holds: ${lowHolds}`);
});

test('weather and disasters occur, do damage, and can end a settlement', () => {
  const seen = { rain: 0, landslide: 0, tornado: 0, eruption: 0, rumble: 0 };
  let severe = 0, housesTorn = 0, fieldsBuried = 0, causes = new Set();
  const sched = [1, 10, 100, 100, 1000];
  for (let seed = 1; seed <= 120; seed++) {
    const st = createSim(seed);
    for (let v = 0; v < 5; v++) {
      if (isAlive(st)) playVisit(st, 'mixed + ridge seed store', v);
      let warned = null;
      runYears(st, sched[v], (ev) => ev.forEach((e) => {
        if (e.type in seen) seen[e.type]++;
        if (e.type === 'rumble' && warned === null) warned = e.year;
        if (e.type === 'eruption') { assert.ok(st.sky.lastEruption.year === e.year); if (e.severe) severe++; warned = null; }
        if (e.type === 'tornado') housesTorn += e.n;
        if (e.type === 'landslide') fieldsBuried += e.n;
      }));
    }
    if (st.collapse) causes.add(st.collapse.cause.replace(/\d+/g, 'N'));
    assert.equal(st.stats.eruptions > 0, st.sky.lastEruption !== null);
  }
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 8, `${k}: ${seen[k]}`);
  assert.ok(severe > 1 && housesTorn > 5 && fieldsBuried > 8, `severe ${severe}, houses ${housesTorn}, fields ${fieldsBuried}`);
  assert.ok([...causes].some((c) => /eruption|tornado/i.test(c)), [...causes].join(' | '));
});

test('an eruption is always preceded by smoke, and ash thins the harvest', () => {
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 5; seed++) {
    const st = createSim(seed);
    playVisit(st, 'mixed + ridge seed store', 0);
    let smokeYear = null;
    for (let y = 0; y < 300 && isAlive(st); y++) {
      const wasRumbling = st.sky.rumble;
      runYears(st, 1, (ev) => ev.forEach((e) => {
        if (e.type === 'rumble' && smokeYear === null) smokeYear = e.year;
        if (e.type === 'eruption') {
          assert.ok(wasRumbling === 1, 'erupts when the countdown ends');
          assert.ok(smokeYear !== null && e.year - smokeYear === BALANCE.hazards.rumbleYears, `smoke ${smokeYear}, eruption ${e.year}`);
          assert.ok(st.sky.ash > 0);
          checked++;
          smokeYear = null;
        }
      }));
    }
  }
  assert.ok(checked >= 5);
});

test('work has no count limit but is paid for in food', () => {
  const st = createSim(1);
  const food0 = st.stores.low.food;
  let built = 0;
  for (const id of [...LOW, ...RIDGE]) if (buildPlot(st, id, 'Ama').ok) built++;
  assert.ok(built > 3, `built ${built} fields in one visit`);
  assert.ok(Math.abs(food0 - st.stores.low.food - built * BALANCE.workCost.build) < 1e-9);
  assert.equal(buildRidgeStore(st, 'Ama').ok, false, 'not enough food left for the store');
  assert.equal(canAfford(st, 'store'), false);
  assert.ok(setCrop(st, LOW[0], 'roots', 'Ama').ok, 'free decisions still work');
});

test('each practice, custom and crop changes outcomes across seeds', () => {
  const sched = [1, 10, 100, 200];
  // Survival to year 311 with one extra decision added to a fixed opening.
  const run = (tweak) => {
    let alive = 0, food = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const st = createSim(seed);
      buildPlot(st, LOW[0], 'Ama'); buildPlot(st, RIDGE[0], 'Ama'); buildRidgeStore(st, 'Ama');
      demonstrate(st, 0, [1, 2], 'Ama');
      if (tweak) tweak(st);
      let harvest = 0;
      for (const y of sched) runYears(st, y, (ev) => ev.forEach((e) => { if (e.type === 'harvest') harvest += e.food; }));
      if (isAlive(st)) alive++;
      food += harvest;
    }
    return { alive, food };
  };
  const base = run();
  const outcomes = new Set([JSON.stringify(base)]);
  for (const p of PRACTICES.filter((x) => x.id !== 'seed')) outcomes.add(JSON.stringify(run((st) => demonstrate(st, 0, [1, 2], 'Ama', p.id))));
  for (const c of CUSTOMS) for (let i = 0; i < c.options.length; i++) if (i !== c.base) outcomes.add(JSON.stringify(run((st) => setCustom(st, c.id, i, 'Ama'))));
  for (const c of CROPS.filter((x) => x.id !== 'grain')) outcomes.add(JSON.stringify(run((st) => { setCrop(st, LOW[0], c.id, 'Ama'); setCrop(st, RIDGE[0], c.id, 'Ama'); })));
  const tried = 1 + PRACTICES.length - 1 + CUSTOMS.reduce((n, c) => n + c.options.length - 1, 0) + CROPS.length - 1;
  assert.equal(outcomes.size, tried, 'every single decision produced a different set of futures');
  const n = decisionCount(6, 16);
  assert.ok(n.practices + n.customs + n.crops >= 100);
});

test('practices spread and can be lost; customs drift back; the same decisions replay identically', () => {
  let lost = 0, spread = 0, drifted = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const make = () => {
      const st = createSim(seed);
      buildPlot(st, LOW[0], 'Ama'); buildPlot(st, RIDGE[0], 'Ama'); buildRidgeStore(st, 'Ama');
      demonstrate(st, 0, [1, 2], 'Ama');
      demonstrate(st, 0, [], 'Ama', 'dry');
      setCustom(st, 'reserve', 3, 'Ama');
      setCustom(st, 'fields', 3, 'Ama');
      return st;
    };
    const st = make();
    runYears(st, 300, (ev) => ev.forEach((e) => { if (e.type === 'custom-drift') drifted++; }));
    const twin = make();
    runYears(twin, 300);
    assert.equal(hashState(st), hashState(twin));
    if (!isAlive(st)) continue;
    const n = holders(st, 'dry');
    if (n === 0) lost++;
    if (n > 1) spread++;
  }
  assert.ok(lost > 1 && spread > 3 && drifted > 5, `lost ${lost}, spread ${spread}, drifted ${drifted}`);
});

test('people are born, marry between houses and die; family lines mix', () => {
  const st = prepared(8);
  demonstrate(st, 0, [1, 2], 'Ama');
  assert.equal(st.lines.length, 6);
  assert.ok(st.people.length >= 18);
  assert.ok(st.people.every((p) => p.lines.length === 1 && st.households.some((h) => h.id === p.hid)));
  let mixed = 0, alive = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s2 = prepared(seed);
    demonstrate(s2, 0, [1, 2], 'Ama');
    runYears(s2, 80);
    if (!isAlive(s2)) continue;
    alive++;
    const year = yearOf(s2);
    assert.ok(s2.stats.births > 0 && s2.stats.weddings > 0);
    assert.ok(s2.people.every((p) => year - p.born < 110), 'nobody lives for ever');
    assert.ok(s2.people.every((p) => s2.households.some((h) => h.id === p.hid)), 'everyone lives in a house');
    for (const p of s2.people) if (p.spouse !== null) assert.equal(s2.people.find((q) => q.id === p.spouse).spouse, p.id);
    for (const h of s2.households) assert.equal(h.size, s2.people.filter((p) => p.hid === h.id).length);
    if (s2.people.some((p) => p.lines.length >= 2)) mixed++;
  }
  assert.ok(alive >= 8 && mixed >= alive - 1, `alive ${alive}, with mixed lines ${mixed}`);
});

test('a planned match joins two lines and their child can work out a new idea, traceably', () => {
  let traced = 0, kept = 0, tried = 0;
  for (let seed = 1; seed <= 60 && traced < 3; seed++) {
    const st = createSim(seed);
    buildPlot(st, LOW[0], 'Ama'); buildPlot(st, LOW[1], 'Ama'); buildPlot(st, RIDGE[0], 'Ama'); buildRidgeStore(st, 'Ama');
    demonstrate(st, 0, [1, 2], 'Ama', 'seed');
    demonstrate(st, 0, [], 'Ama', 'dry'); // house 0 keeps drying
    demonstrate(st, 3, [], 'Renn', 'stone'); // house 3 keeps stone
    // Find a child of house 0 and a child of house 3 who can be promised to each other.
    const a = st.people.find((p) => p.hid === 0 && p.spouse === null && p.ideas.dry);
    const b = a && st.people.find((p) => p.hid === 3 && p.ideas.stone && canBetroth(a, p));
    if (!a || !b) continue;
    tried++;
    assert.ok(possibleIdeas(a, b).some((i) => i.id === 'sealed'), 'drying + stone could become a sealed granary');
    assert.ok(!possibleIdeas(a, a).some((i) => i.id === 'sealed'), 'not within one line alone');
    assert.ok(betroth(st, a.id, b.id, 'Ama').ok);
    assert.equal(demonstrate(st, 0, [], 'Ama', 'sealed').ok, false, 'a derived idea cannot be demonstrated');
    runYears(st, 60);
    const married = st.people.some((p) => p.id === a.id && p.spouse === b.id) || st.people.some((p) => p.mother !== null && [p.mother, p.father].includes(a.id) && [p.mother, p.father].includes(b.id));
    if (married) kept++;
    const d = st.discovered.sealed;
    const theirs = d && (d.pid === a.id || d.pid === b.id || (d.parents.includes(a.id) && d.parents.includes(b.id)));
    if (theirs) {
      traced++;
      if (d.pid !== a.id && d.pid !== b.id) assert.ok(d.lines.includes(a.lines[0]) && d.lines.includes(b.lines[0]), 'their child belongs to both lines');
      assert.ok(st.actions.some((x) => x.type === 'betroth' && x.a === a.id && x.b === b.id));
    }
  }
  assert.ok(tried >= 3 && kept >= 1 && traced >= 1, `tried ${tried}, matches kept ${kept}, sealed granary traced to the match ${traced}`);
});

test('ideas die with the last person who holds them; teachers spread them; houses can be moved', () => {
  // One old person is the only keeper of an idea.
  let died = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const st = prepared(seed);
    demonstrate(st, 0, [1, 2, 3, 4, 5], 'Ama');
    const elder = st.people.find((p) => p.hid === 5 && p.spouse !== null);
    elder.born = -72;
    give(elder, 'watch', { root: 'demo', year: 0, by: 'Ama' });
    let lostEvent = false;
    runYears(st, 15, (ev) => ev.forEach((e) => {
      if (e.type !== 'knowledge-lost' || !/Watching/.test(e.text) || lostEvent) return;
      lostEvent = true;
      assert.equal(st.people.filter((p) => p.ideas.watch).length, 0, 'nobody holds it when it is reported lost');
      assert.ok(!st.people.some((p) => p.id === elder.id), 'its keeper has died');
    }));
    if (lostEvent) died++;
  }
  assert.ok(died >= 3, `died with its last keeper in ${died} of 20 runs`);
  const spread = { plain: 0, teacher: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    for (const mode of ['plain', 'teacher']) {
      const st = prepared(seed);
      demonstrate(st, 0, [1, 2], 'Ama');
      demonstrate(st, 0, [], 'Ama', 'watch');
      if (mode === 'teacher') for (const p of st.people.filter((q) => q.hid === 0 && q.ideas.watch)) setCalling(st, p.id, 'teacher', 'Ama');
      runYears(st, 40);
      if (isAlive(st)) spread[mode] += st.people.filter((p) => p.ideas.watch).length;
    }
  }
  assert.ok(spread.teacher > spread.plain, `holders after 40 years: teacher ${spread.teacher} vs ${spread.plain}`);
  const st = createSim(2);
  const slot = st.houses.find((h) => h.elev === 'ridge');
  const food = st.stores.low.food;
  assert.ok(moveHousehold(st, 0, slot.id, 'Ama').ok);
  assert.equal(st.houses[slot.id].hid, 0);
  assert.equal(st.stores.low.food, food - BALANCE.people.moveCost);
});
