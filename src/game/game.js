// Game controller: explicit states, input, and the DOM interface. The simulation is only ever
// advanced by Playback (during a jump) and only ever edited by player actions (during a visit).
import { BALANCE as B } from '../sim/balance.js';
import { WORLD, PLOT_SITES, HOUSE_SLOTS, groundHeight } from '../sim/world.js';
import { hashSeed } from '../sim/rng.js';
import * as Sim from '../sim/sim.js';
import { summary, assessRisks, estimateSurvival } from '../sim/risks.js';
import { Playback } from '../sim/playback.js';
import { PRACTICES, PRACTICE, CUSTOMS, CROPS, CROP, holds, holders } from '../sim/decisions.js';

export const S = { TITLE: 'title', VISIT: 'visit', PLANNING: 'planning', PLAYBACK: 'playback', ARRIVAL: 'arrival', RUINS: 'ruins', RESULTS: 'results' };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const n0 = (v) => Math.round(v).toLocaleString('en');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const SEASON_LINES = [
  'Spring: households sow what seed they have',
  'Summer: the river decides',
  'Autumn: harvest, and seed set aside by those who know how',
  'Winter: the stores are eaten down',
];
const STAGE = B.stages.names;
const ERA = { 1: 'One year', 10: 'Ten years', 100: 'A century', 1000: 'A millennium' };
const WALK = 64;

export class Game {
  constructor(view, sound) {
    this.view = view;
    this.sound = sound;
    this.state = S.TITLE;
    this.keys = new Set();
    this.sim = Sim.createSim(1);
    this.toastT = 0;
    this.stepT = 0;
    this.inspect = null;
    this.captions = [];
    this.queue = [];
    view.sync(this.sim);
    view.syncActors(this.sim, true);
    this.bind();
    this.showTitle();
    view.app.on('update', (dt) => this.update(Math.min(dt, 0.1)));
  }

  // ---- lifecycle ----------------------------------------------------------------------------
  newRun(seed) {
    this.seed = seed >>> 0;
    this.sim = Sim.createSim(this.seed);
    this.visit = 1;
    this.picking = false;
    this.pair = [];
    this.active = 0;
    this.jumps = [];
    this.pb = null;
    this.inspect = null;
    this.verdict = null;
    this.returnT = 0;
    this.say = null;
    $('speech').hidden = true;
    this.view.clearActors();
    this.view.sync(this.sim);
    this.view.syncActors(this.sim, true);
    this.view.water.target = WORLD.waterLevels[0];
    this.view.setTint(1, 1, 1, 0);
    this.view.weather = 'none';
    this.pickPair();
    const a = this.me();
    if (a) a.x = 470;
    const o = this.other();
    if (o) o.x = 610;
    this.setState(S.VISIT);
    this.view.cam.tzoom = this.view.baseZoom();
    this.toast('Six households, a little food and seed, and no farms. Take as long as you like. Work is paid for in food.');
  }

  setState(s) {
    this.state = s;
    const visiting = s === S.VISIT || s === S.PLANNING;
    $('top').hidden = !visiting;
    $('who').hidden = !visiting;
    $('hint').hidden = !(s === S.VISIT || s === S.RUINS || s === S.RESULTS);
    $('playback').hidden = s !== S.PLAYBACK;
    $('ruinbar').hidden = !(s === S.RUINS || s === S.RESULTS);
    $('context').classList.toggle('raised', s === S.RUINS || s === S.RESULTS);
    $('hint').innerHTML = s === S.VISIT ? '<kbd>A</kbd><kbd>D</kbd> walk · <kbd>E</kbd> inspect · <kbd>T</kbd> demonstrate · <kbd>C</kbd> customs · <kbd>Q</kbd> switch villager · <kbd>J</kbd> plan the jump' : '<kbd>A</kbd><kbd>D</kbd> walk · <kbd>E</kbd> inspect';
    if (s !== S.VISIT && s !== S.RUINS && s !== S.RESULTS) {
      $('context').hidden = true;
      $('prompt').hidden = true;
    }
    if (s === S.VISIT || s === S.PLAYBACK || s === S.RUINS || s === S.RESULTS) $('modal').hidden = true;
    for (const a of this.view.actors.values()) a.controlled = false;
    this.keys.clear();
    if (visiting) this.refreshHud();
  }

  pickPair() {
    const hs = this.sim.households;
    let pair = (this.pair || []).filter((id) => hs.some((h) => h.id === id));
    if (pair.length < 2) {
      const rest = hs.filter((h) => !pair.includes(h.id));
      const have = pair.length ? hs.find((h) => h.id === pair[0]).knows : null;
      // Prefer one villager who knows the practice and one who does not.
      rest.sort((a, b) => (have === null ? b.knows - a.knows : have ? a.knows - b.knows : b.knows - a.knows) || a.id - b.id);
      while (pair.length < 2 && rest.length) {
        const h = rest.shift();
        pair.push(h.id);
        if (pair.length === 1) rest.sort((a, b) => (h.knows ? a.knows - b.knows : b.knows - a.knows) || a.id - b.id);
      }
    }
    this.pair = pair;
    if (this.active >= pair.length) this.active = 0;
  }
  hh(id) { return this.sim.households.find((h) => h.id === id); }
  me() { return this.state === S.RUINS ? this.view.actors.get(-1) : this.view.actors.get(this.pair[this.active]); }
  other() { return this.pair.length > 1 ? this.view.actors.get(this.pair[1 - this.active]) : null; }
  myHouse() { return this.hh(this.pair[this.active]); }

