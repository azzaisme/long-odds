// Game controller: explicit states, input, and the DOM interface. The simulation is only ever
// advanced by Playback (during a jump) and only ever edited by player actions (during a visit).
import { BALANCE as B } from '../sim/balance.js';
import { WORLD, PLOT_SITES, HOUSE_SLOTS, groundHeight } from '../sim/world.js';
import { hashSeed } from '../sim/rng.js';
import * as Sim from '../sim/sim.js';
import { summary, assessRisks, estimateSurvival } from '../sim/risks.js';
import { Playback } from '../sim/playback.js';
import { IDEAS, IDEA, PRACTICES, CUSTOMS, CROPS, CROP, BRIDGES, BRIDGE, holds, holders, possibleIdeas } from '../sim/decisions.js';
import { canBetroth } from '../sim/people.js';
import { WORK_TOUCH } from '../sim/decisions.js';

// What a decision touches, as small tags: "harvest ▲", "forest ▼". No numbers, no verdict.
const touch = (list) => (list && list.length ? `<span class="touch">${list.map((t) => { const d = t.slice(-1); return d === '+' || d === '-' ? `<i>${esc(t.slice(0, -1))} <b class="${d === '+' ? 'up' : 'dn'}">${d === '+' ? '▲' : '▼'}</b></i>` : `<i>${esc(t)}</i>`; }).join('')}</span>` : '');

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
// The god: the only character the player ever is. He knows every base idea.
const GOD = { id: null, name: 'you', ideas: new Proxy({}, { get: () => true }) };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

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
    this.view.addActor(-1, 'god', 470);
    this.setState(S.VISIT);
    this.view.cam.tzoom = this.view.baseZoom();
    this.toast('Six families, a little food and seed, and no farms. Take as long as you like: work is paid for in food.');
  }

  setState(s) {
    this.state = s;
    const visiting = s === S.VISIT || s === S.PLANNING;
    $('top').hidden = !visiting;
    $('bar').hidden = s !== S.VISIT;
    $('goals').hidden = s !== S.VISIT;
    $('hint').hidden = !(s === S.RUINS || s === S.RESULTS);
    $('playback').hidden = s !== S.PLAYBACK;
    $('ruinbar').hidden = !(s === S.RUINS || s === S.RESULTS);
    $('context').classList.toggle('raised', s === S.RUINS || s === S.RESULTS);
    if (s !== S.VISIT && s !== S.RUINS && s !== S.RESULTS) {
      $('context').hidden = true;
      $('prompt').hidden = true;
    }
    if (s !== S.PLANNING) this.tab = null;
    if (s === S.VISIT || s === S.PLAYBACK || s === S.RUINS || s === S.RESULTS) $('modal').hidden = true;
    for (const a of this.view.actors.values()) a.controlled = false;
    this.keys.clear();
    this.ctxHtml = null;
    if (visiting) this.refreshHud();
  }

  hh(id) { return this.sim.households.find((h) => h.id === id); }
  me() { return this.view.actors.get(-1); }
  myHouse() { return GOD; }

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
      if (k === 'j') return this.openPlan();
      if (k === 'b') return this.openBridge();
      if (k === 'h' || k === '?') return this.openHelp();
      if (k === 'e' && !this.picking) return this.act('site');
      if (k === 't') return this.act('teach');
      if (k === 'c') return this.openCustoms();
      if (k === 'p') return this.openPeople();
      if (this.picking) {
        if (k === 'Escape') return (this.picking = false);
        const pr = PRACTICES[Number(k) - 1];
        if (pr) return this.act('teach', pr.id);
      }
      if (k === '1' && this.inspect) return this.act('site');
      if (k === '2' && this.inspect) return this.act('crop');
    } else if (s === S.PLANNING) {
      if (k === 'Escape') return this.pending ? this.openPlan() : this.act('close');
      if (!this.pending && this.tab) {
        if (k === 'j') return this.openPlan();
        if (k === 'p') return this.openPeople();
        if (k === 'c') return this.openCustoms();
        if (k === 'b') return this.openBridge();
        if (k === 'h') return this.openHelp();
        if (this.tab !== 'plan') return;
      }
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
      case 'people': return this.openPeople();
      case 'plan': return this.openPlan();
      case 'help': return this.openHelp();
      case 'house': return this.openHouse(Number(arg));
      case 'match': return this.openMatch(Number(arg));
      case 'promise': return this.promise(arg);
      case 'calling': return this.calling(arg);
      case 'move': return this.moveHouse(arg);
      case 'bridge': return this.openBridge();
      case 'plan-bridge': return this.planBridge(arg);
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
      <p>You are a god with a small valley to look after. Keep its riverside settlement alive for as many years as you can. Walk the bank among them, build farms and a seed store, show a neighbour how to save seed. Then step out of the world for <b>1, 10, 100 or 1,000 years</b> and watch the village live with what you left it.</p>
      <p>Last long enough, fed and unflooded, and the hamlet grows: village, town, city, and finally <b>the Hold</b>, one great terraced house on the ridge with room for every resident and a seed vault of its own.</p>
      <p>The valley is not gentle. The river floods, heavy rains bring landslides, tornadoes cross the plain, and the volcano behind the hills smokes for a few years before it erupts.</p>
      <p class="note">Take as long as you like over each visit. Work is paid for in food from the stores; customs and crops cost nothing to change. Every jump plays out over thirty seconds and cannot be undone. There is no last visit: you come back until nobody is left.</p>
      <p class="note"><kbd>A</kbd><kbd>D</kbd> walk · <kbd>E</kbd> act on what you are standing at · <kbd>T</kbd> teach · <kbd>P</kbd> people · <kbd>C</kbd> customs · <kbd>B</kbd> bridge · <kbd>J</kbd> step out · <kbd>H</kbd> all controls</p>
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
    consider(Math.abs(a.x - 268), { kind: 'bridge', id: 0, x: 262, top: 22, reach: 16, bias: -8 });
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
      if (p.state === 'forest') {
        const f = st.forest.stands[p.stand];
        const side = f.side;
        const game = st.forest.game[side];
        const cover = Math.round(Sim.forestCover(st, side) * 100);
        const how = f.wood >= 7.5 ? 'Old trees, never cut.' : f.wood >= 2 ? 'Thinned, and growing back.' : f.wood > 0 ? 'Seedlings among the stumps.' : 'Stumps. It will only grow back if a neighbouring stand still has trees to seed it.';
        const cut = !p.far || st.bridge.built;
        return {
          kind: 'fell', forest: true, title: `Stand of the ${side} forest`,
          text: `${how} ${Math.round(f.wood)} timber here; ${cover}% of the ${side} forest still stands. ${game < 1 ? 'There is no game left in it.' : game < 8 ? 'Game is scarce.' : 'There is game under the trees.'}`,
          action: cut && f.wood >= 0.5 ? `Fell for timber (${Math.round(f.wood)})` : null,
          action2: cut ? 'Clear the stand for a field' : null,
          note: cut ? '' : 'There is no way across the river.',
        };
      }
      const cropLine = ` Sown with ${CROP[p.crop].name.toLowerCase()}: ${CROP[p.crop].does.toLowerCase()}`;
      if (p.state === 'wild') return { kind: 'build', title: `${place} site`, text: `Open ground. ${trait}`, action: 'Clear and build a field here' };
      if (p.state === 'overgrown') return { title: `Overgrown ${place.toLowerCase()} field`, text: `Abandoned ${ago(p.since)}; last worked in year ${Math.max(0, p.lastWorked)}.${by} ${trait}`, action: 'Clear and rebuild this field', kind: 'build' };
      if (p.state === 'damaged') return { title: `Flood-damaged ${place.toLowerCase()} field`, text: `Buried in silt since year ${p.since}. Seed-saving households can restore it in spring; nobody else knows how.${by}`, action: 'Dig out and repair this field', kind: 'repair' };
      if (p.state === 'eroded') return { title: 'Lost to the river', text: `The river cut this bank away in year ${p.since}.` };
      return { title: `${place} field`, text: `${trait}${by}${cropLine}` };
    }
    if (t.kind === 'bridge') {
      const br = st.bridge;
      const far = st.plots.filter((p) => p.far && p.state !== 'wild' && p.state !== 'eroded').length;
      const stands = br.built ? `A ${BRIDGE[br.built].name.toLowerCase()} has stood here since year ${br.builtYear}.` : br.lostYear !== null ? `The last bridge was lost in year ${br.lostYear}.` : 'Nothing crosses the river here yet.';
      const plan = br.plan && br.plan !== br.built ? ` Planned: a ${BRIDGE[br.plan].name.toLowerCase()}, ${br.progress} of ${BRIDGE[br.plan].years} years built.` : br.plan ? ' The village keeps it up.' : '';
      return { kind: 'open', title: 'The crossing', text: `${stands}${plan} Across the water lie two fields of unworked soil${far ? ` (${far} cleared)` : ''} and the road downriver, where new families and their ideas come from.`, action: 'Plan a bridge' };
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
      const also = IDEAS.filter((p) => p.id !== 'seed' && holds(h, p.id)).map((p) => p.name.toLowerCase());
      return { kind: 'open', hid: h.id, title: `${h.name}'s household`, text: `${h.size} people, ${h.adults} grown. Of the ${this.lineNames(h.lines)} line${h.lines.length > 1 ? 's' : ''}. Here since year ${h.since}. ${how}${also.length ? ` They also keep: ${also.join(', ')}.` : ''}`, action: 'Meet the household: matches, callings, moving house' };
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
    return this.witnesses(practice);
  }

  spend(result, sound) {
    if (!result.ok) {
      this.toast(cap(result.text), true);
      this.sound.deny();
      return false;
    }
    this.toast(cap(result.text));
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
    if (t.kind === 'house') return this.openHouse(st.houses[t.id].hid);
    if (t.kind === 'bridge') return this.openBridge();
    if (t.kind === 'plot' && st.plots[t.id].state === 'forest') {
      if (this.spend(Sim.fellStand(st, t.id, who), 'build')) this.view.emit('dust', t.x, groundHeight(t.x) + 6, 18);
    } else if (t.kind === 'plot') {
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
    if (!ws.length) return this.toast('Nobody close enough still needs to learn that. Walk up to some villagers first.', true), this.sound.deny();
    if (this.spend(Sim.demonstrate(this.sim, null, ws.map((h) => h.id), 'you', id), 'teach')) {
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
    if (p.state === 'forest') {
      if (this.spend(Sim.clearStand(this.sim, t.id, 'you'), 'build')) this.view.emit('dust', t.x, groundHeight(t.x) + 6, 22);
      return;
    }
    if (p.state === 'eroded') return;
    const next = CROPS[(CROPS.findIndex((c) => c.id === p.crop) + 1) % CROPS.length];
    const r = Sim.setCrop(this.sim, t.id, next.id, this.myHouse().name);
    if (r.ok) (this.toast(`${r.text} ${next.does}`), this.sound.click());
    this.ctxHtml = null;
  }
  lineNames(lines) {
    return lines.length ? lines.map((l) => this.sim.lines[l].name).join(' · ') : 'no';
  }
  personLine(p) {
    const st = this.sim;
    const year = Sim.yearOf(st);
    const age = year - p.born;
    const ideas = Object.keys(p.ideas).map((id) => IDEA[id].name).join(', ') || 'no ideas yet';
    const sp = p.spouse !== null ? st.people.find((q) => q.id === p.spouse) : null;
    const be = p.betrothed !== null ? st.people.find((q) => q.id === p.betrothed) : null;
    const status = sp ? `married to ${sp.name}` : be ? `promised to ${be.name}` : age < B.people.adultAge ? 'child' : 'unmarried';
    return { age, ideas, status, sp, be };
  }
  openHouse(hid) {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    const st = this.sim;
    const h = this.hh(hid);
    if (!h) return;
    this.pending = null;
    this.odds = null;
    this.setState(S.PLANNING);
    this.sound.click();
    const slot = h.house >= 0 ? st.houses[h.house] : null;
    const rows = st.people.filter((p) => p.hid === hid).sort((a, b) => a.born - b.born).map((p) => {
      const d = this.personLine(p);
      const grown = d.age >= B.people.adultAge;
      const acts = [];
      if (!d.sp) acts.push(`<button data-act="match" data-arg="${p.id}">${d.be ? 'Change match' : 'Find a match'}</button>`);
      if (grown) acts.push(`<button data-act="calling" data-arg="${p.id}">${p.calling === 'teacher' ? 'Teacher ✓' : 'Make teacher'}</button>`);
      return `<tr><td><b>${esc(p.name)}</b><small>${d.age}, ${p.sex === 'f' ? 'woman' : 'man'}${grown ? '' : ' (child)'} · ${esc(this.lineNames(p.lines))}</small></td><td>${esc(d.ideas)}<small>${esc(d.status)}${p.calling ? ' · teacher' : ''}</small></td><td>${acts.join('')}</td></tr>`;
    });
    const free = (elev) => st.houses.find((x) => x.elev === elev && x.state !== 'home');
    const other = slot ? (slot.elev === 'low' ? 'ridge' : 'low') : null;
    const move = other && free(other) ? `<button data-act="move" data-arg="${hid}:${free(other).id}" ${st.stores.low.food + st.stores.ridge.food >= B.people.moveCost ? '' : 'disabled'}>Move this household to ${other === 'ridge' ? 'the ridge' : 'the riverside'} · costs ${B.people.moveCost} food</button>` : '';
    this.tab = null;
    this.modal(`
      <h2>${esc(h.name)}'s household</h2>
      <p class="note">${slot ? (slot.elev === 'ridge' ? 'A house on the ridge' : 'A house by the river, below the flood line') : 'Living in shared quarters'} · family line${h.lines.length > 1 ? 's' : ''}: ${esc(this.lineNames(h.lines))}. Children pick up whatever the grown people of their own house know. A marriage joins two lines, and a child who holds two ideas may work out a third.</p>
      <table class="people">${rows.join('')}</table>
      <div class="row">${move}<button data-act="people">The whole village <kbd>P</kbd></button><button data-act="close">Done <kbd>Esc</kbd></button></div>`);
  }
  openMatch(pid) {
    if (this.state !== S.PLANNING) return;
    const st = this.sim;
    const a = st.people.find((p) => p.id === pid);
    if (!a) return;
    const year = Sim.yearOf(st);
    const options = st.people.filter((b) => canBetroth(a, b) && Math.abs(a.born - b.born) <= 15).map((b) => ({ b, could: possibleIdeas(a, b), fresh: b.lines.filter((l) => !a.lines.includes(l)).length }));
    options.sort((x, y) => y.could.length - x.could.length || y.fresh - x.fresh || Math.abs(a.born - x.b.born) - Math.abs(a.born - y.b.born));
    const rows = options.slice(0, 14).map(({ b, could }) => {
      const d = this.personLine(b);
      return `<tr><td><b>${esc(b.name)}</b><small>${d.age} · ${esc(this.hh(b.hid).name)}'s house · ${esc(this.lineNames(b.lines))}</small></td><td>${esc(d.ideas)}<small>${could.length ? `their children could work out: <i>${esc(could.map((i) => i.name).join(', '))}</i>` : 'no new idea in reach from this pairing'}${d.be ? ` · already promised to ${esc(d.be.name)}` : ''}</small></td><td><button class="${could.length ? 'primary' : ''}" data-act="promise" data-arg="${a.id}:${b.id}">Promise</button></td></tr>`;
    });
    const mine = this.personLine(a);
    this.tab = null;
    this.modal(`
      <h2>A match for ${esc(a.name)}</h2>
      <p class="note">${esc(a.name)}, ${year - a.born}, of the ${esc(this.lineNames(a.lines))} line${a.lines.length > 1 ? 's' : ''}, knows: ${esc(mine.ideas)}. A promise costs nothing and is kept when both are of age (${B.people.marryFrom}) and still free. Matches with the most new ideas in reach come first.</p>
      ${rows.length ? `<table class="people">${rows.join('')}</table>` : '<p>There is nobody free, unrelated and near enough in age in any other house.</p>'}
      <div class="row"><button data-act="house" data-arg="${a.hid}">Back</button></div>`);
  }
  promise(arg) {
    if (this.state !== S.PLANNING) return;
    const [a, b] = arg.split(':').map(Number);
    const r = Sim.betroth(this.sim, a, b, this.myHouse() ? this.myHouse().name : 'the god');
    this.toast(r.text, !r.ok);
    if (r.ok) this.sound.good();
    this.openHouse(this.sim.people.find((p) => p.id === a).hid);
  }
  calling(arg) {
    if (this.state !== S.PLANNING) return;
    const p = this.sim.people.find((q) => q.id === Number(arg));
    if (!p) return;
    const r = Sim.setCalling(this.sim, p.id, p.calling === 'teacher' ? null : 'teacher', 'the god');
    this.toast(r.text);
    this.openHouse(p.hid);
  }
  moveHouse(arg) {
    if (this.state !== S.PLANNING) return;
    const [hid, slot] = arg.split(':').map(Number);
    const r = Sim.moveHousehold(this.sim, hid, slot, 'the god');
    this.toast(r.text, !r.ok);
    if (r.ok) {
      this.sound.build();
      this.view.sync(this.sim);
      this.view.syncActors(this.sim, true);
    }
    this.openHouse(hid);
  }
  openPeople() {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    const st = this.sim;
    this.pending = null;
    this.odds = null;
    this.setState(S.PLANNING);
    const year = Sim.yearOf(st);
    const grown = st.people.filter((p) => year - p.born >= B.people.adultAge);
    const lines = st.lines.map((l) => ({ l, n: st.people.filter((p) => p.lines.includes(l.id)).length })).filter((x) => x.n > 0);
    const ideaRow = (i) => {
      const n = st.people.filter((p) => p.ideas[i.id]).length;
      const hn = holders(st, i.id);
      const d = st.discovered[i.id];
      if (n) return `<li class="good"><b>${esc(i.name)}</b> · ${n} people in ${hn} house${hn === 1 ? '' : 's'}${d ? ` · worked out by ${esc(d.by)} (${esc(this.lineNames(d.lines))}) in year ${d.year}` : ''}<br><span class="note">${esc(i.does)}</span> ${touch(i.t)}</li>`;
      if (i.base) return `<li class="warn"><b>${esc(i.name)}</b> · nobody keeps it. You can demonstrate it (T).<br><span class="note">${esc(i.does)}</span> ${touch(i.t)}</li>`;
      const both = grown.filter((p) => p.ideas[i.from[0]] && p.ideas[i.from[1]]).length;
      const have = i.from.map((f) => `${IDEA[f].name}${st.people.some((p) => p.ideas[f]) ? '' : ' (unknown)'}`).join(' + ');
      return `<li class="note"><b>${esc(i.name)}</b> · not yet. Grows from ${esc(have)}${both ? `; ${both} ${both === 1 ? 'person holds' : 'people hold'} both` : '; nobody holds both'}.<br><span class="note">${esc(i.does)}</span> ${touch(i.t)}</li>`;
    };
    this.modal(`${this.tabs('people')}
      <h2>The people of the valley</h2>
      <div class="grid"><div><small>People</small><b>${st.people.length}</b></div><div><small>Grown</small><b>${grown.length}</b></div><div><small>Houses</small><b>${st.households.length}</b></div><div><small>Family lines</small><b>${lines.length}</b></div><div><small>Ideas known</small><b>${IDEAS.filter((i) => st.people.some((p) => p.ideas[i.id])).length} of ${IDEAS.length}</b></div></div>
      <h3>Family lines</h3>
      <p>${lines.map(({ l, n }) => `<b>${esc(l.name)}</b> <span class="note">${n}${l.year ? `, arrived year ${l.year}` : ''}</span>`).join(' · ')}</p>
      <h3>Houses</h3>
      <div class="opts">${st.households.map((h) => `<button data-act="house" data-arg="${h.id}">${esc(h.name)} <small>${h.size}</small></button>`).join('')}</div>
      <h3>Ideas</h3>
      <ul>${IDEAS.map(ideaRow).join('')}</ul>
`);
  }
  openBridge() {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    const st = this.sim;
    const br = st.bridge;
    this.pending = null;
    this.odds = null;
    this.setState(S.PLANNING);
    const pct = (v) => (v >= 1 ? 'certain' : v <= 0 ? 'never' : `${Math.round(v * 100)}%`);
    this.modal(`${this.tabs('bridge')}
      <h2>Plan a bridge</h2>
      <p class="note">You decide what is to be built; the village builds it, one fed winter at a time, while you are away. Planning costs nothing. A bridge opens two far-bank fields (10% richer soil), brings new families ${B.bridge.newcomers}× as often, and lets the village trade for ${Math.round(B.bridge.trade * 100)}% of what it lacks in a hungry winter. If it goes while a crop stands across the river, that crop is lost. The old bridge stays in use while a bigger one is built.</p>
      ${BRIDGES.map((k) => `<div class="custom"><b>${esc(k.name)}${br.built === k.id ? ' · standing' : ''}${br.plan === k.id && br.built !== k.id ? ` · planned, ${br.progress}/${k.years} years` : ''}</b><span class="note">${esc(k.does)}</span>${touch(k.t)}<div class="note">${k.years} year${k.years > 1 ? 's' : ''} · ${k.food} food a year · carried away by high water: ${pct(k.washout[0])}, flood: ${pct(k.washout[1])}, great flood: ${pct(k.washout[2])}${k.rot ? ` · rots ${pct(k.rot)} a year if it is no longer the plan` : ''}${k.needs ? ` · needs someone who knows ${IDEA[k.needs].name.toLowerCase()} (${holders(st, k.needs)} houses do)` : ''}</div><div class="opts"><button data-act="plan-bridge" data-arg="${k.id}" class="${br.plan === k.id ? 'primary' : ''}" ${br.plan === k.id ? 'disabled' : ''}>${br.plan === k.id ? 'This is the plan' : `Plan a ${esc(k.name.toLowerCase())}`}</button></div></div>`).join('')}
      <div class="row"><button data-act="plan-bridge" data-arg="none" ${br.plan ? '' : 'disabled'}>Plan no bridge</button></div>`);
  }
  planBridge(arg) {
    if (this.state !== S.PLANNING) return;
    const r = Sim.planBridge(this.sim, arg === 'none' ? null : arg, this.myHouse() ? this.myHouse().name : 'the god');
    this.toast(r.text, !r.ok);
    if (r.ok) this.sound.click();
    this.view.sync(this.sim);
    this.openBridge();
  }
  openCustoms() {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    this.pending = null;
    this.odds = null;
    this.setState(S.PLANNING);
    const st = this.sim;
    this.modal(`${this.tabs('customs')}
      <h2>Customs of the village</h2>
      <p class="note">What the whole village does while you are away. Changing a custom costs nothing. Over the centuries each one slips back, a step at a time, toward what villages do unprompted (marked ·). The tags under each choice say what it pushes up ▲ or down ▼, not by how much.</p>
      ${CUSTOMS.map((c) => `<div class="custom"><b>${esc(c.name)}</b><span class="note">${esc(c.ask)}</span><div class="opts cols">${c.options.map((o, i) => `<div><button data-act="custom" data-arg="${c.id}:${i}" class="${st.customs[c.id] === i ? 'primary' : ''}">${esc(o.label)}${i === c.base ? ' ·' : ''}</button>${touch(o.t)}</div>`).join('')}</div></div>`).join('')}
`);
  }
  setCustom(arg) {
    if (this.state !== S.PLANNING) return;
    const [id, i] = arg.split(':');
    const top = $('panel').scrollTop;
    if (Sim.setCustom(this.sim, id, Number(i), this.myHouse() ? this.myHouse().name : 'the god').ok) this.sound.click();
    this.openCustoms();
    $('panel').scrollTop = top;
  }
  // ---- planning a jump ----------------------------------------------------------------------
  conditionHtml() {
    const s = summary(this.sim);
    const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
    return `<div class="grid">
      ${cell('Settlement', esc(s.stageName))}${cell('People', s.people)}${cell('Households', s.households)}${cell('Know seed saving', s.knowers)}
      ${cell('Food in store', n0(s.food))}${cell('Seed: granary', n0(s.seedLow))}${cell('Seed: ridge', s.ridgeStore ? n0(s.seedRidge) : 'no store')}
      ${cell('Timber', n0(s.wood))}${cell('Forest standing', `${Math.round(s.coverWest * 100)}% W · ${Math.round(s.coverEast * 100)}% E`)}${cell('Game', n0(s.game))}${cell('Floodplain fields', s.fieldsLow)}${cell('Ridge fields', s.fieldsRidge)}${s.damaged ? cell('Flood-damaged', s.damaged) : ''}
    </div>
    <p class="note">Ideas kept (houses): ${IDEAS.filter((p) => holders(this.sim, p.id)).map((p) => `${esc(p.name)} ${holders(this.sim, p.id)}/${s.households}`).join(' · ') || 'none'}</p>
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
    this.modal(`${this.tabs('plan')}
      <h2>Year ${n0(year)}: how the settlement stands</h2>
      ${this.conditionHtml()}${left}
      <p>How far ahead will you skip? This is visit ${this.visit}.</p>
      <div class="row jumps">${B.jumpChoices.map((y, i) => `<button data-act="choose" data-arg="${y}"><b>${n0(y)} year${y > 1 ? 's' : ''}</b><small>to year ${n0(year + y)} · <kbd>${i + 1}</kbd></small></button>`).join('')}</div>
      <p class="note">Every jump takes thirty seconds to play out. You cannot act or turn back until it lands.</p>`);
  }
  choose(years) {
    if (this.state !== S.PLANNING || !B.jumpChoices.includes(years)) return;
    this.pending = years;
    this.tab = null;
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
    // The god is gone in a flash of blue light. Only then does the thirty-second clock start.
    const body = this.me();
    this.godX = body ? body.x : 560;
    this.setState(S.PLAYBACK);
    this.pb = null;
    this.departT = 1.0;
    $('toast').hidden = true;
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
      else if (e.type === 'flood' && e.level >= 2 && this.floodSoundT <= 0) (this.sound.flood(e.level), (this.floodSoundT = 1.2), (this.view.shake = Math.max(this.view.shake, e.level === 3 ? 1.6 : 0.6)));
      else if (e.type === 'harvest' && j.years <= 10) this.sound.harvest();
      else if (e.type === 'stage' || e.type === 'idea') this.sound.arrive(true);
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
    const rank = (e) => (e.type === 'collapse' || e.type === 'stage' || e.type === 'eruption' || e.type === 'idea' ? 5 : e.type === 'forest-gone' || e.type === 'game-gone' || e.type === 'cold' || e.type === 'tornado' || e.type === 'landslide' || e.type === 'rumble' || e.type === 'bridge' || e.type === 'bridge-lost' || e.type === 'stranded' ? 4 : e.type === 'recovery' || e.type === 'knowledge-lost' || e.type === 'store' ? 4 : e.p >= 3 ? 3 : e.sum ? 2 : e.p);
    if (this.queue.length > 4) {
      const keep = this.queue.map((e, i) => ({ e, i })).sort((a, b) => rank(b.e) - rank(a.e) || b.i - a.i).slice(0, 4).sort((a, b) => a.i - b.i);
      this.queue = keep.map((k) => k.e);
    }
    if (this.capT <= 0 && this.queue.length) {
      const e = this.queue.shift();
      this.capT = gap;
      const li = document.createElement('li');
      const good = e.type === 'bridge' || e.type === 'idea' || e.type === 'newcomers' || e.type === 'wedding' || e.type === 'stage' || e.type === 'recovery' || e.type === 'store' || e.type === 'settle' || e.type === 'repair' || e.type === 'uphill';
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
      const must = turning.filter((e) => ['forest-gone', 'game-gone', 'bridge', 'bridge-lost', 'stranded', 'idea', 'eruption', 'tornado', 'landslide', 'stage', 'stage-down', 'collapse', 'recovery', 'knowledge-lost', 'store', 'erode'].includes(e.type));
      const stages = turning.filter((e) => e.type === 'idea' || e.type === 'stage' || e.type === 'collapse' || e.type === 'eruption');
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
      this.view.removeActor(-1);
      this.view.addActor(-1, 'god', x);
      this.verdict = null;
      this.returnT = 1.3; // a beat to see him arrive, then the report opens
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
      lines.push(`${demo.length === 1 ? '1 recovery was' : `${demo.length} recoveries were`} carried out by households whose seed saving goes back to ${p.by === 'you' ? 'your' : `${esc(p.by)}'s`} demonstration in year ${p.year}.`);
    }
    for (const d of st.discoveries.filter((x) => x.year >= j.from)) {
      const made = st.actions.find((a) => a.type === 'betroth' && ((d.parents.includes(a.a) && d.parents.includes(a.b)) || d.pid === a.a || d.pid === a.b));
      const shown = d.from.filter((f) => st.actions.some((a) => a.type === 'demonstrate' && a.practice === f));
      if (made) lines.push(`${esc(IDEA[d.idea].name)} was worked out in year ${d.year} by ${esc(d.by)}, ${d.pid === made.a || d.pid === made.b ? 'one of the pair you promised to each other' : 'a child of the match you made'} in year ${made.year}.`);
      else if (shown.length) lines.push(`${esc(IDEA[d.idea].name)} (year ${d.year}, ${esc(d.by)}) grew out of ${esc(shown.map((f) => IDEA[f].name.toLowerCase()).join(' and '))}, which you demonstrated.`);
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
    const god = this.me();
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
    $('visit').textContent = `${s.stageName} · visit ${this.visit}`;
    const known = IDEAS.filter((i) => holders(st, i.id)).length;
    const chip = (cls, value, label, tip) => `<div class="chip" title="${esc(tip)}"><i class="ico ${cls}"></i><b>${value}</b><small>${label}</small></div>`;
    $('stats').innerHTML =
      chip('people', s.people, `in ${s.households} houses`, `${s.people} people in ${s.households} houses, of ${st.lines.filter((l) => st.people.some((p) => p.lines.includes(l.id))).length} family lines`) +
      chip('food', n0(s.food), 'food', `Food in store: ${n0(s.food - s.foodRidge)} in the granary, ${n0(s.foodRidge)} on the ridge. Work is paid for out of this.`) +
      chip('seed', `${n0(s.seedLow)}${s.ridgeStore ? ` + ${n0(s.seedRidge)}▲` : ''}`, 'seed', s.ridgeStore ? `${n0(s.seedLow)} seed in the lowland granary, ${n0(s.seedRidge)} in the ridge store` : `${n0(s.seedLow)} seed, all in the lowland granary. There is no ridge store.`) +
      chip('fields', `${s.fieldsLow} + ${s.fieldsRidge}▲`, s.damaged ? `fields · ${s.damaged} silted` : 'fields', `${s.fieldsLow} floodplain fields and ${s.fieldsRidge} ridge fields${s.damaged ? `; ${s.damaged} buried in flood silt` : ''}`) +
      chip('wood', n0(s.wood), `forest ${Math.round((s.coverWest + s.coverEast) * 50)}%`, `${n0(s.wood)} cut timber. The west forest is ${Math.round(s.coverWest * 100)}% standing, the east ${Math.round(s.coverEast * 100)}%. Game: ${n0(st.forest.game.west)} west, ${n0(st.forest.game.east)} east.`) +
      chip('ideas', `${known}/${IDEAS.length}`, 'ideas', `${known} of ${IDEAS.length} ideas are kept by someone. ${s.knowers} houses know how to save seed.`);
    // First-visit checklist: what to try before leaving.
    const did = (type) => st.actions.some((a) => a.type === type);
    const goals = [
      [did('build-plot'), 'Clear a field: walk to a staked site and press <kbd>E</kbd>'],
      [did('demonstrate'), 'Teach an idea: stand among villagers and press <kbd>T</kbd>'],
      [did('build-store') || did('plan-bridge') || did('betroth') || did('set-custom'), 'Plan ahead: a ridge store, a match (<kbd>P</kbd>), a custom (<kbd>C</kbd>) or a bridge (<kbd>B</kbd>)'],
      [false, 'Step out of the world with <kbd>J</kbd> and see what they make of it'],
    ];
    const el = $('goals');
    el.classList.toggle('done', this.visit > 1);
    el.innerHTML = this.visit > 1 ? '' : `<b>First visit</b>${goals.map(([ok, t]) => `<div class="${ok ? 'ok' : ''}">${ok ? '■' : '□'} ${t}</div>`).join('')}`;
  }

  // The card for whatever the god is standing at. It appears on its own; E does the main thing.
  updateContext() {
    const t = this.nearest();
    const a = this.me();
    const prompt = $('prompt');
    const box = $('context');
    const st = this.sim;
    const visit = this.state === S.VISIT;
    this.inspect = t ? t.key : null;
    const price = (kind) => (kind === 'fell' ? B.forest.fellCost : kind === 'clear' ? B.forest.clearCost : B.workCost[kind] || 0);
    const afford = (kind) => kind === 'open' || st.stores.low.food + st.stores.ridge.food >= price(kind);
    const cost = (kind) => (kind === 'open' ? '' : price(kind) ? ` · ${price(kind)} food` : ' · free');
    let html = '';
    if (visit && a && this.picking) {
      prompt.hidden = true;
      html = `<h3>Teach an idea</h3><p>You know all six. Everyone old enough in the houses of the three nearest villagers learns it. Each lesson costs ${B.workCost.teach} food. <kbd>Esc</kbd> to cancel.</p><div class="plist">${PRACTICES.map((p, i) => {
        const who = this.pupils(p.id);
        return `<button data-act="teach" data-arg="${p.id}" ${who.length && afford('teach') ? '' : 'disabled'}><kbd>${i + 1}</kbd> <b>${esc(p.name)}</b> <small>${holders(st, p.id)}/${st.households.length} houses keep it${who.length ? ` · would teach ${esc(who.map((h) => h.name).join(', '))}` : ' · nobody new in reach'}</small><span>${esc(p.does)}</span>${touch(p.t)}</button>`;
      }).join('')}</div>`;
    } else if (t) {
      const d = this.describe(t);
      const [sx, sy] = this.view.toScreen(t.x, groundHeight(t.x) + t.top);
      prompt.hidden = false;
      prompt.style.left = `${sx}px`;
      prompt.style.top = `${sy - 4}px`;
      if (prompt.dataset.k !== d.title) (prompt.dataset.k = d.title), (prompt.textContent = d.title);
      // Each button carries, underneath, what doing it would touch.
      const p = t.kind === 'plot' ? st.plots[t.id] : null;
      let mainTags = null;
      if (p && p.state === 'forest') mainTags = WORK_TOUCH.fell;
      else if (p && p.state !== 'damaged') mainTags = WORK_TOUCH[p.far ? 'field-far' : p.elev === 'low' ? 'field-low' : 'field-ridge'];
      else if (t.kind === 'store') mainTags = WORK_TOUCH.store;
      else if (t.kind === 'granary') mainTags = WORK_TOUCH.carry;
      let acts = '';
      if (visit && d.action) acts += `<div><button class="primary" data-act="site" ${afford(d.kind) ? '' : 'disabled'}><kbd>E</kbd> ${esc(d.action)}${cost(d.kind)}</button>${touch(mainTags)}</div>`;
      if (visit && d.forest && d.action2) acts += `<div><button data-act="crop" ${afford('clear') ? '' : 'disabled'}><kbd>2</kbd> ${esc(d.action2)}${cost('clear')}</button>${touch(WORK_TOUCH[`clear-${st.forest.stands[p.stand].side}`])}</div>`;
      else if (visit && p && p.state !== 'eroded') acts += `<div><button data-act="crop"><kbd>2</kbd> Sown with ${esc(CROP[p.crop].name.toLowerCase())}: change</button>${touch(CROP[p.crop].t)}</div>`;
      if (visit && d.action && !afford(d.kind)) acts += '<span class="more">Not enough food in store for this.</span>';
      html = `<div class="card"><div class="txt"><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p>${!acts && d.note && visit ? `<div class="more">${esc(d.note)}</div>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`;
    } else prompt.hidden = true;
    if (html !== this.ctxHtml) {
      this.ctxHtml = html;
      box.innerHTML = html;
    }
    box.hidden = !html;
  }

  tabs(active) {
    this.tab = active;
    const t = [['plan', 'J', 'Step out'], ['people', 'P', 'People'], ['customs', 'C', 'Customs'], ['bridge', 'B', 'Bridge'], ['help', 'H', 'Controls']];
    return `<div class="tabs">${t.map(([id, k, label]) => `<button data-act="${id}" class="${id === active ? 'on' : ''}"><kbd>${k}</kbd> ${label}</button>`).join('')}<button data-act="close" class="x" title="Close (Esc)">✕</button></div>`;
  }
  openHelp() {
    if (this.state !== S.VISIT && this.state !== S.PLANNING) return;
    this.pending = null;
    this.odds = null;
    this.setState(S.PLANNING);
    this.modal(`${this.tabs('help')}
      <h2>Controls</h2>
      <div class="keys">
        <span><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd></span><span>Walk. A card appears for whatever you are standing at.</span>
        <span><kbd>E</kbd></span><span>Do the main thing on the card: clear a field, build, carry seed, meet a household, plan the bridge</span>
        <span><kbd>2</kbd></span><span>Change the crop of the field you are standing at</span>
        <span><kbd>T</kbd> then <kbd>1</kbd>–<kbd>6</kbd></span><span>Teach an idea to the houses of the three nearest villagers</span>
        <span><kbd>P</kbd></span><span>People: family lines, houses, ideas, matches, teachers, moving house</span>
        <span><kbd>C</kbd></span><span>Customs the whole village keeps while you are away</span>
        <span><kbd>B</kbd></span><span>Plan a bridge; the village builds it over the years</span>
        <span><kbd>J</kbd></span><span>Review the settlement and step out of the world for 1, 10, 100 or 1,000 years</span>
        <span><kbd>Esc</kbd></span><span>Close a panel</span>
      </div>
      <p class="note">Work is paid for in food from the stores. Matches, callings, customs, crops and bridge plans cost nothing to set.</p>`);
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
            a.x = Math.max(st.bridge.built ? WORLD.farWalkMin : WORLD.walkMin, Math.min(WORLD.walkMax, a.x + dir * WALK * dt));
            if ((this.stepT -= dt) <= 0) (this.sound.step(), (this.stepT = 0.26));
          }
        }
        cam.tx = a.x;
        cam.ty = groundHeight(a.x) + 26;
      }
      view.updateActors(dt, st, { gather: s === S.VISIT && a ? a.x : undefined });
      view.setMarkers(s === S.VISIT ? a : null, null);
      this.updateContext();
    } else if (s === S.PLANNING) {
      view.updateActors(dt, st, {});
      view.setMarkers(this.me(), null);
      this.pumpOdds();
    } else if (s === S.PLAYBACK) {
      const now = performance.now();
      const j = this.jump;
      if (!this.pb) {
        const before = this.departT;
        this.departT -= dt;
        if (before > 0.45 && this.departT <= 0.45) (view.removeActor(-1), view.flash(this.godX, true), this.sound.vanish());
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
      else if (j.years === 100) (cam.tzoom = cw / 1500), (cam.tx = 900), (cam.ty = 0);
      else (cam.tzoom = cw / 2060), (cam.tx = 800), (cam.ty = 0); // the whole valley, forest to forest
      if (j.years >= 100) cam.ty = -100; // clamps so the valley floor sits at the bottom of the frame

      const level = st.river.level;
      view.water.target = WORLD.waterLevels[level] + (j.years === 1 && upcoming === 1 ? 3 : 0);
      view.rainPower = level >= 3 ? 3 : level >= 2 ? 2 : 1;
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
