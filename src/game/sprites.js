// Original procedural pixel art. Every sprite is drawn to a small canvas at 1 world pixel per
// texel. Visual randomness uses its own generator and never touches the simulation's.
import { makeRng } from '../sim/rng.js';
import { WORLD, groundHeight } from '../sim/world.js';

export const PAL = {
  skyTop: '#33456b', skyMid: '#7d8fae', skyLow: '#e4c9a0',
  far: '#7c88a6', farDark: '#69769a', mid: '#566f6c', midDark: '#48605f', near: '#3f5a4a',
  grass: '#5d8a3e', grassLight: '#7aa64c', grassDark: '#446d33',
  dirt: '#73502f', dirtDark: '#553a24', dirtDeep: '#3b2a1e',
  rock: '#8d8779', rockLight: '#a9a394', rockDark: '#66615a',
  water: '#3f7391', waterLight: '#a4cbd8', waterDeep: '#2c556f',
  wall: '#c0a070', wallDark: '#96784f', thatch: '#9a7a3c', thatchDark: '#735a2a', wood: '#5a4028',
  gold: '#e2b84a', goldDark: '#b88a2c', sprout: '#8fd05a', silt: '#8b8676', siltDark: '#6c685c',
  skin: '#e0b088', hair: '#3a2a22', boots: '#2e231c',
};
export const SHIRTS = ['#c8553d', '#3f7fbf', '#d9a441', '#6a9f5b', '#9a62b0', '#d17f9f', '#4fa3a3', '#b0703a'];

const canvases = {};
function make(name, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  canvases[name] = c;
  return c;
}
const R = (g, c, x, y, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
function fromMap(name, rows, colors) {
  return make(name, rows[0].length, rows.length, (g) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => colors[ch] && R(g, colors[ch], x, y)));
  });
}

const VILLAGER = {
  idle: ['..hhhh..', '.hhsss..', '..ssss..', '.cccccc.', '.cccccc.', '.sccccs.', '..cccc..', '..tttt..', '..t..t..', '..t..t..', '..b..b..'],
  walk1: ['..hhhh..', '.hhsss..', '..ssss..', '.cccccc.', '.cccccc.', 's.cccc.s', '..cccc..', '..tttt..', '.tt..t..', '.t....t.', '.b....b.'],
  walk2: ['..hhhh..', '.hhsss..', '..ssss..', '.cccccc.', '.cccccc.', '.sccccs.', '..cccc..', '..tttt..', '...tt...', '...tt...', '...bb...'],
};

function house(g, state, rnd) {
  // 26 x 22, ground at the bottom row.
  if (state === 'rubble') {
    for (let i = 0; i < 22; i++) {
      const x = 2 + Math.floor(rnd() * 22);
      const h = 1 + Math.floor(rnd() * 3);
      R(g, rnd() < 0.5 ? PAL.wallDark : PAL.rockDark, x, 22 - h, 2, h);
    }
    R(g, PAL.grassDark, 3, 21, 4, 1);
    R(g, PAL.grassDark, 15, 21, 6, 1);
    return;
  }
  const ruin = state === 'ruin';
  const wall = state === 'home' ? PAL.wall : PAL.wallDark;
  R(g, wall, 3, 11, 20, 11);
  for (let y = 12; y < 22; y += 3) R(g, PAL.wallDark, 3, y, 20, 1);
  R(g, PAL.wood, 3, 11, 1, 11);
  R(g, PAL.wood, 22, 11, 1, 11);
  R(g, state === 'home' ? PAL.wood : '#1c1512', 10, 14, 5, 8); // door
  R(g, state === 'home' ? '#f3d27a' : '#1c1512', 17, 14, 3, 3); // window
  for (let y = 0; y < 11; y++) {
    const half = 3 + y;
    const x0 = Math.max(0, 13 - half);
    const w = Math.min(26, half * 2);
    R(g, y % 2 ? PAL.thatch : PAL.thatchDark, x0, y, w, 1);
  }
  R(g, PAL.thatchDark, 0, 10, 26, 1);
  if (state === 'empty') {
    R(g, PAL.thatchDark, 6, 4, 3, 2);
    R(g, PAL.grassDark, 4, 21, 5, 1);
  }
  if (ruin) {
    g.clearRect(11, 0, 15, 8); // roof fallen in on one side
    g.clearRect(14, 8, 12, 5);
    g.clearRect(19, 11, 7, 6);
    R(g, PAL.wood, 12, 6, 1, 6);
    R(g, PAL.wood, 16, 9, 1, 3);
    R(g, PAL.thatchDark, 15, 19, 9, 3);
    R(g, PAL.grassDark, 2, 20, 4, 2);
    R(g, PAL.grass, 8, 13, 2, 2);
    R(g, PAL.grassDark, 20, 17, 3, 2);
  }
}

