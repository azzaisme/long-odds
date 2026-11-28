// PlayCanvas world view. Reads simulation state; never writes it.
import * as pc from 'playcanvas';
import { SHIRTS } from './sprites.js';
import { WORLD, PLOT_SITES, HOUSE_SLOTS, FOREST_STANDS, groundHeight, waterEdge, waterLeft } from '../sim/world.js';
import { yearOf } from '../sim/sim.js';
import { customValue } from '../sim/decisions.js';

const Z = { volcano: -52, civic: -17, sky: -60, far: -50, cloud: -45, mid: -40, tree: -22, terrain: -20, house: -14, store: -12, plot: -8, growth: -7, actor: -4, badge: -3, water: 2, tint: 3.4, light: 3.7, fx: 4 };
const vrand = Math.random; // visual-only randomness

export class View {
  constructor(canvas, canvases) {
    const app = (this.app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false, alpha: false } }));
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    // Draw at the screen's own pixels (up to 2x) so a phone's half-step zoom still lands on whole pixels.
    app.graphicsDevice.maxPixelRatio = Math.min(2, window.devicePixelRatio || 1);
    window.addEventListener('resize', () => app.resizeCanvas());
    app.scene.ambientLight = new pc.Color(1, 1, 1);

    this.mats = {};
    this.sizes = {};
    for (const [name, c] of Object.entries(canvases)) {
      const tex = new pc.Texture(app.graphicsDevice, {
        width: c.width, height: c.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
        minFilter: /^(sky|soft_)/.test(name) ? pc.FILTER_LINEAR : pc.FILTER_NEAREST,
        magFilter: /^(sky|soft_)/.test(name) ? pc.FILTER_LINEAR : pc.FILTER_NEAREST,
        addressU: name.startsWith('water') || name === 'foam' || name === 'fore' || name === 'soft_mist' || name === 'ripple' ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      tex.setSource(c);
      const m = new pc.StandardMaterial();
      m.useLighting = false;
      m.useSkybox = false;
      // Distance haze at dusk falls on the world, not on light, sky or the god.
      m.useFog = !/^(sky|sky_dusk|sun|fore|terrain|glow|beam|aura|white|ember|spark|rain|ashflake|smoke|marker|marker_dim|seed|foam|ripple|moon|soft_.*|god_.*)$/.test(name);
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(1, 1, 1);
      m.emissiveMap = tex;
      m.opacityMap = tex;
      m.opacityMapChannel = 'a';
      m.cull = pc.CULLFACE_NONE;
      if (name === 'beam' || name === 'aura' || name === 'foam' || name === 'glow' || name === 'sky_dusk' || name === 'sun' || name === 'fore' || name.startsWith('water') || name === 'smoke' || name === 'floodline' || name === 'cloud' || name === 'ripple') {
        m.blendType = pc.BLEND_NORMAL;
        m.opacity = name === 'glow' || name === 'sky_dusk' || name === 'sun' || name === 'fore' ? 0 : name === 'beam' ? 0.85 : name === 'aura' ? 0.55 : name.startsWith('water') ? 0.72 : name === 'cloud' ? 0.8 : 0.6;
        m.depthWrite = false;
      } else if (name.startsWith('soft_') || name === 'moon') {
        // Light and air: smooth, see-through, and (for light) added to what is behind it.
        m.blendType = name === 'soft_glow' || name === 'soft_rays' ? pc.BLEND_ADDITIVEALPHA : pc.BLEND_NORMAL;
        m.depthWrite = false;
        m.opacity = 0;
      } else m.alphaTest = 0.5;
      m.update();
      this.mats[name] = m;
      this.sizes[name] = [c.width, c.height];
    }
    this.tintMat = new pc.StandardMaterial();
    Object.assign(this.tintMat, { useLighting: false, useSkybox: false, useFog: false, blendType: pc.BLEND_NORMAL, depthWrite: false, depthTest: true, opacity: 0 });
    this.tintMat.diffuse = new pc.Color(0, 0, 0);
    this.tintMat.emissive = new pc.Color(1, 1, 1);
    this.tintMat.update();

    const cam = (this.camera = new pc.Entity('camera'));
    cam.addComponent('camera', { projection: pc.PROJECTION_ORTHOGRAPHIC, clearColor: new pc.Color(0.2, 0.27, 0.42), nearClip: 1, farClip: 400 });
    cam.camera.gammaCorrection = pc.GAMMA_SRGB;
    cam.camera.toneMapping = pc.TONEMAP_NONE;
    cam.setPosition(400, 60, 100);
    app.root.addChild(cam);

    this.cam = { x: 420, y: 64, zoom: 3, tx: 420, ty: 64, tzoom: 3 };
    this.time = 0;
    this.water = { level: WORLD.waterLevels[0], target: WORLD.waterLevels[0] };
    this.tint = { r: 1, g: 1, b: 1, a: 0, ta: 0 };
    this.weather = 'none';
    this.actors = new Map();
    this.fx = [];
    this.build();
    app.start();
  }

  sprite(name, x, y, z, parent) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type: 'plane', castShadows: false, receiveShadows: false });
    e.setLocalEulerAngles(90, 0, 0);
    (parent || this.app.root).addChild(e);
    e._z = z;
    this.setTex(e, name);
    this.place(e, x, y);
    return e;
  }
  setTex(e, name, flip) {
    if (e._tex === name && e._flip === !!flip) return;
    e._tex = name;
    e._flip = !!flip;
    e.render.meshInstances[0].material = this.mats[name];
    const [w, h] = this.sizes[name];
    e._w = w;
    e._h = h;
    e.setLocalScale(flip ? -w : w, 1, h);
  }
  // Anchor: bottom centre.
  place(e, x, y) {
    e.setLocalPosition(x, y + e._h * Math.abs(e._sy || 1) / 2, e._z);
  }

  build() {
    this.sky = this.sprite('sky', 0, 0, Z.sky);
    // Sunset: a second sky laid over the first, a low sun, haze by distance, and a black foreground.
    this.skyDusk = this.sprite('sky_dusk', 0, 0, Z.sky + 0.5);
    this.sun = this.sprite('sun', 0, 0, -56);
    this.fore = this.sprite('fore', 0, 0, 7);
    this.skyDusk.enabled = this.sun.enabled = this.fore.enabled = false;
    // Light and air. Each piece has its own copy of a soft texture's material so it can be tinted alone.
    const own = (base, key) => ((this.mats[key] = this.mats[base].clone()), (this.sizes[key] = this.sizes[base]), key);
    this.daySun = this.sprite(own('sun', 'sun_day'), 0, 0, -57);
    this.sunGlow = this.sprite(own('soft_glow', 'glow_sun'), 0, 0, -57.5);
    this.moon = this.sprite('moon', 0, 0, -57);
    this.moonGlow = this.sprite(own('soft_glow', 'glow_moon'), 0, 0, -57.5);
    this.rays = this.sprite('soft_rays', 0, 0, -39);
    this.mists = [
      { e: this.sprite(own('soft_mist', 'mist_far'), 0, 0, -47), y: 96, h: 70, par: 0.82, speed: 1.5, a: 0.5, stretch: 1.6 },
      { e: this.sprite(own('soft_mist', 'mist_mid'), 0, 0, -37), y: 50, h: 56, par: 0.6, speed: 3, a: 0.55, stretch: 1.2 },
      { e: this.sprite(own('soft_mist', 'mist_near'), 0, 0, 3), y: 30, h: 40, par: 0, speed: 5, a: 0.5, stretch: 1, river: true },
    ];
    this.sheen = this.sprite(own('soft_fade', 'sheen'), 0, 0, 2.1);
    this.glints = [];
    for (let i = 0; i < 10; i++) {
      const e = this.sprite('white', 0, 0, 2.15);
      e.enabled = false;
      this.glints.push({ e, u: vrand(), v: vrand(), t: vrand() * 3 });
    }
    this.dawn = 0;
    const fog = this.app.scene.fog;
    fog.type = pc.FOG_LINEAR;
    fog.color = new pc.Color(0.72, 0.42, 0.44); // dusty rose: what far things fade into
    // With an orthographic camera the haze works on depth as a share of the camera's range
    // (near 1, far 400), not on distance in pixels: `hz` converts.
    this.hz = (dist) => (dist - 1) / 399;
    fog.start = this.hz(107); // just behind the people, fields and graves, which stay dark
    fog.end = 1e7;
    this.dusk = 0;
    this.duskApplied = -1;
    this.duskT = [1, 1, 1];
    this.hazeMats = Object.entries(this.mats).filter(([n, m]) => (m.useFog || n === 'terrain') && !n.startsWith('water')).map(([, m]) => m);
    this.far = this.sprite('far', 0, 0, Z.far);
    this.mid = this.sprite('mid', 0, 0, Z.mid);
    this.volcano = this.sprite('volcano', 0, 0, Z.volcano);
    this.slideEnt = this.sprite('slide', 868, 16, Z.plot - 1);
    this.slideEnt.enabled = false;
    this.funnel = this.sprite('funnel', 0, 0, Z.fx - 1);
    this.funnel.enabled = false;
    this.twister = null;
    this.shake = 0;
    this.clouds = [0, 1, 2, 3, 4].map((i) => {
      const c = this.sprite('cloud', i * 420 + 100, 150 + (i % 3) * 38, Z.cloud);
      c._x = i * 420 + 100;
      c._y = 150 + (i % 3) * 38;
      return c;
    });
    this.terrain = this.sprite('terrain', (WORLD.x0 + WORLD.x1) / 2, -100, Z.terrain);

    // Standing trees: landmarks that stay put however the settlement changes.
    const trees = [[786, 'pine'], [812, 'tree2'], [846, 'pine'], [880, 'tree'], [905, 'pine'], [928, 'tree2'], [972, 'tree'], [1466 + WORLD.east, 'pine'], [1452 + WORLD.east, 'tree2'], [276, 'reeds'], [268, 'reeds'], [758, 'tree2']];
    for (const [x, t] of trees) this.sprite(t, x, groundHeight(x) - 1, Z.tree);

    // The two forests, in depth. Behind each stand a wall of far canopy; then a far row of trees,
    // pale with distance; then the stand's own trees; then one tree nearer than the people.
    // Every tree has its turn in the stand's timber: as the stand is cut the last ones in go first,
    // and as it grows back each comes up from sapling to young tree to full height.
    const kinds = ['oak', 'fir', 'oak2'];
    const rows = [
      { n: 4, dx: [-17, -6, 5, 16], suffix: '_far', z: Z.tree - 3, size: 0.9 },
      { n: 3, dx: [-13, 0, 13], suffix: '', z: Z.tree + 1, size: 1 },
      { n: 1, dx: [9], suffix: '_near', z: Z.actor + 0.6, size: 1, small: true },
    ];
    this.stands = FOREST_STANDS.map((f) => {
      const canopy = this.sprite(`canopy${f.id % 3}`, f.x, groundHeight(f.x) - 1, Z.tree - 6 - (f.id % 2) * 0.3);
      canopy._x = f.x;
      const trees = [];
      rows.forEach((row, r) => {
        for (let i = 0; i < row.n; i++) {
          const h = (f.id * 13 + r * 7 + i * 5) % 11;
          const x = f.x + (r === 2 && f.id % 2 ? -row.dx[i] : row.dx[i]) + (h % 5) - 2;
          const kind = kinds[(f.id + i + r) % 3];
          const e = this.sprite(kind + row.suffix, x, groundHeight(x) - 1, row.z + (h % 4) * 0.15);
          Object.assign(e, { _x: x, _kind: kind, _suffix: row.suffix, _size: row.size, _small: !!row.small, _flipped: h % 2 === 1 });
          // The front tree is felled first and the stand's own middle tree last.
          e._turn = r === 2 ? 7 : r === 1 ? [3, 0, 1][i] : [6, 2, 5, 4][i];
          trees.push(e);
        }
      });
      return { f, trees, canopy, key: '' };
    });
    // What the valley remembers: graves on the hill, a stone notched for each flood, a shrine.
    this.graves = [];
    for (let i = 0; i < 16; i++) {
      const x = 804 + i * 8 + ((i * 5) % 3);
      const e = this.sprite(i % 3 === 1 ? 'grave_post' : 'grave_stone', x, groundHeight(x) - 1, Z.plot - 2 + (i % 2) * 0.1);
      e.enabled = false;
      this.graves.push(e);
    }
    this.floodStone = this.sprite('flood_stone', 280, groundHeight(280) - 1, Z.store);
    this.floodStone.enabled = false;
    this.shrine = this.sprite('shrine', 950, groundHeight(950) - 1, Z.store);
    this.shrine.enabled = false;
    // Lamplight in the windows after dark, drawn over the night.
    this.glows = HOUSE_SLOTS.map((h) => {
      const e = this.sprite('glow', h.x + 5, groundHeight(h.x) + 5, Z.light);
      e.enabled = false;
      return e;
    });
    this.stars = [];
    for (let i = 0; i < 46; i++) {
      const e = this.sprite('white', 0, 0, -58);
      e.setLocalScale(1, 1, 1);
      e.enabled = false;
      this.stars.push({ e, u: (i * 0.6180339) % 1, v: ((i * 0.3819) % 1) * 0.62 });
    }
    this.birds = [];
    for (let i = 0; i < 5; i++) {
      const e = this.sprite('bird0', 0, 0, -44);
      e.enabled = false;
      this.birds.push({ e, dx: -i * 13 - (i % 2) * 6, dy: (i % 3) * 7 - 6, phase: i * 0.7 });
    }
    this.flock = null;
    this.flockT = 6;
    this.fishEnt = this.sprite('fish', 0, 0, Z.water - 0.5);
    this.fishEnt.enabled = false;
    this.fishT = 5;
    this.kids = new Map();
    this.dayT = 0.12; // time of day, 0..1; starts in the morning
    this.night = 0;
    this.deer = [];
    for (let i = 0; i < 10; i++) {
      const e = this.sprite('deer0', 0, 0, Z.actor - 2);
      e.enabled = false;
      this.deer.push({ e, side: i < 5 ? 'west' : 'east', x: 0, target: null, wait: vrand() * 4, dir: 1, placed: false });
    }
    this.gameCount = { west: 0, east: 0 };

    this.plots = PLOT_SITES.map((s) => {
      const y = groundHeight(s.x);
      const e = this.sprite(`plot_${s.elev}_wild`, s.x, y - 4, Z.plot);
      const growth = this.sprite('sapling', s.x + 6, y - 1, Z.growth);
      growth.enabled = false;
      return { site: s, e, growth, key: '' };
    });
    this.houses = HOUSE_SLOTS.map((s) => {
      const e = this.sprite('house_home', s.x, groundHeight(s.x) - 1, Z.house);
      e.enabled = false;
      return { slot: s, e, key: '', smoke: vrand() * 3 };
    });
    this.granary = this.sprite('granary', WORLD.granaryX, groundHeight(WORLD.granaryX) - 1, Z.store);
    this.store = this.sprite('store_site', WORLD.ridgeStoreX, groundHeight(WORLD.ridgeStoreX) - 1, Z.store);

    // Civic buildings appear as the settlement grows: hall, levee and tower, city blocks, the Hold.
    const civic = (name, x, z, stage, upTo = 4) => {
      const e = this.sprite(name, x, groundHeight(x) - 2, z);
      e.enabled = false;
      return { e, name, x, stage, upTo };
    };
    this.civic = [civic('hall', 790, Z.house - 1, 1), civic('tower', 748, Z.civic, 2), civic('levee', 252, Z.plot + 1, 2), civic('city', 1240, Z.civic, 3, 3), civic('hold', 1236, Z.civic - 1, 4)];
    this.civicKey = '';

    this.bridge = this.sprite('bridge_rope', 0, 0, Z.plot + 0.5);
    this.bridge.enabled = false;
    this.works = this.sprite('bridge_works', 0, 0, Z.plot + 0.4);
    this.works.enabled = false;
    this.deck = false;

    this.waterEnt = this.sprite('water0', 0, 0, Z.water);
    // Flood water lies over the river and thickens as it rises; foam rides its crest and
    // wreckage drifts on it.
    // The overflow is the same water as the river: its own copies of the river's materials, so the
    // two pieces can show the upper and lower parts of one continuous surface.
    this.mats.sheet0 = this.mats.water0.clone();
    this.mats.sheet1 = this.mats.water1.clone();
    this.sizes.sheet0 = this.sizes.sheet1 = [64, 64];
    this.floodEnt = this.sprite('sheet0', 0, 0, Z.water + 0.2);
    this.floodEnt.enabled = false;
    this.foamEnt = this.sprite('foam', 0, 0, Z.water + 0.4);
    this.foamEnt.enabled = false;
    this.rippleEnt = this.sprite('ripple', 0, 0, 2.2);
    this.buildMirror();
    this.drift = ['drift_log', 'drift_thatch', 'drift_barrel', 'drift_log', 'drift_thatch', 'drift_barrel'].map((t, i) => {
      const e = this.sprite(t, 0, 0, Z.water + 0.3);
      e.enabled = false;
      return { e, x: 0, v: 14 + i * 4, phase: i * 1.3, placed: false, flip: i % 2 === 1 };
    });
    this.rainPower = 1;
    this.floodline = this.sprite('floodline', 0, 0, Z.water - 0.5);
    this.floodline.enabled = false;
    this.aura = this.sprite('aura', 0, 0, Z.actor - 1);
    this.aura.enabled = false;
    this.beam = this.sprite('beam', 0, 0, Z.fx - 0.5);
    this.beam.enabled = false;
    this.flashT = 0;
    this.pulse = 0;
    this.marker = this.sprite('marker', 0, 0, Z.badge);
    this.markerDim = this.sprite('marker_dim', 0, 0, Z.badge);
    this.carry = this.sprite('sack', 0, 0, Z.badge);
    this.carry.enabled = false;
    // What is in each store shows as sacks stacked beside it.
    this.stock = { low: [], ridge: [] };
    for (const [k, x0] of [['low', WORLD.granaryX + 19], ['ridge', WORLD.ridgeStoreX + 15]])
      for (const [dx, dy] of [[0, 0], [6, 0], [3, 5]]) {
        const e = this.sprite('sack', x0 + dx, groundHeight(x0 + dx) + dy, Z.store + 0.5);
        e.enabled = false;
        this.stock[k].push(e);
      }

    const t = (this.tintEnt = new pc.Entity('tint'));
    t.addComponent('render', { type: 'plane', castShadows: false });
    t.setLocalEulerAngles(90, 0, 0);
    t.render.meshInstances[0].material = this.tintMat;
    this.app.root.addChild(t);

    this.pool = [];
    for (let i = 0; i < 240; i++) {
      const p = this.sprite('white', 0, -500, Z.fx);
      p.enabled = false;
      this.pool.push(p);
    }
  }

  // ---- simulation -> visuals --------------------------------------------------------------
  sync(st) {
    const year = yearOf(st);
    for (const v of this.plots) {
      const p = st.plots[v.site.id];
      const look = p.state === 'planted' ? p.stage || 'sprout' : p.state;
      const old = p.state === 'overgrown' && year - p.since > 25;
      const key = look + (old ? (year - p.since > 90 ? 2 : 1) : 0);
      if (key === v.key) continue;
      v.key = key;
      this.setTex(v.e, `plot_${v.site.elev}_${look}`);
      v.growth.enabled = old;
      if (old) {
        this.setTex(v.growth, year - p.since > 90 ? 'tree' : 'sapling');
        this.place(v.growth, v.site.x + 6, groundHeight(v.site.x) - 1);
      }
    }
    for (const v of this.houses) {
      const s = st.houses[v.slot.id];
      if (s.state === v.key) continue;
      v.key = s.state;
      v.e.enabled = s.state !== 'gone';
      if (s.state !== 'gone') this.setTex(v.e, `house_${s.state}`);
    }
    const longGone = st.collapse && year - st.collapse.year > 40;
    this.setTex(this.granary, longGone ? 'granary_ruin' : 'granary');
    this.setTex(this.store, st.stores.ridge.built ? (longGone ? 'store_ruin' : 'store') : 'store_site');
    this.place(this.granary, WORLD.granaryX, groundHeight(WORLD.granaryX) - 1);
    for (const k of ['low', 'ridge']) {
      const held = k === 'ridge' && !st.stores.ridge.built ? 0 : st.stores[k].seed + st.stores[k].food;
      this.stock[k].forEach((e, i) => (e.enabled = !longGone && held > [0.5, 10, 25][i]));
    }
    // After a collapse the highest stage ever reached is what stands in ruins.
    const dead = st.households.length === 0;
    const stage = dead ? st.stats.peakStage : st.civ.stage;
    const ckey = stage + (dead ? 'r' : '');
    if (ckey !== this.civicKey) {
      this.civicKey = ckey;
      for (const c of this.civic) {
        c.e.enabled = stage >= c.stage && stage <= c.upTo;
        if (c.e.enabled) {
          this.setTex(c.e, c.name + (dead ? '_ruin' : ''));
          this.place(c.e, c.x, c.name === 'levee' ? 9 : groundHeight(c.x) - 2);
        }
      }
    }
    for (const v of this.stands) {
      const f = st.forest.stands[v.f.id];
      const key = f.cleared ? 'x' : String(Math.round(f.wood * 5));
      if (key === v.key) continue;
      v.key = key;
      const full = Math.min(1, f.wood / 10);
      v.canopy.enabled = !f.cleared && f.wood >= 1.5;
      if (v.canopy.enabled) {
        // The far canopy stands as tall as the stand is grown.
        v.canopy._sy = 0.35 + 0.95 * full;
        v.canopy.setLocalScale(64, 1, v.canopy._h * v.canopy._sy);
        this.place(v.canopy, v.canopy._x, groundHeight(v.canopy._x) - 1);
      }
      for (const e of v.trees) {
        e.enabled = !f.cleared;
        if (f.cleared) continue;
        // How far along this tree is: nothing, sapling, young, grown.
        const p = (f.wood - e._turn * 0.875) / 3;
        const young = { oak: 'tree', fir: 'pine', oak2: 'tree2' }[e._kind];
        const kind = p <= 0 ? 'stump' : p < 0.3 ? 'sapling' : p < 0.65 || e._small ? young : e._kind;
        const size = kind === 'stump' || kind === 'sapling' ? 1 : p < 0.65 ? (p < 0.45 ? 0.8 : 1) : p < 0.85 ? 0.8 : p < 1 ? 0.9 : 1;
        e._tex = null;
        this.setTex(e, kind + e._suffix, e._flipped);
        e._sy = size * e._size;
        e.setLocalScale((e._flipped ? -1 : 1) * e._w * e._sy, 1, e._h * e._sy);
        this.place(e, e._x, groundHeight(e._x) - 1);
      }
    }
    const nobody = st.households.length === 0;
    const nGraves = Math.min(16, Math.floor(2.2 * Math.log2(1 + st.stats.deaths / 2)));
    this.graves.forEach((e, i) => (e.enabled = i < nGraves));
    this.floodStone.enabled = !!st.river.lastFlood;
    this.shrine.enabled = year > 0;
    if (year > 0) this.setTex(this.shrine, !nobody && st.year0.shortage <= 0.001 ? 'shrine' : 'shrine_bare');
    this.homes = st.houses.map((h) => h.state === 'home');
    this.gameCount = { west: Math.round(st.forest.game.west / 8), east: Math.round(st.forest.game.east / 8) };
    const br = st.bridge;
    const bx = (WORLD.bridge.x0 + WORLD.bridge.x1) / 2;
    const bkey = `${br.built}|${br.plan}|${br.progress > 0}|${br.lostYear}`;
    if (bkey !== this.bridgeKey) {
      this.bridgeKey = bkey;
      const tex = br.built ? `bridge_${br.built}` : br.lostYear !== null && year - br.lostYear < 40 ? 'bridge_gone' : null;
      this.bridge.enabled = !!tex;
      if (tex) {
        this.setTex(this.bridge, tex);
        this.bridge.setLocalPosition(bx, WORLD.bridge.deck + 10 - this.bridge._h / 2, Z.plot + 0.5);
      }
      const building = br.plan && br.plan !== br.built && br.progress > 0;
      this.works.enabled = !!building;
      if (building) this.works.setLocalPosition(bx, WORLD.bridge.deck + 10 - this.works._h / 2, Z.plot + 0.4);
    }
    this.deck = !!br.built;
    const sky = st.sky;
    this.volcanoHot = sky.ash > 0 || (sky.lastEruption && year - sky.lastEruption.year < 6);
    this.volcanoSmoke = sky.rumble > 0 ? 1 : sky.ash > 0 ? 2 : 0;
    this.setTex(this.volcano, this.volcanoHot ? 'volcano_hot' : 'volcano');
    this.slideEnt.enabled = !!sky.lastSlide && year - sky.lastSlide.year < 30;
    const line = st.river.floods.reduce((m, f) => Math.max(m, f.level), 0);
    this.floodLevel = line;
  }

  // Keep one actor per household. Returns the actor map.
  syncActors(st, instant) {
    const seen = new Set();
    for (const h of st.households) {
      seen.add(h.id);
      let a = this.actors.get(h.id);
      if (!a) {
        const home = this.homeX(h);
        a = this.addActor(h.id, `v${h.id % SHIRTS.length}`, home + (vrand() * 30 - 15));
      }
      a.home = this.homeX(h);
      a.knows = h.knows;
      a.badge.enabled = h.knows;
    }
    for (const [id, a] of this.actors) {
      if (id < 0 || seen.has(id)) continue;
      if (instant || a.leaving > 6) this.removeActor(id);
      else if (!a.leaving) {
        a.leaving = 0.01;
        a.target = 1560 + WORLD.east; // out through the split in the cliff
        a.wait = 0;
        a.badge.enabled = false;
      }
    }
    return this.actors;
  }
  // Height an actor stands at: the ground, or the bridge deck over the river.
  surface(x) {
    const g = groundHeight(x);
    return this.deck && x > WORLD.bridge.x0 && x < WORLD.bridge.x1 ? Math.max(g, WORLD.bridge.deck) : g;
  }
  homeX(h) {
    return h.house >= 0 ? HOUSE_SLOTS[h.house].x : 1060 + ((h.id * 37) % 360);
  }
  // One child out of doors for each house that has children, up to a dozen.
  syncChildren(st) {
    const year = yearOf(st);
    const want = new Map();
    for (const p of st.people) {
      const age = year - p.born;
      if (age < 3 || age >= 14 || want.has(p.hid) || want.size >= 12) continue;
      const h = st.households.find((x) => x.id === p.hid);
      if (h) want.set(p.hid, this.homeX(h));
    }
    for (const [hid, k] of this.kids) {
      if (want.has(hid)) continue;
      k.e.destroy();
      this.kids.delete(hid);
    }
    for (const [hid, home] of want) {
      let k = this.kids.get(hid);
      if (!k) {
        const x = home + vrand() * 24 - 12;
        k = { e: this.sprite(`child${hid % 4}_idle`, x, groundHeight(x), Z.actor - 0.5), skin: `child${hid % 4}`, x, target: null, wait: vrand() * 3, dir: 1, phase: vrand() * 9 };
        this.kids.set(hid, k);
      }
      k.home = home;
    }
  }
  updateChildren(dt, opts) {
    for (const k of this.kids.values()) {
      if (k.target === null) {
        if ((k.wait -= dt) <= 0) {
          // Children stay near home, unless the god is close: then they trail after him.
          const near = opts.god !== undefined && Math.abs(opts.god - k.x) < 150;
          k.target = near && vrand() < 0.7 ? opts.god + (vrand() < 0.5 ? -1 : 1) * (10 + vrand() * 14) : k.home + vrand() * 70 - 35;
          k.target = Math.max(this.deck ? 8 : WORLD.walkMin, Math.min(1462, k.target));
        }
      } else {
        const d = k.target - k.x;
        k.dir = Math.sign(d) || k.dir;
        k.x += Math.sign(d) * Math.min(Math.abs(d), 52 * dt);
        if (Math.abs(d) < 1) (k.target = null), (k.wait = 0.4 + vrand() * 2.5);
      }
      k.phase += dt * 11;
      const frame = k.target !== null ? (Math.floor(k.phase) % 2 ? 'walk1' : 'walk2') : 'idle';
      this.setTex(k.e, `${k.skin}_${frame}`, k.dir < 0);
      this.place(k.e, Math.round(k.x), Math.round(this.surface(k.x)));
    }
  }
  clearChildren() {
    for (const k of this.kids.values()) k.e.destroy();
    this.kids.clear();
  }
  addActor(id, skin, x) {
    const e = this.sprite(`${skin}_idle`, x, groundHeight(x), Z.actor - (id % 7) * 0.1);
    const badge = this.sprite('seed', x, groundHeight(x) + 14, Z.badge);
    badge.enabled = false;
    const loadE = this.sprite('sack', x, groundHeight(x) + 6, Z.badge);
    loadE.enabled = false;
    const a = { id, skin, e, badge, loadE, load: null, next: null, x, dir: 1, moving: false, controlled: false, target: null, wait: vrand() * 3, home: x, leaving: 0, knows: false, phase: vrand() * 10 };
    this.actors.set(id, a);
    return a;
  }
  removeActor(id) {
    const a = this.actors.get(id);
    if (!a) return;
    a.e.destroy();
    a.badge.destroy();
    a.loadE.destroy();
    this.actors.delete(id);
  }
  clearActors() {
    this.clearChildren();
    for (const id of [...this.actors.keys()]) this.removeActor(id);
  }

  // What the customs send villagers to do, as chances per outing. The customs are meant to be seen:
  // sacks going up to the ridge store, logs and game coming back from the forest.
  errands(st) {
    const trees = st.forest.stands.filter((f) => f.wood > 0 && (f.side === 'east' || this.deck));
    const near = (list) => list.sort((a, b) => Math.abs(FOREST_STANDS[a.id].x - 700) - Math.abs(FOREST_STANDS[b.id].x - 700))[0];
    const tree = near(trees);
    const cut = customValue(st, 'woodcut');
    const game = ['east', 'west'].filter((side) => st.forest.game[side] > 1 && (side === 'east' || this.deck));
    const edge = (side) => (side === 'east' ? 1500 : -40);
    return {
      uphill: st.stores.ridge.built ? 0.4 * Math.max(customValue(st, 'uphillSeed') / 0.9, customValue(st, 'uphillFood') / 0.7) : 0,
      wood: tree ? { none: 0, thin: 0.12, clear: 0.28 }[cut] : 0,
      woodX: tree ? FOREST_STANDS[tree.id].x + (tree.side === 'east' ? -8 : 8) : 0,
      hunt: game.length ? customValue(st, 'hunt') * 0.5 : 0,
      gameX: game.length ? edge(game[0]) + (game[0] === 'east' ? 30 : -30) : 0,
      idle: [1.5, 1, 0.6][st.customs.pace],
      ridgeFields: customValue(st, 'fields'),
    };
  }
  sendOn(a, kind, er) {
    if (kind === 'uphill') (a.target = WORLD.granaryX + 6), (a.next = { x: WORLD.ridgeStoreX + 12, load: 'sack' });
    else if (kind === 'wood') (a.target = er.woodX), (a.next = { x: WORLD.granaryX - 14 + vrand() * 8, load: 'load_log' });
    else if (kind === 'hunt') (a.target = er.gameX + vrand() * 30 - 15), (a.next = { x: WORLD.granaryX + vrand() * 10, load: 'load_game' });
    a.load = null;
    a.wait = 0;
  }
  // A custom was just changed: a few villagers set off at once (or put down what they carried).
  errandBurst(st, custom, nearX) {
    const er = this.errands(st);
    const kind = { uphillSeed: 'uphill', uphillFood: 'uphill', woodcut: 'wood', hunt: 'hunt' }[custom];
    if (!kind) return 0;
    const folk = [...this.actors.values()].filter((a) => a.id >= 0 && !a.leaving).sort((a, b) => Math.abs(a.x - nearX) - Math.abs(b.x - nearX));
    const load = { uphill: 'sack', wood: 'load_log', hunt: 'load_game' }[kind];
    if (!er[kind]) {
      for (const a of folk) if (a.load === load || (a.next && a.next.load === load)) (a.load = null), (a.next = null), (a.target = null), (a.wait = 0.5);
      return 0;
    }
    const n = Math.max(1, Math.min(4, Math.round(er[kind] * 12)));
    folk.filter((a) => !a.load && !a.next).slice(0, n).forEach((a) => this.sendOn(a, kind, er));
    return n;
  }
  // On arriving in a year, some are already out on their errands rather than all setting off at once.
  seedErrands(st) {
    const er = this.errands(st);
    for (const a of this.actors.values()) {
      if (a.id < 0 || a.leaving) continue;
      const r = vrand();
      const kind = r < er.uphill ? 'uphill' : r < er.uphill + er.wood ? 'wood' : r < er.uphill + er.wood + er.hunt ? 'hunt' : null;
      if (!kind) continue;
      this.sendOn(a, kind, er);
      const from = a.target;
      a.target = a.next.x;
      a.load = a.next.load;
      a.next = null;
      a.x = from + (a.target - from) * vrand() * 0.8;
    }
  }

  // Routine for villagers the player is not holding. `places` lists x positions worth visiting.
  updateActors(dt, st, opts) {
    const speed = opts.speed || 34;
    const built = st.plots.filter((p) => p.state === 'fallow' || p.state === 'planted' || p.state === 'damaged');
    for (const a of this.actors.values()) {
      if (a.leaving) {
        a.leaving += dt;
        if (a.x > 1470 + WORLD.east) a.e.enabled = false;
      }
      if (!a.controlled && a.id >= 0 && !a.leaving && opts.god !== undefined && Math.abs(opts.god - a.x) < 34) {
        // The god is close: they stop what they are doing and turn to him.
        if (a.target !== null && !a.load && !a.next) (a.target = null), (a.wait = 1.2 + vrand() * 1.5);
        if (a.target === null) (a.dir = Math.sign(opts.god - a.x) || a.dir), (a.moving = false);
      }
      if (!a.controlled) {
        if (a.target === null) {
          a.wait -= dt;
          if (a.wait <= 0 && a.id >= 0) {
            const er = (this.er = this.er && this.erT === this.time ? this.er : this.errands(st));
            this.erT = this.time;
            const q = vrand();
            const kind = q < er.uphill ? 'uphill' : q < er.uphill + er.wood ? 'wood' : q < er.uphill + er.wood + er.hunt ? 'hunt' : null;
            if (kind) this.sendOn(a, kind, er);
            else {
              const r = vrand();
              // Where they farm follows the custom for where fields go.
              const ridge = built.filter((p) => p.elev === 'ridge');
              const pick = ridge.length && ridge.length < built.length ? (vrand() < Math.max(0.15, er.ridgeFields) ? ridge : built.filter((p) => p.elev !== 'ridge')) : built;
              if (pick.length && r < 0.75) a.target = PLOT_SITES[pick[Math.floor(vrand() * pick.length)].id].x + (vrand() * 30 - 15);
              if (a.target !== null && a.target < WORLD.walkMin && !this.deck) a.target = WORLD.granaryX;
              else if (a.target === null && r < 0.88) a.target = WORLD.granaryX + (vrand() * 30 - 15);
              else if (a.target === null) a.target = a.home + (vrand() * 40 - 20);
              if (opts.gather !== undefined && vrand() < 0.3) a.target = opts.gather + (vrand() * 200 - 100);
            }
            a.target = Math.max(this.deck ? WORLD.farWalkMin : WORLD.walkMin, Math.min(a.leaving ? WORLD.x1 : kind ? WORLD.walkMax : 1462, a.target));
          }
        } else {
          const d = a.target - a.x;
          const stepx = Math.sign(d) * Math.min(Math.abs(d), speed * dt * (a.leaving || a.load || a.next ? 1.6 : 1));
          a.x += stepx;
          a.dir = Math.sign(d) || a.dir;
          a.moving = true;
          if (Math.abs(d) < 1 && a.next) {
            // Reached the forest or the granary: pick up, and carry it where it goes.
            a.target = a.next.x;
            a.load = a.next.load;
            a.next = null;
          } else if (Math.abs(d) < 1) {
            a.target = null;
            a.moving = false;
            a.load = null;
            a.wait = (1.5 + vrand() * 5) * (this.er ? this.er.idle : 1);
          }
        }
      }
      a.phase += dt * (a.moving ? 9 : 0);
      const frame = a.moving ? (Math.floor(a.phase) % 2 ? 'walk1' : 'walk2') : 'idle';
      this.setTex(a.e, `${a.skin}_${frame}`, a.dir < 0);
      const y = this.surface(a.x);
      this.place(a.e, Math.round(a.x), Math.round(y) - 0);
      a.loadE.enabled = !!a.load && a.e.enabled && !a.leaving;
      if (a.loadE.enabled) {
        this.setTex(a.loadE, a.load, a.dir < 0);
        const [lx, ly] = a.load === 'load_log' ? [-a.dir, a.e._h - 9] : a.load === 'sack' ? [-a.dir * 4, a.e._h - 10] : [a.dir * 5, 2];
        this.place(a.loadE, Math.round(a.x) + lx, Math.round(y) + ly);
      }
      if (a.badge.enabled) this.place(a.badge, Math.round(a.x), Math.round(y) + a.e._h + 2 + Math.round(Math.sin(this.time * 3 + a.id) * 0.6));
    }
  }

  setMarkers(active, other) {
    this.marker.enabled = !!active;
    this.markerDim.enabled = !!other;
    const bob = Math.round(Math.sin(this.time * 5) * 1);
    this.aura.enabled = !!active;
    if (active) this.aura.setLocalPosition(Math.round(active.x), this.surface(active.x) + active.e._h / 2 + bob * 0.5, Z.actor - 1);
    if (active) this.place(this.marker, Math.round(active.x), this.surface(active.x) + active.e._h + 3 + bob);
    if (other) this.place(this.markerDim, Math.round(other.x), groundHeight(other.x) + (other.knows ? 22 : 16));
  }

  // ---- effects ----------------------------------------------------------------------------
  emit(kind, x, y, n = 1) {
    for (let i = 0; i < n; i++) {
      const e = this.pool.find((p) => !p.enabled);
      if (!e) return;
      e.enabled = true;
      const f = { e, kind, x, y, vx: 0, vy: 0, life: 1, age: 0 };
      if (kind === 'snow') Object.assign(f, { vx: -6 + vrand() * 12, vy: -18 - vrand() * 14, life: 6, tex: 'white' });
      else if (kind === 'rain') Object.assign(f, { vx: -30, vy: -190, life: 1.6, tex: 'rain' });
      else if (kind === 'firefly') Object.assign(f, { vx: vrand() * 10 - 5, vy: vrand() * 6 - 2, life: 2.4 + vrand() * 2, tex: 'ember' });
      else if (kind === 'splash') Object.assign(f, { vx: vrand() * 16 - 8, vy: 14 + vrand() * 14, life: 0.28, tex: 'white', g: -90 });
      else if (kind === 'ash') Object.assign(f, { vx: -10 + vrand() * 8, vy: -26 - vrand() * 16, life: 7, tex: 'ashflake' });
      else if (kind === 'plume') Object.assign(f, { x: x + vrand() * 14 - 7, vx: 5 + vrand() * 6, vy: 10 + vrand() * 8, life: 6, tex: vrand() < 0.5 ? 'ashflake' : 'smoke' });
      else if (kind === 'lava') Object.assign(f, { x: x + vrand() * 10 - 5, vx: vrand() * 70 - 35, vy: 50 + vrand() * 70, life: 2.4, tex: 'ember', g: -60 });
      else if (kind === 'debris') Object.assign(f, { vx: vrand() * 120 - 60, vy: 20 + vrand() * 90, life: 1.2, tex: vrand() < 0.5 ? 'ashflake' : 'smoke', g: -120 });
      else if (kind === 'spark') {
        const a = vrand() * Math.PI * 2;
        const v = 30 + vrand() * 90;
        Object.assign(f, { vx: Math.cos(a) * v, vy: Math.sin(a) * v + 30, life: 0.5 + vrand() * 0.6, tex: 'spark', g: -40 });
      } else if (kind === 'rise') Object.assign(f, { x: x + vrand() * 12 - 6, vx: 0, vy: 60 + vrand() * 120, life: 0.9, tex: 'spark' });
      else if (kind === 'smoke') Object.assign(f, { vx: 3 + vrand() * 3, vy: 8 + vrand() * 4, life: 2.6, tex: 'smoke' });
      else if (kind === 'dust') Object.assign(f, { x: x + vrand() * 30 - 15, vx: vrand() * 30 - 15, vy: 18 + vrand() * 25, life: 0.7, tex: 'smoke', g: -80 });
      else if (kind === 'mote') Object.assign(f, { vx: 4 + vrand() * 6, vy: vrand() * 4 - 1, life: 5 + vrand() * 4, tex: 'white' });
      else if (kind === 'seed') Object.assign(f, { x: x + vrand() * 16 - 8, vx: vrand() * 40 - 20, vy: 30 + vrand() * 30, life: 1.1, tex: 'seed', g: -90 });
      this.setTex(e, f.tex);
      this.fx.push(f);
    }
  }
  updateFx(dt, view) {
    if (this.weather === 'snow') for (let i = 0; i < 2; i++) this.emit('snow', view.x0 + vrand() * (view.x1 - view.x0), view.y1 + 4);
    else if (this.weather === 'ash') for (let i = 0; i < 3; i++) this.emit('ash', view.x0 + vrand() * (view.x1 - view.x0 + 40), view.y1 + 4);
    else if (this.weather === 'rain') for (let i = 0; i < 3 * this.rainPower; i++) this.emit('rain', view.x0 + vrand() * (view.x1 - view.x0 + 60), view.y1 + 4);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.age += dt;
      if (f.g) f.vy += f.g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const ground = groundHeight(Math.max(WORLD.x0, Math.min(WORLD.x1 - 1, f.x)));
      if (f.age > f.life || ((f.kind === 'snow' || f.kind === 'rain' || f.kind === 'ash') && f.y < Math.max(ground, this.water.level))) {
        f.e.enabled = false;
        this.fx.splice(i, 1);
      } else this.place(f.e, Math.round(f.x), Math.round(f.y));
    }
  }

  // ---- per-frame --------------------------------------------------------------------------
  update(dt, st, opts = {}) {
    this.time += dt;
    const canvas = this.app.graphicsDevice.canvas;
    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    const c = this.cam;
    const k = 1 - Math.exp(-dt * (opts.camSnap ? 30 : 3.2));
    c.zoom += (c.tzoom - c.zoom) * k;
    c.x += (c.tx - c.x) * k;
    c.y += (c.ty - c.y) * k;
    const vw = cw / c.zoom;
    const vh = ch / c.zoom;
    let cx = Math.max(WORLD.x0 + vw / 2, Math.min(WORLD.x1 - vw / 2, c.x));
    if (vw >= WORLD.x1 - WORLD.x0) cx = (WORLD.x0 + WORLD.x1) / 2;
    const cy = Math.max(-64 + vh / 2, c.y);
    const snap = (v) => Math.round(v * c.zoom) / c.zoom;
    this.camera.camera.orthoHeight = vh / 2;
    if (this.shake > 0) this.shake -= dt;
    const sh = this.shake > 0 ? Math.min(1, this.shake) * 3 : 0;
    this.camera.setPosition(snap(cx + (vrand() - 0.5) * sh), snap(cy + (vrand() - 0.5) * sh), 100);
    this.viewRect = { x0: cx - vw / 2, x1: cx + vw / 2, y0: cy - vh / 2, y1: cy + vh / 2, zoom: c.zoom, cw, ch };

    // Backdrop: the sky fills the frame; distant layers slide slower than the ground.
    this.sky._sy = 1;
    this.sky.setLocalScale(vw + 4, 1, vh + 4);
    this.sky.setLocalPosition(cx, cy, Z.sky);
    // Sunset. `opts.dusk` forces it (title, ruins); otherwise the day's own dusk drives it.
    const wantDusk = opts.dusk !== undefined ? opts.dusk : opts.ambient ? this.duskOfDay || 0 : 0;
    this.dusk += (wantDusk - this.dusk) * (1 - Math.exp(-dt * (opts.camSnap ? 50 : 1.6)));
    const d = this.dusk < 0.004 ? 0 : this.dusk;
    if (Math.abs(d - this.duskApplied) > 0.008 || (d === 0) !== (this.duskApplied === 0)) {
      this.duskApplied = d;
      // Near things darken toward silhouette; far things are lost in the haze.
      this.duskT = [1 - 0.86 * d, 1 - 0.93 * d, 1 - 0.88 * d];
      this.app.scene.fog.end = d > 0 ? this.hz(107 + 72 / d) : 1e7;
      for (const m of this.hazeMats) {
        m.emissive.set(this.duskT[0], this.duskT[1], this.duskT[2]);
        m.update();
      }
      for (const [name, e] of [['sky_dusk', this.skyDusk], ['sun', this.sun], ['fore', this.fore]]) {
        e.enabled = d > 0;
        this.mats[name].opacity = d;
        this.mats[name].update();
      }
    }
    if (d > 0) {
      // The warm end of the dusk sky sits on the horizon, just above the hills, not at the bottom
      // of the frame where the land would hide it.
      const horizon = 56;
      const skyTop = cy + vh / 2 + 2;
      this.skyDusk.setLocalScale(vw + 4, 1, Math.max(8, skyTop - horizon));
      this.skyDusk.setLocalPosition(cx, (skyTop + horizon) / 2, Z.sky + 0.5);
      // Low over the far range, off to one side of the mountain.
      const sp = this.sunPos(opts, cx, cy, vw, vh);
      this.sun.setLocalPosition(sp[0], sp[1], -56);
      const fh = 44;
      this.fore.setLocalScale(vw + 4, 1, fh);
      this.fore.setLocalPosition(cx, cy - vh / 2 + fh / 2 - 2, 7);
      const fm = this.mats.fore;
      fm.emissiveMapTiling = new pc.Vec2((vw + 4) / 512, 1);
      fm.opacityMapTiling = fm.emissiveMapTiling;
      fm.emissiveMapOffset = new pc.Vec2((((cx * 1.3) / 512) % 1 + 1) % 1, 0); // nearer than the world: it slides faster
      fm.opacityMapOffset = fm.emissiveMapOffset;
      fm.update();
    }
    this.far.setLocalPosition(snap(800 + (cx - 800) * 0.82), 96, Z.far);
    this.mid.setLocalPosition(snap(800 + (cx - 800) * 0.6), 52, Z.mid);
    const vx = snap(700 + (cx - 800) * 0.88);
    this.volcano.setLocalPosition(vx, 95, Z.volcano);
    this.crater = [vx, 178];
    this.plumeT = (this.plumeT || 0) - dt;
    if (this.volcanoSmoke && this.plumeT <= 0) {
      this.plumeT = this.volcanoSmoke > 1 ? 0.08 : 0.3;
      this.emit('plume', this.crater[0], this.crater[1]);
    }
    const tw = this.twister;
    this.funnel.enabled = !!tw;
    if (tw) {
      tw.t += dt;
      tw.x += dt * 190;
      const gx = Math.min(1590, tw.x);
      this.funnel.setLocalScale(40 * (Math.sin(tw.t * 20) > 0 ? 1 : -1), 1, 110);
      this.funnel.setLocalPosition(Math.round(gx + Math.sin(tw.t * 7) * 6), groundHeight(gx) + 55, Z.fx - 1);
      if (vrand() < 0.7) this.emit('debris', gx, groundHeight(gx) + 4);
      if (tw.x > tw.x1) this.twister = null;
    }
    for (const cl of this.clouds) {
      cl._x += dt * (opts.cloudSpeed || 3);
      if (cl._x > 2200) cl._x = -200;
      cl.setLocalPosition(snap(cl._x + (cx - 800) * 0.75), cl._y, Z.cloud);
    }

    // Water.
    const w = this.water;
    w.level += (w.target - w.level) * (1 - Math.exp(-dt * (opts.waterRate || 1.2)));
    const normal = WORLD.waterLevels[0];
    const bank = WORLD.lowGround;
    // A flood is the river growing. First it swells inside its channel, widening up the banks
    // and turning muddy; when it tops them it spreads outward over the land from both banks,
    // shallow at first and deepening as it goes. It falls back the same way.
    const over = Math.max(0, w.level - bank);
    const fullLeft = waterLeft(w.level);
    const fullRight = waterEdge(w.level);
    const reach = over > 0 ? Math.max(fullRight - WORLD.bridge.x1, WORLD.bridge.x0 - fullLeft) : 0;
    const rate = (opts.spreadRate || 170) * dt;
    const cur = w.spread || 0;
    w.spread = cur < reach ? Math.min(reach, cur + rate) : Math.max(reach, cur - rate * 1.4);
    const frac = reach > 0 ? Math.min(1, w.spread / reach) : 0;
    const spilled = w.spread > 0.5;
    const swell = w.level > normal + 0.5 ? Math.sin(this.time * 1.7) * 0.5 + Math.sin(this.time * 0.9 + 1) * 0.3 : 0;
    // The river in its channel: up to the top of the banks.
    // (Stopping just under the lowest turf keeps the river inside its channel.)
    const riverTop = Math.min(w.level, bank - 1.5) + (spilled ? 0 : swell * Math.min(1, Math.max(0, w.level - normal) / 3));
    const rEdge = waterEdge(riverTop);
    const rLeft = waterLeft(riverTop);
    const frame = Math.floor(this.time * 2.5) % 2;
    this.setTex(this.waterEnt, frame ? 'water0' : 'water1');
    this.waterEnt.setLocalScale(rEdge - rLeft, 1, riverTop + 100);
    this.waterEnt.setLocalPosition((rEdge + rLeft) / 2, -100 + (riverTop + 100) / 2, Z.water);
    // One texture runs down the whole depth of the water, from the surface to the bottom of the
    // frame. `from` and `share` say which part of that depth a piece shows (0 is the surface).
    const tile = (m, width, x0, from = 0, share = 1) => {
      m.emissiveMapTiling = new pc.Vec2(width / 64, share);
      m.opacityMapTiling = m.emissiveMapTiling;
      m.emissiveMapOffset = new pc.Vec2((((x0 / 64) % 1) + 1) % 1, 1 - from - share);
      m.opacityMapOffset = m.emissiveMapOffset;
    };
    // Over the land once it spills: the same water, continuing upward and outward from the channel.
    // While it drains back, the sheet on the land stays a thin layer until it has all returned.
    const hExt = Math.max(w.level, bank + 1.5);
    const left = spilled ? Math.max(waterLeft(hExt), WORLD.bridge.x0 - w.spread) : rLeft;
    const right = spilled ? Math.min(waterEdge(hExt), WORLD.bridge.x1 + w.spread) : rEdge;
    const top = spilled ? bank + Math.max(1.5, over * Math.pow(frac, 0.7)) + swell : riverTop;
    const murk = Math.max(0, Math.min(1, (w.level - normal) / 8));
    const flooding = murk > 0.02;
    const edge = right;
    const wl = left;
    this.surface0 = { top, left, right, flooding, spilled };
    // In flood the whole river, channel and overflow alike, takes on the colour of silt.
    const depthAll = top + 100;
    const upper = spilled ? (top - riverTop) / depthAll : 0; // share of the depth that lies over the land
    for (const m of [this.mats.water0, this.mats.water1]) {
      tile(m, rEdge - rLeft, rLeft, upper, 1 - upper);
      m.emissive.set((1 - 0.1 * murk) * this.duskT[0], (1 - 0.2 * murk) * this.duskT[1], (1 - 0.42 * murk) * this.duskT[2]);
      m.update();
    }
    this.floodEnt.enabled = spilled;
    this.foamEnt.enabled = spilled && frac < 1; // foam only while the front is moving
    if (spilled) {
      const width = right - left;
      this.setTex(this.floodEnt, frame ? 'sheet0' : 'sheet1');
      this.floodEnt.setLocalScale(width, 1, top - riverTop);
      this.floodEnt.setLocalPosition((right + left) / 2, riverTop + (top - riverTop) / 2, Z.water + 0.2);
      for (const m of [this.mats.sheet0, this.mats.sheet1]) {
        tile(m, width, left, 0, upper);
        m.emissive.set((1 - 0.1 * murk) * this.duskT[0], (1 - 0.2 * murk) * this.duskT[1], (1 - 0.42 * murk) * this.duskT[2]);
        m.update();
      }
      this.foamEnt.setLocalScale(width, 1, 3);
      this.foamEnt.setLocalPosition((right + left) / 2, top + 0.5, Z.water + 0.4);
      this.mats.foam.emissiveMapTiling = new pc.Vec2(width / 64, 1);
      this.mats.foam.opacityMapTiling = this.mats.foam.emissiveMapTiling;
      this.mats.foam.emissiveMapOffset = new pc.Vec2((this.time * 0.11) % 1, 0);
      this.mats.foam.opacityMapOffset = this.mats.foam.emissiveMapOffset;
      this.mats.foam.opacity = 0.6 * (1 - frac);
      this.mats.foam.update();
      // Water breaks at both advancing edges.
      for (let i = 0; i < (frac < 1 ? 3 : 1); i++) {
        if (vrand() < 0.5) this.emit('splash', right - 1 - vrand() * 4, top);
        if (vrand() < 0.5) this.emit('splash', left + 1 + vrand() * 4, top);
      }
    }
    if (flooding && this.weather === 'rain' && this.viewRect) for (let i = 0; i < this.rainPower; i++) {
      const x = Math.max(left, this.viewRect.x0) + vrand() * (Math.min(right, this.viewRect.x1) - Math.max(left, this.viewRect.x0));
      if (x > left && x < right) this.emit('splash', x, top);
    }
    const rise = spilled ? top - normal : 0;
    // Wreckage: more of it the higher the water.
    const want = rise > 40 ? 6 : rise > 18 ? 4 : rise > 8 ? 2 : 0;
    this.drift.forEach((d, i) => {
      const on = flooding && i < want;
      d.e.enabled = on;
      if (!on) return (d.placed = false);
      if (!d.placed) (d.x = wl + ((i * 0.37 + 0.2) % 1) * (edge - wl)), (d.placed = true);
      d.x -= d.v * dt; // carried downstream
      if (d.x < wl + 8) d.x = edge - 10;
      if (d.x > edge - 6) d.x = edge - 10;
      const bob = Math.sin(this.time * 2.2 + d.phase) * 0.8;
      d.e.setLocalScale(d.flip ? -d.e._w : d.e._w, 1, d.e._h);
      d.e.setLocalPosition(Math.round(d.x), Math.round(top + bob - 2 + d.e._h / 2), Z.water + 0.3);
    });
    const showLine = opts.showFloodLine && this.floodLevel > 0;
    this.floodline.enabled = !!showLine;
    if (showLine) {
      const h = WORLD.waterLevels[this.floodLevel];
      const x1 = waterEdge(h);
      this.floodline.setLocalScale(x1 - 262, 1, 1);
      this.floodline.setLocalPosition((x1 + 262) / 2, h + 0.5, Z.water - 0.5);
      this.mats.floodline.emissiveMapTiling = new pc.Vec2((x1 - 262) / 64, 1);
      this.mats.floodline.opacityMapTiling = this.mats.floodline.emissiveMapTiling;
      this.mats.floodline.update();
    }

    // Season wash.
    const t = this.tint;
    t.a += (t.ta - t.a) * (1 - Math.exp(-dt * 2));
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 0.9);
    const pz = this.pulse;
    if (pz > t.a) (this.tintMat.emissive.set(0.6, 0.85, 1), (this.tintMat.opacity = pz));
    else (this.tintMat.emissive.set(t.r, t.g, t.b), (this.tintMat.opacity = t.a));
    this.beam.enabled = this.flashT > 0;
    if (this.flashT > 0) {
      this.flashT -= dt;
      const life = this.flashBig ? 0.75 : 0.35;
      const k = Math.max(0, this.flashT / life);
      const w = (this.flashBig ? 26 : 10) * Math.sin(k * Math.PI) + 2;
      const h = this.flashBig ? 420 : 40;
      this.beam.setLocalScale(w, 1, h);
      this.beam.setLocalPosition(this.flashAt[0], this.flashAt[1] + h / 2, Z.fx - 0.5);
    }
    this.tintMat.update();
    this.tintEnt.setLocalScale(vw + 4, 1, vh + 4);
    this.tintEnt.setLocalPosition(cx, cy, Z.tint);

    // The day turns while the god is in the valley: dusk, night with lamps and stars, dawn.
    if (opts.ambient) {
      this.dayT = (this.dayT + dt / 170) % 1;
      const t = this.dayT;
      const ramp = (a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
      const dusk = ramp(0.38, 0.47) * (1 - ramp(0.6, 0.68));
      const night = ramp(0.62, 0.7) * (1 - ramp(0.9, 0.98));
      const dawn = ramp(0.9, 0.96) * (1 - ramp(0.97, 1));
      this.dawn = dawn;
      this.duskOfDay = Math.max(dusk * 0.9, dawn * 0.5); // dawn has some of sunset's look, from the other side
      this.night = night;
      const a = Math.max(night * 0.5, dawn * 0.16);
      const mix = night > 0.05 ? [0.06 + 0.5 * (1 - night), 0.09 + 0.3 * (1 - night), 0.24] : [1, 0.6, 0.6];
      this.setTint(mix[0], mix[1], mix[2], a);
    } else this.night = 0;
    const lamp = Math.max(this.night, this.dusk * 0.95); // lamps are lit at sunset too
    this.mats.glow.opacity = 0.85 * lamp;
    this.mats.glow.update();
    this.glows.forEach((e, i) => (e.enabled = lamp > 0.05 && !!(this.homes && this.homes[i])));
    for (const sStar of this.stars) {
      sStar.e.enabled = this.night > 0.35;
      if (this.night > 0.35) sStar.e.setLocalPosition(Math.round(this.viewRect.x0 + sStar.u * vw), Math.round(this.viewRect.y1 - sStar.v * vh), -58);
    }
    if (this.night > 0.5 && vrand() < 0.2) this.emit('firefly', this.viewRect.x0 + vrand() * vw, groundHeight(Math.max(WORLD.x0, Math.min(WORLD.x1 - 1, this.viewRect.x0 + vw / 2))) + 4 + vrand() * 26);
    // Birds cross the sky by day.
    this.flockT -= dt;
    if (!this.flock && this.flockT <= 0 && this.night < 0.2 && opts.ambient) {
      const dir = vrand() < 0.5 ? 1 : -1;
      this.flock = { x: dir > 0 ? this.viewRect.x0 - 20 : this.viewRect.x1 + 80, y: cy + vh * (0.12 + vrand() * 0.2), dir, n: 2 + Math.floor(vrand() * 4) };
    }
    if (this.flock) {
      const f = this.flock;
      f.x += f.dir * 46 * dt;
      this.birds.forEach((b, i) => {
        b.e.enabled = i < f.n;
        if (i >= f.n) return;
        this.setTex(b.e, Math.floor(this.time * 5 + b.phase) % 2 ? 'bird0' : 'bird1');
        b.e.setLocalPosition(Math.round(f.x + b.dx * f.dir), Math.round(f.y + b.dy + Math.sin(this.time * 2 + b.phase) * 2), -44);
      });
      if (f.x < this.viewRect.x0 - 120 || f.x > this.viewRect.x1 + 120) (this.flock = null), (this.flockT = 14 + vrand() * 30), this.birds.forEach((b) => (b.e.enabled = false));
    } else this.birds.forEach((b) => (b.e.enabled = false));
    // Now and then a fish jumps in the river.
    this.fishT -= dt;
    const s0 = this.surface0;
    if (!this.fishJump && this.fishT <= 0 && s0 && !s0.flooding && opts.ambient) {
      const x = s0.left + 14 + vrand() * Math.max(1, s0.right - s0.left - 28);
      this.fishJump = { x, t: 0, dir: vrand() < 0.5 ? 1 : -1 };
      this.emit('splash', x, s0.top, 4);
    }
    this.fishEnt.enabled = !!this.fishJump;
    if (this.fishJump) {
      const j = this.fishJump;
      j.t += dt;
      const u = j.t / 0.8;
      this.fishEnt.setLocalScale(j.dir * this.fishEnt._w, 1, this.fishEnt._h);
      this.fishEnt.setLocalPosition(Math.round(j.x + j.dir * u * 12), Math.round(s0.top + Math.sin(u * Math.PI) * 9), Z.water - 0.5);
      if (u >= 1) (this.emit('splash', j.x + j.dir * 12, s0.top, 4), (this.fishJump = null), (this.fishT = 7 + vrand() * 14));
    }

    // Deer browse in whichever forest still has game.
    const seen = { west: 0, east: 0 };
    for (const d of this.deer) {
      const show = seen[d.side]++ < this.gameCount[d.side];
      d.e.enabled = show;
      if (!show) {
        d.placed = false;
        continue;
      }
      const [lo, hi] = d.side === 'west' ? [-440, -30] : [1490, 1850];
      if (!d.placed) (d.x = lo + vrand() * (hi - lo)), (d.placed = true);
      if (d.target === null) {
        if ((d.wait -= dt) <= 0) d.target = Math.max(lo, Math.min(hi, d.x + vrand() * 160 - 80));
      } else {
        const dx = d.target - d.x;
        d.dir = Math.sign(dx) || d.dir;
        d.x += Math.sign(dx) * Math.min(Math.abs(dx), 22 * dt);
        if (Math.abs(dx) < 1) (d.target = null), (d.wait = 2 + vrand() * 7);
      }
      this.setTex(d.e, d.target !== null && Math.floor(this.time * 6) % 2 ? 'deer1' : 'deer0', d.dir < 0);
      this.place(d.e, Math.round(d.x), groundHeight(d.x));
    }

    // Hearth smoke from occupied houses.
    if (st && !opts.noSmoke)
      for (const v of this.houses) {
        if (v.key !== 'home') continue;
        v.smoke -= dt;
        if (v.smoke <= 0) {
          v.smoke = 1.2 + vrand() * 2;
          this.emit('smoke', v.slot.x - 6, groundHeight(v.slot.x) + 20);
        }
      }
    this.atmosphere(dt, opts, cx, cy, vw, vh);
    this.updateFx(dt, this.viewRect);
  }

  // Where the sun stands. Forced sunsets (title, ruins) hold it low on the right; otherwise it
  // rises on the left at dawn, arcs over through the day and sets on the right.
  sunPos(opts, cx, cy, vw, vh) {
    const low = Math.min(152, cy + vh * 0.34);
    if (opts.dusk !== undefined || !opts.ambient) return [Math.round(cx + vw * 0.22), Math.round(low)];
    const t = this.dayT;
    const s = t > 0.85 ? (t - 1) / 0.47 : Math.min(1, t / 0.47); // 0 at sunrise, 1 at sunset; below 0 before dawn
    const high = cy + vh * 0.3;
    const lift = s < 0 ? s * 3 : Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, s))), 0.7);
    const set = t > 0.6 && t < 0.85 ? (t - 0.6) / 0.08 : 0; // sinking behind the range after dusk
    return [Math.round(cx + vw * (-0.3 + 0.52 * Math.max(-0.2, s))), Math.round(low + (high - low) * lift - Math.min(1, set) * 70)];
  }

  // Light and air over the valley: the day's sun and its glow, the moon, shafts of light when the
  // sun is low, mist lying in the valley and on the river, and the sky's light on the water.
  atmosphere(dt, opts, cx, cy, vw, vh) {
    const d = this.dusk;
    const night = this.night;
    const live = !!opts.ambient || opts.dusk !== undefined;
    const set = (key, r, g, b, a) => {
      const m = this.mats[key];
      if (m._a === a && m._r === r && m._g === g && m._b === b) return;
      (m._a = a), (m._r = r), (m._g = g), (m._b = b);
      m.emissive.set(r, g, b);
      m.opacity = a;
      m.update();
    };
    const q = (v) => Math.round(v * 50) / 50;
    const [sx, sy] = this.sunPos(opts, cx, cy, vw, vh);
    // The day's sun: the same disc as the sunset's, which takes over as the sky reddens.
    const day = live ? Math.max(0, 1 - night * 1.4) : 0;
    const sunA = q(day * (1 - d));
    this.daySun.enabled = sunA > 0.02;
    set('sun_day', 1, 1, 1, sunA);
    this.daySun.setLocalPosition(sx, sy, -57);
    const glowA = q(day * (0.55 + 0.35 * d));
    this.sunGlow.enabled = glowA > 0.02;
    set('glow_sun', 1, q(0.92 - 0.3 * d), q(0.7 - 0.4 * d), glowA);
    const gs = 230 + 150 * d;
    this.sunGlow.setLocalScale(gs, 1, gs);
    this.sunGlow.setLocalPosition(sx, sy, -57.5);
    // Shafts of light, strongest when the sun is low.
    const lowness = live ? Math.max(d, this.dawn, 0.22 * day) : 0;
    const rayA = q(Math.min(0.75, lowness * 0.8) * day);
    this.rays.enabled = rayA > 0.02;
    set('soft_rays', 1, q(0.9 - 0.25 * d), q(0.72 - 0.35 * d), rayA);
    const rs = Math.max(vw, vh) * 0.95;
    const leftSun = sx < cx;
    this.rays.setLocalScale(leftSun ? -rs : rs, 1, rs);
    this.rays.setLocalPosition(sx + (leftSun ? rs / 2 : -rs / 2), sy - rs / 2, -39);
    // The moon crosses the night sky.
    const moonA = q(live ? Math.max(0, (night - 0.25) / 0.6) : 0);
    this.moon.enabled = this.moonGlow.enabled = moonA > 0.02;
    if (moonA > 0.02) {
      const m = Math.max(0, Math.min(1, (this.dayT - 0.62) / 0.36));
      const mx = Math.round(cx + vw * (-0.32 + 0.64 * m));
      const my = Math.round(cy + vh * (0.12 + 0.18 * Math.sin(Math.PI * m)));
      set('moon', 1, 1, 1, Math.min(1, moonA));
      this.moon.setLocalPosition(mx, my, -57);
      set('glow_moon', 0.6, 0.72, 1, q(moonA * 0.5));
      this.moonGlow.setLocalScale(150, 1, 150);
      this.moonGlow.setLocalPosition(mx, my, -57.5);
    }
    // Mist: thickest at dawn, thin at noon; it takes the colour of the hour.
    const thick = live ? 0.42 + 0.58 * Math.max(this.dawn, night * 0.75, d * 0.7) : 0.3;
    const mr = q(0.96 - 0.02 * d - 0.6 * night);
    const mg = q(0.97 - 0.36 * d - 0.5 * night);
    const mb = q(1 - 0.42 * d - 0.28 * night);
    for (const mist of this.mists) {
      const key = mist.e._tex;
      const a = q(mist.a * thick * (mist.river ? Math.max(0, thick - 0.5) * 2 : 1));
      mist.e.enabled = a > 0.02;
      if (!mist.e.enabled) continue;
      set(key, mr, mg, mb, a);
      const m = this.mats[key];
      const width = mist.river ? 760 : vw + 4;
      const x = mist.river ? 420 : cx;
      mist.e.setLocalScale(width, 1, mist.h);
      mist.e.setLocalPosition(x, mist.y, mist.e._z);
      m.emissiveMapTiling = new pc.Vec2(width / (512 * mist.stretch), 1);
      m.opacityMapTiling = m.emissiveMapTiling;
      m.emissiveMapOffset = new pc.Vec2(((((x - width / 2) * (1 - mist.par) + this.time * mist.speed) / (512 * mist.stretch)) % 1 + 1) % 1, 0);
      m.opacityMapOffset = m.emissiveMapOffset;
      m.update();
    }
    // The sky's light lying on the river, and glints that come and go.
    const s0 = this.surface0;
    const calm = s0 && !s0.flooding;
    this.sheen.enabled = !!calm;
    if (calm) {
      const depth = 16;
      set('sheen', q(0.86 + 0.14 * d - 0.6 * night), q(0.93 - 0.3 * d - 0.5 * night), q(1 - 0.5 * d - 0.3 * night), q(0.42 + 0.2 * d));
      this.sheen.setLocalScale(s0.right - s0.left, 1, depth);
      this.sheen.setLocalPosition((s0.left + s0.right) / 2, s0.top - depth / 2, 2.1);
    }
    this.updateMirror(dt, calm, night, cx, cy, vw, vh);
    for (const gl of this.glints) {
      gl.t -= dt;
      if (gl.t <= 0) (gl.t = 0.25 + vrand() * 1.6), (gl.u = vrand()), (gl.v = vrand() * vrand()), (gl.on = vrand() < 0.6);
      gl.e.enabled = !!calm && gl.on && night < 0.8;
      if (gl.e.enabled) {
        gl.e.setLocalScale(2 + Math.round(gl.u * 2), 1, 1);
        gl.e.setLocalPosition(Math.round(s0.left + 6 + gl.u * (s0.right - s0.left - 12)), Math.round(s0.top - 1 - gl.v * 9), 2.15);
      }
    }
  }

  // The river mirrors what stands over it. A second camera draws the frame small into a texture;
  // strips of water under the surface each show a row of that picture upside down, squeezed,
  // slid sideways by the ripples, and fainter the deeper they lie.
  buildMirror() {
    const mc = new pc.Entity('mirror');
    mc.addComponent('camera', { projection: pc.PROJECTION_ORTHOGRAPHIC, clearColor: new pc.Color(0.2, 0.27, 0.42), nearClip: 1, farClip: 400, priority: -1 });
    mc.camera.gammaCorrection = pc.GAMMA_SRGB;
    mc.camera.toneMapping = pc.TONEMAP_NONE;
    this.camera.addChild(mc);
    this.mirror = { cam: mc, strips: [], a: 0, w: 0, h: 0, tex: null };
    for (let i = 0; i < 16; i++) {
      const m = new pc.StandardMaterial();
      Object.assign(m, { useLighting: false, useSkybox: false, useFog: false, blendType: pc.BLEND_NORMAL, depthWrite: false, opacity: 0, cull: pc.CULLFACE_NONE });
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(1, 1, 1);
      this.mats[`mirror${i}`] = m;
      this.sizes[`mirror${i}`] = [1, 1];
      const e = this.sprite(`mirror${i}`, 0, 0, 2.04);
      e.enabled = false;
      this.mirror.strips.push({ e, m });
    }
    this.sizeMirror();
  }
  // Two pictures, used turn about: the strips show last frame's while this frame's is drawn,
  // so the mirror camera never reads the picture it is drawing into.
  sizeMirror() {
    const gd = this.app.graphicsDevice;
    const w = Math.max(16, Math.ceil(gd.width / 3));
    const h = Math.max(16, Math.ceil(gd.height / 3));
    const mr = this.mirror;
    if (w === mr.w && h === mr.h) return;
    for (const rt of mr.rts || []) {
      rt.colorBuffer.destroy();
      rt.destroy();
    }
    mr.w = w;
    mr.h = h;
    mr.rts = [0, 1].map(() => {
      const tex = new pc.Texture(gd, { width: w, height: h, format: pc.PIXELFORMAT_RGBA8, mipmaps: false, minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
      return new pc.RenderTarget({ colorBuffer: tex, depth: true });
    });
    mr.turn = 0;
  }
  updateMirror(dt, calm, night, cx, cy, vw, vh) {
    const mr = this.mirror;
    this.sizeMirror();
    mr.turn = 1 - mr.turn;
    mr.cam.camera.renderTarget = mr.rts[mr.turn];
    const picture = mr.rts[1 - mr.turn].colorBuffer;
    mr.cam.camera.orthoHeight = vh / 2;
    mr.a += ((calm ? 1 : 0) - mr.a) * (1 - Math.exp(-dt * 1.5));
    const s0 = this.surface0;
    const on = !!s0 && mr.a > 0.02 && s0.top > cy - vh / 2;
    mr.cam.enabled = on;
    const left = on ? Math.max(s0.left, cx - vw / 2) : 0;
    const right = on ? Math.min(s0.right, cx + vw / 2) : 0;
    const H = 2; // each strip is two rows of water
    const squeeze = 1.7; // and shows this many times as much of what is above
    mr.strips.forEach((s, i) => {
      s.e.enabled = on && right - left > 1;
      if (!s.e.enabled) return;
      const d = i * H;
      const fade = 1 - i / mr.strips.length;
      const slide = Math.sin(this.time * 1.9 + i * 1.3) * (0.4 + i * 0.16) + Math.sin(this.time * 0.8 + i * 0.5) * 0.5;
      s.e.setLocalScale(right - left, 1, H);
      s.e.setLocalPosition((left + right) / 2, s0.top - d - H / 2, 2.04 + i * 0.001);
      const v1 = (s0.top + (d + H) * squeeze - (cy - vh / 2)) / vh;
      s.m.emissiveMapTiling = new pc.Vec2((right - left) / vw, -(H * squeeze) / vh);
      s.m.emissiveMapOffset = new pc.Vec2((left + Math.round(slide) - (cx - vw / 2)) / vw, Math.min(1, v1));
      s.m.emissiveMap = picture;
      s.m.opacity = mr.a * (0.62 - 0.2 * night) * Math.pow(fade, 1.25);
      s.m.update();
    });
    // The line of the surface itself: broken light sliding downstream.
    const rp = this.rippleEnt;
    rp.enabled = !!s0 && !s0.spilled;
    if (rp.enabled) {
      const w = s0.right - s0.left;
      rp.setLocalScale(w, 1, 4);
      rp.setLocalPosition((s0.left + s0.right) / 2, s0.top - 2, 2.2);
      const m = this.mats.ripple;
      m.emissiveMapTiling = new pc.Vec2(w / 64, 1);
      m.opacityMapTiling = m.emissiveMapTiling;
      m.emissiveMapOffset = new pc.Vec2((s0.left / 64 + this.time * 0.045) % 1, 0);
      m.opacityMapOffset = m.emissiveMapOffset;
      m.emissive.set(this.duskT[0] * 0.6 + 0.4, this.duskT[1] * 0.6 + 0.3, this.duskT[2] * 0.6 + 0.3);
      m.opacity = (0.75 - 0.45 * night) * (s0.flooding ? 0.4 : 1);
      m.update();
    }
  }

  // The god's coming and going: a column of blue light, a burst of sparks, a wash over the frame.
  flash(x, big = true) {
    this.flashAt = [x, groundHeight(x)];
    this.flashT = big ? 0.75 : 0.35;
    this.flashBig = big;
    this.pulse = big ? 0.5 : 0.15;
    this.emit('spark', x, groundHeight(x) + 9, big ? 46 : 14);
    if (big) this.emit('rise', x, groundHeight(x) + 4, 24);
  }

  // One-off disaster effects, triggered by simulation events.
  erupt(big) {
    this.shake = big ? 2.2 : 1.2;
    const [x, y] = this.crater;
    this.emit('lava', x, y, big ? 60 : 30);
    this.emit('plume', x, y + 4, 20);
  }
  tornado(side) {
    const low = side === 'low';
    this.twister = { x: low ? 270 : 960, x1: low ? 780 : 1460, t: 0 };
  }
  landslide() {
    this.shake = Math.max(this.shake, 0.7);
    for (let i = 0; i < 40; i++) this.emit('debris', 800 + vrand() * 150, groundHeight(800 + i * 3) + 6);
  }

  setTint(r, g, b, a) {
    Object.assign(this.tint, { r, g, b, ta: a });
  }
  toScreen(x, y) {
    const v = this.viewRect;
    return v ? [(x - v.x0) * v.zoom, (v.y1 - y) * v.zoom] : [0, 0];
  }
  baseZoom() {
    const canvas = this.app.graphicsDevice.canvas;
    const ch = canvas.clientHeight || 720;
    const cw = canvas.clientWidth || 1280;
    // Whole pixels on a desktop; on a phone, a half step so at least 260 units of valley fit across.
    const raw = Math.min(ch / 250, cw / 260);
    return raw >= 1.75 ? Math.max(2, Math.round(raw)) : 1.5;
  }
}
