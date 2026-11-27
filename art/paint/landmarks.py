#!/usr/bin/env python3
"""Grid text for the large landmark sprites: python3 landmarks.py <name>  (piped to `grid` by landmarks.sh).

Each sprite is worked out here as a grid of palette names and printed in the form `klad pixel --grid`
reads: legend lines, a blank line, the rows. Nothing here draws a pixel itself; klad does, bound to the
palette. All randomness comes from the seeded generator below, so every run gives the same picture.
"""
import math
import sys


class Rng:
    """A small fixed generator, so the pictures do not depend on the Python version."""

    def __init__(self, seed):
        self.s = seed & 0x7FFFFFFF or 1

    def f(self):
        self.s = (self.s * 1103515245 + 12345) & 0x7FFFFFFF
        return (self.s >> 8) / float(1 << 23)

    def i(self, a, b):
        return a + int(self.f() * (b - a + 1))

    def chance(self, p):
        return self.f() < p

    def pick(self, seq):
        return seq[int(self.f() * len(seq))]


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.p = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[y][x]
        return None

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def paint_over(self, x, y, c):
        """Colour a pixel only where something is already drawn."""
        if self.get(x, y) is not None:
            self.set(x, y, c)

    def emit(self):
        chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        names = sorted({c for row in self.p for c in row if c})
        key = {n: chars[k] for k, n in enumerate(names)}
        out = ['%s = %s' % (key[n], n) for n in names]
        out.append('')
        for row in self.p:
            out.append(''.join(key[c] if c else '.' for c in row))
        return '\n'.join(out) + '\n'


STONE = ['stone-1', 'stone-2', 'stone-3', 'stone-4']
DARKSTONE = ['stone-1', 'stone-1', 'stone-2', 'stone-3']
PLASTER = ['wall-1', 'wall-2', 'wall-3', 'wall-4']
LEAF = ['leaf-2', 'leaf-3', 'leaf-4']
GRASS = ['grass-2', 'grass-3', 'grass-4']
WILD = ['leaf-1', 'leaf-2', 'leaf-3']
SCRUB = ['grass-1', 'grass-2', 'grass-3']
THATCH = ['thatch-1', 'thatch-2', 'thatch-3', 'thatch-4']
TILE = ['cloth-1', 'cloth-1', 'cloth-2', 'cloth-3']


# ---- foliage --------------------------------------------------------------------------------

