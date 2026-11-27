// People: individuals who are born, learn, marry between houses, have children and die.
// Ideas live in people (person.ideas[id] = where it came from). Family lines are carried by
// descent; a child belongs to every line either parent belongs to. Households keep a derived
// summary (`ideas`, `adults`, `size`) that the farming code reads.
import { IDEAS, IDEA, DERIVED, possibleIdeas } from './decisions.js';

// Every idea a person holds is recorded twice: `ideas[id]` says where it came from, and one bit
// in `mask` makes the yearly checks cheap. Always add ideas through give().
export function give(p, id, from) {
  if (p.ideas[id]) return false;
  p.ideas[id] = from;
  p.mask |= IDEA[id].bit;
  return true;
}
function giveAll(p, src, wantMask, chance, rand) {
  for (const id in src) if (wantMask & IDEA[id].bit && (chance >= 1 || rand() < chance)) give(p, id, src[id]);
}

export const FIRST_NAMES = [
  'Ama', 'Tobi', 'Ilse', 'Renn', 'Odo', 'Mera', 'Kesh', 'Juna', 'Bram', 'Sela', 'Dov', 'Yara', 'Hale', 'Nico', 'Wren', 'Pell',
  'Asha', 'Corin', 'Edda', 'Faro', 'Gwyn', 'Ivo', 'Lark', 'Moss', 'Nell', 'Orin', 'Pia', 'Quill', 'Rhea', 'Soren', 'Tam', 'Una',
  'Vey', 'Wim', 'Xan', 'Ysolt', 'Zev', 'Arlo', 'Brin', 'Cael', 'Dara', 'Esme', 'Finn', 'Greta', 'Holt', 'Ines', 'Jory', 'Kai',
  'Lio', 'Maud', 'Nuri', 'Olwen', 'Perrin', 'Runa', 'Stig', 'Thea', 'Ulf', 'Vida', 'Wyn', 'Zora',
];

export const ageOf = (p, year) => year - p.born;
export const isAdult = (p, year, B) => year - p.born >= B.people.adultAge;
export const membersOf = (st, hid) => st.people.filter((p) => p.hid === hid);
export const person = (st, id) => st.people.find((p) => p.id === id);

export function addPerson(st, hid, born, sex, lines, mother = null, father = null) {
  const id = st.nextPid++;
  const p = { id, name: FIRST_NAMES[(id * 7 + (st.seed % 13)) % FIRST_NAMES.length], sex, born, hid, lines: [...lines].sort((a, b) => a - b), ideas: {}, mask: 0, mother, father, spouse: null, betrothed: null, calling: null };
  st.people.push(p);
  return p;
}

// A founding or arriving family: a couple and their children, starting a new family line.
export function addFamily(st, h, year, rand, B) {
  const line = st.lines.length;
  st.lines.push({ id: line, name: h.name, year });
  h.line = line;
  const a = addPerson(st, h.id, year - 20 - Math.floor(rand() * 16), 'f', [line]);
  const b = addPerson(st, h.id, year - 20 - Math.floor(rand() * 16), 'm', [line]);
  a.spouse = b.id;
  b.spouse = a.id;
  const kids = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < kids; i++) addPerson(st, h.id, year - Math.floor(rand() * 14), rand() < 0.5 ? 'f' : 'm', [line], a.id, b.id);
  // The household is known by one of its people, so the villager on screen is a real person.
  a.name = h.name;
  return [a, b];
}

// Rebuild each household's summary from its people. Call after anything changes who knows what.
export function refreshHouseholds(st, year, B) {
  const by = new Map(st.households.map((h) => [h.id, h]));
  for (const h of st.households) {
    h.adults = 0;
    h.size = 0;
    h.newMask = 0;
    h.lineMask = 0;
  }
  for (const p of st.people) {
    const h = by.get(p.hid);
    if (!h) continue;
    h.size++;
    if (year - p.born < B.people.adultAge) continue;
    h.adults++;
    h.newMask |= p.mask;
    for (const l of p.lines) h.lineMask |= 1 << (l % 30);
  }
  for (const h of st.households) {
    // Rebuild the detailed summary only when what the house knows, or who it descends from, changed.
    if (h.newMask !== h.mask || h.lineMask !== h.lineSeen || (h.ideas.seed && !h.lineage)) {
      h.ideas = {};
      h.lines = [];
      for (const p of st.people) {
        if (p.hid !== h.id || year - p.born < B.people.adultAge) continue;
        for (const id in p.ideas) if (!h.ideas[id]) h.ideas[id] = p.ideas[id];
        for (const l of p.lines) if (!h.lines.includes(l)) h.lines.push(l);
      }
      h.lines.sort((a, b) => a - b);
      h.mask = h.newMask;
      h.lineSeen = h.lineMask;
    }
    delete h.newMask;
    delete h.lineMask;
    h.knows = !!h.ideas.seed;
    h.lineage = h.ideas.seed || null;
  }
}

