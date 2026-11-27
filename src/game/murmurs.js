// What villagers say when the god is near. Every line is chosen from what is actually true in
// the simulation at that moment, so listening to them is a way of reading the valley.
import { BALANCE as B } from '../sim/balance.js';
import { IDEA } from '../sim/decisions.js';
import { yearOf, knowers, builtPlots, forestCover } from '../sim/sim.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function murmur(st, h, visit) {
  const year = yearOf(st);
  const out = [];
  const say = (weight, ...lines) => { for (let i = 0; i < weight; i++) out.push(pick(lines)); };
  const people = st.people.filter((p) => p.hid === h.id);
  const food = st.stores.low.food + st.stores.ridge.food;
  const need = st.people.length * 0.5;
  const fields = builtPlots(st).length;
  const flood = st.river.lastFlood;
  const sky = st.sky;

  // The god.
  if (visit === 1) say(2, 'Who is that, the blue one?', 'Did you see? It walks without touching the grass.', 'Not from downriver, that one.');
  else say(1, 'The blue one is back.', 'Grandmother said you would come again.', 'You were here before I was born, they say.');
  if (year > 0 && st.year0.shortage <= 0.001) say(1, 'We leave grain at the shrine for you.');
  else if (year > 0) say(1, 'There was nothing to leave at the shrine this year. Forgive us.');

  // Food and fields.
  if (fields === 0) say(3, 'Nothing is planted. What are we waiting for?', 'We live on what is in the granary, and it is going down.');
  else if (food < need * 0.5) say(3, 'The granary is nearly bare.', 'We count the sacks every night now.', 'The children ask for more and there is no more.');
  else if (food > need * 2.5) say(2, 'A good year. The children are fat.', 'More in the granary than we can eat. Imagine.');
  if (h.knows) say(1, 'We keep the best seed back. Always the best.', 'You do not eat the seed. That is the whole of it.');
  else if (knowers(st) > 0) {
    const k = st.households.find((x) => x.knows);
    say(1, `${k.name}'s house keeps seed over the winter. I should ask them how.`);
  } else if (fields > 0) say(3, 'We ate the seed. What else was there?', 'Nobody remembers how the old ones kept seed.');
  if (st.stores.ridge.built && st.stores.ridge.seed >= 1) say(1, 'There is seed on the ridge, if the worst comes.');

  // The river.
  if (flood && year - flood.year <= 2) say(3, 'The mud is still in the houses.', flood.level >= 2 ? 'The river took everything on the low ground.' : 'The water came up to the door this year.');
  else if (flood && year - flood.year > 25) say(1, 'My grandmother saw the water reach the granary.', `There is a notch on the flood stone for year ${flood.year}.`);
  else if (flood) say(1, `The river came over in year ${flood.year}. It will again.`);
  if (st.river.wet > 1.25) say(1, 'The river has run high for years now.');
  if (st.river.wet < 0.75) say(1, 'Dry again. The ridge fields are dust.');

  // The mountain and the weather.
  if (sky.rumble > 0) say(4, 'The mountain is smoking. I do not like it.', 'The ground shook in the night. Did you feel it?');
  if (sky.ash > 0) say(4, 'Ash on everything. Nothing grows right.');
  if (sky.lastTornado && year - sky.lastTornado.year <= 5) say(2, 'The wind took the roof clean off. We found it in the river.');
  if (sky.lastSlide && year - sky.lastSlide.year <= 5) say(2, 'The hill came down on the ridge fields.');

  // The forest.
  const east = forestCover(st, 'east');
  if (east === 0) say(2, 'There was a forest on the ridge once. I have only seen the stumps.');
  else if (east < 0.5) say(2, 'The walk for firewood gets longer every year.');
  if (st.forest.game.east < 1 && st.forest.game.west < 1) say(2, 'No deer any more. My father hunted them on the ridge.');
  if (st.forest.cold > 0.2) say(3, 'We burned the fence last winter. It was that or freeze.');

  // The bridge.
  const br = st.bridge;
  if (br.built === 'rope') say(1, 'I do not trust that bridge with a full basket.');
  else if (br.built) say(1, 'Traders came over the bridge last moon.', 'You can walk to the far fields dry-shod now.');
  if (br.plan && br.plan !== br.built && br.progress > 0) say(2, B.bridge && br.plan === 'stone' ? 'The stone bridge will take longer than I have. My children will cross it.' : 'They are driving the posts for the bridge.');
  if (!br.built && br.lostYear !== null && year - br.lostYear <= 5) say(3, 'The bridge went in the flood. The far fields are lost to us.');

  // People.
  for (const p of people) {
    const age = year - p.born;
    if (p.betrothed !== null) {
      const o = st.people.find((q) => q.id === p.betrothed);
      if (o) say(2, `${p.name} is promised to ${o.name}. A good match, they say.`);
    }
    if (age <= 1) say(2, `A new baby in the house. We named the child ${p.name}.`);
    if (age >= 62) say(1, `${p.name} is ${age}. Remembers things nobody else does.`);
    if (p.calling === 'teacher') say(2, `${p.name} teaches the children now.`);
  }
  if (h.lines.length >= 3) say(1, 'Half the valley is my cousin, one way or another.');
  const newest = st.lines[st.lines.length - 1];
  if (newest && newest.year > 0 && year - newest.year <= 30) say(1, `${newest.name}'s people came from downriver in year ${newest.year}. They have settled in well.`);
  const found = st.discoveries[st.discoveries.length - 1];
  if (found && year - found.year <= 40) say(2, `${found.by} thought of ${IDEA[found.idea].name.toLowerCase()}. Nobody had before.`);
  if (st.stats.deaths > st.households.length * 4 && st.households.length > 0) say(1, 'There are more stones on the hill than houses in the valley.');
  if (st.civ.stage >= 2) say(1, 'It was all cottages once, they say.');
  if (st.civ.stage >= 4) say(2, 'Everyone under one roof. My grandmother would not believe it.');
  return pick(out);
}

// Who is left of the founding families, for the arrival report.
export function linesReport(st) {
  const alive = new Map();
  for (const p of st.people) for (const l of p.lines) alive.set(l, (alive.get(l) || 0) + 1);
  const living = st.lines.filter((l) => alive.has(l.id)).map((l) => `${l.name} (${alive.get(l.id)})`);
  const ended = st.lines.filter((l) => !alive.has(l.id)).map((l) => l.name);
  return { living, ended };
}
