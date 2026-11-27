#!/usr/bin/env bash
# Fields (seven states on two soils), trees, stumps, reeds and the cloud.
# The pixels are worked out by the Python below (shapes placed by hand, nothing random), written
# as text grids, and drawn with lib.sh's `new` and `grid`.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/nature.XXXXXX")"
trap 'rm -rf "$T"' EXIT

python3 - "$T" <<'PY'
import sys, os, math
out = sys.argv[1]
CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
index = []


class S:
    """One sprite: a dictionary of pixels, each a palette name."""

    def __init__(self, name, w, h):
        self.name, self.w, self.h, self.p = name, w, h, {}

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            if c is None:
                self.p.pop((x, y), None)
            else:
                self.p[(x, y)] = c

    def get(self, x, y):
        return self.p.get((x, y))

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, c)

    def cells(self, c, pts):
        for x, y in pts:
            self.set(x, y, c)

    def row(self, y, x, text, key):
        """Write a run of characters starting at x; key maps characters to colours, '.' skips."""
        for i, ch in enumerate(text):
            if ch != '.':
                self.set(x + i, y, key[ch])

    def save(self):
        names = sorted(set(self.p.values()))
        ch = {n: CH[i] for i, n in enumerate(names)}
        lines = ['%s = %s' % (ch[n], n) for n in names] + ['']
        for y in range(self.h):
            lines.append(''.join(ch[self.p[(x, y)]] if (x, y) in self.p else '.' for x in range(self.w)))
        open(os.path.join(out, self.name + '.grid'), 'w').write('\n'.join(lines) + '\n')
        index.append('%s %dx%d' % (self.name, self.w, self.h))


# ============================================================================================
# Fields: 46 x 12, the ground surface on row 8, rows 8 to 11 in the ground.
# ============================================================================================
W = 46
SOIL = {  # dark, base, light
    'low': ('soil-1', 'soil-2', 'soil-3'),
    'ridge': ('soil-3', 'soil-4', 'wall-3'),
}


def posts(s, left=4, right=4):
    """A wooden post at each end, from its top row down into the soil."""
    for x, top in ((0, left), (W - 1, right)):
        s.set(x, top, 'wood-4')
        for y in range(top + 1, 10):
            s.set(x, y, 'wood-3' if x == 0 else 'wood-2')
        s.set(x, 9, 'wood-1')


def stones(s, spots):
    """Pale stones in the ridge soil: (x, y, width), lit on top, shaded underneath."""
    for x, y, w in spots:
        for i in range(w):
            s.set(x + i, y, 'stone-4' if i == 0 else 'stone-3')
            s.set(x + i, y + 1, 'stone-2')