export function removePeopleOf(st, hid) {
  const gone = new Set();
  st.people = st.people.filter((p) => (p.hid === hid ? (gone.add(p.id), false) : true));
  for (const p of st.people) {
    if (gone.has(p.spouse)) p.spouse = null;
    if (gone.has(p.betrothed)) p.betrothed = null;
  }
}

const related = (a, b) => (a.mother !== null && (a.mother === b.mother || a.father === b.father)) || a.mother === b.id || a.father === b.id || b.mother === a.id || b.father === a.id;
export const canMarry = (a, b, year, B) =>
  a.id !== b.id && a.sex !== b.sex && a.spouse === null && b.spouse === null && a.hid !== b.hid && !related(a, b) &&
  year - a.born >= B.people.marryFrom && year - b.born >= B.people.marryFrom;
// A betrothal can be made for the young, to take effect when both are of age.
export const canBetroth = (a, b) => a.id !== b.id && a.sex !== b.sex && a.spouse === null && b.spouse === null && a.hid !== b.hid && !related(a, b);
const lineNames = (st, lines) => lines.map((l) => st.lines[l].name).join(' and ');

// One year of births, deaths, learning, marriages and ideas. `found(couple)` is asked to start
// a new household for a newly married pair and returns it, or null if there is no room.
export function peopleYear(st, B, year, say, rand, shortage, found) {
  const P = B.people;
  const hold = st.civ.stage >= 4;
  let byId = null;
  const firstKnown = (id) => !st.discovered[id];

  // Deaths.
  const dead = new Set();
  for (const p of st.people) {
    const age = year - p.born;
    const base = age < 5 ? P.death.infant : age < P.death.oldFrom ? P.death.adult : P.death.old + P.death.oldRise * (age - P.death.oldFrom);
    if (rand() < base * (1 + P.death.hunger * shortage)) dead.add(p.id);
  }
  if (dead.size) {
    // What dies with them: an idea nobody else alive holds.
    const lost = {};
    for (const p of st.people) if (dead.has(p.id)) for (const id in p.ideas) lost[id] = p;
    for (const p of st.people) if (!dead.has(p.id)) for (const id in p.ideas) delete lost[id];
    st.people = st.people.filter((p) => !dead.has(p.id));
    for (const p of st.people) {
      if (dead.has(p.spouse)) p.spouse = null;
      if (dead.has(p.betrothed)) p.betrothed = null;
    }
    for (const id in lost) {
      if (id === 'seed') st.knowersGone = year;
      say(3, 'knowledge-lost', `${IDEA[id].name} died with ${lost[id].name}, the last who knew it.`);
    }
  }

  byId = new Map(st.people.map((p) => [p.id, p]));
  // Learning: children from the adults of their house (or the whole village, with a school);
  // spouses from each other; neighbours now and then.
  const houseMask = new Map();
  const adultsByHouse = new Map();
  let villageMask = 0;
  const adults = [];
  for (const p of st.people) {
    if (year - p.born < P.adultAge) continue;
    adults.push(p);
    houseMask.set(p.hid, (houseMask.get(p.hid) || 0) | p.mask);
    (adultsByHouse.get(p.hid) || adultsByHouse.set(p.hid, []).get(p.hid)).push(p);
    villageMask |= p.mask;
  }
  const schooled = hold || (villageMask & IDEA.school.bit) !== 0;
  for (const p of st.people) {
    const age = year - p.born;
    if (age >= P.learnFrom && age < P.adultAge + 4) {
      const want = (schooled ? villageMask : houseMask.get(p.hid) || 0) & ~p.mask;
      if (want) for (const t of schooled ? adults : adultsByHouse.get(p.hid) || []) if (t.mask & want & ~p.mask) giveAll(p, t.ideas, want & ~p.mask, P.learnChance, rand);
    }
    if (age < P.adultAge) continue;
    const sp = p.spouse !== null ? byId.get(p.spouse) : null;
    if (sp && sp.mask & ~p.mask) giveAll(p, sp.ideas, sp.mask & ~p.mask, P.spouseShare, rand);
    if (p.mask && adults.length > 1) {
      const keys = Object.keys(p.ideas);
      if (rand() < P.neighbourTeach * (p.calling === 'teacher' ? P.teacherBoost : 1) * keys.length) {
        const id = keys[Math.floor(rand() * keys.length)];
        give(adults[Math.floor(rand() * adults.length)], id, p.ideas[id]);
      }
    }
    // New ideas: someone who holds both parents of an idea may put them together.
    for (const idea of DERIVED) {
      if (p.mask & idea.bit || (p.mask & idea.need) !== idea.need) continue;
      if (rand() >= P.invent) continue;
      give(p, idea.id, { root: 'invented', year, by: p.name, lines: [...p.lines] });
      if (firstKnown(idea.id)) {
        const d = { idea: idea.id, year, by: p.name, pid: p.id, lines: [...p.lines], from: idea.from, parents: [p.mother, p.father] };
        st.discovered[idea.id] = d;
        st.discoveries.push(d);
        say(3, 'idea', `${p.name}, of the ${lineNames(st, p.lines)} line${p.lines.length > 1 ? 's' : ''}, put ${IDEA[idea.from[0]].name.toLowerCase()} and ${IDEA[idea.from[1]].name.toLowerCase()} together: ${idea.name.toLowerCase()}.`, { idea: idea.id });
      }
    }
  }

  // Marriages between houses. A betrothal made by the god is kept if both are free and of age.
  const free = st.people.filter((p) => p.spouse === null && year - p.born >= P.marryFrom && year - p.born <= P.marryTo);
  let weddings = 0;
  for (const a of free) {
    if (a.spouse !== null) continue;
    let b = a.betrothed !== null ? byId.get(a.betrothed) : null;
    if (b && dead.has(b.id)) b = null;
    const promised = !!b;
    if (b && !canMarry(a, b, year, B)) continue; // waiting for the betrothed to come of age
    if (!b) {
      if (rand() >= P.marryChance) continue;
      const options = free.filter((c) => c.betrothed === null && canMarry(a, c, year, B));
      if (!options.length) continue;
      b = options[Math.floor(rand() * options.length)];
    }
    a.spouse = b.id;
    b.spouse = a.id;
    a.betrothed = b.betrothed = null;
    weddings++;
    // A new house if there is room; otherwise one moves in with the other's family.
    const h = found(a, b);
    if (h) a.hid = b.hid = h.id;
    else if ((adultsByHouse.get(a.hid) || []).length <= (adultsByHouse.get(b.hid) || []).length) b.hid = a.hid;
    else a.hid = b.hid;
    const mixes = a.lines.some((l) => !b.lines.includes(l)) || b.lines.some((l) => !a.lines.includes(l));
    const could = possibleIdeas(a, b);
    if (promised || (could.length && mixes))
      say(promised ? 2 : 1, 'wedding', `${a.name} (${lineNames(st, a.lines)}) married ${b.name} (${lineNames(st, b.lines)})${could.length ? `. Between them they hold what ${could.map((i) => i.name.toLowerCase()).join(' and ')} could grow from` : ''}.`, { promised });
  }
  if (weddings) st.stats.weddings += weddings;

  // Births.
  const sizes = new Map();
  const kids = new Map();
  for (const p of st.people) {
    sizes.set(p.hid, (sizes.get(p.hid) || 0) + 1);
    if (p.mother !== null && year - p.born < P.adultAge) kids.set(p.mother, (kids.get(p.mother) || 0) + 1);
  }
  const fed = shortage > 0.001 ? 0.25 : 1;
  for (const m of [...st.people]) {
    if (m.sex !== 'f' || m.spouse === null) continue;
    const age = year - m.born;
    if (age < P.adultAge || age > P.birthTo) continue;
    if (rand() >= P.birthChance * fed) continue;
    if ((kids.get(m.id) || 0) >= P.maxChildren || (sizes.get(m.hid) || 0) >= P.crowded) continue;
    const f = byId.get(m.spouse);
    if (!f || f.hid !== m.hid) continue;
    const lines = [...new Set([...m.lines, ...f.lines])];
    addPerson(st, m.hid, year, rand() < 0.5 ? 'f' : 'm', lines, m.id, f.id);
    sizes.set(m.hid, (sizes.get(m.hid) || 0) + 1);
    st.stats.births++;
  }
}

// In the Hold everyone is taught everything the settlement knows.
export function teachEveryone(st, year, B) {
  let all = 0;
  for (const p of st.people) all |= p.mask;
  const src = {};
  let seen = 0;
  for (const p of st.people) if (p.mask & ~seen) {
    for (const id in p.ideas) if (!src[id]) src[id] = p.ideas[id];
    seen |= p.mask;
  }
  for (const p of st.people) if (p.mask !== all && year - p.born >= B.people.learnFrom) giveAll(p, src, all & ~p.mask, 1, null);
}
