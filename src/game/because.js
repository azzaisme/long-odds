// After a jump: what happened, tied back to what the god decided (or left alone).
// Reads the simulation and the jump's record; never changes either. Returns [{ cls, html }].
import { CUSTOM, BRIDGE } from '../sim/decisions.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function because(st, j) {
  const seen = j.seen || {};
  const acts = st.actions;
  const during = (y) => y !== null && y !== undefined && y >= j.from && y <= j.to;
  const last = (type, test = () => true) => [...acts].reverse().find((a) => a.type === type && test(a));
  // "the custom you set in year 3 (“Most”)" or "the village's own habit (“Most”)"
  const custom = (id) => {
    const label = CUSTOM[id].options[st.customs[id]].label;
    const set = last('set-custom', (a) => a.custom === id);
    const kept = set && set.option === st.customs[id];
    return kept ? `the custom you set in year ${set.year} (“${esc(label)}”)` : set ? `a custom that has slipped since you set it (now “${esc(label)}”)` : `the village’s own habit (“${esc(label)}”), which you left alone`;
  };
  const out = [];
  const bad = (html) => out.push({ cls: 'danger', html });
  const good = (html) => out.push({ cls: 'good', html });
  const note = (html) => out.push({ cls: '', html });

  // Seed and floods.
  if (during(st.seedLostYear)) {
    const store = last('build-store');
    if (!st.stores.ridge.built) bad(`The flood of year ${st.seedLostYear} took the seed in the granary. Nothing was kept above the water: no ridge store was ever built.`);
    else if (CUSTOM.uphillSeed.options[st.customs.uphillSeed].v === 0) bad(`The flood of year ${st.seedLostYear} took the seed in the granary. There was a ridge store, but none was carried up to it: ${custom('uphillSeed')}.`);
    else note(`The flood of year ${st.seedLostYear} took the seed in the granary. What was on the ridge${store ? `, in the store you built in year ${store.year},` : ''} was out of its reach: ${custom('uphillSeed')}.`);
  }
  // Knowledge.
  if (during(st.knowersGone)) {
    const shown = acts.filter((a) => a.type === 'demonstrate' && a.practice === 'seed');
    bad(shown.length
      ? `Seed saving died out in year ${st.knowersGone}. You showed it ${plural(shown.length, 'time')}, last in year ${shown[shown.length - 1].year}; it did not outlast the people who learned it.`
      : `Seed saving died out in year ${st.knowersGone}. Only one house ever knew it, and you never showed it to another.`);
  }
  // Forest and game.
  if (seen['forest-gone']) {
    const fells = acts.filter((a) => a.type === 'fell' || a.type === 'clear-forest').length;
    bad(`The forest within reach was cut out by year ${seen['forest-gone'].first}, under ${custom('woodcut')}${fells ? `, after you felled or cleared ${plural(fells, 'stand')} yourself` : ''}.`);
  } else if (seen.cold && CUSTOM.woodcut.options[st.customs.woodcut].v === 'none') bad(`${plural(seen.cold.n, 'cold winter')} without enough firewood: ${custom('woodcut')}.`);
  if (seen['game-gone']) bad(`The game was hunted out by year ${seen['game-gone'].first}, under ${custom('hunt')}.`);
  // Bridges.
  const planned = last('plan-bridge');
  if (planned && BRIDGE[planned.bridge]) {
    const name = BRIDGE[planned.bridge].name.toLowerCase();
    if (seen['bridge-lost']) bad(`The ${esc(name)} you planned in year ${planned.year} was carried away in year ${seen['bridge-lost'].last}${seen.stranded ? ', and the far bank was cut off' : ''}.`);
    else if (seen.bridge) good(`The ${esc(name)} you planned in year ${planned.year} was finished in year ${seen.bridge.last}.`);
    else if (seen['bridge-stalled']) note(`Work on the ${esc(name)} you planned in year ${planned.year} stopped for want of food, hands or timber.`);
  }
  // What the village did with the land on its own.
  const cleared = (seen.expand ? seen.expand.n : 0) + (seen.uphill ? seen.uphill.n : 0);
  if (cleared) note(`The village cleared new ground ${plural(cleared, 'time')} on its own${seen.uphill ? `, ${seen.uphill.n} of them on the ridge` : ''}, following ${custom('fields')}.`);
  if (seen['forest-cleared']) note(`Forest was turned into fields ${plural(seen['forest-cleared'].n, 'time')}: ${custom('clearing')}.`);
  // The fields the god built by hand.
  const mine = [...new Set(acts.filter((a) => a.type === 'build-plot').map((a) => a.plot))];
  if (mine.length) {
    const worked = mine.filter((id) => st.plots[id].state === 'planted' || st.plots[id].state === 'fallow').length;
    if (mine.length === 1) (worked ? good : bad)(`The field you cleared by hand is ${worked ? 'still worked' : 'no longer worked'}.`);
    else (worked ? good : bad)(`Of the ${mine.length} fields you cleared by hand, ${worked ? `${worked} ${worked === 1 ? 'is' : 'are'} still worked` : 'none is still worked'}.`);
  }
  // Customs slipping back.
  if (seen['custom-drift']) note(`${plural(seen['custom-drift'].n, 'custom')} slipped back toward old habits while you were away.`);
  return out.slice(0, 7);
}
