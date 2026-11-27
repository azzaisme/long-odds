// PlayCanvas world view. Reads simulation state; never writes it.
import * as pc from 'playcanvas';
import { buildSprites, SHIRTS } from './sprites.js';
import { WORLD, PLOT_SITES, HOUSE_SLOTS, FOREST_STANDS, groundHeight, waterEdge, waterLeft } from '../sim/world.js';
import { yearOf } from '../sim/sim.js';

const Z = { volcano: -52, civic: -17, sky: -60, far: -50, cloud: -45, mid: -40, tree: -22, terrain: -20, house: -14, store: -12, plot: -8, growth: -7, actor: -4, badge: -3, water: 2, fx: 4, tint: 8 };
const vrand = Math.random; // visual-only randomness

export class View {
  constructor(canvas) {
    const app = (this.app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false, alpha: false } }));
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());
    app.scene.ambientLight = new pc.Color(1, 1, 1);

    this.mats = {};
    this.sizes = {};
    const canvases = buildSprites();
    for (const [name, c] of Object.entries(canvases)) {
      const tex = new pc.Texture(app.graphicsDevice, {
        width: c.width, height: c.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
        minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
        addressU: name.startsWith('water') || name === 'floodline' ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      tex.setSource(c);
      const m = new pc.StandardMaterial();
      m.useLighting = false;
      m.useSkybox = false;
      m.useFog = false;
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(1, 1, 1);
      m.emissiveMap = tex;
      m.opacityMap = tex;
      m.opacityMapChannel = 'a';
      m.cull = pc.CULLFACE_NONE;
      if (name === 'beam' || name === 'aura' || name.startsWith('water') || name === 'smoke' || name === 'floodline' || name === 'cloud') {
        m.blendType = pc.BLEND_NORMAL;
        m.opacity = name === 'beam' ? 0.85 : name === 'aura' ? 0.55 : name.startsWith('water') ? 0.72 : name === 'cloud' ? 0.8 : 0.6;
        m.depthWrite = false;
      } else m.alphaTest = 0.5;
      m.update();
      this.mats[name] = m;
      this.sizes[name] = [c.width, c.height];
    }
    this.tintMat = new pc.StandardMaterial();
    Object.assign(this.tintMat, { useLighting: false, useSkybox: false, useFog: false, blendType: pc.BLEND_NORMAL, depthWrite: false, depthTest: false, opacity: 0 });
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

    // The two forests: three trees to a stand, which thin out and turn to stumps as it is cut.
    const kinds = ['oak', 'fir', 'oak2'];
    this.stands = FOREST_STANDS.map((f) => {
      const trees = [-13, 0, 13].map((dx, i) => {
        const x = f.x + dx + ((f.id * 7 + i * 3) % 5) - 2;
        const e = this.sprite(kinds[(f.id + i) % 3], x, groundHeight(x) - 1, Z.tree + 1 + ((f.id + i) % 3) * 0.2);
        e._x = x;
        e._kind = kinds[(f.id + i) % 3];
        return e;
      });
      return { f, trees, key: '' };
    });
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
      const n = f.cleared ? -1 : f.wood >= 7.5 ? 3 : f.wood >= 4.5 ? 2 : f.wood >= 2 ? 1 : 0;
      const key = `${n}|${f.wood > 0 && f.wood < 2 ? 's' : ''}`;
      if (key === v.key) continue;
      v.key = key;
      v.trees.forEach((e, i) => {
        e.enabled = n >= 0;
        if (n < 0) return;
        // Trees go from the outside in; a stand that is growing back shows saplings among the stumps.
        const standing = i === 1 ? n >= 1 : i === 0 ? n >= 2 : n >= 3;
        this.setTex(e, standing ? e._kind : f.wood > 0 && i === 1 ? 'sapling' : 'stump');
        this.place(e, e._x, groundHeight(e._x) - 1);
      });
    }
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
  addActor(id, skin, x) {
    const e = this.sprite(`${skin}_idle`, x, groundHeight(x), Z.actor - (id % 7) * 0.1);
    const badge = this.sprite('seed', x, groundHeight(x) + 14, Z.badge);
    badge.enabled = false;
    const a = { id, skin, e, badge, x, dir: 1, moving: false, controlled: false, target: null, wait: vrand() * 3, home: x, leaving: 0, knows: false, phase: vrand() * 10 };
    this.actors.set(id, a);
    return a;
  }
  removeActor(id) {
    const a = this.actors.get(id);
    if (!a) return;
    a.e.destroy();
    a.badge.destroy();
    this.actors.delete(id);
  }
  clearActors() {
    for (const id of [...this.actors.keys()]) this.removeActor(id);
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
      if (!a.controlled) {
        if (a.target === null) {
          a.wait -= dt;
          if (a.wait <= 0 && a.id >= 0) {
            const r = vrand();
            // Trained households keep the practice up: they make the walk to the ridge store.
            if (a.knows && st.stores.ridge.built && r < 0.3) (a.target = WORLD.ridgeStoreX + 14), (a.carrying = true);
            else if (built.length && r < 0.75) a.target = PLOT_SITES[built[Math.floor(vrand() * built.length)].id].x + (vrand() * 30 - 15);
            if (a.target !== null && a.target < WORLD.walkMin && !this.deck) a.target = WORLD.granaryX;
            else if (r < 0.88) a.target = WORLD.granaryX + (vrand() * 30 - 15);
            else a.target = a.home + (vrand() * 40 - 20);
            if (opts.gather !== undefined && vrand() < 0.3) a.target = opts.gather + (vrand() * 200 - 100);
            a.target = Math.max(this.deck ? 8 : WORLD.walkMin, Math.min(a.leaving ? WORLD.x1 : 1462, a.target));
          }
        } else {
          const d = a.target - a.x;
          const stepx = Math.sign(d) * Math.min(Math.abs(d), speed * dt * (a.leaving ? 1.6 : 1));
          a.x += stepx;
          a.dir = Math.sign(d) || a.dir;
          a.moving = true;
          if (Math.abs(d) < 1) {
            a.target = null;
            a.moving = false;
            a.carrying = false;
            a.wait = 1.5 + vrand() * 5;
          }
        }
      }
      a.phase += dt * (a.moving ? 9 : 0);
      const frame = a.moving ? (Math.floor(a.phase) % 2 ? 'walk1' : 'walk2') : 'idle';
      this.setTex(a.e, `${a.skin}_${frame}`, a.dir < 0);
      const y = this.surface(a.x);
      this.place(a.e, Math.round(a.x), Math.round(y) - 0);
      if (a.badge.enabled) this.place(a.badge, Math.round(a.x), Math.round(y) + 14 + Math.round(Math.sin(this.time * 3 + a.id) * 0.6));
    }
  }

  setMarkers(active, other) {
    this.marker.enabled = !!active;
    this.markerDim.enabled = !!other;
    const bob = Math.round(Math.sin(this.time * 5) * 1);
    this.aura.enabled = !!active;
    if (active) this.aura.setLocalPosition(Math.round(active.x), this.surface(active.x) + 7 + bob * 0.5, Z.actor - 1);
    if (active) this.place(this.marker, Math.round(active.x), this.surface(active.x) + (active.knows ? 22 : 16) + bob);
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
      else if (kind === 'seed') Object.assign(f, { x: x + vrand() * 16 - 8, vx: vrand() * 40 - 20, vy: 30 + vrand() * 30, life: 1.1, tex: 'seed', g: -90 });
      this.setTex(e, f.tex);
      this.fx.push(f);
    }
  }
  updateFx(dt, view) {
    if (this.weather === 'snow') for (let i = 0; i < 2; i++) this.emit('snow', view.x0 + vrand() * (view.x1 - view.x0), view.y1 + 4);
    else if (this.weather === 'ash') for (let i = 0; i < 3; i++) this.emit('ash', view.x0 + vrand() * (view.x1 - view.x0 + 40), view.y1 + 4);
    else if (this.weather === 'rain') for (let i = 0; i < 3; i++) this.emit('rain', view.x0 + vrand() * (view.x1 - view.x0 + 60), view.y1 + 4);
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
    const edge = waterEdge(w.level);
    const wl = waterLeft(w.level);
    const depth = w.level + 100;
    this.setTex(this.waterEnt, Math.floor(this.time * 2.5) % 2 ? 'water0' : 'water1');
    this.waterEnt.setLocalScale(edge - wl, 1, depth);
    this.waterEnt.setLocalPosition((edge + wl) / 2, -100 + depth / 2, Z.water);
    const wm = this.waterEnt.render.meshInstances[0].material;
    for (const m of [this.mats.water0, this.mats.water1]) {
      m.emissiveMapTiling = new pc.Vec2((edge - wl) / 64, 1);
      m.opacityMapTiling = m.emissiveMapTiling;
      m.update();
    }
    void wm;
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
    this.updateFx(dt, this.viewRect);
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
    const ch = this.app.graphicsDevice.canvas.clientHeight || 720;
    return Math.max(2, Math.round(ch / 250));
  }
}
