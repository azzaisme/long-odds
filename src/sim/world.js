// Fixed geography of the one valley. Shared by the simulation (site lists) and the view (shapes).
// Units are world pixels; x runs from the river (left) up to the split cliff (right).
export const WORLD = {
  width: 1600, // the settled valley; the forests lie beyond it on both sides
  x0: -480, // west edge: the far side of the west forest
  x1: 2000, // east edge: past the split cliff
  east: 400, // length of the forested ridge between the fields and the cliff
  walkMin: 262,
  farWalkMin: -462, // with a bridge standing: the far bank and the west forest
  bridge: { x0: 92, x1: 266, deck: 16 },
  walkMax: 1862,
  granaryX: 502,
  ridgeStoreX: 1004,
  waterLevels: [8, 19, 31, 56], // water surface height for flood level 0..3
  lowGround: 14,
  ridgeGround: 84,
};

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function groundHeight(x) {
  if (x < 0) return 14 + 44 * smooth(-360, -480, x) + (x > -360 ? Math.round(Math.sin(x / 53) * 1) : 0); // west forest floor, rising at the edge
  if (x < 96) return 14; // the far bank
  if (x < 130) return 14 - 30 * smooth(96, 130, x);
  if (x < 262) return -16 + 30 * smooth(196, 262, x);
  if (x < 770) return 14 + Math.round(Math.sin(x / 47) * 1);
  if (x < 950) return 14 + 70 * smooth(770, 950, x);
  if (x < 1470 + WORLD.east) return 84 + Math.round(Math.sin(x / 61) * 2); // ridge, then the east forest
  const c = x - WORLD.east; // the split cliff
  if (c < 1500) return 84 + 110 * smooth(1470, 1500, c);
  if (c >= 1524 && c < 1540) return 118 + Math.abs(c - 1532) * 2; // the split
  return 194 + Math.round(Math.sin(c / 9) * 2);
}

// Left edge of standing water: the far bank, until the water tops it.
export function waterLeft(height) {
  for (let x = 130; x >= WORLD.x0; x--) if (groundHeight(x) > height) return x + 1;
  return WORLD.x0;
}

// Right edge of standing water for a given surface height.
export function waterEdge(height) {
  for (let x = 200; x < 960; x++) if (groundHeight(x) > height) return x;
  return 960;
}

export const PLOT_SITES = [];
for (let i = 0; i < 9; i++) PLOT_SITES.push({ id: i, elev: 'low', x: 296 + i * 52 });
for (let i = 0; i < 7; i++) PLOT_SITES.push({ id: 9 + i, elev: 'ridge', x: 1052 + i * 60 });

// Two fields on the far bank: floodplain soil that can only be reached over a bridge.
PLOT_SITES.push({ id: 16, elev: 'low', far: true, x: 28 }, { id: 17, elev: 'low', far: true, x: 74 });

// Forest stands: ten west of the far bank, nine on the ridge before the cliff. Each stand stands on
// ground that could be a field: a plot whose state is 'forest' until someone clears it.
export const FOREST_STANDS = [];
for (let i = 0; i < 10; i++) FOREST_STANDS.push({ id: i, side: 'west', x: -44 - i * 42 });
for (let i = 0; i < 9; i++) FOREST_STANDS.push({ id: 10 + i, side: 'east', x: 1502 + i * 42 });
for (const f of FOREST_STANDS) PLOT_SITES.push({ id: 18 + f.id, elev: f.side === 'west' ? 'low' : 'ridge', far: f.side === 'west', stand: f.id, x: f.x });

export const HOUSE_SLOTS = [];
for (let i = 0; i < 12; i++) HOUSE_SLOTS.push({ id: i, elev: 'low', x: 322 + i * 36 + (i > 4 ? 36 : 0) });
for (let i = 0; i < 12; i++) HOUSE_SLOTS.push({ id: 12 + i, elev: 'ridge', x: 1034 + i * 36 });

export const NAMES = [
  'Ama', 'Tobi', 'Ilse', 'Renn', 'Odo', 'Mera', 'Kesh', 'Juna', 'Bram', 'Sela', 'Dov', 'Yara',
  'Hale', 'Nico', 'Wren', 'Pell', 'Asha', 'Corin', 'Edda', 'Faro', 'Gwyn', 'Ivo', 'Lark', 'Moss',
];
export const householdName = (id) => NAMES[id % NAMES.length] + (id >= NAMES.length ? ' ' + (1 + Math.floor(id / NAMES.length)) : '');