function plot(g, state, rnd, low) {
  // 46 x 12; the bottom 4 rows sit in the soil.
  const W = 46;
  const soil = low ? '#6b4526' : '#7a5a38';
  const soilDark = low ? '#523319' : '#5f4429';
  const post = () => {
    R(g, PAL.wood, 0, 4, 1, 6);
    R(g, PAL.wood, W - 1, 4, 1, 6);
  };
  if (state === 'wild' || state === 'overgrown') {
    for (let x = 1; x < W - 1; x++) {
      const h = state === 'wild' ? (rnd() < 0.25 ? 2 : 1) : 2 + Math.floor(rnd() * 5);
      R(g, rnd() < 0.5 ? PAL.grass : PAL.grassDark, x, 9 - h, 1, h + 3);
      if (state === 'overgrown' && rnd() < 0.12) R(g, '#c9d86a', x, 9 - h, 1, 1);
    }
    if (state === 'wild') {
      R(g, PAL.rockLight, 2, 7, 1, 2); // survey stake: a site that could be cleared
      R(g, '#e8e2d0', 2, 6, 2, 1);
      R(g, PAL.rockLight, W - 3, 7, 1, 2);
      R(g, '#e8e2d0', W - 4, 6, 2, 1);
    } else post();
    return;
  }
  if (state === 'eroded') {
    R(g, PAL.waterDeep, 0, 8, W, 4);
    for (let x = 0; x < W; x += 3) R(g, rnd() < 0.5 ? PAL.water : PAL.waterLight, x, 8, 2, 1);
    for (let i = 0; i < 6; i++) R(g, PAL.grassDark, 3 + Math.floor(rnd() * 40), 4 + Math.floor(rnd() * 3), 1, 5);
    return;
  }
  R(g, soil, 0, 8, W, 4);
  for (let x = 1; x < W; x += 3) R(g, soilDark, x, 8, 1, 4);
  post();
  if (state === 'sprout') for (let x = 2; x < W - 2; x += 3) R(g, PAL.sprout, x + 1, 6, 1, 2), R(g, '#6cae44', x, 6, 1, 1);
  if (state === 'ripe')
    for (let x = 2; x < W - 2; x += 3) {
      R(g, PAL.goldDark, x + 1, 3, 1, 5);
      R(g, PAL.gold, x, 1 + (x % 2), 2, 3);
      R(g, '#f4dc86', x, 1 + (x % 2), 1, 1);
    }
  if (state === 'fallow') for (let x = 3; x < W - 2; x += 6) R(g, '#b79a5a', x, 7, 2, 1);
  if (state === 'damaged') {
    R(g, PAL.silt, 0, 7, W, 5);
    for (let i = 0; i < 9; i++) R(g, PAL.siltDark, Math.floor(rnd() * 42), 8 + Math.floor(rnd() * 3), 3, 1);
    R(g, PAL.water, 8, 8, 7, 1);
    R(g, PAL.waterLight, 9, 8, 3, 1);
    R(g, PAL.water, 28, 9, 9, 1);
    R(g, PAL.wood, 18, 5, 7, 1); // driftwood
    R(g, PAL.wood, 20, 4, 1, 3);
    R(g, PAL.goldDark, 34, 6, 1, 2);
    R(g, PAL.goldDark, 38, 7, 2, 1);
  }
}

function tree(g, rnd, w, h, leaf, leafDark) {
  const cx = w >> 1;
  R(g, PAL.wood, cx - 1, Math.floor(h * 0.55), 2, Math.ceil(h * 0.45));
  const rows = Math.floor(h * 0.7);
  for (let y = 0; y < rows; y++) {
    const t = y / rows;
    const half = Math.max(1, Math.round(Math.sin(Math.PI * (0.12 + 0.88 * t)) * (w / 2 - 1)));
    for (let x = cx - half; x < cx + half; x++) R(g, rnd() < 0.3 + t * 0.4 ? leafDark : leaf, x, y);
  }
}