def blob(c, cx, cy, rx, ry, ramp):
    """A round clump of leaves lit from the top left: dark, middle, light."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            if dx * dx + dy * dy > 1.0:
                continue
            lx, ly = dx + 0.45, dy + 0.5
            if lx * lx + ly * ly < 0.42:
                col = ramp[2]
            elif dx * 0.7 + dy > 0.55:
                col = ramp[0]
            else:
                col = ramp[1]
            c.set(x, y, col)


def dome(c, x0, w, base, h, ramp):
    """A hedge or bush sitting on row `base` (its lowest row): a flat-bottomed mound."""
    for k in range(w):
        dx = (k + 0.5 - w / 2.0) / (w / 2.0)
        hh = max(1, int(round(h * math.sqrt(max(0.0, 1 - dx * dx * 0.85)))))
        for j in range(hh):
            y = base - j
            top = j >= hh - 1 - (1 if h >= 5 else 0)
            if top and dx < 0.35:
                col = ramp[2]
            elif dx > 0.45 or (j == 0 and h >= 3 and dx > -0.2):
                col = ramp[0]
            else:
                col = ramp[1]
            c.set(x0 + k, y, col)


def tree(c, x, base, h, r, ramp, trunk='wood-2'):
    """A small tree standing on row `base`, `h` pixels tall in all."""
    rx = max(2.5, h * 0.32)
    ry = max(2.5, h * 0.36)
    for y in range(base - int(h * 0.45), base + 1):
        c.set(x, y, trunk)
        c.set(x + 1, y, 'wood-1')
    blob(c, x + 0.5, base - h + ry + 0.5, rx, ry, ramp)


def creeper(c, x, y, length, r, ramp, only_on_wall=True):
    """A hanging strand two pixels wide that wanders a little, with leafy knots."""
    for k in range(length):
        if k and k % 4 == 0:
            x += r.pick([-1, 0, 0, 1])
        for dx in (0, 1):
            if only_on_wall and c.get(x + dx, y + k) is None:
                continue
            c.set(x + dx, y + k, ramp[1] if dx == 0 else ramp[0])
        if k % 5 == 2:
            for dx, dy in ((-1, 0), (-1, 1), (0, 0)):
                if not only_on_wall or c.get(x + dx, y + k + dy) is not None:
                    c.set(x + dx, y + k + dy, ramp[2])


def garden(c, r, x0, x1, y, ruin, tall):
    """Greenery along a ledge whose top row is `y`, between x0 and x1. `tall` is how often a tree stands."""
    x = x0 + r.i(0, 3)
    while x < x1 - 3:
        room = x1 - x
        kind = r.f()
        if ruin:
            ramp = r.pick([WILD, WILD, SCRUB])
            if kind < tall and room >= 9:
                h = r.i(10, 17)
                tree(c, x + 4, y - 1, h, r, ramp)
                x += r.i(9, 13)
            elif kind < tall + 0.5:
                w = min(room, r.i(8, 17))
                dome(c, x, w, y, r.i(4, 8), ramp)
                if r.chance(0.55):
                    creeper(c, x + r.i(1, max(1, w - 3)), y + 1, r.i(5, 13), r, ramp)
                x += w - r.i(0, 2)
            else:
                x += r.i(4, 12)
        else:
            ramp = r.pick([LEAF, GRASS])
            if kind < tall and room >= 8:
                tree(c, x + 3, y - 1, r.i(8, 11), r, ramp)
                x += r.i(8, 10)
            elif kind < 0.52:
                w = min(room, r.i(7, 14))
                dome(c, x, w, y, r.i(3, 4), ramp)       # a clipped hedge, spilling one row over the edge
                if w >= 9 and r.chance(0.45):
                    fx = x + r.i(2, w - 5)
                    col = r.pick(['cloth-3', 'lamp-1', 'snow'])
                    c.set(fx, y - 2, col)
                    c.set(fx + 1, y - 2, col)
                x += w + r.i(1, 4)
            elif kind < 0.8:
                w = min(room, r.i(5, 8))
                dome(c, x, w, y - 1, r.i(4, 6), ramp)
                x += w + r.i(1, 3)
            else:
                x += r.i(3, 7)


def rubble(c, r, x0, w, base, h, ramp):
    """A heap of fallen stone on row `base`."""
    for k in range(w):
        dx = (k + 0.5 - w / 2.0) / (w / 2.0)
        hh = int(round(h * (1 - dx * dx))) + (1 if (k // 3) % 2 else 0)
        for j in range(max(1, hh)):
            block = ((k // 3) + (j // 2) * 2) % 3
            col = ramp[3] if (j >= hh - 1 and dx < 0.2) else (ramp[1] if block == 0 or dx > 0.5 else ramp[2])
            c.set(x0 + k, base - j, col)


# ---- stone buildings ------------------------------------------------------------------------

def wall(c, x, y, w, h, ramp):
    """A flat stone front: lit top and left edge, shaded right edge."""
    c.rect(x, y, w, h, ramp[2])
    c.rect(x, y, w, 1, ramp[3])
    c.rect(x, y, 1, h, ramp[3])
    c.rect(x + w - 2, y + 1, 2, h - 1, ramp[1])


def masonry(c, r, x, y, w, h, ramp, n):
    """A few chunky blocks standing out of the wall; never over a window."""
    for _ in range(n):
        bw, bh = r.i(3, 5), r.i(1, 2)
        bx, by = r.i(x + 2, max(x + 2, x + w - bw - 3)), r.i(y + 2, max(y + 2, y + h - bh - 2))
        col = ramp[3] if r.chance(0.5) else ramp[1]
        if all(c.get(xx, yy) == ramp[2] for xx in range(bx - 1, bx + bw + 1) for yy in range(by - 1, by + bh + 1)):
            c.rect(bx, by, bw, bh, col)


def window(c, x, y, w, h, lit, ruin, arch=False):
    if ruin:
        col, col2 = 'ink', 'ink'
    elif lit:
        col, col2 = 'lamp-1', 'lamp-2'
    else:
        col, col2 = 'trou-1', 'trou-1'
    c.rect(x, y, w, h, col)
    if lit and not ruin and w >= 3 and h >= 4:
        c.rect(x, y, w - 1, 2, col2)          # the brighter upper pane
    if arch and w >= 4:
        c.set(x, y, None if False else c.get(x - 1, y))
        c.set(x + w - 1, y, c.get(x + w, y))


def pitched_roof(c, x, y, w, h, ramp):
    """A hipped roof seen from the front; `y` is the row of its eave, it rises `h` rows."""
    for j in range(h):
        inset = j - 1                         # the eave overhangs by one pixel
        x0, x1 = x + inset, x + w - inset
        if x1 - x0 < 4:
            break
        yy = y - j
        for xx in range(x0, x1):
            if j == 0:
                col = ramp[0]
            elif xx - x0 < 2 or j == h - 1:
                col = ramp[3]
            elif x1 - xx <= 2 + j // 2:
                col = ramp[1]
            else:
                col = ramp[2]
            c.set(xx, yy, col)
    # courses: a few short darker runs, staggered
    for j in range(2, h - 1, 2):
        for xx in range(x + j + 3 + (j % 4), x + w - j - 6, 9):
            c.rect(xx, y - j, 3, 1, ramp[1])


def city_building(c, r, d, x, w, storeys, sh, ramp, roof, ruin):
    H = c.h
    body = storeys * sh + 3
    top = H - body
    wall(c, x, top, w, body, ramp)
    # windows
    n = max(1, (w - 5) // 7)
    start = x + (w - (n * 7 - 4)) // 2
    for s in range(storeys):
        wy = top + 4 + s * sh
        for k in range(n):
            wx = start + k * 7
            if s == storeys - 1 and k == n // 2:
                c.rect(wx - 1, H - 9, 5, 9, ramp[1])      # door surround
                c.rect(wx, H - 8, 3, 8, 'ink' if ruin else 'wood-2')
                if not ruin:
                    c.rect(wx + 2, H - 8, 1, 8, 'wood-1')
                continue
            lit = d.chance(0.72)
            window(c, wx, wy, 3, 4, lit, ruin)
            c.rect(wx - 1, wy + 4, 5, 1, ramp[1])          # sill
    masonry(c, d, x, top, w, body, ramp, 2 + w // 14)

    if ruin:
        return top
    if roof == 'thatch':
        pitched_roof(c, x, top, w, min(top - 1, d.i(7, 10)), THATCH)
    elif roof == 'tile':
        hgt = min(top - 1, d.i(8, 12))
        pitched_roof(c, x, top, w, hgt, TILE)
        cx = x + d.i(5, w - 9)
        c.rect(cx, top - hgt - 1, 3, 5, 'stone-2')
        c.rect(cx, top - hgt - 1, 3, 1, 'stone-4')
    elif roof == 'garden':
        c.rect(x, top - 1, w, 1, ramp[3])
        garden(c, d, x + 1, x + w - 1, top - 1, False, 0.16)
    elif roof == 'parapet':
        for xx in range(x, x + w - 2, 5):
            c.rect(xx, top - 2, 3, 2, ramp[2])
            c.rect(xx, top - 2, 3, 1, ramp[3])
    else:  # a plain cornice and a chimney
        c.rect(x - 1, top - 1, w + 2, 2, ramp[3])
        c.rect(x + w - 1, top, 2, 1, ramp[1])
        cx = x + d.i(3, w - 7)
        c.rect(cx, top - 6, 4, 5, ramp[2])
        c.rect(cx, top - 6, 4, 1, ramp[3])
        c.rect(cx + 3, top - 5, 1, 4, ramp[1])
    return top


def city(ruin):
    W, H = 400, 84
    c = Canvas(W, H)
    lay = Rng(4107)                     # the layout: the same town in both states
    d = Rng(977 if ruin else 311)       # decoration and damage
    x = 3
    last = 0
    plots = []
    while x < W - 4:
        w = lay.i(22, 44)
        if W - 3 - (x + w) < 20:
            w = W - 3 - x
        storeys = lay.i(2, 5)
        if storeys == last:
            storeys = 2 + (storeys - 1) % 4
        last = storeys
        sh = lay.i(11, 13)
        ramp = lay.pick([STONE, STONE, DARKSTONE, STONE, PLASTER, DARKSTONE])
        roof = lay.pick(['thatch', 'tile', 'garden', 'parapet', 'cornice', 'garden', 'tile', 'thatch'])
        plots.append((x, w, storeys, sh, ramp, roof))
        x += w
    for (x, w, storeys, sh, ramp, roof) in plots:
        top = city_building(c, lay, d, x, w, storeys, sh, ramp, roof, ruin)
        if not ruin:
            continue
        body = H - top
        # break the top: a stepped bite, deeper on one side
        fallen = d.chance(0.22)
        depth = body - d.i(8, 14) if fallen else d.i(3, max(4, int(body * 0.45)))
        side = d.pick([-1, 1])
        lvl = d.i(0, 3)
        cols = list(range(x, x + w))
        if side < 0:
            cols.reverse()
        k = 0
        cut = {}
        while k < w:
            run = d.i(3, 7)
            for q in range(k, min(w, k + run)):
                cut[cols[q]] = lvl
            k += run
            lvl = max(0, min(depth, lvl + d.i(-2, 6) + (depth // 6)))
        for xx in range(x, x + w):
            for yy in range(0, top + cut[xx]):
                c.set(xx, yy, None)
            if cut[xx] > 0 and c.get(xx, top + cut[xx]) is not None:
                c.set(xx, top + cut[xx], ramp[3])          # the broken edge catches the light
        if fallen:
            rubble(c, d, x + 2, w - 4, H - 1, d.i(5, 9), ramp)
            if d.chance(0.7):
                tree(c, x + d.i(5, w - 8), H - 4, d.i(12, 18), d, WILD)
        # what grows on it now
        for _ in range(1 + w // 16):
            cx = d.i(x + 2, x + w - 4)
            cy = top + cut.get(cx, 0)
            creeper(c, cx, cy, d.i(8, 22), d, d.pick([WILD, WILD, SCRUB]))
        if not fallen and d.chance(0.65):
            bx = d.i(x + 1, x + w - 10)
            by = top + max(cut.get(bx + q, 0) for q in range(8))
            dome(c, bx, d.i(6, 9), by, d.i(3, 5), d.pick([WILD, SCRUB]))
        if roof in ('thatch', 'tile') and not fallen and d.chance(0.5):
            # a couple of bare rafters still standing
            lo = min(range(x, x + w), key=lambda q: cut[q])
            if cut[lo] == 0:
                for j in range(1, 7):
                    c.set(lo + (j if lo < x + w // 2 else -j), top - j, 'wood-1')
                    c.set(lo + (j if lo < x + w // 2 else -j), top - j + 1, 'wood-2')
    return c


# ---- the Hold -------------------------------------------------------------------------------

def hold(ruin):
    W, H = 440, 156
    c = Canvas(W, H)
    r = Rng(1000)                       # windows and gardens
    d = Rng(52 if ruin else 51)
    T, th = 7, 18
    L = [4 + 34 * i for i in range(T)]
    R = [436 - 22 * i for i in range(T)]
    Y = [H - (i + 1) * th for i in range(T)]          # top row of each tier
    ramp = STONE
    tx = L[6] + 56                                         # the tower, on the top tier

    # which columns of the upper tiers have fallen, and how far down (rows from the tier top)
    def fall(i, x):
        if not ruin:
            return 0
        if i == 6:
            if x >= L[6] + 52:
                return th
            if x >= L[6] + 38:
                return 4 + ((x - L[6] - 38) // 4) * 4
            if x < L[6] + 12:
                return 3 + (2 if (x // 5) % 2 else 0)
            return 0
        if i == 5:
            if x >= R[5] - 40:
                return min(th, 5 + ((x - R[5] + 40) // 5) * 5)
            if L[5] + 2 <= x < L[5] + 16:
                return 4 if (x // 4) % 2 else 7
            return 0
        if i == 4:
            if x >= R[4] - 30:
                return min(12, 3 + ((x - R[4] + 30) // 6) * 4)
            return 0
        if i == 3 and L[3] + 40 <= x < L[3] + 58:
            return 3 if x < L[3] + 47 else 6
        return 0

    # the tower and its beacon, behind the top tier's garden
    if not ruin:
        c.rect(tx, 11, 6, Y[6] - 11, 'stone-3')
        c.rect(tx, 11, 1, Y[6] - 11, 'stone-4')
        c.rect(tx + 4, 11, 2, Y[6] - 11, 'stone-2')
        c.rect(tx + 2, 16, 2, 3, 'lamp-1')
        c.rect(tx + 2, 23, 2, 3, 'lamp-1')
        c.rect(tx - 2, 9, 10, 2, 'stone-4')            # the gallery
        c.rect(tx + 6, 10, 2, 1, 'stone-2')
        c.rect(tx - 2, 8, 10, 1, 'grain-3')
        # the lantern: a bright core in a diamond of light
        for j, (a, b) in enumerate([(2, 3), (1, 4), (0, 5), (0, 5), (1, 4), (1, 4), (2, 3)]):
            for xx in range(tx + a - 1, tx + b + 2):
                c.set(xx, 1 + j, 'lamp-1')
        c.rect(tx + 1, 2, 4, 5, 'lamp-2')
        c.rect(tx + 2, 1, 2, 1, 'lamp-2')
        c.rect(tx + 2, 3, 2, 3, 'snow')
        c.rect(tx - 4, 4, 2, 1, 'lamp-1')              # short rays
        c.rect(tx + 8, 4, 2, 1, 'lamp-1')
        c.rect(tx + 2, 0, 2, 1, 'lamp-1')
        c.rect(tx, 7, 1, 1, 'grain-2')
        c.rect(tx + 5, 7, 1, 1, 'grain-2')
    else:
        # a broken stump stands on what is left of the top tier
        sx = L[6] + 30
        c.rect(sx, 20, 6, Y[6] - 20, 'stone-3')
        c.rect(sx, 20, 1, Y[6] - 20, 'stone-4')
        c.rect(sx + 4, 22, 2, Y[6] - 22, 'stone-2')
        c.rect(sx + 3, 20, 3, 2, None)
        c.rect(sx + 5, 22, 1, 2, None)
        c.rect(sx + 2, 25, 2, 3, 'ink')

    for i in range(T - 1, -1, -1):
        x0, x1, y = L[i], R[i], Y[i]
        wall(c, x0, y, x1 - x0, th, ramp)
        c.rect(x0, y + 1, x1 - x0 - 2, 1, ramp[3])     # a coping two rows deep
        c.rect(x1 - 3, y + 2, 1, th - 2, ramp[1])
        if i == 6 and not ruin:
            c.rect(x0, y, x1 - x0, 1, 'grain-3')       # a gilded cornice crowns the house
            c.rect(x1 - 2, y, 2, 1, 'grain-2')

        # buttresses: a lit edge, a face, and the shadow they throw to the right
        bays = list(range(x0 + 12 + (i % 2) * 6, x1 - 10, 34))
        for b in bays:
            if i == 0 and 140 < b < 182:
                continue
            c.rect(b, y + 2, 1, th - 2, ramp[3])
            c.rect(b + 1, y + 2, 2, th - 2, ramp[2])
            c.rect(b + 3, y + 2, 1, th - 2, ramp[1])
            c.rect(b - 1, y + th - 6, 1, 6, ramp[3])   # the foot is a pixel wider each side
            c.rect(b, y + th - 6, 1, 6, ramp[2])
            c.rect(b + 4, y + th - 6, 1, 6, ramp[1])
            c.rect(b + 3, y + th - 6, 1, 6, ramp[2])

        # windows, a different rhythm on alternate tiers
        edges = [x0 + 2] + [b for b in bays] + [x1 - 4]
        for a, b in zip(edges, edges[1:]):
            lo, hi = a + 6, b - 3
            if hi - lo < 4:
                continue
            if i == 0:
                # the foot: an arcade of deep arches, lamps burning inside
                for wx in range(lo + 1, hi - 6, 11):
                    if 138 < wx < 180:
                        continue
                    lit = r.chance(0.75) and not ruin
                    c.rect(wx, y + 6, 7, 12, 'stone-1')
                    c.rect(wx + 1, y + 5, 5, 1, 'stone-1')
                    c.rect(wx + 1, y + 7, 5, 11, 'ink' if ruin else ('lamp-1' if lit else 'trou-1'))
                    c.rect(wx + 2, y + 6, 3, 1, 'ink' if ruin else ('lamp-1' if lit else 'trou-1'))
                    if lit:
                        c.rect(wx + 2, y + 7, 3, 4, 'lamp-2')
                        c.rect(wx + 1, y + 14, 5, 4, 'grain-2')
            elif i % 2 == 1:
                for wx in range(lo, hi - 1, 6):
                    for wy in (y + 5, y + 11):
                        window(c, wx, wy, 2, 3, r.chance(0.82), ruin)
            else:
                for wx in range(lo + 1, hi - 3, 8):
                    lit = r.chance(0.85)
                    window(c, wx, y + 6, 4, 8, lit, ruin)
                    c.rect(wx + 1, y + 5, 2, 1, 'ink' if ruin else ('lamp-1' if lit else 'trou-1'))
                    c.rect(wx - 1, y + 14, 6, 1, ramp[1])
        masonry(c, d, x0 + 2, y + 2, x1 - x0 - 6, th - 3, ramp, (x1 - x0) // 22)

        # banners on the two highest fronts
        if not ruin and i in (6, 4):
            for b in bays[1:-1:2] if i == 4 else bays[:]:
                if all(c.get(b + 6 + q, y + 4 + p) == ramp[2] for q in range(-1, 4) for p in range(0, 9)):
                    c.rect(b + 6, y + 4, 3, 8, 'cloth-2')
                    c.rect(b + 8, y + 4, 1, 8, 'cloth-1')
                    c.rect(b + 6, y + 4, 3, 1, 'grain-3')
                    c.set(b + 7, y + 11, ramp[2])

        # the stair up the face of this tier from the ledge below, climbing to the right
        if i >= 1:
            sx = x0 + 4
            broken = ruin and i in (3, 5, 6)
            for k in range(th):
                if broken and 6 <= k < 12:
                    continue
                yy = Y[i - 1] - 1 - k
                c.rect(sx + k, yy, 3, 1, ramp[3])
                c.rect(sx + k + 1, yy + 1, 3, 2, ramp[1])
                c.rect(sx + k + 2, yy + 3, 2, 1, ramp[0])

        # what has fallen
        if ruin:
            for xx in range(x0, x1):
                f = fall(i, xx)
                if f:
                    for yy in range(y - 12, y + f):
                        c.set(xx, yy, None)
                    if f < th and c.get(xx, y + f) is not None:
                        c.set(xx, y + f, ramp[3])
            if i == 6:
                rubble(c, d, L[6] + 54, 34, Y[5] - 1, 6, ramp)
            if i == 5:
                rubble(c, d, R[5] - 12, 28, Y[4] - 1, 5, ramp)
                rubble(c, d, L[5] - 16, 14, Y[4] - 1, 3, ramp)
            if i == 4:
                rubble(c, d, R[4] - 12, 20, Y[3] - 1, 4, ramp)
            # cracks: short stepped runs of the darkest stone
            for _ in range(2 + (x1 - x0) // 90):
                cx, cy = d.i(x0 + 6, x1 - 10), y + d.i(3, 6)
                for k in range(d.i(5, 9)):
                    if c.get(cx, cy + k) == ramp[2]:
                        c.set(cx, cy + k, ramp[0])
                    if k % 3 == 2:
                        cx += d.pick([-1, 1])

        # the garden on this tier's ledge: low along the wall behind it, taller on the open ends
        nxt_l = L[i + 1] if i + 1 < T else x1
        nxt_r = R[i + 1] if i + 1 < T else x0
        if i + 1 < T:
            garden(c, r, x0 + 1, nxt_l - 1, y, ruin, 0.3 if ruin else 0.2)
            garden(c, r, nxt_l + 24, nxt_r - 1, y, ruin, 0.1 if ruin else 0.0)
            garden(c, r, nxt_r + 1, x1 - 1, y, ruin, 0.3 if ruin else 0.2)
        else:
            if ruin:
                garden(c, r, L[6] + 12, L[6] + 38, y, True, 0.3)
            else:
                garden(c, r, x0 + 1, tx - 3, y, False, 0.12)
                garden(c, r, tx + 9, x1 - 1, y, False, 0.12)

    # pennants on the open right-hand corners
    if not ruin:
        for i in (1, 3, 5):
            px = R[i] - 4
            c.rect(px, Y[i] - 11, 1, 11, 'wood-2')
            c.rect(px - 5, Y[i] - 11, 5, 3, 'cloth-2')
            c.rect(px - 5, Y[i] - 9, 3, 1, 'cloth-1')
            c.rect(px - 5, Y[i] - 10, 1, 1, None)

    # the vault door at the foot, x 150 to 176
    y = Y[0]
    c.rect(149, y - 1, 28, 2, 'stone-4')               # lintel
    c.rect(150, y + 1, 26, th - 1, 'stone-2')
    c.rect(150, y + 1, 1, th - 1, 'stone-4')
    c.rect(174, y + 1, 2, th - 1, 'stone-1')
    c.rect(175, y - 1, 2, 2, 'stone-2')
    door = 'ink' if ruin else 'grain-2'
    for j, (a, b) in enumerate([(157, 168), (155, 170), (154, 171)]):
        c.rect(a, y + 3 + j, b - a + 1, 1, door)
    c.rect(153, y + 6, 20, th - 6, door)
    if not ruin:
        c.rect(163, y + 3, 10, th - 3, 'grain-1')       # the right leaf, in shade
        for j, (a, b) in enumerate([(157, 168), (155, 170), (154, 171)]):
            for xx in range(153, 173):
                if (xx < a or xx > b) and c.get(xx, y + 3 + j) == 'grain-1':
                    c.set(xx, y + 3 + j, 'stone-2')
        c.rect(153, y + 6, 1, th - 6, 'grain-3')
        c.rect(155, y + 15, 16, 1, 'grain-1')           # a band across the foot of the leaves
        # the seed emblem: a gold drop on a dark roundel
        for j, (a, b) in enumerate([(160, 165), (159, 166), (158, 167), (158, 167), (158, 167), (158, 167), (159, 166), (160, 165)]):
            c.rect(a, y + 6 + j, b - a + 1, 1, 'wood-1')
        seed = ['..hh..', '.hHhg.', 'hHhhgg', 'hhhhgg', 'hhhggg', '.hggg.']
        for j, row in enumerate(seed):
            for k, ch in enumerate(row):
                if ch != '.':
                    c.set(160 + k, y + 7 + j, {'h': 'grain-4', 'H': 'lamp-2', 'g': 'grain-3'}[ch])
    else:
        c.rect(153, y + 6, 3, th - 6, 'trou-1')         # a little light falls in at the left
        c.rect(170, y + 5, 3, th - 5, 'wood-1')         # one leaf hangs open, tarnished
        c.rect(172, y + 5, 1, th - 5, 'soil-2')
        creeper(c, 158, y - 1, 9, d, WILD)
        creeper(c, 167, y - 1, 6, d, WILD)
    # steps up to the door
    c.rect(151, H - 2, 24, 2, 'stone-4')
    c.rect(151, H - 1, 24, 1, 'stone-3')
    c.rect(173, H - 2, 2, 2, 'stone-2')
    if ruin:
        dome(c, 147, 8, H - 1, 4, SCRUB)
        tree(c, 120, H - 1, 17, d, WILD)
        tree(c, 388, H - 1, 15, d, WILD)
        dome(c, 396, 12, H - 1, 5, WILD)
        dome(c, 60, 14, H - 1, 5, WILD)
        dome(c, 236, 11, H - 1, 4, SCRUB)
    return c


# ---- the volcano ----------------------------------------------------------------------------

def volcano(hot):
    W, H = 320, 190
    c = Canvas(W, H)

    def top(x):
        dx = x - 160
        a = abs(dx)
        rim = 10 if dx < 0 else 12
        if a <= 14:
            return rim + (18 - rim) * (1 - (a / 14.0) ** 2.2)        # the crater notch
        t = (a - 14) / 146.0
        y = rim + (t ** 0.74) * (188 - rim)
        y += (1.6 * math.sin(x * 0.21) + 2.2 * math.sin(x * 0.067 + 1.0)) * min(1.0, t * 3)
        y -= 6.0 * math.exp(-((x - 238) / 13.0) ** 2)              # a shoulder on the right flank
        y -= 3.0 * math.exp(-((x - 62) / 18.0) ** 2)
        return y

    tops = [int(round(top(x))) for x in range(W)]
    for x in range(W):
        for y in range(max(0, tops[x]), H):
            c.set(x, y, 'vol-2')

    streams = []
    if hot:
        for u0, y0, length, ph in ((-0.42, 14, 78, 0.0), (0.08, 20, 118, 2.0), (0.52, 16, 62, 4.0)):
            streams.append((u0, y0, length, ph))

    for y in range(H):
        xs = [x for x in range(W) if c.p[y][x]]
        if not xs:
            continue
        xl, xr = xs[0], xs[-1]
        xm, half = (xl + xr) / 2.0, max(4.0, (xr - xl) / 2.0)
        if y < 22:
            xm, half = 160.0, max(half, 18.0)
        k = min(1.0, half / 70.0)
        for x in xs:
            u = (x - xm) / half
            # ridges and gullies fan out from the summit: the tone follows the angle, not the row
            v = u + 0.24 * math.sin(8.5 * u + 0.9 * math.sin(y * 0.04)) + 0.11 * k * math.sin(19 * u + 2 + y * 0.012)
            if hot and y < 90:
                v += 0.28 * (1 - y / 90.0)                           # ash darkens the upper cone
            tone = 'vol-3' if v < -0.3 else ('vol-2' if v < 0.32 else 'vol-1')
            # snow: a cap with fingers running down the gullies, lower on the lit side
            line = 52 - 10 * u + 13 * math.sin(7 * u + 0.6) + 7 * math.sin(15 * u + 2.1)
            if hot:
                line = line - 44 if u < -0.25 else -1
            depth = y - tops[x]
            if y < line and not (hot and depth < 5):
                tone = 'snow' if v < 0.18 else 'far-3'
            c.set(x, y, tone)

    # the crater: the inner lip shows as a dark band under the notch (or a glowing one)
    for x in range(160 - 15, 160 + 16):
        t = tops[x]
        a = abs(x - 160)
        if hot:
            c.set(x, t, 'lava-3')
            c.set(x, t + 1, 'lava-3' if a < 11 else 'lava-2')
            c.set(x, t + 2, 'lava-2')
            if a < 12:
                c.set(x, t + 3, 'lava-2' if a < 8 else 'lava-1')
            if a < 9:
                c.set(x, t + 4, 'lava-1')
        elif a <= 12:
            c.set(x, t, 'vol-1' if x < 163 else 'vol-2')
            c.set(x, t + 1, 'vol-1' if x < 163 else 'vol-2')
            if a < 9 and x < 163:
                c.set(x, t + 2, 'vol-1')

    # lava: streams that follow the gullies down the upper flanks
    for (u0, y0, length, ph) in streams:
        prev = None
        for j in range(length):
            y = y0 + j
            xs = [x for x in range(W) if c.p[y][x]]
            xl, xr = xs[0], xs[-1]
            xm, half = (xl + xr) / 2.0, (xr - xl) / 2.0
            if y < 22:
                xm, half = 160.0, 20.0
            x = int(round(xm + (u0 + 0.05 * math.sin(j * 0.09 + ph)) * half))
            f = j / float(length)
            a, b = (x, x) if prev is None else (min(prev, x), max(prev, x))
            for xx in range(a, b + 1):
                if f < 0.45:
                    cols = ['lava-2', 'lava-3', 'lava-3', 'lava-1']
                elif f < 0.8:
                    cols = ['lava-2', 'lava-2', 'lava-1']
                else:
                    cols = ['lava-1', 'lava-1']
                for q, col in enumerate(cols):
                    c.paint_over(xx + q, y, col)
            prev = x
    return c


# ---- the tornado ----------------------------------------------------------------------------

def funnel():
    W, H = 40, 110
    c = Canvas(W, H)
    tones = ['storm-3', 'storm-2', 'storm-1']
    for y in range(H):
        t = y / float(H - 1)
        w = int(round(32 * (1 - t) ** 1.6 + 4))
        cx = 20 + 3.0 * math.sin(y * 0.085) * min(1.0, t * 1.6)
        xl = int(round(cx - w / 2.0))
        for k in range(w):
            u = (k + 0.5) / w
            th = math.acos(max(-1.0, min(1.0, 1 - 2 * u)))            # the angle round the funnel
            base = 0 if u < 0.24 else (1 if u < 0.68 else 2)
            pitch = 5.0 + 5.0 * (w / 36.0)
            band = (y - pitch * th + 300) % (9 + 3 * (w / 36.0))
            if band < 3.2:
                base = min(2, base + 1)
            elif u >= 0.68 and band > 6.5 and w > 8:
                base = 1                                              # a paler band shows on the dark side
            c.set(xl + k, y, tones[base])
    return c


# ---- the landslide --------------------------------------------------------------------------

def slide():
    W, H = 150, 46
    c = Canvas(W, H)
    r = Rng(88)
    tops, bots = [], []
    for x in range(W):
        f = x / float(W - 1)
        yc = 43.5 - 41.0 * f
        th = 1.2 + 9.0 * math.sin(math.pi * f) ** 0.8
        lump = (1.2 * math.sin(x * 0.45) + 1.6 * math.sin(x * 0.16 + 1)) * (th / 10.0)
        t, b = int(round(yc - th + lump)), int(round(yc + th * 0.5 + 1))
        tops.append(t)
        bots.append(b)
        for y in range(t, b + 1):
            d = (y - t) / float(max(1, b - t))
            # flow lines run with the slope: lit on top, dark underneath
            s = d + 0.14 * math.sin((x + 3.6 * y) * 0.21)
            col = 'soil-3' if s < 0.3 else ('soil-2' if s < 0.78 else 'soil-1')
            c.set(x, y, col)
    # clods of paler earth on the surface
    for x0 in range(10, W - 12, 13):
        x = x0 + r.i(0, 5)
        y = tops[x] + 1
        if tops[x] >= 0:
            c.rect(x, y, 3, 1, 'soil-4')
            c.rect(x + 1, y + 1, 3, 1, 'soil-4')
    # rocks: more and larger towards the foot of the slide
    placed = []
    tries = 0
    while len(placed) < 17 and tries < 400:
        tries += 1
        f = r.f() ** 1.4
        x = int(4 + f * (W - 14))
        big = 1 - f
        w = 3 + int(r.f() * (2 + 4 * big))
        h = max(2, int(w * 0.7))
        span = bots[x] - tops[x] - h
        if span < 1:
            continue
        y = tops[x] + r.i(0, span)
        if any(abs(x - px) < (w + pw) // 2 + 3 and abs(y - py) < (h + ph) // 2 + 2 for px, py, pw, ph in placed):
            continue
        placed.append((x, y, w, h))
        for j in range(h):
            for k in range(w):
                corner = (j in (0, h - 1)) and (k in (0, w - 1)) and w >= 4
                if corner:
                    continue
                if j == 0 or (k == 0 and j < h - 1):
                    col = 'stone-4'
                elif j == h - 1 or k == w - 1:
                    col = 'stone-1'
                elif k + j < (w + h) // 2 - 1:
                    col = 'stone-3'
                else:
                    col = 'stone-2'
                if c.get(x + k, y + j) is not None or j < h - 1:
                    c.set(x + k, y + j, col)
        for k in range(1, w + 1):                                    # the shadow it throws on the earth
            c.paint_over(x + k, y + h, 'soil-1')
    return c


SPRITES = {
    'city': lambda: city(False),
    'city_ruin': lambda: city(True),
    'hold': lambda: hold(False),
    'hold_ruin': lambda: hold(True),
    'volcano': lambda: volcano(False),
    'volcano_hot': lambda: volcano(True),
    'funnel': funnel,
    'slide': slide,
}
SIZES = {'city': '400x84', 'city_ruin': '400x84', 'hold': '440x156', 'hold_ruin': '440x156',
         'volcano': '320x190', 'volcano_hot': '320x190', 'funnel': '40x110', 'slide': '150x46'}

if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in SPRITES:
        sys.exit('usage: landmarks.py <%s>' % '|'.join(SPRITES))
    sys.stdout.write(SPRITES[sys.argv[1]]().emit())
