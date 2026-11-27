#!/usr/bin/env python3
"""Grid text for the backdrop layers: python3 backdrop.py sky|far|mid|water0|water1
Prints a klad grid (legend, blank line, rows) for art/paint/backdrop.sh to pipe into `grid`.
Everything is seeded, so every run gives the same pixels."""
import math, random, sys


def canvas(w, h, ch='.'):
    return [[ch] * w for _ in range(h)]


def emit(legend, px):
    out = [f'{k} = {v}' for k, v in legend.items()] + ['']
    out += [''.join(row) for row in px]
    sys.stdout.write('\n'.join(out) + '\n')


# ---- sky: five even bands; where two meet, the rows alternate once each way -------------------
def sky():
    W, H = 4, 128
    bounds = [26, 52, 78, 104]          # first row of bands 2..5
    rows = []
    for y in range(H):
        band = sum(y >= b for b in bounds)
        for i, b in enumerate(bounds):
            if y == b - 2: band = i + 1   # one row of the next band early
            if y == b + 1: band = i       # one row of the last band late
        rows.append(['abcde'[band]] * W)
    emit({'a': 'sky-1', 'b': 'sky-2', 'c': 'sky-3', 'd': 'sky-4', 'e': 'sky-5'}, rows)


# ---- far: the mountain range ---------------------------------------------------------------
def slope_run(rng, n, slopes, first):
    """Cumulative drop per column away from a summit: straight stretches of a few even slopes."""
    off = [0]
    seg = 0
    while len(off) <= n:
        s = rng.choice(first if seg == 0 else slopes)
        L = rng.randint(5, 10) if seg == 0 else rng.randint(10, 38)
        base = off[-1]
        for i in range(1, L + 1):
            off.append(base + int(i * s))
        seg += 1
    return off