function terrain(g, W, H, baseY) {
  // H rows; world y maps to row (H - 1) - (y - baseY).
  const rnd = makeRng(77);
  const row = (y) => H - 1 - (y - baseY);
  for (let px = 0; px < W; px++) {
    const x = px + WORLD.x0;
    const top = Math.round(groundHeight(x));
    const rocky = x >= 1466 + WORLD.east;
    const bed = x >= 100 && x < 262;
    const woods = x < 0 || (x >= 1474 && x < 1466 + WORLD.east); // forest floor: leaf litter, not turf
    for (let y = baseY; y <= top; y++) {
      const d = top - y;
      let c;
      if (rocky) c = d < 2 ? PAL.rockLight : (x * 7 + y * 3) % 23 < 2 || (x + (y >> 3) * 5) % 17 === 0 ? PAL.rockDark : PAL.rock;
      else if (bed) c = d < 2 ? '#8f8368' : d < 12 ? PAL.dirtDark : PAL.dirtDeep;
      else if (woods && d < 3) c = d === 0 ? ((x * 5) % 7 < 2 ? '#7a6a3a' : '#4f6a34') : (x + y) % 2 ? '#3f5a30' : '#5a4a2c';
      else if (d === 0) c = PAL.grassLight;
      else if (d < 3) c = PAL.grass;
      else if (d < 5) c = (x + y) % 3 ? PAL.grassDark : PAL.dirt;
      else if (d < 26) c = (x * 13 + y * 7) % 29 === 0 ? PAL.dirtDark : PAL.dirt;
      else if (d < 60) c = (x * 11 + y * 5) % 31 === 0 ? PAL.dirtDeep : PAL.dirtDark;
      else c = PAL.dirtDeep;
      R(g, c, px, row(y));
    }
    if (rocky && rnd() < 0.2 && top > 150) R(g, PAL.grassDark, px, row(top) - 1, 1, 1);
    if (x > 770 && x < 950 && x % 9 === 0) R(g, PAL.rock, px, row(top - 2), 2, 1); // scree on the slope
  }
}

function skyline(g, W, H, rnd, color, dark, peaks, amp, base, split) {
  for (let x = 0; x < W; x++) {
    let y = base;
    for (const [f, a, ph] of peaks) y += Math.sin(x * f + ph) * a * amp;
    y = Math.round(H - y);
    if (split && Math.abs(x - split) < 46) y -= Math.round((46 - Math.abs(x - split)) * 1.5) - (Math.abs(x - split - 3) < 5 ? 34 : 0);
    R(g, color, x, y, 1, H - y);
    R(g, dark, x, y + 6 + ((x * 7) % 5), 1, 2);
    if ((x * 13) % 37 < 3) R(g, dark, x, y + 14, 1, 10);
  }
}

const STONE = ['#9a9486', '#b3ad9d', '#77726a', '#5d5953'];
// Multi-storey stone block with windows; used for the town hall, the city and the Hold.
function block(g, rnd, x, y, w, h, ruin, garden) {
  R(g, STONE[0], x, y, w, h);
  R(g, STONE[1], x, y, w, 1);
  R(g, STONE[2], x, y + h - 1, w, 1);
  R(g, STONE[2], x + w - 1, y, 1, h);
  for (let yy = y + 3; yy < y + h - 1; yy += 7) for (let xx = x + ((yy * 3) % 5); xx < x + w - 2; xx += 9) R(g, STONE[2], xx, yy, 3, 1);
  for (let yy = y + 4; yy + 4 < y + h; yy += 8)
    for (let xx = x + 4; xx + 3 < x + w - 2; xx += 7) {
      const lit = !ruin && rnd() < 0.7;
      R(g, lit ? '#f3d27a' : '#22212a', xx, yy, 2, 3);
    }
  if (garden)
    for (let xx = x + 1; xx < x + w - 1; xx++) {
      const r = rnd();
      if (r < (ruin ? 0.8 : 0.45)) R(g, r < 0.2 ? PAL.grassLight : PAL.grassDark, xx, y - 1 - (r < 0.1 || (ruin && r < 0.3) ? 1 : 0), 1, 2 + (ruin && r < 0.25 ? 3 : 0));
    }
  if (ruin) {
    for (let i = 0; i < w / 14; i++) {
      const cx = x + Math.floor(rnd() * w);
      const cw = 3 + Math.floor(rnd() * 8);
      g.clearRect(cx, y - 3, cw, 4 + Math.floor(rnd() * Math.min(h, 12)));
      R(g, PAL.grassDark, cx + Math.floor(rnd() * 20) - 10, y + 2 + Math.floor(rnd() * (h - 3)), 1, 4 + Math.floor(rnd() * 6)); // creeper
    }
  }
}
function cityRow(g, W, H, rnd, ruin) {
  let x = 4;
  while (x < W - 20) {
    const w = 22 + Math.floor(rnd() * 22);
    const h = 26 + Math.floor(rnd() * (H - 34));
    block(g, rnd, x, H - h, Math.min(w, W - x - 2), h, ruin, rnd() < 0.5);
    if (!ruin && rnd() < 0.4) R(g, PAL.thatchDark, x + 2, H - h - 3, Math.min(w, W - x - 2) - 4, 3);
    x += w + (rnd() < 0.3 ? 5 : 1);
  }
}
function hold(g, W, H, rnd, ruin) {
  // Seven terraces stepping back and up; gardens on every ledge; the seed vault at the foot.
  const tiers = 7;
  const th = Math.floor((H - 16) / tiers);
  for (let i = 0; i < tiers; i++) {
    const w = W - 8 - i * 58;
    const x = 4 + i * 22; // steps toward the cliff as it rises
    block(g, rnd, x, H - (i + 1) * th, w, th, ruin, true);
    for (let b = x + 12; b < x + w - 6; b += 34) R(g, STONE[2], b, H - (i + 1) * th, 2, th); // buttresses
  }
  const tx = 4 + (tiers - 1) * 22 + (W - 8 - (tiers - 1) * 58) / 2;
  if (!ruin) {
    R(g, STONE[1], tx - 2, 2, 4, H - tiers * th - 2);
    R(g, '#ffe9a0', tx - 3, 0, 6, 4); // beacon
    R(g, PAL.gold, tx - 2, 1, 4, 2);
  } else R(g, STONE[2], tx - 2, 9, 4, H - tiers * th - 9);
  // Vault door.
  R(g, STONE[3], 150, H - th + 4, 26, th - 4);
  R(g, ruin ? '#22212a' : PAL.goldDark, 153, H - th + 7, 20, th - 7);
  if (!ruin) R(g, PAL.gold, 160, H - th + 11, 6, 6), R(g, '#fff0b0', 161, H - th + 12, 2, 2);
  for (let sx = 40; sx < W - 60; sx += 74) for (let k = 0; k < 4; k++) R(g, STONE[1], sx + k * 2, H - th + k * 2 - 2 + th - 8, 8, 2); // stairs
}