def furrows(s, kind):
    """Tilled soil seen from the side: crests every four pixels with a dark trough between."""
    D, M, L = SOIL[kind]
    for x in range(W):
        k = (x + 1) % 4
        s.set(x, 8, L if k in (0, 1) else M if k == 2 else D)
        s.set(x, 9, D if k == 3 else M)
        s.set(x, 10, D if (x // 5) % 3 == 1 and x % 5 < 4 else M)
        s.set(x, 11, M if (x // 4) % 4 == 2 else D)
    if kind == 'ridge':
        stones(s, [(6, 10, 2), (21, 9, 2), (33, 10, 3), (41, 9, 1)])
        # thin soil: pale subsoil showing along the bottom
        for x in (1, 2, 3, 12, 13, 14, 15, 26, 27, 28, 38, 39, 44, 45):
            s.set(x, 11, 'wall-2')


def rough(s, kind, top=9):
    """Untilled soil below the surface, in loose clumps."""
    D, M, L = SOIL[kind]
    pat = {
        9: 'MMMMDDMMMMMMMLLMMMMDDDMMMMMMMMDDMMMMMLLMMMMDDM',
        10: 'MDDDMMMMMDDDDMMMMMMMMMDDDMMMMDDMMMMMMDDDDMMMMM',
        11: 'DDDDDMMMDDDDDDDDMMMMDDDDDDDMMDDDDDDMMMDDDDDDDD',
    }
    key = {'D': D, 'M': M, 'L': L}
    for y in range(top, 12):
        s.row(y, 0, pat[y], key)
    if kind == 'ridge':
        stones(s, [(8, 10, 2), (24, 9, 2), (36, 10, 2)])
        for x in (0, 1, 2, 16, 17, 18, 19, 29, 30, 31, 43, 44, 45):
            s.set(x, 11, 'wall-2')


def f_wild(kind):
    s = S('plot_%s_wild' % kind, W, 12)
    rough(s, kind)
    g = ('grass-1', 'grass-2', 'grass-3', 'grass-4') if kind == 'low' else ('grass-2', 'grass-3', 'grass-4', 'grass-5')
    key = dict(zip('dmlh', g))
    # turf on the surface, with roots reaching one row down
    s.row(8, 0, 'mmllmmmmmllmmmmmmlllmmmmmmmllmmmmmmlllmmmmmmlmm', key)
    s.row(9, 0, 'ddmdd..ddmmddd..dddmdd.dddd..dddmddd..ddddmd.d', key)
    if kind == 'low':   # lush: thick tufts
        s.row(7, 0, '....ll..hl....ll.l...hll...l..ll....hl...ll...', key)
        s.row(6, 0, '....h....l.....h......l.......h......l....h...', key)
    else:               # thin and dry: sparse tufts, bare patches, stones on the surface
        s.row(7, 0, '.....l.......hl..........l.......lh.......l...', key)
        s.row(6, 0, '..............h...................l...........', key)
        D, M, L = SOIL[kind]
        s.row(8, 0, '.......LL..............MLL...........LL.......', {'L': L, 'M': M})
        stones(s, [(19, 7, 2), (29, 7, 1)])
        s.set(19, 8, 'stone-2'), s.set(20, 8, 'stone-2'), s.set(29, 8, 'stone-2')
    # survey stakes: a pale peg with a paler flag, near each end
    for x, fx in ((2, 3), (43, 42)):
        s.cells('fur-4', [(x, 4), (fx, 4), (x, 5)])
        s.cells('wall-3', [(x, 6), (x, 7)])
        s.set(x, 8, 'wall-1')
        s.set(fx, 5, 'wall-3')
    return s


def f_fallow(kind):
    s = S('plot_%s_fallow' % kind, W, 12)
    furrows(s, kind)
    # freshly turned: each crest stands a pixel proud of the ground line
    D, M, L = SOIL[kind]
    for x in range(3, 43, 4):
        s.set(x, 7, L), s.set(x + 1, 7, M)
        s.set(x, 8, M), s.set(x + 1, 8, M)
    # stubble: short cut stalks left in a few furrows
    key = {'a': 'thatch-3', 'b': 'thatch-2', 'c': 'thatch-4'}
    s.row(7, 0, '.....a.......ab..........a.......ba.......a...', key)
    s.row(6, 0, '.....c........c..................c............', key)
    if kind == 'ridge':
        stones(s, [(17, 7, 2)])
        s.set(17, 8, 'stone-2'), s.set(18, 8, 'stone-2')
    posts(s)
    return s


def f_sprout(kind):
    s = S('plot_%s_sprout' % kind, W, 12)
    furrows(s, kind)
    # a young plant on every crest: a stem and two leaves, a few already taller
    for i, x in enumerate(range(3, 43, 4)):
        tall = i % 3 == 1
        s.set(x, 7, 'grass-3')
        s.set(x + 1, 7, 'grass-2')
        s.set(x - 1, 6, 'grass-4')
        s.set(x + 1, 6, 'grass-3')
        if tall:
            s.set(x, 6, 'grass-3')
            s.set(x, 5, 'grass-5')
            s.set(x - 1, 6, None)
            s.set(x - 1, 5, 'grass-4')
        elif i % 3 == 2:
            s.set(x + 2, 5, 'grass-4')
            s.set(x + 1, 6, 'grass-3')
    posts(s)
    return s


def f_ripe(kind):
    s = S('plot_%s_ripe' % kind, W, 12)
    furrows(s, kind)
    # a standing crop: dark stalks low down, heavy pale heads on top at uneven heights
    tops = [1, 0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 1, 1, 0]
    for i, x in enumerate(range(2, 44, 3)):
        t = tops[i]
        for y in range(t, 8):
            for dx in range(3):
                if x + dx > 43:
                    continue
                if y < t + 3:        # the head
                    c = 'grain-4' if (dx == 0 and y <= t + 1) else 'grain-3' if dx < 2 else 'grain-1'
                    if dx == 2 and y == t:
                        c = None      # a notch between heads
                    if dx == 1 and y == t + 2:
                        c = 'grain-2'  # the underside of the head
                elif y < 6:          # leaves and upper stalk
                    c = 'grain-2' if dx == 0 else 'grain-1'
                else:                # stalks in shade
                    c = 'grain-1' if dx != 2 else 'thatch-1'
                s.set(x + dx, y, c)
        s.set(x, t + 3, 'grain-3')   # the head hangs lower on its lit side
        s.set(x, 6, 'grain-2') if i % 2 else None
    s.rect(1, 6, 1, 2, 'grain-1')
    s.rect(1, 3, 1, 3, 'grain-2')
    s.set(44, 7, 'grain-1')
    posts(s)
    return s


def f_damaged(kind):
    s = S('plot_%s_damaged' % kind, W, 12)
    rough(s, kind, top=10)
    key = {'d': 'silt-1', 'm': 'silt-2', 'l': 'silt-3', 'w': 'water-2', 'v': 'water-3', 'u': 'water-4', 'k': 'water-1'}
    # a blanket of silt lying in low drifts, two puddles in its hollows
    s.row(6, 0, '...........................lll................', key)
    s.row(7, 0, '.llllm..........lllllm...lllmmmm.........lllm.', key)
    s.row(8, 0, 'lllmmmmlwuvvwwwlllmmmmmllmmmmmmmmlwwvuvwwllmmm', key)
    s.row(9, 0, 'mmmmmmddmkwwkmmmmmmddmmmmmmdddmmmmmkkwwkmmmmdd', key)
    s.row(10, 0, 'mdd..mmmm.ddmmm..mmmmdd..mmmmmm..ddmmmm..mmmmm', key)
    # driftwood: a stranded log with a snapped branch, and a second stick
    k2 = {'a': 'wood-3', 'b': 'wood-2', 'c': 'wood-1', 'p': 'wall-3'}
    s.row(5, 0, '..............a...............................', k2)
    s.row(6, 0, '...........paaab.aab..........................', k2)
    s.row(7, 0, '...........cbbbbbbc.................abb.......', k2)
    # what is left of the crop: bent stalks
    s.cells('grain-1', [(30, 5), (31, 4), (38, 6)])
    s.cells('grain-2', [(32, 4), (39, 5)])
    posts(s, left=4, right=5)
    s.set(0, 8, 'silt-1'), s.set(45, 8, 'silt-1')
    return s


def f_overgrown(kind):
    s = S('plot_%s_overgrown' % kind, W, 12)
    rough(s, kind)
    lush = kind == 'low'
    key = {'d': 'leaf-1', 'm': 'leaf-2', 'l': 'leaf-3', 'h': 'leaf-4',
           'g': 'grass-2', 'G': 'grass-3', 'y': 'grass-4', 'Y': 'grass-5',
           't': 'thatch-3', 'T': 'thatch-4', 'w': 'wood-2', 'f': 'lamp-1'}
    if lush:  # brambles and saplings in dark heavy clumps, rank grass between
        rows = [
            '..................................hh..........',
            '........lh.......................hlll.........',
            '.......hllm.........Y...........hllllm........',
            '......hlllmm.......y.....hh.....lllmmmm...Y...',
            '..y...lllmmmd..hl..G.Y..hllm....llmmmmd...y...',
            '..G..hllmmmmd.hllm.G.y.hllmmm...lmmmmmd..yG.y.',
            '.yG.ylllmmmmdhllmmdGyG.lllmmmd.ylmmmmdd.yGG.G.',
            '.GGyGlmmmmdddllmmddGGGyllmmmddyGGmmdddGyGGGyG.',
            'gGGGGGmmddddgGmdddgGGGGGmmdddgGGGgdddgGGGGGGGg',
            'gg.ggdd.ggddgg.gddgg.gggdddgg.ggg.gdd.ggg.gggg',
        ]
    else:     # dry and thin: bleached seed stalks, thistles, low thorn, bare ground between
        rows = [
            '..............................................',
            '...........T.......................T..........',
            '...........T.........hh.......T....t..........',
            '.....T.....t..Y.....hllm......T....y...Y......',
            '.....T..Y..y..y.....lllmm..Y..t..y.y...y..T...',
            '..Y..t..y..y.yG..f.hllmmmd.y..y..G.G..yG..T...',
            '..y..y.yG..G.GG.fGfllmmmmd.G.yy.yG.G.yGG.yt...',
            '.yG.yG.GG.yG.GGyGGGlmmmddd.GyGG.GGyG.GGGyGy.y.',
            'gGG.GGgGG.GGgGGGGGGGmmdddgGGGGG.GGGGgGGGGGGgG.',
            'g.g..gg.g..ggg.gg.ggddg.gg.ggg...gg.gg.ggg.g..',
        ]
    for i, r in enumerate(rows):
        s.row(i, 0, r, key)
    if not lush:
        stones(s, [(10, 8, 1), (31, 8, 2)])
    posts(s)
    return s


def f_eroded(kind):
    s = S('plot_%s_eroded' % kind, W, 12)
    D, M, L = SOIL[kind]
    key = {'k': 'water-1', 'w': 'water-2', 'v': 'water-3', 'u': 'water-4', 'D': D, 'M': M, 'L': L,
           'g': 'grass-2', 'G': 'grass-3'}
    # the river where the field was, with the cut bank left at each end
    s.row(7, 0, 'G............................................G', key)
    s.row(8, 0, 'GLwvvuvwwwwvvwwwwwwvuvvwwwwwwvvwwwwwvuvvwwwwLG', key)
    s.row(9, 0, 'MMLwwwwwwkkwwwwwvvwwwwwwwkkkwwwwwvvwwwwwwwwMMM', key)
    s.row(10, 0, 'DMMMkkwwkkkkkkwwwwwkkkkkkkkkkkwwwwkkkkkwwMMMDD', key)
    s.row(11, 0, 'DDMMMkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkMMMDDD', key)
    if kind == 'ridge':   # the stony bed shows through
        stones(s, [(4, 10, 2), (39, 9, 2), (22, 10, 1)])
        s.cells('wall-2', [(0, 11), (1, 11), (44, 11), (45, 11)])
    # reeds standing in the shallows: (x, top row, has a brown head, leaf side)
    reeds = [(6, 3, 1, -1), (8, 5, 0, 1), (11, 2, 1, 1), (17, 5, 0, -1), (24, 4, 1, -1), (26, 2, 0, 1),
             (27, 5, 0, 1), (33, 3, 1, 1), (36, 5, 0, -1), (40, 4, 1, -1)]
    for x, top, head, side in reeds:
        for y in range(top, 9):
            s.set(x, y, 'grass-3' if y < top + 2 else 'grass-2' if y < 7 else 'grass-1')
        if head:
            s.set(x, top, 'wood-3'), s.set(x, top + 1, 'wood-2'), s.set(x, top + 2, 'wood-2')
            s.set(x, top - 1, 'grass-3')
        # a blade bending away from the stalk
        s.set(x + side, top + 3, 'grass-3'), s.set(x + 2 * side, top + 2, 'grass-4')
    return s


for kind in ('low', 'ridge'):
    for f in (f_wild, f_fallow, f_sprout, f_ripe, f_damaged, f_overgrown, f_eroded):
        f(kind).save()

# ============================================================================================
# Trees. Foliage is built from overlapping round clumps, each lit from the top left, drawn from
# the back of the crown to the front so that a clump's lit side sits on its neighbour's shade.
# ============================================================================================


def crown(s, clumps, ramp, cut=(0.42, -0.12, -0.62)):
    """clumps: (centre x, centre y, radius x, radius y, shade offset). ramp: dark to light, 4 steps."""
    leaf = {}
    for cx, cy, rx, ry, off in clumps:
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy > 1 or not (0 <= x < s.w and 0 <= y < s.h):
                    continue
                l = -(dx * 0.62 + dy * 0.78)
                i = 3 if l > cut[0] else 2 if l > cut[1] else 1 if l > cut[2] else 0
                leaf[(x, y)] = max(0, min(3, i + off))
    # the edge away from the light takes a darker step, in place of an outline
    edge = {}
    for (x, y), i in leaf.items():
        if (x + 1, y) not in leaf or (x, y + 1) not in leaf:
            edge[(x, y)] = max(0, min(i, 1) - (1 if (x, y + 1) not in leaf and (x + 1, y) not in leaf else 0))
    leaf.update(edge)
    for (x, y), i in leaf.items():
        s.set(x, y, ramp[i])
    return leaf


def trunk(s, rows, bark=('wood-1', 'wood-2', 'wood-3')):
    """rows: (y, left x, right x) spans; lit on the left edge, shaded on the right third."""
    for y, a, b in rows:
        n = b - a + 1
        for x in range(a, b + 1):
            k = x - a
            c = bark[2] if (k == 0 and n > 2) else bark[0] if k >= n - max(1, n // 3) else bark[1]
            s.set(x, y, c)


def limb(s, pts, c='wood-1'):
    s.cells(c, pts)


LEAF = ('leaf-1', 'leaf-2', 'leaf-3', 'leaf-4')            # deep forest green
YOUNG = ('leaf-2', 'grass-2', 'grass-3', 'grass-4')        # lighter, yellower
FRESH = ('grass-1', 'grass-2', 'grass-3', 'grass-4')


def t_oak():
    # old growth: a broad heavy dome on a thick forked trunk with spreading roots
    s = S('oak', 30, 46)
    trunk(s, [(y, 12, 17) for y in range(24, 40)] + [(40, 11, 17), (41, 11, 18), (42, 10, 18), (43, 10, 19),
                                                     (44, 9, 20), (45, 8, 21)])
    # bark furrows and a knot
    s.cells('wood-1', [(14, 33), (14, 34), (14, 35), (13, 40), (13, 41), (15, 43), (15, 44), (12, 45), (18, 45)])
    s.cells('wood-3', [(13, 36), (13, 37), (11, 43), (10, 44), (9, 45)])
    # limbs reaching out under the crown
    limb(s, [(11, 30), (10, 29), (9, 28), (8, 27), (7, 27), (18, 29), (19, 28), (20, 27), (21, 26), (22, 26)], 'wood-2')
    limb(s, [(11, 31), (10, 30), (9, 29), (18, 30), (19, 29), (20, 28), (21, 27)], 'wood-1')
    crown(s, [
        (15, 14, 12, 11, -1),     # the mass behind everything
        (21, 7, 6.5, 5.5, 0), (9, 8, 7, 6, 0), (15, 5.5, 6, 5, 0),
        (24, 14.5, 5.6, 6, 0), (5.5, 16, 5.3, 6, 0),
        (17, 15, 6.5, 5.5, 0), (10.5, 19, 6, 5, 0),
        (22.5, 22.5, 5.5, 4.5, 0), (15.5, 25, 5, 3.6, -1), (6.5, 24.5, 5, 4, 0),
    ], LEAF)
    # shade under the crown on the trunk
    for x in range(12, 18):
        for y in (29, 30, 31):
            if s.get(x, y) in ('wood-2', 'wood-3'):
                s.set(x, y, 'wood-1')
    return s


def t_oak2():
    # old growth of another habit: tall and open, the crown in separate boughs leaning to the right
    s = S('oak2', 26, 40)
    trunk(s, [(y, 11, 14) for y in range(20, 36)] + [(36, 10, 14), (37, 10, 15), (38, 9, 15), (39, 8, 17)])
    s.cells('wood-1', [(12, 28), (12, 29), (12, 30), (13, 35), (11, 37), (11, 38)])
    s.cells('wood-3', [(11, 31), (11, 32), (9, 39)])
    # a low bough to the left and a long limb up to the right
    limb(s, [(10, 27), (9, 26), (8, 25), (7, 24), (6, 24), (5, 23), (15, 24), (16, 23), (17, 22), (18, 21),
             (19, 20), (20, 19)], 'wood-2')
    limb(s, [(10, 28), (9, 27), (8, 26), (7, 25), (15, 25), (16, 24), (17, 23), (18, 22), (19, 21)], 'wood-1')
    crown(s, [
        (14, 10, 8, 8.5, -1),
        (15.5, 5, 5.5, 4.6, 0), (9, 8, 5.5, 5, 0), (20, 10, 5.4, 5.4, 0),
        (13, 13.5, 5.5, 4.6, 0), (20.5, 17.5, 4.6, 3.6, -1),
        (5.5, 20, 4.8, 3.8, 0), (13, 19.5, 4.2, 3, -1),
    ], YOUNG)
    for x in range(11, 15):
        for y in (22, 23, 24):
            if s.get(x, y) in ('wood-2', 'wood-3'):
                s.set(x, y, 'wood-1')
    return s


def t_tree():
    # the village broadleaf: a round, friendly crown
    s = S('tree', 18, 30)
    trunk(s, [(y, 8, 10) for y in range(16, 27)] + [(27, 7, 10), (28, 7, 11), (29, 6, 12)])
    s.cells('wood-1', [(9, 22), (9, 23)])
    limb(s, [(7, 19), (6, 18), (5, 17), (11, 18), (12, 17), (13, 16)], 'wood-2')
    crown(s, [
        (9, 9.5, 7.5, 8, -1),
        (11.5, 5.5, 5, 4.6, 0), (6, 6.5, 5, 4.8, 0),
        (13, 12, 4.4, 4.6, -1), (4.8, 13, 4.3, 4.4, 0), (9.5, 12.5, 4.6, 4, 0),
        (9, 16.5, 4.5, 2.8, -1),
    ], FRESH)
    for x in range(8, 11):
        for y in (19, 20):
            if s.get(x, y) in ('wood-2', 'wood-3'):
                s.set(x, y, 'wood-1')
    return s


def t_tree2():
    # a smaller broadleaf, a little taller than wide
    s = S('tree2', 14, 24)
    trunk(s, [(y, 6, 7) for y in range(13, 22)] + [(22, 6, 8), (23, 5, 8)])
    s.cells('wood-3', [(6, 18), (6, 19), (6, 20), (6, 21), (5, 23)])
    limb(s, [(5, 15), (4, 14), (8, 15), (9, 14)], 'wood-2')
    crown(s, [
        (7, 7.5, 5.6, 6.6, -1),
        (8.5, 4.5, 4.2, 4, 0), (4.6, 6.5, 4, 4.2, 0),
        (9.6, 10, 3.6, 3.8, -1), (5.2, 11.5, 4, 3.4, 0),
    ], YOUNG)
    for y in (15, 16):
        s.set(7, y, 'wood-1')
    return s


def t_sapling():
    # a whip of a stem with a few sprays of new leaf
    s = S('sapling', 8, 12)
    k = {'h': 'grass-5', 'l': 'grass-4', 'm': 'grass-3', 'd': 'grass-2', 'w': 'wood-2', 'W': 'wood-3', 'k': 'wood-1'}
    rows = [
        '...hl...',
        '..hllm..',
        '.hllmmd.',
        '.llmmdd.',
        '..mdwd..',
        'hl..w.lm',
        'lmd.wlmd',
        '.dd.wmd.',
        '...Ww...',
        '...Ww...',
        '...Ww...',
        '..Wwk...',
    ]
    for i, r in enumerate(rows):
        s.row(i, 0, r, k)
    return s


def conifer(s, cx, tiers, ramp, hi):
    """tiers: (top row, bottom row, half width at top, half width at bottom), drawn top to bottom.
    Each tier is a skirt of boughs: lit on its left, in shade on its right and under the tier above."""
    prev_bottom = -9
    for n, (y0, y1, a, b) in enumerate(tiers):
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            half = int(round(a + (b - a) * t))
            for x in range(cx - half, cx + half):
                r = (x - (cx - half) + 0.5) / (2 * half)
                i = 2 if r < 0.5 else 1 if r < 0.8 else 0
                if y <= prev_bottom and x > cx - half:
                    i = max(0, i - 1)          # shade cast by the tier above
                if x == cx + half - 1:
                    i = 0
                s.set(x, y, ramp[i])
        # drooping tips along the bottom of the skirt
        half = b
        for x in range(cx - half, cx + half):
            k = (x - cx + 40) % 3
            if k == (n % 3):
                s.set(x, y1 + 1, ramp[2] if x < cx - 1 else ramp[0])
        # light catching the top of the bough on the lit side
        if hi == 'auto':
            for y in range(y0 + 1, y1):
                t = (y - y0) / max(1, y1 - y0)
                half = int(round(a + (b - a) * t))
                if n and 0.45 <= t < 0.95:
                    s.set(cx - half + 1, y, ramp[3])
                    if t >= 0.7 and half > 3:
                        s.set(cx - half + 2, y, ramp[3])
            prev_bottom = y1
            continue
        for d in hi.get(n, []):
            s.set(cx + d[0], y0 + d[1], ramp[3])
        prev_bottom = y1


def t_fir():
    # tall, narrow and dark: tight skirts of boughs almost to the ground
    s = S('fir', 16, 40)
    trunk(s, [(y, 7, 8) for y in range(33, 39)] + [(39, 6, 9)])
    s.rect(7, 33, 2, 2, 'wood-1')
    ramp = ('leaf-1', 'leaf-1', 'leaf-2', 'leaf-3')
    s.cells('leaf-2', [(7, 0), (7, 1)])
    s.cells('leaf-1', [(8, 1)])
    conifer(s, 8, [(2, 6, 1, 3), (6, 11, 1, 4), (10, 16, 2, 5), (15, 21, 2, 6), (20, 26, 3, 7), (25, 31, 3, 8),
                   (30, 34, 4, 7)],
            ramp, 'auto')
    return s


def t_pine():
    # the village pine: lighter and looser than the forest fir, with a long bare trunk
    s = S('pine', 12, 26)
    trunk(s, [(y, 5, 6) for y in range(15, 25)] + [(25, 4, 7)])
    s.cells('wood-3', [(5, 20), (5, 21), (5, 22), (5, 23), (5, 24), (4, 25)])
    ramp = ('leaf-1', 'leaf-2', 'leaf-3', 'leaf-4')
    s.cells('leaf-3', [(5, 0), (5, 1)])
    s.cells('leaf-2', [(6, 1)])
    conifer(s, 6, [(2, 5, 1, 3), (5, 9, 1, 4), (9, 13, 2, 5), (13, 18, 2, 6)],
            ramp, {0: [(-1, 1), (-2, 2)], 1: [(-2, 2), (-3, 3)], 2: [(-3, 2), (-4, 3)], 3: [(-3, 2), (-4, 3), (-5, 4)]})
    return s


def t_stump():
    s = S('stump', 14, 6)
    k = {'p': 'wall-4', 'q': 'wall-3', 'r': 'wall-2', 'a': 'wood-3', 'b': 'wood-2', 'c': 'wood-1', 'g': 'grass-2'}
    rows = [
        '..............',
        '.pppqq........',
        'apqrqqc..ppqq.',
        'abbbbcc.apqrqc',
        'abbcbcc.abbbcc',
        'abbbbccgabcbccc'[:14],
    ]
    rows[5] = 'aabbbccc.abbcc'
    rows[4] = '.abbcbc.aabbcc'
    rows[3] = '.abbbbc..pqrqc'
    rows[2] = '.apqrqc..ppqq.'
    rows[1] = '..pppq........'
    for i, r in enumerate(rows):
        s.row(i, 0, r, k)
    return s


def t_reeds():
    s = S('reeds', 10, 10)
    k = {'h': 'grass-4', 'l': 'grass-3', 'm': 'grass-2', 'd': 'grass-1', 'B': 'wood-3', 'b': 'wood-2'}
    rows = [
        '.....l....',
        '..l..B....',
        '..B..b..l.',
        '..b..b.hB.',
        'h.b.hl..b.',
        '.lm..l.lb.',
        '.lm.lm.lm.',
        '..mlmm.mm.',
        '.dmmdmlmd.',
        '.dmddmmdd.',
    ]
    for i, r in enumerate(rows):
        s.row(i, 0, r, k)
    return s


def t_cloud():
    s = S('cloud', 46, 12)
    k = {'a': 'cloud-1', 'b': 'cloud-2'}
    rows = [
        '.................aaaaaa.......................',
        '...............aaaaaaaaaa.....................',
        '..............aaaaaaaaaaaa....aaaaa...........',
        '........aaaa.aaaaaaaaaaaaaa.aaaaaaaaa.........',
        '......aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa........',
        '.....aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaa...',
        '..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'aaaaaaaaaabbaaaaaaaaaaabbbbaaaaaaaaaaabbaaaaaa',
        'aaaaabbbbbbbbbaaaaabbbbbbbbbbaaaabbbbbbbbbaabb',
        '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
        '...bbbbbbbbbbbbbb...bbbbbbbbbbbbbbb..bbbbbb...',
    ]
    for i, r in enumerate(rows):
        s.row(i, 0, r, k)
    return s


for f in (t_tree, t_tree2, t_sapling, t_pine, t_oak, t_oak2, t_fir, t_stump, t_reeds, t_cloud):
    f().save()

open(os.path.join(out, 'index'), 'w').write('\n'.join(index) + '\n')
PY

while read -r name size; do
  new "$name" "$size"
  grid "$name" <"$T/$name.grid"
done <"$T/index"