  // ---- input --------------------------------------------------------------------------------
  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') {
        if (e.key === 'Enter') this.begin();
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'Tab', ' '].includes(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      this.key(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    window.addEventListener('blur', () => this.keys.clear());
    $('btn-switch').onclick = () => this.switchVillager();
    $('btn-jump').onclick = () => this.openPlan();
    $('btn-sound').onclick = () => {
      this.sound.setMuted(!this.sound.muted);
      $('btn-sound').style.opacity = this.sound.muted ? 0.4 : 1;
    };
    // One delegated handler for every generated button.
    $('ui').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) this.act(b.dataset.act, b.dataset.arg);
    });
  }
  key(k) {
    this.sound.start();
    const s = this.state;
    if (s === S.TITLE && k === 'Enter') return this.begin();
    if (s === S.VISIT) {
      if (k === 'q' || k === 'Tab') return this.switchVillager();
      if (k === 'j') return this.openPlan();
      if (k === 'e') return this.toggleInspect();
      if (k === 't') return this.act('teach');
      if (k === 'c') return this.openCustoms();
      if (this.picking) {
        if (k === 'Escape') return (this.picking = false);
        const pr = PRACTICES[Number(k) - 1];
        if (pr) return this.act('teach', pr.id);
      }
      if (k === '1' && this.inspect) return this.act('site');
      if (k === '2' && this.inspect) return this.act('crop');
    } else if (s === S.RUINS || s === S.RESULTS) {
      if (k === 'e') return this.toggleInspect();
    } else if (s === S.PLANNING) {
      if (k === 'Escape') return this.pending ? this.openPlan() : this.act('close');
      if (this.pending && k === 'Enter') return this.act('commit');
      const i = ['1', '2', '3', '4'].indexOf(k);
      if (!this.pending && i >= 0) return this.act('choose', B.jumpChoices[i]);
    } else if (s === S.ARRIVAL && k === 'Enter') return this.verdict ? this.retry() : this.act('next');
  }
  act(name, arg) {
    this.sound.start();
    switch (name) {
      case 'begin': return this.begin();
      case 'site': return this.siteAction();
      case 'teach': return this.teach(arg);
      case 'crop': return this.cycleCrop();
      case 'customs': return this.openCustoms();
      case 'custom': return this.setCustom(arg);
      case 'close': return this.state === S.PLANNING && (this.sound.click(), this.setState(S.VISIT));
      case 'choose': return this.choose(Number(arg));
      case 'back': return this.openPlan();
      case 'commit': return this.commit();
      case 'next': return this.next();
      case 'look': return this.lookAround();
      case 'new': return this.retry();
      case 'retry': return this.retry();
      case 'details': return this.state === S.ARRIVAL && this.modal(this.arrivalHtml, true);
    }
  }

  // ---- title --------------------------------------------------------------------------------
  showTitle() {
    this.state = S.TITLE;
    this.setState(S.TITLE);
    const q = new URLSearchParams(location.search).get('seed') || '';
    this.modal(`
      <h1>LONG ODDS</h1>
      <div class="tag">Plant a field. Bet a century.</div>
      <p>You are a god with a small valley to look after. Keep its riverside settlement alive for as many years as you can. Step into a villager and walk the bank, build farms and a seed store, show a neighbour how to save seed. Then step out of the world for <b>1, 10, 100 or 1,000 years</b> and watch the village live with what you left it.</p>
      <p>Last long enough, fed and unflooded, and the hamlet grows: village, town, city, and finally <b>the Hold</b>, one great terraced house on the ridge with room for every resident and a seed vault of its own.</p>
      <p>The valley is not gentle. The river floods, heavy rains bring landslides, tornadoes cross the plain, and the volcano behind the hills smokes for a few years before it erupts.</p>
      <p class="note">Take as long as you like over each visit. Work is paid for in food from the stores; customs and crops cost nothing to change. Every jump plays out over thirty seconds and cannot be undone. There is no last visit: you come back until nobody is left.</p>
      <div class="keys">
        <span><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd></span><span>Walk</span>
        <span><kbd>E</kbd></span><span>Inspect what is nearby, then <kbd>1</kbd> to work on it</span>
        <span><kbd>T</kbd></span><span>Demonstrate a practice to villagers standing close</span>
        <span><kbd>C</kbd></span><span>Set the customs of the village</span>
        <span><kbd>Q</kbd></span><span>Switch to the other villager</span>
        <span><kbd>J</kbd></span><span>Review the settlement and choose a jump</span>
      </div>
      <div class="row"><label>Valley seed <input id="seed" value="${esc(q)}" placeholder="random" maxlength="12"></label>
      <button class="primary" data-act="begin">Begin <kbd>Enter</kbd></button></div>`, true);
    this.view.cam.tzoom = this.view.baseZoom();
  }
  begin() {
    if (this.state !== S.TITLE) return;
    const raw = ($('seed') && $('seed').value.trim()) || '';
    const seed = raw === '' ? (Math.random() * 2 ** 31) >>> 0 : /^\d+$/.test(raw) ? Number(raw) >>> 0 : hashSeed(raw);
    this.sound.start();
    this.sound.good();
    this.newRun(seed);
  }

  // ---- visit: inspecting and working --------------------------------------------------------
  nearest() {
    const a = this.me();
    if (!a) return null;
    let best = null;
    const consider = (d, t) => {
      if (d < t.reach && (!best || d + t.bias < best.d)) best = { ...t, d: d + t.bias };
    };
    for (const s of PLOT_SITES) consider(Math.abs(a.x - s.x), { kind: 'plot', id: s.id, x: s.x, top: 14, reach: 25, bias: 0 });
    consider(Math.abs(a.x - WORLD.granaryX), { kind: 'granary', id: 0, x: WORLD.granaryX, top: 36, reach: 20, bias: -6 });
    consider(Math.abs(a.x - WORLD.ridgeStoreX), { kind: 'store', id: 0, x: WORLD.ridgeStoreX, top: 24, reach: 18, bias: -6 });
    for (const s of HOUSE_SLOTS) if (this.sim.houses[s.id].state !== 'gone') consider(Math.abs(a.x - s.x), { kind: 'house', id: s.id, x: s.x, top: 28, reach: 13, bias: 14 });
    const stage = Sim.isAlive(this.sim) ? this.sim.civ.stage : this.sim.stats.peakStage;
    if (stage >= 3) consider(Math.abs(a.x - 1240), { kind: 'civic', id: stage, x: 1240, top: stage >= 4 ? 150 : 80, reach: 190, bias: 40 });
    if (best) best.key = best.kind + best.id;
    return best;
  }

  describe(t) {
    const st = this.sim;
    const year = Sim.yearOf(st);
    const ago = (y) => (year - y <= 0 ? 'this year' : `${plural(year - y, 'year')} ago`);
    if (t.kind === 'plot') {
      const p = st.plots[t.id];
      const low = p.elev === 'low';
      const place = low ? 'Floodplain' : 'Ridge';
      const trait = low
        ? `Rich river silt: about ${B.yield.low} food a year. Every flood reaches it.`
        : `Thin soil: about ${B.yield.ridge} food a year. Ordinary floods never climb this far; drought bites harder.`;
      const by = p.builtBy ? ` Cleared by ${p.builtBy === 'village' ? 'the village' : p.builtBy} in year ${p.builtYear}.` : '';
      const cropLine = ` Sown with ${CROP[p.crop].name.toLowerCase()}: ${CROP[p.crop].does.toLowerCase()}`;
      if (p.state === 'wild') return { kind: 'build', title: `${place} site`, text: `Open ground. ${trait}`, action: 'Clear and build a field here' };
      if (p.state === 'overgrown') return { title: `Overgrown ${place.toLowerCase()} field`, text: `Abandoned ${ago(p.since)}; last worked in year ${Math.max(0, p.lastWorked)}.${by} ${trait}`, action: 'Clear and rebuild this field', kind: 'build' };
      if (p.state === 'damaged') return { title: `Flood-damaged ${place.toLowerCase()} field`, text: `Buried in silt since year ${p.since}. Seed-saving households can restore it in spring; nobody else knows how.${by}`, action: 'Dig out and repair this field', kind: 'repair' };
      if (p.state === 'eroded') return { title: 'Lost to the river', text: `The river cut this bank away in year ${p.since}.` };
      return { title: `${place} field`, text: `${trait}${by}${cropLine}` };
    }
    if (t.kind === 'granary') {
      const g = st.stores.low;
      const n = Sim.carryAmount(st);
      return {
        kind: 'carry',
        title: 'Lowland granary',
        text: `Holds ${n0(g.food)} food and ${n0(g.seed)} seed. It stands on the floodplain: a big flood ruins most of what is inside.`,
        action: st.stores.ridge.built ? (n >= 0.5 ? `Carry ${n0(n)} seed up to the ridge store` : null) : null,
        note: st.stores.ridge.built ? (n >= 0.5 ? '' : 'There is no seed here to carry.') : 'Build a store on the ridge and seed can be carried up from here.',
      };
    }
    if (t.kind === 'store') {
      const r = st.stores.ridge;
      if (!r.built) return { title: 'Dry shelf on the ridge', text: 'Stone footings and a marker stake. A seed store here would sit above any ordinary flood.', action: 'Build a seed store here', kind: 'store' };
      return { title: 'Ridge seed store', text: `Built by ${r.builtBy === 'village' ? 'the village' : r.builtBy} in year ${r.builtYear}. Holds ${n0(r.seed)} seed and ${n0(r.food)} food. Households that know seed saving carry part of each harvest's seed up here.` };
    }
    if (t.kind === 'civic') {
      const alive = Sim.isAlive(st);
      const yr = st.civ.reached[t.id];
      if (t.id >= 4) return alive
        ? { title: 'The Hold', text: `Finished in year ${yr}. Seven garden terraces against the cliff, a seed vault at the foot, and every one of the ${st.households.length} households under one roof, above any flood.` }
        : { title: 'The Hold, empty', text: `Finished in year ${yr}, abandoned in year ${st.collapse.year}. The terraces have gone to scrub and the vault door stands open.` };
      return alive ? { title: 'City blocks', text: `Stone houses of several storeys, raised from year ${yr}. Households without a house of their own live here.` } : { title: 'Ruined city blocks', text: `Raised from year ${yr}, empty since year ${st.collapse.year}.` };
    }
    const s = st.houses[t.id];
    if (s.state === 'home') {
      const h = this.hh(s.hid);
      const lin = h.lineage;
      const how = !h.knows ? 'They do not know how to save seed.' : lin && lin.root === 'demo' ? `They save seed, a practice ${lin.by} demonstrated in year ${lin.year}.` : `They save seed${lin ? `, as ${lin.by}'s household always has` : ''}.`;
      const also = PRACTICES.filter((p) => p.id !== 'seed' && holds(h, p.id)).map((p) => p.name.toLowerCase());
      return { title: `${h.name}'s household`, text: `Here since year ${h.since}, now in its ${ordinal(h.gen)} generation. ${how}${also.length ? ` They also keep: ${also.join(', ')}.` : ''}` };
    }
    const what = { empty: 'An empty house', ruin: 'A ruin', rubble: 'Rubble' }[s.state];
    return { title: what, text: s.state === 'empty' ? `The household left ${ago(s.since)}.` : s.state === 'ruin' ? `The roof fell in ${ago(s.since)}.` : `Only the footings are left. It has lain like this for ${plural(year - s.since, 'year')}.` };
  }

  // The two nearest villagers within reach who do not yet hold the practice.
  witnesses(practice = 'seed') {
    const a = this.me();
    const mine = this.myHouse();
    if (!a || !mine) return [];
    const out = [];
    for (const [id, v] of this.view.actors) {
      if (id === mine.id || id < 0 || v.leaving) continue;
      const h = this.hh(id);
      if (h && !holds(h, practice) && Math.abs(v.x - a.x) <= B.teachRadius) out.push({ h, d: Math.abs(v.x - a.x) });
    }
    return out.sort((p, q) => p.d - q.d).slice(0, B.teachWitnesses).map((o) => o.h);
  }
  // Who a demonstration of this practice would reach right now, the vessel included.
  pupils(practice) {
    const me = this.myHouse();
    return me ? [...(holds(me, practice) ? [] : [me]), ...this.witnesses(practice)] : [];
  }

  toggleInspect() {
    const t = this.nearest();
    this.inspect = t && this.inspect !== t.key ? t.key : null;
    this.picking = false;
    if (t) this.sound.click();
  }

  spend(result, sound) {
    if (!result.ok) {
      this.toast(result.text, true);
      this.sound.deny();
      return false;
    }
    this.toast(result.text);
    this.sound[sound]();
    this.view.sync(this.sim);
    this.view.syncActors(this.sim, true);
    this.refreshHud();
    return true;
  }
  canWork() {
    if (this.state !== S.VISIT) return false; // interventions are locked outside a visit
    return true;
  }
  siteAction() {
    const t = this.nearest();
    if (!t || t.key !== this.inspect || !this.describe(t).action || !this.canWork()) return;
    this.picking = false;
    const who = this.myHouse().name;
    const st = this.sim;
    const a = this.me();
    if (t.kind === 'plot') {
      const p = st.plots[t.id];
      if (this.spend(p.state === 'damaged' ? Sim.repairPlot(st, t.id, who) : Sim.buildPlot(st, t.id, who), 'build')) this.view.emit('dust', t.x, groundHeight(t.x) + 2, 14);
    } else if (t.kind === 'store') {
      if (this.spend(Sim.buildRidgeStore(st, who), 'build')) this.view.emit('dust', t.x, groundHeight(t.x) + 4, 16);
    } else if (t.kind === 'granary') {
      if (this.spend(Sim.carrySeedUphill(st, who), 'carry')) {
        this.view.emit('seed', a.x, groundHeight(a.x) + 12, 8);
        // The walk itself is shown: the villager makes the climb with the sack.
        a.controlled = false;
        a.target = WORLD.ridgeStoreX + 10;
        this.carrying = a;
      }
    }
  }
  // T opens the list of practices the god can show; a number picks one.
  teach(id) {
    if (this.state !== S.VISIT || !this.myHouse()) return;
    if (!id) {
      this.picking = !this.picking;
      this.inspect = null;
      return this.sound.click();
    }
    const me = this.myHouse();
    const ws = this.witnesses(id);
    const a = this.me();
    if (this.spend(Sim.demonstrate(this.sim, me.id, ws.map((h) => h.id), me.name, id), 'teach')) {
      this.picking = false;
      this.view.emit('seed', a.x, groundHeight(a.x) + 10, 16);
      this.view.flash(a.x, false);
      for (const h of ws) {
        const v = this.view.actors.get(h.id);
        v.target = null;
        v.wait = 3;
        v.dir = Math.sign(a.x - v.x) || 1;
      }
    }
  }
  cycleCrop() {
    const t = this.nearest();
    if (this.state !== S.VISIT || !t || t.kind !== 'plot' || t.key !== this.inspect) return;
    const p = this.sim.plots[t.id];
    if (p.state === 'eroded') return;
    const next = CROPS[(CROPS.findIndex((c) => c.id === p.crop) + 1) % CROPS.length];
    const r = Sim.setCrop(this.sim, t.id, next.id, this.myHouse().name);
    if (r.ok) (this.toast(`${r.text} ${next.does}`), this.sound.click());
  }
  openCustoms() {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    this.pending = null;
    this.odds = null;
    this.setState(S.PLANNING);
    const st = this.sim;
    this.modal(`
      <h2>Customs of the village</h2>
      <p class="note">What the whole village does while you are away. Changing a custom costs nothing. Over the centuries each one slips back, a step at a time, toward what villages do unprompted (marked ·).</p>
      ${CUSTOMS.map((c) => `<div class="custom"><b>${esc(c.name)}</b><span class="note">${esc(c.ask)}</span><div class="opts">${c.options.map((o, i) => `<button data-act="custom" data-arg="${c.id}:${i}" class="${st.customs[c.id] === i ? 'primary' : ''}">${esc(o.label)}${i === c.base ? ' ·' : ''}</button>`).join('')}</div></div>`).join('')}
      <div class="row"><button data-act="close">Done <kbd>Esc</kbd></button></div>`);
  }
  setCustom(arg) {
    if (this.state !== S.PLANNING) return;
    const [id, i] = arg.split(':');
    const top = $('panel').scrollTop;
    if (Sim.setCustom(this.sim, id, Number(i), this.myHouse() ? this.myHouse().name : 'the god').ok) this.sound.click();
    this.openCustoms();
    $('panel').scrollTop = top;
  }
  switchVillager() {
    if (this.state !== S.VISIT) return;
    if (this.pair.length < 2) return this.toast('There is nobody else to switch to.', true);
    const left = this.me();
    this.active = 1 - this.active;
    this.inspect = null;
    this.picking = false;
    this.carrying = null;
    if (left) (left.target = null), (left.wait = 0.6); // the villager you leave goes back to their routine
    this.sound.swap();
    if (left) this.view.flash(left.x, false);
    const h = this.myHouse();
    this.toast(`You are now ${h.name}. ${this.hh(this.pair[1 - this.active]).name} goes back to work.`);
    this.refreshHud();
  }

  // ---- planning a jump ----------------------------------------------------------------------
  conditionHtml() {
    const s = summary(this.sim);
    const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
    return `<div class="grid">
      ${cell('Settlement', esc(s.stageName))}${cell('Households', s.households)}${cell('Know seed saving', s.knowers)}
      ${cell('Food in store', n0(s.food))}${cell('Seed: granary', n0(s.seedLow))}${cell('Seed: ridge', s.ridgeStore ? n0(s.seedRidge) : 'no store')}
      ${cell('Floodplain fields', s.fieldsLow)}${cell('Ridge fields', s.fieldsRidge)}${s.damaged ? cell('Flood-damaged', s.damaged) : ''}
    </div>
    <p class="note">Practices kept: ${PRACTICES.map((p) => `${esc(p.name)} ${holders(this.sim, p.id)}/${s.households}`).join(' · ')}</p>
    <ul>${assessRisks(this.sim).map((r) => `<li class="${r.level}">${esc(r.text)}</li>`).join('')}</ul>`;
  }
  openPlan() {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    this.pending = null;
    this.odds = null;
    this.sound.click();
    this.setState(S.PLANNING);
    const year = Sim.yearOf(this.sim);
    const left = '';
    this.modal(`
      <h2>Year ${n0(year)}: how the settlement stands</h2>
      ${this.conditionHtml()}${left}
      <p>How far ahead will you skip? This is visit ${this.visit}.</p>
      <div class="row jumps">${B.jumpChoices.map((y, i) => `<button data-act="choose" data-arg="${y}"><b>${n0(y)} year${y > 1 ? 's' : ''}</b><small>to year ${n0(year + y)} · <kbd>${i + 1}</kbd></small></button>`).join('')}</div>
      <div class="row"><button data-act="close">Keep working <kbd>Esc</kbd></button><span class="note">Every jump takes thirty seconds to play out. You cannot act or turn back until it lands.</span></div>`);
  }
  choose(years) {
    if (this.state !== S.PLANNING || !B.jumpChoices.includes(years)) return;
    this.pending = years;
    this.sound.click();
    const year = Sim.yearOf(this.sim);
    const trials = { 1: 200, 10: 200, 100: 120, 1000: 60 }[years];
    this.odds = { gen: estimateSurvival(this.sim, years, trials), last: null, years };
    this.modal(`
      <h2>Skip ${n0(years)} year${years > 1 ? 's' : ''}, to year ${n0(year + years)}?</h2>
      <p>The village will live through every season between now and then on its own. You will watch for thirty seconds. You cannot build, teach, switch villagers or turn back until it lands in year ${n0(year + years)}.</p>
      <ul>${assessRisks(this.sim).filter((r) => r.level !== 'good').map((r) => `<li class="${r.level}">${esc(r.text)}</li>`).join('') || '<li class="good">No pressing risks stand out.</li>'}</ul>
      <div class="odds" id="odds">Running trial futures…</div>
      <div class="row"><button class="danger" data-act="commit">Commit to the jump <kbd>Enter</kbd></button><button data-act="back">Back <kbd>Esc</kbd></button></div>`);
  }
  pumpOdds() {
    const o = this.odds;
    if (!o || o.finished) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 5) {
      const r = o.gen.next();
      if (r.done) {
        o.finished = true;
        break;
      }
      o.last = r.value;
    }
    const el = $('odds');
    if (el && o.last) {
      const { done, trials, survived } = o.last;
      el.innerHTML = `<b>${Math.round((100 * survived) / done)}%</b> of trial futures still have households in year ${n0(Sim.yearOf(this.sim) + o.years)} (${survived} of ${done}${done < trials ? `, running ${trials}` : ''}).<br><span class="note">Estimated on copies of this village with their own dice. The real jump has not been rolled.</span>`;
    }
  }

  commit() {
    if (this.state !== S.PLANNING || !this.pending) return;
    const years = this.pending;
    this.pending = null;
    this.odds = null;
    const st = this.sim;
    this.jump = {
      years, from: Sim.yearOf(st), to: Sim.yearOf(st) + years, before: summary(st), turning: [], wasAlive: Sim.isAlive(st),
      counts: this.zeroCounts(), periodStart: Sim.yearOf(st), recStart: st.recoveries.length,
    };
    this.captions = [];
    this.queue = [];
    this.capT = 0;
    this.floodSoundT = 0;
    $('captions').innerHTML = '';
    $('pb-era').textContent = ERA[years];
    $('pb-dest').textContent = `→ year ${n0(this.jump.to)}`;
    // The god steps out of the villager and is gone in a flash of blue light. Only then does
    // the thirty-second clock start.
    const body = this.me();
    this.godX = body ? body.x : 560;
    this.setState(S.PLAYBACK);
    this.pb = null;
    this.departT = 1.0;
    $('toast').hidden = true;
    this.view.addActor(-2, 'god', this.godX);
    this.view.flash(this.godX, false);
    this.sound.commit();
    $('pb-year').textContent = `Year ${n0(this.jump.from)}`;
    $('pb-fill').style.width = '0%';
    $('pb-phase').textContent = 'You step out of the world…';
  }
  zeroCounts() { return { disasters: 0, floods: 0, left: 0, settled: 0, cleared: 0, repaired: 0, harvests: 0 }; }

  onTick(ev, st) {
    const j = this.jump;
    const minP = { 1: 1, 10: 1, 100: 2, 1000: 3 }[j.years];
    for (const e of ev) {
      const c = j.counts;
      if (e.type === 'flood' && e.level >= 2) c.floods++;
      else if (e.type === 'leave') c.left += e.n;
      else if (e.type === 'settle') c.settled += e.n;
      else if (e.type === 'expand' || e.type === 'uphill') c.cleared += e.n;
      else if (e.type === 'repair') c.repaired += e.n;
      if (e.p >= 3) j.turning.push(e);
      if (e.p >= minP) this.queue.push(e);
      if (e.type === 'eruption') (this.view.erupt(e.severe), this.sound.erupt(), c.disasters++);
      else if (e.type === 'tornado') (this.view.tornado(e.side), this.sound.tornado(), c.disasters++);
      else if (e.type === 'landslide') (this.view.landslide(), this.sound.slide(), c.disasters++);
      if (e.type === 'collapse') this.sound.collapse();
      else if (e.type === 'flood' && e.level >= 2 && this.floodSoundT <= 0) (this.sound.flood(e.level), (this.floodSoundT = 1.2));
      else if (e.type === 'harvest' && j.years <= 10) this.sound.harvest();
      else if (e.type === 'stage') this.sound.arrive(true);
      else if (e.type === 'recovery' && j.years <= 100 && this.floodSoundT <= 0.6) this.sound.good();
    }
    // Secondary changes are rolled up by decade or century at the long horizons.
    const period = j.years === 100 ? 10 : j.years === 1000 ? 100 : 0;
    const year = Sim.yearOf(st);
    if (period && st.tick % 4 === 0 && (year % period === 0 || year === j.to) && year > j.periodStart) {
      const c = j.counts;
      const bits = [];
      if (c.disasters) bits.push(plural(c.disasters, 'disaster'));
      if (c.floods) bits.push(plural(c.floods, 'damaging flood'));
      if (c.repaired) bits.push(`${plural(c.repaired, 'field')} restored`);
      if (c.cleared) bits.push(`${plural(c.cleared, 'field')} cleared`);
      if (c.settled) bits.push(`${plural(c.settled, 'household')} settled`);
      if (c.left) bits.push(`${c.left} left`);
      const H = st.households.length;
      const tail = H ? `${plural(H, 'household')} now` : st.collapse ? `empty since year ${st.collapse.year}` : '';
      if (bits.length || H) this.queue.push({ sum: true, year: j.periodStart, text: `Years ${n0(j.periodStart)}–${n0(year - 1)}: ${[...bits, tail].filter(Boolean).join(' · ')}` });
      else if (year % (period * 2) === 0) this.queue.push({ sum: true, year: j.periodStart, text: `Years ${n0(j.periodStart)}–${n0(year - 1)}: nobody. ${this.decayLine(st)}` });
      j.counts = this.zeroCounts();
      j.periodStart = year;
    }
  }
  decayLine(st) {
    const ruins = st.houses.filter((h) => h.state === 'ruin').length;
    const rubble = st.houses.filter((h) => h.state === 'rubble').length;
    const wood = st.plots.filter((p) => p.state === 'overgrown').length;
    return ruins ? `${plural(ruins, 'roof')} fallen in, ${plural(wood, 'field')} gone to scrub.` : rubble ? `Rubble where ${plural(rubble, 'house')} stood; trees in the old fields.` : 'The valley keeps no sign of them.';
  }

  updateCaptions(dt) {
    const j = this.jump;
    const now = this.view.time;
    this.capT -= dt;
    this.floodSoundT -= dt;
    const gap = { 1: 0.25, 10: 0.6, 100: 0.85, 1000: 1.0 }[j.years];
    // Keep the queue short: turning points first, then summaries, then the rest.
    const rank = (e) => (e.type === 'collapse' || e.type === 'stage' || e.type === 'eruption' ? 5 : e.type === 'tornado' || e.type === 'landslide' || e.type === 'rumble' ? 4 : e.type === 'recovery' || e.type === 'knowledge-lost' || e.type === 'store' ? 4 : e.p >= 3 ? 3 : e.sum ? 2 : e.p);
    if (this.queue.length > 4) {
      const keep = this.queue.map((e, i) => ({ e, i })).sort((a, b) => rank(b.e) - rank(a.e) || b.i - a.i).slice(0, 4).sort((a, b) => a.i - b.i);
      this.queue = keep.map((k) => k.e);
    }
    if (this.capT <= 0 && this.queue.length) {
      const e = this.queue.shift();
      this.capT = gap;
      const li = document.createElement('li');
      const good = e.type === 'stage' || e.type === 'recovery' || e.type === 'store' || e.type === 'settle' || e.type === 'repair' || e.type === 'uphill';
      li.className = e.sum ? 'sum' : e.p >= 3 ? `p3${good ? ' good' : ''}` : '';
      li.innerHTML = e.sum ? esc(e.text) : `<i>Year ${n0(e.year)}</i>${esc(e.text)}`;
      $('captions').appendChild(li);
      this.captions.push({ li, t: now });
      while (this.captions.length > 4) this.captions.shift().li.remove();
    }
    const life = j.years === 1 ? 7 : 5;
    while (this.captions.length && now - this.captions[0].t > life) this.captions.shift().li.remove();
    for (const c of this.captions) c.li.classList.toggle('old', now - c.t > life * 0.55);
  }

  updatePlaybackHud(nowMs) {
    const st = this.sim;
    const j = this.jump;
    const year = Sim.yearOf(st);
    $('pb-year').textContent = `Year ${n0(year)}`;
    $('pb-fill').style.width = `${(this.pb.progress(nowMs) * 100).toFixed(2)}%`;
    const H = st.households.length;
    let line;
    if (st.collapse) line = `Abandoned since year ${n0(st.collapse.year)}. ${this.decayLine(st)}`;
    else if (j.years === 1) line = SEASON_LINES[st.tick % 4];
    else if (j.years === 10) line = `Year ${Math.min(j.years, year - j.from + 1)} of 10 · ${Sim.SEASONS[st.tick % 4]} · ${plural(H, 'household')}`;
    else if (j.years === 100) line = `Generation ${Math.min(4, 1 + Math.floor((year - j.from) / 25))} of 4 · ${STAGE[st.civ.stage]} · ${plural(H, 'household')} · ${plural(Sim.builtPlots(st).length, 'field')}`;
    else line = `Century ${Math.min(10, 1 + Math.floor((year - j.from) / 100))} of 10 · ${STAGE[st.civ.stage]} · ${plural(H, 'household')} · ${plural(Sim.builtPlots(st).length, 'field')}`;
    $('pb-phase').textContent = line;
  }

  // ---- arrival ------------------------------------------------------------------------------
  arrive() {
    const st = this.sim;
    const j = this.jump;
    this.jumps.push(j);
    this.pb = null;
    this.setState(S.ARRIVAL);
    this.view.sync(st);
    this.view.syncActors(st, true);
    this.view.weather = 'none';
    this.view.water.target = WORLD.waterLevels[0];
    const alive = Sim.isAlive(st);
    const a = summary(st);
    const b = j.before;
    const cell = (k, x, y) => `<div><small>${k}</small><b>${x} → ${y}</b></div>`;
    let turning = j.turning;
    let skipped = 0;
    if (turning.length > 9) {
      const must = turning.filter((e) => ['eruption', 'tornado', 'landslide', 'stage', 'stage-down', 'collapse', 'recovery', 'knowledge-lost', 'store', 'erode'].includes(e.type));
      const stages = turning.filter((e) => e.type === 'stage' || e.type === 'collapse' || e.type === 'eruption');
      const pick = new Set([...turning.slice(0, 2), ...stages, ...must.slice(0, 2), ...must.slice(-2), ...turning.slice(-2)]);
      skipped = turning.length - pick.size;
      turning = turning.filter((e) => pick.has(e));
    }
    const events = turning.length
      ? `<ul>${turning.map((e) => `<li class="ev" data-y="Year ${n0(e.year)}">${esc(e.text)}</li>`).join('')}</ul>${skipped ? `<p class="note">…and ${skipped} more floods, departures and recoveries along the way.</p>` : ''}`
      : '<p class="note">Nothing turned the village’s course. The seasons simply went round.</p>';
    const trace = this.traceHtml(j);
    const grid = `<div class="grid">${cell('Households', b.households, a.households)}${cell('Know seed saving', b.knowers, a.knowers)}${cell('Fields', b.fieldsLow + b.fieldsRidge, a.fieldsLow + a.fieldsRidge)}${cell('Ridge fields', b.fieldsRidge, a.fieldsRidge)}${cell('Seed', n0(b.seedLow + b.seedRidge), n0(a.seedLow + a.seedRidge))}</div>`;
    const span = `Year ${n0(j.from)} → year ${n0(j.to)}`;
    let html;
    if (!alive) {
      const c = st.collapse;
      const during = c.year >= j.from;
      html = `
        <h2>Year ${n0(j.to)}. Nobody is here.</h2>
        <p>${during ? `The last household left in <b>year ${n0(c.year)}</b>, ${n0(j.to - c.year)} years before you arrived.` : `The valley has been empty since year ${n0(c.year)}.`} ${esc(c.cause)}</p>
        <div class="big">${n0(c.year)} years survived</div>
        <h3>${span}</h3>${events}${trace}
        <div class="row"><button class="primary" data-act="retry">Try again</button><button data-act="next">Walk the ruins</button></div>`;
    } else if (B.visitsPerRun && this.visit >= B.visitsPerRun) {
      html = `
        <h2>Still standing</h2>
        <div class="big">Year ${n0(j.to)} · ${esc(a.stageName)}</div>
        <p>${a.stage >= 4 ? `All ${a.households} households live in the Hold, the great terraced house on the ridge, finished in year ${n0(st.civ.reached[4])}. It feeds itself and keeps its own seed.` : `${plural(a.households, 'household')} still farm the valley after your fifth and last jump. It is a ${esc(a.stageName.toLowerCase())}; the Hold, one great house for everyone, was never finished.`}</p>
        ${grid}<h3>${span}</h3>${events}${trace}
        <p class="note">Valley seed ${this.seed} · run fingerprint ${Sim.hashState(st)}</p>
        <div class="row"><button class="primary" data-act="new">Start a new run</button><button data-act="look">Look around</button></div>`;
    } else {
      html = `
        <h2>Arrived in year ${n0(j.to)}</h2>
        <p>The settlement survived the jump. It is ${a.stage >= 4 ? 'the Hold' : `a ${esc(a.stageName.toLowerCase())}`} of ${plural(a.households, 'household')}.</p>
        ${grid}<h3>${span}</h3>${events}${trace}
        <div class="row"><button class="primary" data-act="next">Begin visit ${this.visit + 1} <kbd>Enter</kbd></button></div>`;
    }
    this.arrivalHtml = html;
    // He flashes back into existence.
    const x = Math.max(WORLD.walkMin + 20, Math.min(WORLD.walkMax - 20, this.godX || 560));
    this.view.flash(x, true);
    this.sound.appear();
    this.view.cam.tx = x;
    this.view.cam.ty = groundHeight(x) + 44;
    $('modal').hidden = true;
    if (alive) {
      this.view.addActor(-2, 'god', x);
      this.verdict = null;
      this.returnT = 1.3; // then he steps back into a villager and the arrival report opens
    } else {
      this.view.clearActors();
      this.view.addActor(-1, 'god', x);
      this.view.setTint(0.55, 0.6, 0.75, 0.14);
      const n = st.collapse.year;
      this.verdict = { t: 0, said: false, line: n < 1 ? 'Nope. Not like that. They didn’t even make it a year.' : `Nope. Not like that. They only made it ${n0(n)} year${n === 1 ? '' : 's'}.` };
    }
  }
  // Recoveries during this jump that go back to something the player did.
  traceHtml(j) {
    const st = this.sim;
    const recs = st.recoveries.slice(j.recStart);
    const lines = [];
    const stores = recs.filter((r) => r.kind === 'ridge-seed' && r.storeBuiltBy && r.storeBuiltBy !== 'village');
    if (stores.length) lines.push(`${plural(stores.length, 'replanting')} after a flood used seed from the ridge store ${esc(stores[0].storeBuiltBy)} built in year ${stores[0].storeBuiltYear}.`);
    const demo = recs.filter((r) => r.practice && r.practice.root === 'demo');
    if (demo.length) {
      const p = demo[0].practice;
      lines.push(`${demo.length === 1 ? '1 recovery was' : `${demo.length} recoveries were`} carried out by households whose seed saving goes back to ${esc(p.by)}'s demonstration in year ${p.year}.`);
    }
    return lines.length ? `<h3>Traced to your visits</h3><ul>${lines.map((l) => `<li class="good">${l}</li>`).join('')}</ul>` : '';
  }
  next() {
    if (this.state !== S.ARRIVAL || this.returnT > 0) return;
    const st = this.sim;
    this.sound.click();
    if (!Sim.isAlive(st)) return this.lookAround();
    if (B.visitsPerRun && this.visit >= B.visitsPerRun) return;
    this.visit++;
    this.picking = false;
    this.inspect = null;
    this.pickPair();
    this.view.setTint(1, 1, 1, 0);
    this.view.cam.tzoom = this.view.baseZoom();
    this.setState(S.VISIT);
  }
  lookAround() {
    if (this.state !== S.ARRIVAL) return;
    const st = this.sim;
    const alive = Sim.isAlive(st);
    this.inspect = null;
    this.view.cam.tzoom = this.view.baseZoom();
    if (alive) {
      this.setState(S.RESULTS);
      $('ruinbar').innerHTML = `<span><b>Still standing in year ${n0(Sim.yearOf(st))}: ${esc(STAGE[st.civ.stage])}.</b> Walk the valley; <kbd>E</kbd> inspects.</span><button class="primary" data-act="new">Start a new run</button>`;
    } else {
      this.verdict = null;
      $('speech').hidden = true;
      if (!this.view.actors.get(-1)) this.view.addActor(-1, 'god', 560);
      this.setState(S.RUINS);
      this.view.setTint(0.55, 0.6, 0.75, 0.14);
      $('ruinbar').innerHTML = `<span><b>Year ${n0(Sim.yearOf(st))}. ${n0(st.collapse.year)} years survived.</b> ${esc(st.collapse.cause)} Walk the ruins; <kbd>E</kbd> reads what is left.</span><button class="primary" data-act="retry">Try again</button>`;
    }
  }

  // "Maybe I could…": the scene wipes to black and a new world wipes in.
  retry() {
    if (this.wiping || this.state === S.PLAYBACK || this.state === S.TITLE) return;
    this.wiping = true;
    this.sound.start();
    const god = this.view.actors.get(-1) || this.me();
    $('modal').hidden = true;
    $('ruinbar').hidden = true;
    $('context').hidden = true;
    this.say = { text: 'Maybe I could…', actor: god };
    const wipe = $('wipe');
    wipe.className = '';
    setTimeout(() => (wipe.className = 'in', this.sound.wipe()), 700);
    setTimeout(() => {
      this.say = null;
      this.verdict = null;
      $('speech').hidden = true;
      this.newRun((Math.random() * 2 ** 31) >>> 0);
      this.view.update(0.001, this.sim, { camSnap: true });
      const a = this.me();
      if (a) this.view.flash(a.x, true);
      this.sound.appear();
      wipe.className = 'out';
      this.wiping = false;
    }, 1900);
  }
  speechAt(actor, text) {
    const el = $('speech');
    if (!actor) return (el.hidden = true);
    const [sx, sy] = this.view.toScreen(actor.x, groundHeight(actor.x) + 22);
    el.hidden = false;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    if (el.textContent !== text) el.textContent = text;
  }

  // ---- interface helpers --------------------------------------------------------------------
  modal(html, clear) {
    $('panel').innerHTML = html;
    $('modal').hidden = false;
    $('modal').classList.toggle('clear', !!clear);
    $('panel').scrollTop = 0;
  }
  toast(text, bad) {
    const t = $('toast');
    t.textContent = text;
    t.className = bad ? 'bad' : '';
    t.hidden = false;
    this.toastT = 4.5;
  }
  refreshHud() {
    const st = this.sim;
    const s = summary(st);
    $('year').textContent = `Year ${n0(s.year)}`;
    $('visit').textContent = `Visit ${this.visit}`;
    const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
    $('stats').innerHTML =
      cell(esc(s.stageName), `${s.households} households`) + cell('Seed-savers', s.knowers) + cell('Food', n0(s.food)) +
      cell('Seed', `${n0(s.seedLow)} low · ${s.ridgeStore ? n0(s.seedRidge) : '–'} ridge`) +
      cell('Fields', `${s.fieldsLow} flood · ${s.fieldsRidge} ridge${s.damaged ? ` · ${s.damaged} silted` : ''}`);
    $('pips').innerHTML = `<small>work is paid in food</small>`;
    const me = this.myHouse();
    const o = this.pair.length > 1 ? this.hh(this.pair[1 - this.active]) : null;
    $('btn-switch').innerHTML = o ? `Switch to ${esc(o.name)} <kbd>Q</kbd>` : 'Nobody to switch to';
    $('btn-switch').disabled = !o;
    if (me) $('who').innerHTML = `You are acting through <b>${esc(me.name)}</b>. ${PRACTICES.filter((p) => holds(me, p.id)).map((p) => p.name).join(', ') || 'Knows no practices yet'}`;
  }

  updateContext() {
    const t = this.nearest();
    const a = this.me();
    const prompt = $('prompt');
    const box = $('context');
    if (this.inspect && (!t || t.key !== this.inspect)) this.inspect = null;
    let html = '';
    if (t && !this.inspect) {
      const d = this.describe(t);
      const [sx, sy] = this.view.toScreen(t.x, groundHeight(t.x) + t.top);
      prompt.hidden = false;
      prompt.style.left = `${sx}px`;
      prompt.style.top = `${sy - 4}px`;
      const key = `${d.title}`;
      if (prompt.dataset.k !== key) (prompt.dataset.k = key), (prompt.innerHTML = `<kbd>E</kbd> ${esc(d.title)}`);
    } else prompt.hidden = true;
    const st = this.sim;
    const afford = (kind) => Sim.canAfford(st, kind);
    const cost = (kind) => (B.workCost[kind] ? `costs ${B.workCost[kind]} food` : 'free');
    if (t && this.inspect) {
      const d = this.describe(t);
      const can = this.state === S.VISIT && d.action;
      html += `<h3>${esc(d.title)}</h3><p>${esc(d.text)}</p>`;
      let acts = '';
      if (can) acts += `<button class="primary" data-act="site" ${afford(d.kind) ? '' : 'disabled'}><kbd>1</kbd> ${esc(d.action)} · ${cost(d.kind)}</button>`;
      if (this.state === S.VISIT && t.kind === 'plot' && st.plots[t.id].state !== 'eroded') acts += `<button data-act="crop"><kbd>2</kbd> Crop: ${esc(CROP[st.plots[t.id].crop].name)} (change) · free</button>`;
      if (acts) html += `<div class="acts">${acts}</div>`;
      else if (d.note && this.state === S.VISIT) html += `<div class="more">${esc(d.note)}</div>`;
    }
    if (this.state === S.VISIT && a && this.picking) {
      html = `<h3>Demonstrate a practice</h3><p>You know them all. Whoever's hands you use learns it, and so do the two nearest villagers within reach. Each demonstration ${cost('teach')}.</p><div class="plist">${PRACTICES.map((p, i) => {
        const who = this.pupils(p.id);
        return `<button data-act="teach" data-arg="${p.id}" ${who.length && afford('teach') ? '' : 'disabled'}><kbd>${i + 1}</kbd> <b>${esc(p.name)}</b> <small>${holders(st, p.id)}/${st.households.length} keep it${who.length ? ` · would teach ${esc(who.map((h) => h.name).join(', '))}` : ' · nobody new in reach'}</small><span>${esc(p.does)}</span></button>`;
      }).join('')}</div>`;
    }
    if (html !== this.ctxHtml) {
      this.ctxHtml = html;
      box.innerHTML = html;
    }
    box.hidden = !html;
  }

  // ---- frame --------------------------------------------------------------------------------
  update(dt) {
    const view = this.view;
    const st = this.sim;
    const s = this.state;
    const cam = view.cam;
    const opts = { showFloodLine: s === S.VISIT || s === S.PLANNING };
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').hidden = true;

    if (s === S.VISIT || s === S.RUINS || s === S.RESULTS) {
      const a = this.me();
      if (a) {
        if (this.carrying === a && a.target !== null) {
          view.carry.enabled = true;
          view.place(view.carry, Math.round(a.x) + a.dir * 4, groundHeight(a.x) + 7);
        } else {
          if (this.carrying === a) (this.carrying = null), view.emit('seed', a.x, groundHeight(a.x) + 12, 8);
          view.carry.enabled = false;
          a.controlled = true;
          const dir = (this.keys.has('d') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('a') || this.keys.has('ArrowLeft') ? 1 : 0);
          a.moving = dir !== 0;
          if (dir) {
            a.dir = dir;
            a.x = Math.max(WORLD.walkMin, Math.min(WORLD.walkMax, a.x + dir * WALK * dt));
            if ((this.stepT -= dt) <= 0) (this.sound.step(), (this.stepT = 0.26));
          }
        }
        cam.tx = a.x;
        cam.ty = groundHeight(a.x) + 44;
      }
      const me = s === S.VISIT ? this.myHouse() : null;
      view.updateActors(dt, st, { gather: s === S.VISIT && a ? a.x : undefined });
      view.setMarkers(s === S.VISIT ? a : null, s === S.VISIT ? this.other() : null);
      void me;
      this.updateContext();
    } else if (s === S.PLANNING) {
      view.updateActors(dt, st, {});
      view.setMarkers(this.me(), this.other());
      this.pumpOdds();
    } else if (s === S.PLAYBACK) {
      const now = performance.now();
      const j = this.jump;
      if (!this.pb) {
        const before = this.departT;
        this.departT -= dt;
        if (before > 0.45 && this.departT <= 0.45) (view.removeActor(-2), view.flash(this.godX, true), this.sound.vanish());
        if (this.departT <= 0) this.pb = new Playback(st, j.years, now);
        cam.tx = this.godX;
        view.updateActors(dt, st, {});
        view.setMarkers(null, null);
        view.update(dt, st, opts);
        return;
      }
      this.pb.advance(now, (ev, sim) => this.onTick(ev, sim));
      view.sync(st);
      const fast = j.years >= 100;
      view.syncActors(st, fast);
      view.updateActors(dt, st, { speed: { 1: 34, 10: 70, 100: 130, 1000: 170 }[j.years] });
      view.setMarkers(null, null);
      view.carry.enabled = false;
      this.updateCaptions(dt);
      this.updatePlaybackHud(now);

      // Framing and atmosphere change with the horizon.
      const cw = view.viewRect ? view.viewRect.cw : 1280;
      const base = view.baseZoom();
      const upcoming = st.tick % 4;
      const hasRidge = st.plots.some((p) => p.elev === 'ridge' && p.state !== 'wild') || st.stores.ridge.built;
      if (j.years === 1) (cam.tzoom = Math.min(base, cw / 520)), (cam.tx = 520), (cam.ty = 92);
      else if (j.years === 10) (cam.tzoom = Math.min(base, cw / (hasRidge ? 1000 : 640))), (cam.tx = hasRidge ? 780 : 540), (cam.ty = hasRidge ? 130 : 100);
      else if (j.years === 100) (cam.tzoom = cw / 1240), (cam.tx = 880), (cam.ty = 0);
      else (cam.tzoom = cw / 1420), (cam.tx = 890), (cam.ty = 0);
      if (j.years >= 100) cam.ty = -100; // clamps so the valley floor sits at the bottom of the frame

      const level = st.river.level;
      view.water.target = WORLD.waterLevels[level] + (j.years === 1 && upcoming === 1 ? 3 : 0);
      opts.waterRate = { 1: 0.9, 10: 5, 100: 14, 1000: 22 }[j.years];
      opts.cloudSpeed = { 1: 6, 10: 30, 100: 90, 1000: 200 }[j.years];
      const sky = st.sky;
      if (sky.ash > 0) (view.setTint(0.2, 0.17, 0.17, j.years <= 10 ? 0.42 : 0.3), (view.weather = 'ash'));
      else if (st.collapse) (view.setTint(0.55, 0.6, 0.75, 0.16), (view.weather = 'none'));
      else if (j.years <= 10) {
        if (level >= 1 || sky.rain) (view.setTint(0.35, 0.45, 0.6, sky.rain ? 0.3 : 0.22), (view.weather = 'rain'));
        else if (st.river.drought && upcoming === 2) (view.setTint(1, 0.8, 0.35, 0.16), (view.weather = 'none'));
        else if (upcoming === 3) (view.setTint(0.95, 0.97, 1, 0.2), (view.weather = 'snow'));
        else if (upcoming === 2) (view.setTint(1, 0.7, 0.35, 0.07), (view.weather = 'none'));
        else (view.setTint(1, 1, 1, 0), (view.weather = 'none'));
      } else {
        view.weather = level >= 2 || sky.rain ? 'rain' : 'none';
        const wet = st.river.wet;
        if (wet > 1.2) view.setTint(0.35, 0.45, 0.65, 0.12);
        else if (wet < 0.8) view.setTint(1, 0.8, 0.4, 0.1);
        else view.setTint(1, 1, 1, 0);
      }
      if (this.pb.finished) this.arrive();
    } else {
      // Title and arrival: the valley idles behind the panel.
      view.updateActors(dt, st, {});
      view.setMarkers(null, null);
      if (s === S.ARRIVAL && this.returnT > 0 && (this.returnT -= dt) <= 0) {
        // Alive: the god steps back into a villager, and the report opens.
        view.removeActor(-2);
        view.flash(this.godX || 560, false);
        this.sound.arrive(true);
        this.modal(this.arrivalHtml, true);
      }
      const v = s === S.ARRIVAL ? this.verdict : null;
      if (v) {
        // Collapsed: push in on him while he gives the verdict.
        v.t += dt;
        const god = view.actors.get(-1);
        cam.tzoom = view.baseZoom() * 2;
        cam.tx = god.x;
        cam.ty = groundHeight(god.x) + 26;
        if (v.t > 1.0 && !v.said) {
          v.said = true;
          this.sound.bad();
          $('ruinbar').hidden = false;
          $('ruinbar').innerHTML = `<span><b>${n0(st.collapse.year)} years survived.</b> ${esc(st.collapse.cause)}</span><span class="btns"><button class="primary" data-act="retry">Try again <kbd>Enter</kbd></button><button data-act="details">What happened</button><button data-act="next">Walk the ruins</button></span>`;
        }
        if (v.said && !this.say) this.speechAt(god, v.line);
      }
      if (s === S.TITLE) (cam.tx = 560 + Math.sin(view.time * 0.08) * 160), (cam.ty = 48);
    }
    if (this.say) this.speechAt(this.say.actor, this.say.text);
    else if (!(s === S.ARRIVAL && this.verdict && this.verdict.said)) $('speech').hidden = true;
    view.update(dt, st, opts);
  }
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