// Sprites painted in klad (art/sprites/*.klad, exported by art/export.sh) replace the ones drawn in
// code below, by name. Anything not yet painted keeps its code-drawn version.
const painted = import.meta.glob('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
// The skies are painted as a few flat bands of colour. On screen they are one smooth gradient
// through the middle of each painted band, so no steps show.
function smoothSky(src) {
  const H = src.height;
  const d = src.getContext('2d').getImageData(0, 0, 1, H).data;
  const stops = [];
  const key = (y) => `rgb(${d[y * 4]},${d[y * 4 + 1]},${d[y * 4 + 2]})`;
  for (let y = 0, from = 0; y <= H; y++) {
    if (y < H && key(y) === key(from)) continue;
    // one-row slivers are the old dither between bands, not a colour of their own
    if (y - from > 2) stops.push([stops.length ? (from + y) / 2 / H : 0, key(from)]);
    from = y;
  }
  if (stops.length < 2) return src;
  stops[stops.length - 1][0] = 1;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  return c;
}

export async function loadSprites() {
  const out = buildSprites();
  await Promise.all(
    Object.entries(painted).map(async ([path, url]) => {
      const name = path.split('/').pop().replace('.png', '');
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0);
      out[name] = /^sky/.test(name) ? smoothSky(c) : c;
    }),
  );
  return out;
}

