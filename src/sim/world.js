// Fixed geography of the one valley. Shared by the simulation (site lists) and the view (shapes).
// Units are world pixels; x runs from the river (left) up to the split cliff (right).
export const WORLD = {
  width: 1600,
  walkMin: 262,
  farWalkMin: 8, // with a bridge standing
  bridge: { x0: 92, x1: 266, deck: 16 },
  walkMax: 1462,
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
  if (x < 96) return 14; // the far bank
  if (x < 130) return 14 - 30 * smooth(96, 130, x);
  if (x < 262) return -16 + 30 * smooth(196, 262, x);
  if (x < 770) return 14 + Math.round(Math.sin(x / 47) * 1);
  if (x < 950) return 14 + 70 * smooth(770, 950, x);
  if (x < 1470) return 84 + Math.round(Math.sin(x / 61) * 2);
  if (x < 1500) return 84 + 110 * smooth(1470, 1500, x);
  if (x >= 1524 && x < 1540) return 118 + Math.abs(x - 1532) * 2; // the split
  return 194 + Math.round(Math.sin(x / 9) * 2);
}

// Left edge of standing water: the far bank, until the water tops it.
export function waterLeft(height) {
  for (let x = 130; x >= 0; x--) if (groundHeight(x) > height) return x + 1;
  return 0;
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

export const HOUSE_SLOTS = [];
for (let i = 0; i < 12; i++) HOUSE_SLOTS.push({ id: i, elev: 'low', x: 322 + i * 36 + (i > 4 ? 36 : 0) });
for (let i = 0; i < 12; i++) HOUSE_SLOTS.push({ id: 12 + i, elev: 'ridge', x: 1034 + i * 36 });

export const NAMES = [
  'Ama', 'Tobi', 'Ilse', 'Renn', 'Odo', 'Mera', 'Kesh', 'Juna', 'Bram', 'Sela', 'Dov', 'Yara',
  'Hale', 'Nico', 'Wren', 'Pell', 'Asha', 'Corin', 'Edda', 'Faro', 'Gwyn', 'Ivo', 'Lark', 'Moss',
];
export const householdName = (id) => NAMES[id % NAMES.length] + (id >= NAMES.length ? ' ' + (1 + Math.floor(id / NAMES.length)) : '');