def far():
    W, H = 2048, 260
    rng = random.Random(1420)
    px = canvas(W, H)
    BACK = dict(lit='3', shade='2', slopes=[0.34, 0.5, 0.5, 0.67, 0.67, 1.0], first=[1.0, 1.0, 1.5])
    TWIN = dict(lit='3', shade='2', slopes=[0.67, 1.0, 1.0, 0.5], first=[2.0])
    FRONT = dict(lit='2', shade='1', slopes=[0.25, 0.34, 0.34, 0.5, 0.5], first=[0.5, 0.67])

    peaks = []
    x = -70
    while x < W + 120:                      # the back range
        x += rng.randint(100, 185)
        if abs(x - 1420) < 95: continue
        peaks.append((rng.randint(92, 132), x, BACK))
    peaks.append((56, 1407, TWIN))          # the notched twin peak
    peaks.append((67, 1435, TWIN))
    back = sorted(peaks, key=lambda p: p[0])            # tallest is farthest: drawn first
    front = []
    x = -90
    while x < W + 150:                      # foothills in front
        x += rng.randint(90, 200)
        front.append((rng.randint(158, 196), x, FRONT))
    front.sort(key=lambda p: p[0])

    for py, cx, kind in back + front:
        n = 700
        left = slope_run(rng, n, kind['slopes'], kind['first'])
        right = slope_run(rng, n, kind['slopes'], kind['first'])
        # the ridge between the lit and the shaded face zigzags down, leaning right
        ridge, rx, lean = [], cx, True
        while len(ridge) < H:
            if lean:
                for _ in range(rng.randint(3, 9)): rx += 1; ridge.append(rx)
            else:
                for i in range(rng.randint(4, 12)): rx -= i % 2; ridge.append(rx)
            lean = not lean
        snow = py < 106
        cap = (40 if kind is TWIN else rng.randint(16, 23)) if snow else 0
        period = rng.choice([10, 12, 14])
        phase = rng.randint(0, 13)
        own = set()
        for i in range(-n, n + 1):
            xx = cx + i
            if not 0 <= xx < W: continue
            top = py + (left[-i] if i < 0 else right[i])
            # snow line: a level edge cut into teeth
            u = (xx + phase) % period
            tooth = abs(u - period // 2)
            line = py + cap - tooth - abs(i) // 6
            for y in range(top, H):
                lit = xx < ridge[y - py]
                if y < line:
                    px[y][xx] = 's' if lit else '3'
                else:
                    px[y][xx] = kind['lit'] if lit else kind['shade']
                    if lit: own.add((xx, y))
        # a few ravines on the lit face: thin lines falling down and to the left
        for _ in range(2 if kind is not FRONT else 1):
            i = -rng.randint(20, 150)
            xx = cx + i
            y = py + left[-i] + rng.randint(10, 30)
            n_rows = rng.randint(16, 30)
            for k in range(n_rows):
                wide = 1 if k < n_rows // 3 else 2 if k < 2 * n_rows // 3 else 3
                for d in range(wide):
                    if (xx + d, y) in own and (xx + d, y - 3) in own: px[y][xx + d] = kind['shade']
                y += 1
                if k % 2: xx -= 1
    emit({'1': 'far-1', '2': 'far-2', '3': 'far-3', 's': 'snow'}, px)


# ---- mid: rolling hills, the river bend, tree clumps ------------------------------------------
def mid():
    W, H = 2048, 150
    rng = random.Random(520)
    px = canvas(W, H)

    def hump(cx, w, top, base=H + 30):
        def f(x):
            u = (x - cx) / w
            if abs(u) >= 1: return base
            return base - (base - top) * 0.5 * (1 + math.cos(math.pi * u))
        return f

    hills = []
    # back hills, placed so that a saddle sits at x = 520 for the river to come out of
    for cx, w, top in [(520, 420, 66), (1150, 420, 78), (1750, 420, 74), (2000, 400, 76), (-40, 380, 74),
                       (60, 300, 70), (330, 250, 57), (700, 270, 60), (1010, 280, 72), (1290, 300, 58),
                       (1600, 290, 66), (1880, 280, 59), (2100, 260, 68)]:
        hills.append(hump(cx, w, top))
    # nearer, lower swells
    x = -150
    while x < W + 200:
        x += rng.randint(170, 330)
        hills.append(hump(x, rng.randint(240, 380), rng.randint(84, 108)))

    for f in hills:
        tops = [min(H + 40, int(round(f(x)))) for x in range(-100, W + 100)]
        t = lambda x: tops[x + 100]
        for x in range(W):
            top = max(55, t(x))
            lit = t(x - 16) + 2         # the same hill shifted right and down: a crescent of light
            dark = t(x + 70) - 6       # ... and the shaded flank on the right
            for y in range(top, H):
                px[y][x] = '3' if y < lit else '1' if y < dark else '2'
    for x in range(W):                  # a low swell behind them all, so the skyline never breaks
        top = int(round(89 + 4 * math.sin(x * 0.011 + 1) + 2 * math.sin(x * 0.027)))
        for y in range(top, H):
            if px[y][x] == '.': px[y][x] = '2'

    # the river: out of the saddle at x = 520, a wide swing left, then back toward the bottom edge
    y0 = next(y for y in range(H) if px[y][520] != '.') + 3
    keys = [(0.0, 520), (0.12, 556), (0.64, 104), (1.0, 185)]

    def centre(y):
        t = min(1.0, max(0.0, (y - y0) / (H - 1 - y0)))
        for (t0, a), (t1, b) in zip(keys, keys[1:]):
            if t <= t1:
                u = (t - t0) / (t1 - t0)
                return a + (b - a) * u * u * (3 - 2 * u), t
        return keys[-1][1], t

    water = {}
    for y in range(y0, H):
        (c0, t), (c1, _), (c2, _) = centre(y), centre(y + 1), centre(y - 1)
        w = 3 + t * t * 127
        lo = int(round(min(c0, c1, c2) - w / 2))
        hi = int(round(max(c0, c1, c2) + w / 2))
        water[y] = (lo, hi)
        for x in range(max(0, lo), min(W, hi + 1)):
            px[y][x] = 'x'
    for y, (lo, hi) in water.items():   # the far bank throws a dark edge on the water
        for x in range(max(0, lo), min(W, hi + 1)):
            if px[y - 1][x] not in 'wxyz' and hi - lo > 5: px[y][x] = 'w'
    for y in range(y0 + 30, H - 1, 3):  # a few pale glints where the river is wide
        lo, hi = water[y]
        for _ in range((hi - lo) // 40 + 1):
            x = rng.randint(lo + 6, max(lo + 7, hi - 18))
            L = rng.randint(5, 11)
            if all(px[yy][xx] == 'x' for xx in range(x - 2, x + L + 2) for yy in (y - 1, y, y + 1)):
                for xx in range(x, x + L): px[y][xx] = 'y'

    # small dark tree clumps
    CLUMPS = [['.##..', '####.', '#####', '.###.'],
              ['..##..', '.####.', '######', '######', '.####.'],
              ['.###...##.', '#####.####', '##########', '.########.'],
              ['.##.', '####', '####']]
    placed = 0
    while placed < 70:
        if placed % 3 == 0: gx, gy = rng.randint(20, W - 30), rng.randint(64, H - 10)
        shape = rng.choice(CLUMPS)
        x = gx + rng.randint(-14, 14)
        y = gy + rng.randint(-3, 3)
        cells = [(x + i, y + j) for j, row in enumerate(shape) for i, c in enumerate(row) if c == '#']
        around = [(x + i, y + j) for j in range(-2, len(shape) + 2) for i in range(-2, len(shape[0]) + 2)]
        if all(px[b][a] in '23' for a, b in around):
            for a, b in cells: px[b][a] = '1'
            placed += 1
    emit({'1': 'mid-1', '2': 'mid-2', '3': 'mid-3', 'w': 'water-1', 'x': 'water-2', 'y': 'water-3'}, px)


# ---- water0 / water1: the foreground river's surface, tiling left to right --------------------
def water(frame):
    W, H = 64, 64
    rng = random.Random(64)
    px = canvas(W, H, 'b')
    px[0] = ['d'] * W
    dashes = []                                   # (x, y, length, colour, drift)
    for x, L in [(3, 6), (19, 4), (30, 7), (47, 5)]: dashes.append((x, 1, L, 'd', 3))
    for x, L in [(11, 5), (38, 6), (57, 4)]: dashes.append((x, 3, L, 'c', 3))
    for y in range(6, 22, 4):                     # paler ripples near the surface
        x = rng.randint(0, 20)
        while x < W - 4:
            dashes.append((x, y, rng.randint(5, 9), 'c', 4))
            x += rng.randint(22, 34)
    for y in range(24, 62, 5):                    # darker ripples lower down
        x = rng.randint(0, 24)
        while x < W - 4:
            dashes.append((x, y, rng.randint(6, 10), 'a', 4))
            x += rng.randint(25, 38)
    for x, y, L, c, drift in dashes:
        x += drift * frame
        for i in range(L): px[y][(x + i) % W] = c
        if L >= 7 and y > 4:                      # the longer ones are two rows thick in the middle
            for i in range(2, L - 2): px[y + 1][(x + i + frame) % W] = c
    emit({'a': 'water-1', 'b': 'water-2', 'c': 'water-3', 'd': 'water-4'}, px)


if __name__ == '__main__':
    name = sys.argv[1]
    {'sky': sky, 'far': far, 'mid': mid, 'water0': lambda: water(0), 'water1': lambda: water(1)}[name]()