export function buildSprites() {
  const rnd = makeRng(20240);
  for (let i = 0; i < SHIRTS.length; i++) {
    const colors = { h: i % 3 === 1 ? '#7a5a36' : PAL.hair, s: PAL.skin, c: SHIRTS[i], t: '#4a4458', b: PAL.boots };
    for (const f of Object.keys(VILLAGER)) fromMap(`v${i}_${f}`, VILLAGER[f], colors);
  }
  // The god: a tall robed figure of blue light. This is the player's own form.
  const GOD = {
    idle: ['...wwww...', '..wllllw..', '..wleelw..', '..wllllw..', '...wllw...', '..rrrrrr..', '.rrrrrrrr.', '.rrbrrbrr.', '.rrrrrrrr.', '.rrrrrrrr.', '..rrrrrr..', '..rrrrrr..', '..rrbbrr..', '..rrrrrr..', '.rrrrrrrr.', '.rr.rr.rr.'],
    walk1: ['...wwww...', '..wllllw..', '..wleelw..', '..wllllw..', '...wllw...', '..rrrrrr..', '.rrrrrrrr.', '.rrbrrbrr.', '.rrrrrrrr.', '.rrrrrrrr.', '..rrrrrr..', '..rrrrrr..', '..rrbbrr..', '.rrrrrrr..', 'rrrrrrrr..', 'rr.rr.rr..'],
    walk2: ['...wwww...', '..wllllw..', '..wleelw..', '..wllllw..', '...wllw...', '..rrrrrr..', '.rrrrrrrr.', '.rrbrrbrr.', '.rrrrrrrr.', '.rrrrrrrr.', '..rrrrrr..', '..rrrrrr..', '..rrbbrr..', '..rrrrrrr.', '..rrrrrrrr', '..rr.rr.rr'],
  };
  const godColors = { w: '#e9fbff', l: '#bfeaff', e: '#1b3a66', r: '#4f9de0', b: '#9fd8ff' };
  for (const f of Object.keys(GOD)) fromMap(`god_${f}`, GOD[f], godColors);
  make('beam', 16, 64, (g) => {
    for (let x = 0; x < 16; x++) {
      const a = 1 - Math.abs(x - 7.5) / 8;
      g.fillStyle = `rgba(${150 + Math.round(a * 100)}, ${215 + Math.round(a * 40)}, 255, ${a.toFixed(2)})`;
      g.fillRect(x, 0, 1, 64);
    }
  });
  make('aura', 14, 18, (g) => {
    for (let y = 0; y < 18; y++) for (let x = 0; x < 14; x++) {
      const d = Math.hypot((x - 6.5) / 7, (y - 8.5) / 9);
      if (d < 1 && (x + y) % 2 === 0) R(g, d < 0.6 ? '#bfeaff' : '#6fb8f0', x, y);
    }
  });
  make('spark', 2, 2, (g) => R(g, '#bfeaff', 0, 0, 2, 2));

  for (const s of ['home', 'empty', 'ruin', 'rubble']) make(`house_${s}`, 26, 22, (g) => house(g, s, rnd));
  make('plot_low_forest', 46, 12, () => {});
  make('plot_ridge_forest', 46, 12, () => {});
  // Old-growth trees of the two forests, stumps where they were felled, and the deer that live under them.
  make('oak', 30, 46, (g) => tree(g, rnd, 30, 46, '#3f7038', '#2c5230'));
  make('oak2', 26, 40, (g) => tree(g, rnd, 26, 40, '#4a7a3a', '#335a32'));
  make('fir', 16, 40, (g) => {
    R(g, PAL.wood, 7, 30, 2, 10);
    for (let y = 0; y < 32; y++) {
      const half = 1 + (((y % 8) * 0.8 + y * 0.12) | 0);
      R(g, y % 2 ? '#274a3a' : '#31583f', 8 - half, y, half * 2, 1);
    }
  });
  make('stump', 14, 6, (g) => {
    R(g, '#6a4c2c', 1, 2, 4, 4);
    R(g, '#c9a66a', 1, 2, 4, 1);
    R(g, '#6a4c2c', 9, 3, 3, 3);
    R(g, '#c9a66a', 9, 3, 3, 1);
  });
  for (const f of [0, 1])
    make(`deer${f}`, 13, 11, (g) => {
      R(g, '#9a6a3c', 2, 4, 8, 4);
      R(g, '#b98a54', 3, 6, 6, 2);
      R(g, '#9a6a3c', 9, 2, 3, 3);
      R(g, '#3a2a1c', 11, 3, 1, 1);
      R(g, '#d8c9a8', 10, 0, 1, 2);
      R(g, '#d8c9a8', 12, 0, 1, 2);
      R(g, '#e8dcc0', 1, 4, 1, 2);
      R(g, '#6a4628', f ? 3 : 2, 8, 1, 3);
      R(g, '#6a4628', f ? 8 : 9, 8, 1, 3);
      R(g, '#6a4628', f ? 5 : 4, 8, 1, 3);
    });
  for (const e of ['low', 'ridge'])
    for (const s of ['wild', 'fallow', 'sprout', 'ripe', 'damaged', 'overgrown', 'eroded']) make(`plot_${e}_${s}`, 46, 12, (g) => plot(g, s, rnd, e === 'low'));

  make('granary', 32, 32, (g) => {
    for (const x of [4, 12, 19, 27]) R(g, PAL.wood, x, 22, 2, 10); // stilts
    R(g, PAL.wood, 2, 21, 28, 2);
    R(g, PAL.wall, 4, 10, 24, 11);
    for (let x = 6; x < 28; x += 4) R(g, PAL.wallDark, x, 10, 1, 11);
    R(g, PAL.wood, 13, 13, 6, 8);
    for (let y = 0; y < 10; y++) R(g, y % 2 ? PAL.thatch : PAL.thatchDark, Math.max(0, 14 - y * 1.6) | 0, y, Math.min(32, 4 + y * 3.2) | 0, 1);
    R(g, PAL.wood, 21, 22, 1, 10); // ladder
    R(g, PAL.wood, 24, 22, 1, 10);
    for (let y = 24; y < 32; y += 2) R(g, PAL.wood, 21, y, 4, 1);
    R(g, PAL.gold, 15, 15, 2, 2);
  });
  make('granary_ruin', 32, 32, (g) => {
    for (const x of [4, 12, 27]) R(g, PAL.wood, x, 24 + (x % 3), 2, 8 - (x % 3));
    R(g, PAL.wood, 6, 27, 20, 2);
    R(g, PAL.thatchDark, 10, 29, 16, 3);
    R(g, PAL.wallDark, 14, 25, 8, 3);
    for (const x of [3, 9, 20, 24, 29]) R(g, PAL.grassDark, x, 26, 1, 6);
  });
  make('store_ruin', 24, 18, (g) => {
    R(g, PAL.rock, 2, 11, 9, 7);
    R(g, PAL.rock, 15, 13, 7, 5);
    R(g, PAL.rockDark, 4, 13, 1, 2);
    R(g, PAL.rockDark, 11, 16, 5, 2);
    for (const x of [1, 8, 13, 22]) R(g, PAL.grassDark, x, 10 + (x % 4), 1, 8 - (x % 4));
  });
  make('store_site', 24, 18, (g) => {
    for (const x of [2, 8, 15, 21]) R(g, PAL.rockLight, x, 15, 2, 3);
    R(g, PAL.rock, 4, 17, 4, 1);
    R(g, PAL.rock, 11, 17, 4, 1);
    R(g, PAL.wood, 11, 5, 1, 12);
    R(g, '#e8e2d0', 12, 5, 5, 3);
    R(g, PAL.gold, 13, 6, 2, 1);
  });
  make('store', 24, 18, (g) => {
    R(g, PAL.rock, 2, 7, 20, 11);
    for (let y = 8; y < 18; y += 3) for (let x = 2 + (y % 2) * 2; x < 22; x += 5) R(g, PAL.rockDark, x, y, 1, 2);
    R(g, PAL.rockLight, 2, 7, 20, 1);
    R(g, PAL.wood, 9, 10, 6, 8);
    R(g, PAL.gold, 11, 12, 2, 2);
    for (let y = 0; y < 7; y++) R(g, y % 2 ? PAL.thatch : PAL.thatchDark, Math.max(0, 9 - y * 1.5) | 0, y, Math.min(24, 6 + y * 3) | 0, 1);
  });
  for (const ruin of [false, true]) {
    const k = ruin ? '_ruin' : '';
    make('hall' + k, 44, 30, (g) => {
      block(g, rnd, 2, 12, 40, 18, ruin, false);
      if (!ruin) for (let y = 0; y < 12; y++) R(g, y % 2 ? PAL.thatch : PAL.thatchDark, Math.max(0, 20 - y * 2), y, Math.min(44, 4 + y * 4), 1);
      else for (let y = 5; y < 12; y++) R(g, PAL.thatchDark, Math.max(0, 20 - y * 2), y, 14, 1);
      R(g, PAL.wood, 18, 20, 8, 10);
    });
    make('tower' + k, 16, 52, (g) => {
      block(g, rnd, 3, ruin ? 22 : 8, 10, ruin ? 30 : 44, ruin, false);
      if (!ruin) R(g, PAL.thatchDark, 1, 5, 14, 3), R(g, PAL.thatch, 4, 2, 8, 3), R(g, '#ffe9a0', 7, 0, 2, 2);
    });
    make('levee' + k, 64, 12, (g) => {
      for (let x = 0; x < 64; x++) {
        if (ruin && (x * 7) % 13 < 4) continue;
        R(g, STONE[(x >> 2) % 2 ? 0 : 2], x, 3 + ((x >> 3) % 2), 1, 9);
        R(g, STONE[1], x, 3 + ((x >> 3) % 2), 1, 1);
      }
    });
    make('city' + k, 400, 84, (g, W, H) => cityRow(g, W, H, rnd, ruin));
    make('hold' + k, 440, 156, (g, W, H) => hold(g, W, H, rnd, ruin));
  }
  make('tree', 18, 30, (g) => tree(g, rnd, 18, 30, '#4f8040', '#38613a'));
  make('tree2', 14, 24, (g) => tree(g, rnd, 14, 24, '#5d8c46', '#426b3a'));
  make('sapling', 8, 12, (g) => tree(g, rnd, 8, 12, '#6da04e', '#4c7c3e'));
  make('pine', 12, 26, (g) => {
    R(g, PAL.wood, 5, 20, 2, 6);
    for (let y = 0; y < 21; y++) {
      const half = 1 + ((y % 7) * 0.7 + y * 0.12) | 0;
      R(g, y % 2 ? '#2f5440' : '#3a664a', 6 - half, y, half * 2, 1);
    }
  });
  make('reeds', 10, 10, (g) => {
    for (let x = 0; x < 10; x += 2) {
      const h = 4 + Math.floor(rnd() * 6);
      R(g, PAL.grassDark, x, 10 - h, 1, h);
      if (rnd() < 0.5) R(g, '#8a6a3a', x, 10 - h, 1, 2);
    }
  });
  make('marker', 7, 6, (g) => {
    R(g, '#bfeaff', 0, 0, 7, 2);
    R(g, '#bfeaff', 1, 2, 5, 2);
    R(g, '#bfeaff', 3, 4, 1, 2);
    R(g, '#bfeaff', 2, 4, 3, 1);
  });
  make('marker_dim', 5, 3, (g) => {
    R(g, '#b9b39c', 0, 0, 5, 1);
    R(g, '#b9b39c', 1, 1, 3, 1);
    R(g, '#b9b39c', 2, 2, 1, 1);
  });
  make('seed', 5, 5, (g) => {
    R(g, PAL.goldDark, 1, 0, 3, 5);
    R(g, PAL.goldDark, 0, 1, 5, 3);
    R(g, PAL.gold, 1, 1, 3, 3);
    R(g, '#fff0b0', 1, 1, 1, 1);
  });
  make('sack', 6, 6, (g) => {
    R(g, '#b79a6a', 1, 1, 4, 5);
    R(g, '#8f7448', 0, 2, 6, 3);
    R(g, '#b79a6a', 1, 2, 4, 3);
    R(g, PAL.wood, 2, 0, 2, 1);
  });
  // The volcano that stands behind the valley. `hot` shows lava after an eruption.
  for (const hot of [false, true])
    make(hot ? 'volcano_hot' : 'volcano', 320, 190, (g, W, H) => {
      const vr = makeRng(5150);
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - 160);
        let top = d < 17 ? 12 + (17 - d) * 0.5 + (x % 3) : 14 + Math.pow((d - 17) / 143, 0.72) * (H - 14); // crater, then concave flanks
        top = Math.round(top + Math.sin(x * 0.21) * 1.5);
        R(g, '#6a6690', x, top, 1, H - top);
        if (x > 160) R(g, '#5a567f', x, top + 2, 1, H - top - 2); // shaded side
        if (top < 62) R(g, d < 17 && hot ? '#ffb347' : '#cfd3e2', x, top, 1, Math.max(1, Math.min(6, 62 - top) - (x % 4)));
        if ((x * 7) % 19 < 2) R(g, '#4d4a70', x, top + 10 + (x % 9), 1, 26);
        void vr;
      }
      if (hot) {
        for (const [dx, len] of [[-9, 80], [4, 120], [14, 60]]) {
          let x = 160 + dx;
          for (let y = 18; y < 18 + len; y++) {
            x += vr() < 0.5 ? (dx < 0 ? -1 : 1) * (vr() < 0.6 ? 1 : 0) : 0;
            R(g, y % 5 ? '#ff7a2a' : '#ffd070', Math.round(x), y, 2, 1);
          }
        }
        R(g, '#fff0a0', 150, 12, 20, 3);
      }
    });
  // Bridges across the river: 174 wide, deck on row 10.
  make('bridge_rope', 174, 24, (g, W) => {
    for (let x = 0; x < W; x++) {
      const sag = Math.round(Math.sin((x / W) * Math.PI) * 6);
      R(g, x % 4 === 3 ? '#4a3420' : '#8a6a44', x, 10 + sag, 1, 1);
      R(g, '#3a2a1c', x, 4 + Math.round(sag * 0.6), 1, 1);
      if (x % 9 === 0) R(g, '#3a2a1c', x, 4 + Math.round(sag * 0.6), 1, 6 + Math.round(sag * 0.4));
    }
    R(g, PAL.wood, 0, 0, 2, 12);
    R(g, PAL.wood, W - 2, 0, 2, 12);
  });
  make('bridge_timber', 174, 44, (g, W, H) => {
    R(g, '#7a5a38', 0, 10, W, 2);
    R(g, '#5a4028', 0, 12, W, 1);
    R(g, '#5a4028', 0, 5, W, 1);
    for (let x = 6; x < W; x += 12) R(g, '#5a4028', x, 5, 1, 5);
    for (let x = 22; x < W - 10; x += 26) {
      R(g, '#4a3420', x, 12, 2, H - 12);
      R(g, '#4a3420', x + 8, 12, 2, H - 12);
      for (let k = 0; k < 8; k++) R(g, '#5a4028', x + 1 + k, 16 + k, 1, 1);
    }
  });
  make('bridge_stone', 174, 46, (g, W, H) => {
    R(g, STONE[0], 0, 6, W, H - 6);
    R(g, STONE[1], 0, 6, W, 1);
    for (let x = 0; x < W; x += 6) R(g, STONE[2], x, 3, 3, 3);
    for (let y = 9; y < 20; y += 4) for (let x = (y % 8) * 2; x < W; x += 11) R(g, STONE[2], x, y, 4, 1);
    for (const cx of [32, 87, 142]) for (let y = 14; y < H; y++) {
      const half = Math.min(22, Math.round(Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, 30 - y) / 16, 2))) * 22));
      g.clearRect(cx - half, y, half * 2, 1);
    }
  });
  make('bridge_works', 174, 44, (g, W, H) => {
    for (const x of [8, 34, 60]) {
      R(g, '#6a4c2c', x, 6, 2, H - 6);
      R(g, '#6a4c2c', x + 10, 6, 2, H - 6);
      R(g, '#8a6a44', x - 2, 12, 16, 1);
      R(g, '#8a6a44', x - 2, 24, 16, 1);
    }
    R(g, '#7a5a38', 0, 10, 46, 2);
    R(g, PAL.rockLight, 70, 8, 6, 3);
    R(g, PAL.rock, 78, 9, 5, 2);
  });
  make('bridge_gone', 174, 44, (g, W, H) => {
    for (const x of [10, 150]) R(g, '#4a3420', x, 8, 2, H - 8);
    R(g, '#7a5a38', 0, 10, 14, 2);
    R(g, '#7a5a38', W - 16, 10, 16, 2);
    R(g, '#5a4028', 12, 12, 1, 5);
    R(g, '#5a4028', 14, 14, 1, 6);
  });
  make('funnel', 40, 110, (g, W, H) => {
    for (let y = 0; y < H; y++) {
      const t = y / H;
      const w = Math.round(36 * Math.pow(1 - t, 1.6) + 4);
      const cx = 20 + Math.round(Math.sin(y * 0.16) * 3 * (1 - t));
      R(g, y % 3 ? '#5b5f6b' : '#474a55', cx - (w >> 1), y, w, 1);
      if (y % 4 === 0) R(g, '#8a8f9b', cx - (w >> 1) + 1, y, Math.max(1, w >> 2), 1);
    }
  });
  make('slide', 150, 46, (g, W, H) => {
    const sr = makeRng(88);
    for (let x = 0; x < W; x++) {
      const base = Math.round(H - 4 - (x / W) * (H - 14));
      const th = 3 + Math.round(Math.sin((x / W) * Math.PI) * 9);
      for (let y = base - th; y < base + 3; y++) R(g, sr() < 0.25 ? PAL.rockDark : sr() < 0.5 ? PAL.dirtDark : PAL.dirt, x, y);
      if (sr() < 0.08) R(g, PAL.rockLight, x, base - th - 1, 2, 2);
    }
  });
  make('ember', 2, 2, (g) => R(g, '#ff9a3a', 0, 0, 2, 2));
  make('ashflake', 2, 2, (g) => R(g, '#6f6b6b', 0, 0, 2, 2));
  make('white', 2, 2, (g) => R(g, '#ffffff', 0, 0, 2, 2));
  make('smoke', 3, 3, (g) => {
    R(g, '#d8d2c6', 1, 0, 1, 3);
    R(g, '#d8d2c6', 0, 1, 3, 1);
  });
  make('rain', 1, 4, (g) => R(g, '#b7d4e2', 0, 0, 1, 4));
  make('floodline', 64, 1, (g) => {
    for (let x = 0; x < 64; x += 8) R(g, '#f1e3b0', x, 0, 4, 1);
  });
  make('cloud', 46, 12, (g) => {
    R(g, '#f1e6d2', 8, 6, 32, 5);
    R(g, '#f1e6d2', 14, 2, 14, 4);
    R(g, '#f1e6d2', 26, 4, 10, 3);
    R(g, '#f1e6d2', 2, 8, 42, 3);
    R(g, '#d7cbb9', 6, 10, 34, 1);
  });
  for (let f = 0; f < 2; f++)
    make(`water${f}`, 64, 64, (g) => {
      g.fillStyle = PAL.water;
      g.fillRect(0, 0, 64, 64);
      R(g, PAL.waterLight, 0, 0, 64, 1);
      for (let x = f * 5; x < 64; x += 11) R(g, PAL.waterLight, x, 1, 5, 1);
      for (let y = 5; y < 64; y += 6) for (let x = (y * 7 + f * 9) % 23; x < 64; x += 23) R(g, y < 20 ? '#5b8ea8' : PAL.waterDeep, x, y, 7, 1);
    });

  // Backdrop layers.
  make('sky', 4, 128, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, PAL.skyTop);
    grad.addColorStop(0.55, PAL.skyMid);
    grad.addColorStop(1, PAL.skyLow);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 128);
  });
  make('far', 2048, 260, (g, W, H) =>
    skyline(g, W, H, rnd, PAL.far, PAL.farDark, [[0.004, 1, 0.3], [0.011, 0.5, 1.7], [0.031, 0.18, 0.4], [0.09, 0.05, 2]], 46, 120, 1420));
  make('mid', 2048, 150, (g, W, H) => {
    skyline(g, W, H, rnd, PAL.mid, PAL.midDark, [[0.006, 1, 2.1], [0.017, 0.45, 0.2], [0.05, 0.12, 1.1]], 26, 66, 0);
    // The river bend: it comes out of the hills, swings wide, and turns into the foreground.
    for (let y = 58; y < H; y++) {
      const t = (y - 58) / (H - 58);
      const cx = 520 - Math.sin(t * Math.PI * 1.15) * 250 - t * 150;
      const w = 3 + t * t * 120;
      R(g, PAL.waterDeep, Math.round(cx - w / 2) - 1, y, Math.round(w) + 2, 1);
      R(g, y % 3 ? '#5e8fa8' : '#7fb0c2', Math.round(cx - w / 2), y, Math.round(w), 1);
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * W);
      const y = 70 + Math.floor(rnd() * 60);
      R(g, PAL.near, x, y, 3, 4);
      R(g, PAL.midDark, x + 1, y - 2, 1, 2);
    }
  });
  make('terrain', WORLD.x1 - WORLD.x0, 320, (g, W, H) => terrain(g, W, H, -100));
  return canvases;
}
