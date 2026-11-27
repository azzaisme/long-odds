#!/usr/bin/env bash
# Houses, stores, civic buildings, bridges and the small badges.
# Usage: art/paint/buildings.sh [sprite-name ...]   (no names: paint them all)
# Each sprite is its own drawing, art/sprites/<sprite-name>.klad. The pictures are built by the
# Python below as text grids (shapes, then hand-placed detail) and written with `grid`.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

GRIDS="$(mktemp -d)"
trap 'rm -rf "$GRIDS"' EXIT

python3 - "$GRIDS" "$@" <<'PY'
import math, os, sys

OUT, ONLY = sys.argv[1], sys.argv[2:]
RAMP = {'wood': 4, 'thatch': 4, 'wall': 4, 'stone': 4, 'grass': 5, 'grain': 4, 'soil': 4, 'god': 4, 'silt': 3}
CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'


class C:
    """A canvas of palette names; None is empty."""

    def __init__(s, w, h):
        s.w, s.h = w, h
        s.p = [[None] * w for _ in range(h)]

    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.p[y][x] = c

    def get(s, x, y):
        return s.p[y][x] if 0 <= x < s.w and 0 <= y < s.h else None

    def rect(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                s.set(xx, yy, c)

    def clear(s, x, y, w=1, h=1):
        s.rect(x, y, w, h, None)

    def cells(s, c, *pts):
        for x, y in pts:
            s.set(x, y, c)

    def line(s, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx, sy = (1 if x1 >= x0 else -1), (1 if y1 >= y0 else -1)
        err = dx - dy
        while True:
            s.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                return
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy

    def stamp(s, x, y, legend, rows):
        """A small hand-drawn part: rows of characters, legend maps them to palette names."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '!':
                    s.clear(x + i, y + j)
                elif ch != '.':
                    s.set(x + i, y + j, legend[ch])

    def shade(s, x, y, d, only=None):
        c = s.get(x, y)
        if not c or '-' not in c:
            return
        ramp, n = c.rsplit('-', 1)
        if ramp not in RAMP or (only and ramp != only):
            return
        s.set(x, y, '%s-%d' % (ramp, max(1, min(RAMP[ramp], int(n) + d))))

    def shade_rect(s, x, y, w, h, d, only=None):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                s.shade(xx, yy, d, only)

    def text(s):
        names = []
        for row in s.p:
            for c in row:
                if c and c not in names:
                    names.append(c)
        ch = {n: CHARS[i] for i, n in enumerate(names)}
        legend = ''.join('%s = %s\n' % (ch[n], n) for n in names)
        return legend + '\n' + '\n'.join(''.join(ch[c] if c else '.' for c in row) for row in s.p) + '\n'


SPRITES = {}


def sprite(name, w, h):
    def deco(fn):
        def build():
            c = C(w, h)
            fn(c)
            return c
        SPRITES[name] = build
        return fn
    return deco


# ---- shared materials --------------------------------------------------------------------------

def thatch(c, y0, rows, half0, slope, fresh=True, cx=None):
    """A thatched roof seen from its long side: a rounded hill of straw, lit from the top left."""
    cx = c.w // 2 if cx is None else cx
    for i in range(rows):
        half = min(int(round(half0 + slope * i)), cx)
        x0, x1 = cx - half, cx + half - 1
        turn = cx + int(half * 0.3)
        for x in range(x0, x1 + 1):
            col = 'thatch-3' if x < turn else 'thatch-2'
            if x >= x1 - (1 if i > rows // 2 else 0):
                col = 'thatch-1'
            if i == 0:
                col = 'thatch-4' if x < cx and fresh else 'thatch-3' if x < turn else 'thatch-2'
            if i == rows - 1:
                col = 'thatch-2' if x < turn else 'thatch-1'
            c.set(x, y0 + i, col)
        if fresh and 0 < i < rows - 2:  # the lit shoulder
            for x in range(x0 + 1, x0 + 3 + (i % 2)):
                c.set(x, y0 + i, 'thatch-4')
    # a few straw ends: short dark strokes, staggered
    for i in range(2, rows - 2, 3):
        half = min(int(round(half0 + slope * i)), cx)
        for k, x in enumerate(range(cx - half + 5 + (i % 2) * 2, cx + half - 3, 6)):
            for j in (0, 1):
                c.shade(x, y0 + i + j, -1, 'thatch')


def stone(c, x, y, w, h, cy=4, cx=9):
    """A stone wall: flat mid grey, light along the top, dark at the right and the foot, and a few
    short joints that say 'blocks' without drawing every one."""
    c.rect(x, y, w, h, 'stone-3')
    c.rect(x, y, w, 1, 'stone-4')
    c.rect(x, y + h - 1, w, 1, 'stone-2')
    c.rect(x + w - 1, y, 1, h, 'stone-2')
    n = 0
    for yy in range(y + 2, y + h - 1, cy):
        off = (n * 5) % cx
        for xx in range(x + 1 + off, x + w - 3, cx):
            c.rect(xx, yy, 3, 1, 'stone-2')
            if n % 2 == 0 and xx + 5 < x + w - 2 and yy + 1 < y + h - 1:
                c.rect(xx + 4, yy + 1, 2, 1, 'stone-4')
        n += 1


def tuft(c, x, base, h=2):
    """A clump of weeds standing on row `base`."""
    if h <= 1:
        c.cells('grass-2', (x, base))
        c.cells('grass-4', (x + 1, base))
        return
    for j in range(h):
        c.set(x, base - j, 'grass-2' if j < h - 1 else 'grass-4')
    for j in range(max(1, h - 1)):
        c.set(x + 1, base - j, 'grass-4' if j == h - 2 and h > 2 else 'grass-3' if j else 'grass-2')
    if h >= 3:
        for j in range(h - 2):
            c.set(x - 1, base - j, 'grass-3' if j < h - 3 else 'grass-5')


def planks(c, x0, x1, y, seam=4, phase=0):
    """A plank deck two rows thick, its top on row y."""
    for x in range(x0, x1 + 1):
        k = (x + phase) % seam
        c.set(x, y, 'wood-1' if k == seam - 1 else 'wood-4' if ((x + phase) // seam) % 3 == 0 else 'wood-3')
        c.set(x, y + 1, 'wood-1' if k == seam - 1 else 'wood-2')


# ---- houses, 26x22 -----------------------------------------------------------------------------

def house(c, state):
    fresh = state == 'home'
    # daub wall with a timber post at each corner, on a course of footing stones
    c.rect(3, 10, 20, 12, 'wall-3')
    c.rect(19, 10, 4, 12, 'wall-2')
    c.rect(3, 10, 20, 1, 'wall-1')          # shadow of the eave
    c.rect(19, 11, 4, 1, 'wall-1')
    if fresh:
        c.rect(5, 12, 3, 4, 'wall-4')
        c.cells('wall-4', (5, 16), (6, 16))
    else:                                   # damp and stains
        c.rect(4, 17, 4, 3, 'wall-2')
        c.cells('wall-2', (5, 16), (4, 16), (15, 19), (16, 19), (16, 18), (17, 19))
        c.cells('wall-1', (4, 19), (5, 19), (20, 18), (21, 18), (21, 17))
    c.rect(3, 10, 1, 12, 'wood-3')
    c.rect(22, 10, 1, 12, 'wood-1')
    c.rect(3, 21, 20, 1, 'stone-2')
    for x in (3, 4, 5, 6, 9, 10, 14, 15, 16):
        c.set(x, 21, 'stone-3')
    # door
    c.rect(8, 11, 7, 1, 'wood-1')
    if fresh:
        c.rect(9, 12, 5, 10, 'wood-2')
        c.rect(9, 12, 1, 10, 'wood-3')
        c.rect(13, 12, 1, 10, 'wood-1')
        c.set(12, 17, 'wood-4')
    else:
        c.rect(9, 12, 5, 10, 'ink')
        if state == 'empty':                # the door hangs open
            c.rect(9, 12, 1, 10, 'wood-3')
            c.rect(10, 13, 1, 9, 'wood-1')
    # window
    c.rect(15, 12, 5, 1, 'wood-1')
    c.rect(15, 13, 1, 3, 'wood-1')
    c.rect(19, 13, 1, 3, 'wood-1')
    c.rect(15, 16, 5, 1, 'wood-2')
    if fresh:
        c.rect(16, 13, 3, 3, 'lamp-1')
        c.cells('lamp-2', (16, 13), (17, 13), (16, 14))
    else:
        c.rect(16, 13, 3, 3, 'ink')
    thatch(c, 0, 10, 4, 1, fresh)
    if state == 'empty':
        # thatch gone in two places, a rafter showing
        c.stamp(6, 4, {'t': 'thatch-1', 'w': 'wood-1', 'u': 'thatch-2'}, ['.tt.', 'twtt', '.wtu'])
        c.stamp(16, 6, {'t': 'thatch-1', 'w': 'wood-1'}, ['tt.', 'twt', '.w.'])
        c.clear(24, 9, 2, 1)
        c.clear(23, 8, 1, 1)
        c.set(23, 9, 'thatch-1')
        tuft(c, 1, 21, 3)
        tuft(c, 6, 21, 2)
        tuft(c, 17, 21, 2)
        tuft(c, 24, 21, 3)
    if state == 'ruin':
        # the right half of the roof has fallen in
        edge = [11, 12, 11, 12, 13, 12, 12, 13, 12, 13]
        for y in range(10):
            c.clear(edge[y] + 1, y, 26, 1)
            c.set(edge[y], y, 'thatch-1')
        # the wall under it is broken down: top row of what still stands, by column
        top = {16: 11, 17: 11, 18: 12, 19: 13, 20: 13, 21: 14, 22: 11}
        for x, t in top.items():
            c.clear(x, 10, 1, t - 10)
            c.set(x, t, 'wood-1' if x == 22 else 'wall-4' if x < 19 else 'wall-3')
        c.cells('wall-1', (14, 10), (15, 10))
        c.rect(16, 13, 3, 3, 'ink')
        # bare timbers where the roof was: the hip rafter, one inside it, a purlin across
        c.line(13, 0, 23, 10, 'wood-2')
        c.line(13, 5, 18, 10, 'wood-1')
        c.rect(14, 6, 6, 1, 'wood-1')
        c.cells('wood-2', (12, 0))
        # fallen thatch and wall heaped at the foot
        c.stamp(13, 18, {'t': 'thatch-1', 'u': 'thatch-2', 'v': 'thatch-3', 'w': 'wood-1', 'a': 'wall-1', 'b': 'wall-2'}, [
            '.......vv...',
            '....uvvuut..',
            '.bbuuuuttwtt',
            'abbuuttttttt',
        ])
        c.stamp(7, 12, {'g': 'grass-2', 'G': 'grass-3'}, ['Gg', 'gG', '.g'])   # creeper
        c.stamp(4, 15, {'g': 'grass-2', 'G': 'grass-3'}, ['g.', 'Gg', 'gG'])
        tuft(c, 1, 21, 4)
        tuft(c, 6, 21, 3)
        tuft(c, 11, 21, 2)
        tuft(c, 24, 20, 3)
        c.cells('grass-2', (24, 21), (25, 21))
        c.cells('grass-3', (19, 15), (20, 17))
        c.cells('grass-4', (19, 14))


for st in ('home', 'empty', 'ruin'):
    sprite('house_' + st, 26, 22)(lambda c, st=st: house(c, st))


@sprite('house_rubble', 26, 22)
def _(c):
    L = {'s': 'stone-2', 'S': 'stone-3', 'l': 'stone-4', 'd': 'stone-1', 'a': 'wall-1', 'b': 'wall-2', 'B': 'wall-3',
         'w': 'wood-1', 'W': 'wood-2', 'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4', 't': 'thatch-1'}
    c.stamp(0, 15, L, [
        '..h.......................',
        '..gW...................h..',
        '.hGWBb........h.......hg..',
        '.gGWBbb.....lSg...SS..gGbw',
        'hgGwbbalSS.lSSsg.lSSsBbbaw',
        'gGgwbaaSSsdSSssGlSSssdbaaw',
        'gGsSssdsssdsssdgSsssddssdg',
    ])


# ---- granary, 32x32 ----------------------------------------------------------------------------

@sprite('granary', 32, 32)
def _(c):
    # stilts: two at the back in shadow, then the front ones
    for x in (10, 21):
        c.rect(x, 22, 2, 9, 'wood-1')
    for x in (4, 26):
        c.rect(x, 22, 2, 10, 'wood-2')
        c.rect(x, 22, 1, 10, 'wood-3')
        c.rect(x, 22, 2, 1, 'wood-1')
    c.line(6, 23, 9, 29, 'wood-1')            # braces
    c.line(25, 23, 22, 29, 'wood-1')
    # floor beam
    c.rect(2, 20, 28, 2, 'wood-2')
    c.rect(2, 20, 27, 1, 'wood-4')
    c.rect(29, 20, 1, 2, 'wood-1')
    c.rect(3, 21, 26, 1, 'wood-1')
    # wall: daub panels in a timber frame
    c.rect(4, 10, 24, 10, 'wall-3')
    c.rect(22, 10, 6, 10, 'wall-2')
    c.rect(4, 10, 24, 1, 'wall-1')
    c.rect(22, 11, 6, 1, 'wall-1')
    c.rect(6, 12, 3, 4, 'wall-4')
    c.rect(4, 10, 1, 10, 'wood-3')
    c.rect(27, 10, 1, 10, 'wood-1')
    c.rect(10, 11, 1, 9, 'wood-2')
    c.rect(21, 11, 1, 9, 'wood-2')
    # door with the grain mark
    c.rect(12, 11, 8, 1, 'wood-1')
    c.rect(13, 12, 6, 8, 'wood-2')
    c.rect(13, 12, 1, 8, 'wood-3')
    c.rect(18, 12, 1, 8, 'wood-1')
    c.stamp(14, 13, {'G': 'grain-3', 'H': 'grain-4', 'e': 'grain-2'}, ['.GG.', 'HGGe', 'GGGe', '.ee.'])
    # ladder up to the door
    c.rect(13, 22, 1, 10, 'wood-3')
    c.rect(18, 22, 1, 10, 'wood-2')
    for y in (23, 25, 27, 29):
        c.rect(14, y, 4, 1, 'wood-4')
    thatch(c, 0, 10, 3, 1.45)


@sprite('granary_ruin', 32, 32)
def _(c):
    L = {'w': 'wood-1', 'W': 'wood-2', 'x': 'wood-3', 'X': 'wood-4', 't': 'thatch-1', 'u': 'thatch-2', 'v': 'thatch-3',
         'a': 'wall-1', 'b': 'wall-2', 'B': 'wall-3', 'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4', 'k': 'grass-5', 'i': 'ink'}
    c.stamp(0, 16, L, [
        '................................',
        '....xW..........................',
        '....xW..........................',
        '....xW....................k.....',
        '....xWXX..................g.....',
        '....xWWWXXX.........w....hg.....',
        '....xW.wWWWXXX......wW...gG.....',
        '..h.xW....wWWWXXX...wW....g.xW..',
        '..g.xW..Bb...wWWWXXXwW....g.xW..',
        '.hg.xW.BBbbvv...wWWWXXX..vvuxW..',
        '.gGhxWbBbbvvuuuvvu.wWWWXXuuttWh.',
        'hgGgxWabbuuuuttuuuttuwwWWWuttWg.',
        'gGggxwaabuuttttttttttttwwwtttwgh',
        'gGggwwaaatttttiittttttttttttwwgg',
        '.gG.ww.............ww.......ww.g',
        '....ww.............ww.......ww..',
    ])


# ---- seed store on the ridge, 24x18 ------------------------------------------------------------

@sprite('store_site', 24, 18)
def _(c):
    L = {'s': 'stone-2', 'S': 'stone-3', 'l': 'stone-4', 'd': 'stone-1', 'w': 'wood-1', 'W': 'wood-2', 'x': 'wood-3',
         'f': 'fur-4', 'F': 'cloud-2', 'G': 'grain-3', 'g': 'grass-2', 'h': 'grass-4'}
    c.stamp(0, 4, L, [
        '...........x............',
        '...........xfffff.......',
        '...........xffGff.......',
        '...........xFfffF.......',
        '...........xW..F........',
        '...........xW...........',
        '...........xW...........',
        '...........xW...........',
        '...........xW...........',
        '...........xW...........',
        '...........xW...........',
        '.llS..llS..xW.llS..llS..',
        '.SSs..SSs.hxW.SSs..SSs..',
        '.SssllSsslSwWlSssllSssg.',
    ])


def store_walls(c):
    stone(c, 2, 7, 20, 11, 3, 7)
    c.rect(2, 7, 20, 1, 'stone-2')            # shadow of the eave
    c.rect(2, 8, 1, 10, 'stone-4')
    c.rect(18, 8, 4, 10, 'stone-2')
    c.rect(21, 8, 1, 10, 'stone-1')
    c.cells('stone-1', (19, 11), (20, 11), (18, 15), (19, 15))
    c.cells('stone-4', (4, 9), (5, 9), (4, 13), (5, 13), (6, 13))


@sprite('store', 24, 18)
def _(c):
    store_walls(c)
    c.rect(8, 9, 8, 1, 'wood-1')
    c.rect(9, 10, 6, 8, 'wood-2')
    c.rect(9, 10, 1, 8, 'wood-3')
    c.rect(14, 10, 1, 8, 'wood-1')
    c.stamp(10, 12, {'G': 'grain-3', 'H': 'grain-4', 'e': 'grain-1'}, ['.GG.', 'HGGe', 'GGGe', '.ee.'])
    thatch(c, 0, 7, 3, 1.5)


@sprite('store_ruin', 24, 18)
def _(c):
    store_walls(c)
    c.rect(9, 10, 6, 8, 'ink')
    # what is left standing, by column (the row of its broken top); 18 is nothing
    top = [18, 18, 9, 8, 8, 9, 10, 10, 11, 14, 16, 17, 17, 16, 15, 13, 12, 12, 13, 13, 14, 16, 18, 18]
    for x, t in enumerate(top):
        c.clear(x, 0, 1, t)
        if t < 18:
            c.set(x, t, 'stone-4' if x < 18 else 'stone-3')
    # the doorway is a breach now, with fallen stone in it
    c.stamp(9, 14, {'s': 'stone-2', 'S': 'stone-3', 'l': 'stone-4', 'd': 'stone-1', 't': 'thatch-1', 'u': 'thatch-2'}, [
        'l.....',
        'Ss..lS',
        'Ssdutt',
        'sdlSsd',
    ])
    c.stamp(3, 10, {'g': 'grass-2', 'G': 'grass-3'}, ['Gg', 'gG', '.g'])
    tuft(c, 0, 17, 3)
    tuft(c, 7, 17, 2)
    tuft(c, 22, 17, 4)
    c.cells('grass-3', (16, 11), (17, 11))
    c.cells('grass-4', (16, 10))
    c.cells('grass-2', (19, 12), (20, 13))


# ---- meeting hall, 44x30 -----------------------------------------------------------------------

def hall(c, ruin):
    stone(c, 2, 12, 40, 18, 4, 11)
    c.rect(2, 13, 1, 17, 'stone-4')
    c.rect(34, 13, 8, 17, 'stone-2')
    c.rect(41, 13, 1, 17, 'stone-1')
    c.cells('stone-1', (36, 17), (37, 17), (38, 17), (35, 25), (36, 25), (37, 25))
    c.rect(2, 12, 40, 1, 'stone-2')
    c.rect(34, 12, 8, 1, 'stone-1')
    # door: two leaves under a stone lintel
    c.rect(17, 18, 10, 1, 'stone-4')
    c.rect(17, 19, 1, 11, 'stone-2')
    c.rect(26, 19, 1, 11, 'stone-2')
    if ruin:
        c.rect(18, 19, 8, 11, 'ink')
        c.rect(18, 19, 2, 11, 'wood-1')       # one leaf still hanging
        c.cells('wood-2', (18, 19), (18, 20), (18, 21), (18, 22))
    else:
        c.rect(18, 19, 8, 11, 'wood-2')
        c.rect(18, 19, 1, 11, 'wood-3')
        c.rect(22, 19, 1, 11, 'wood-1')
        c.rect(25, 19, 1, 11, 'wood-1')
        c.cells('wood-4', (21, 24), (23, 24))
    for x in (6, 11, 31, 36):
        c.rect(x - 1, 16, 4, 1, 'stone-2' if x < 30 else 'stone-1')
        c.rect(x, 17, 2, 4, 'ink' if ruin else 'lamp-1')
        if not ruin:
            c.cells('lamp-2', (x, 17), (x, 18))
        c.rect(x - 1, 21, 4, 1, 'stone-4' if x < 30 else 'stone-3')
    if not ruin:
        thatch(c, 0, 12, 4, 1.7)
        return
    # no roof: the wall top is broken, a corner of thatch and three rafters remain
    top = [12, 12, 12, 12, 12, 13, 13, 12, 12, 13, 14, 14, 13, 12, 12, 12, 12, 13, 13, 12, 12, 12, 12, 13, 15, 16, 16, 15, 13, 13, 14, 14, 13,
           14, 16, 17, 19, 19, 18, 18]
    for i, t in enumerate(top):
        x = 2 + i
        c.clear(x, 12, 1, t - 12)
        c.set(x, t, 'stone-4' if x < 34 else 'stone-3')
    c.stamp(0, 5, {'t': 'thatch-1', 'u': 'thatch-2', 'v': 'thatch-3', 'w': 'wood-1', 'W': 'wood-2'}, [
        '.........vvW......W...........',
        '.......vvuutW.....W...........',
        '.....vvvuut..W....W....W......',
        '...vvvuuutt...W...W....W......',
        '..vvuuuuttw....W..W....W......',
        '.vuuuutttt.w....W.W....W......',
        'uuutttttt..w.....WW....W......',
    ])
    c.line(18, 12, 18, 12, 'wood-2')
    c.rect(23, 12, 1, 1, 'wood-2')
    # creepers and weeds
    c.stamp(3, 14, {'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4'}, ['hG.', 'gGg', '.gG', '.Gg', '..g', '..g'])
    c.stamp(27, 15, {'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4'}, ['.h', 'Gg', 'gG', 'g.'])
    c.stamp(37, 17, {'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4'}, ['h.', 'gG', 'Gg', '.g'])
    tuft(c, 0, 29, 3)
    tuft(c, 14, 29, 2)
    tuft(c, 28, 29, 3)
    tuft(c, 42, 29, 4)
    c.stamp(20, 27, {'s': 'stone-2', 'S': 'stone-3', 'l': 'stone-4'}, ['..lS', 'lSSs', 'Sssd'.replace('d', 's')])


sprite('hall', 44, 30)(lambda c: hall(c, False))
sprite('hall_ruin', 44, 30)(lambda c: hall(c, True))


# ---- watchtower, 16x52 -------------------------------------------------------------------------

def tower_shaft(c, y0):
    c.rect(3, y0, 10, 52 - y0, 'stone-3')
    c.rect(3, y0, 1, 52 - y0, 'stone-2')
    c.rect(4, y0, 2, 52 - y0, 'stone-4')
    c.rect(10, y0, 3, 52 - y0, 'stone-2')
    c.rect(12, y0, 1, 52 - y0, 'stone-1')
    for i, y in enumerate(range(y0 + 3, 50, 5)):       # a few joints
        x = 6 + (i * 3) % 4
        c.rect(x, y, 2, 1, 'stone-2')
        if i % 2:
            c.rect(10, y + 2, 2, 1, 'stone-1')
        else:
            c.rect(4, y + 2, 1, 1, 'stone-3')
    # battered foot
    c.rect(2, 48, 12, 4, 'stone-3')
    c.rect(2, 48, 1, 4, 'stone-2')
    c.rect(3, 48, 3, 1, 'stone-4')
    c.rect(10, 48, 4, 4, 'stone-2')
    c.rect(13, 49, 1, 3, 'stone-1')
    c.rect(2, 51, 12, 1, 'stone-2')
    c.rect(10, 51, 4, 1, 'stone-1')


def tower(c, ruin):
    tower_shaft(c, 9)
    # door
    c.rect(6, 43, 4, 1, 'stone-2')
    c.rect(6, 44, 4, 8, 'ink' if ruin else 'wood-2')
    if not ruin:
        c.rect(6, 44, 1, 8, 'wood-3')
        c.rect(9, 44, 1, 8, 'wood-1')
    # slit windows
    for y, lit in ((33, False), (20, True)):
        c.rect(7, y, 2, 4, 'lamp-1' if lit and not ruin else 'ink')
        if lit and not ruin:
            c.cells('lamp-2', (7, y), (7, y + 1))
    if ruin:
        # broken off about halfway, higher on the left
        top = {3: 24, 4: 23, 5: 23, 6: 25, 7: 26, 8: 26, 9: 28, 10: 30, 11: 31, 12: 31}
        for x, t in top.items():
            c.clear(x, 0, 1, t)
            c.set(x, t, 'stone-4' if x < 10 else 'stone-3')
        c.stamp(7, 27, {'d': 'stone-1'}, ['d.', 'dd'])
        # fallen stone at the foot, creeper, weeds
        c.stamp(0, 47, {'s': 'stone-2', 'S': 'stone-3', 'l': 'stone-4', 'd': 'stone-1', 'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4'}, [
            '.h..............',
            '.g...........lS.',
            'lS..........lSs.',
            'SsS.........Sssd',
            'Sss.........sSsd',
        ])
        c.stamp(10, 34, {'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4'}, ['.h.', 'gG.', '.gG', '.Gg', '..g', '.gG', '..g'])
        c.stamp(3, 38, {'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4'}, ['h.', 'Gg', 'gG', '.g'])
        return
    # the lookout: a corbelled platform, a little roof on posts and the beacon above it
    c.stamp(0, 0, {'L': 'lamp-2', 'l': 'lamp-1', 'f': 'lava-2', 't': 'thatch-1', 'u': 'thatch-2', 'v': 'thatch-3', 'V': 'thatch-4',
                   'w': 'wood-1', 'W': 'wood-2', 's': 'stone-2', 'S': 'stone-3', 'h': 'stone-4', 'd': 'stone-1', 'i': 'ink'}, [
        '.......l........',
        '......lLl.......',
        '......fLf.......',
        '......Vvut......',
        '....VVvvuut.....',
        '..VVvvvvuuutt...',
        '.uuuuuutttttttt.',
        '...W.iiiiii.w...',
        '...W.iiiiii.w...',
        '.hhhhhhhhSSSss..',
        '.SSSSSSSSssssd..',
        '..ssssssssddd...',
    ])


sprite('tower', 16, 52)(lambda c: tower(c, False))
sprite('tower_ruin', 16, 52)(lambda c: tower(c, True))


# ---- levee, 64x12 ------------------------------------------------------------------------------

def levee(c, ruin):
    # a low wall of big blocks under long capstones; the ends are whole so lengths can join
    c.rect(0, 4, 64, 8, 'stone-3')
    c.rect(0, 10, 64, 2, 'stone-2')
    c.rect(0, 11, 64, 1, 'stone-1')
    c.rect(0, 5, 64, 1, 'stone-2')            # shadow under the capstones
    c.rect(0, 3, 64, 2, 'stone-4')
    for x in range(7, 64, 8):                 # joints between capstones
        c.set(x, 3, 'stone-2')
        c.set(x, 4, 'stone-2')
    for i, x in enumerate(range(3, 62, 6)):   # a few upright joints, staggered
        y = 6 if i % 2 else 8
        c.rect(x, y, 1, 2, 'stone-2')
        if i % 3 == 0:
            c.rect(x + 2, 7 if i % 2 else 6, 2, 1, 'stone-4')
    if not ruin:
        return
    # three breaches: the row where the wall is left standing, by column
    for x0, prof in ((9, [5, 5, 8, 8, 10, 11, 11, 10, 10, 7, 7, 5]), (29, [6, 6, 9, 9, 10, 12, 12, 12, 12, 11, 9, 9, 8, 8, 5]),
                     (50, [5, 7, 7, 9, 10, 10, 8, 8, 6])):
        for i, t in enumerate(prof):
            c.clear(x0 + i, 0, 1, t)
            if t < 12:
                c.set(x0 + i, t, 'stone-4' if t < 10 else 'stone-3')
    c.stamp(0, 0, {'g': 'grass-2', 'G': 'grass-3', 'h': 'grass-4', 's': 'stone-2', 'S': 'stone-3', 'l': 'stone-4'}, [
        '................................................................',
        '................................................................',
        '......h......................................h..................',
        '......g.......................h..............g..................',
        '..............................................................h.',
        '..............................................................g.',
        '................................................................',
        '................................................................',
        '.............h.....................h............................',
        '.............gG...................hg....lS..............h.......',
        '............gGg...................gG...lSs.............gG.......',
        '............gGg..................gGg...Sss.............gg.......',
    ])


sprite('levee', 64, 12)(lambda c: levee(c, False))
sprite('levee_ruin', 64, 12)(lambda c: levee(c, True))


# ---- bridges, 174 wide, the top of the deck on row 10 ---------------------------------------------

W = 174
DECK = 10


def bank_post(c, x, top, bottom):
    c.rect(x, top, 3, bottom - top + 1, 'wood-2')
    c.rect(x, top, 1, bottom - top + 1, 'wood-3')
    c.rect(x + 2, top, 1, bottom - top + 1, 'wood-1')
    c.rect(x, top, 2, 1, 'wood-4')


@sprite('bridge_rope', W, 24)
def _(c):
    def sag(x, depth):
        t = (x - 3) / (W - 7)
        return int(round(depth * 4 * t * (1 - t)))
    for x in range(3, W - 3):
        d = DECK + sag(x, 5)
        r = 3 + sag(x, 4)
        c.set(x, r, 'thatch-2')                       # hand rope
        if (x - 3) % 8 == 4:                          # hangers down to the deck
            for y in range(r + 1, d):
                c.set(x, y, 'wood-2')
        k = (x - 3) % 4
        c.set(x, d, 'wood-1' if k == 3 else 'wood-4' if ((x - 3) // 4) % 3 == 0 else 'wood-3')
        c.set(x, d + 1, 'wood-1')                     # the rope the planks are tied to
    bank_post(c, 0, 0, 13)
    bank_post(c, W - 3, 0, 13)
    for x in (0, W - 3):                              # lashings
        c.rect(x, 3, 3, 1, 'thatch-2')
        c.rect(x, 10, 3, 1, 'thatch-2')


def timber_deck(c, x0, x1):
    planks(c, x0, x1, DECK, 6)
    c.rect(x0, DECK + 2, x1 - x0 + 1, 1, 'wood-2')    # the beam under the planks
    c.rect(x0, DECK + 3, x1 - x0 + 1, 1, 'wood-1')


def trestle(c, x, top=14, bottom=43):
    """A pair of posts 8 apart with two crossed braces and a tie between them."""
    for px in (x, x + 8):
        c.rect(px, top, 2, bottom - top + 1, 'wood-2')
        c.rect(px + 1, top, 1, bottom - top + 1, 'wood-1')
        c.rect(px, top, 1, 6, 'wood-3')
    for y0 in (16, 31):
        c.line(x + 2, y0, x + 7, y0 + 10, 'wood-2')
        c.line(x + 7, y0, x + 2, y0 + 10, 'wood-1')
    c.rect(x + 2, 28, 6, 1, 'wood-3')
    c.rect(x + 2, 29, 6, 1, 'wood-1')
    # knee braces up to the beam
    c.line(x - 1, 17, x - 4, 14, 'wood-1')
    c.line(x + 10, 17, x + 13, 14, 'wood-1')


@sprite('bridge_timber', W, 44)
def _(c):
    for x in range(22, W - 10, 26):
        trestle(c, x)
    timber_deck(c, 0, W - 1)
    # handrail on the far side
    c.rect(0, 4, W, 1, 'wood-3')
    c.rect(0, 5, W, 1, 'wood-1')
    for x in range(8, W - 6, 13):
        c.rect(x, 4, 1, 6, 'wood-2')
        c.set(x, 4, 'wood-4')
    for x in (0, W - 2):
        c.rect(x, 3, 2, 7, 'wood-2')
        c.rect(x, 3, 2, 1, 'wood-4')


@sprite('bridge_stone', W, 46)
def _(c):
    H = 46
    c.rect(0, DECK, W, H - DECK, 'stone-3')
    # sparse joints on the face
    for n, y in enumerate(range(13, H, 4)):
        for x in range(2 + (n * 7) % 13, W - 4, 13):
            c.rect(x, y, 4, 1, 'stone-2')
            if n % 2:
                c.rect(x + 6, y + 2, 2, 1, 'stone-4')
    # three arches
    def half(y):
        if y >= 34:
            return 22
        t = (34 - y) / 18.0
        return int(round(22 * math.sqrt(max(0.0, 1 - t * t)))) if t <= 1 else 0
    opening = set()
    for cxa in (32, 87, 142):
        for y in range(16, H):
            for x in range(cxa - half(y), cxa + half(y)):
                opening.add((x, y))
    for x, y in opening:
        c.clear(x, y)
    for x in range(W):
        for y in range(DECK, H):
            if (x, y) in opening:
                continue
            near = [(x + dx, y + dy) in opening for dx, dy in ((1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1))]
            if any(near):                                  # the ring of arch stones
                c.set(x, y, 'stone-4' if (x + y) % 5 else 'stone-2')
    for x, y in opening:                                   # the underside of each vault, in shadow
        if (x, y - 1) not in opening or (x, y - 2) not in opening or ((x + 1, y) not in opening and y < 34) or ((x + 2, y) not in opening and y < 30):
            c.set(x, y, 'stone-1')
    # piers: lit on the left, dark on the right, a wider foot
    for x0, x1 in ((0, 9), (55, 64), (110, 119), (165, 173)):
        for y in range(34, H):
            c.set(x1, y, 'stone-2')
            if x1 - 1 > x0:
                c.set(x1 - 1, y, 'stone-2' if y % 4 else 'stone-3')
        c.rect(x0, H - 3, x1 - x0 + 1, 3, 'stone-2')
        c.rect(x0, H - 3, x1 - x0 + 1, 1, 'stone-3')
        c.rect(x0, H - 1, x1 - x0 + 1, 1, 'stone-1')
    # the deck edge and the parapet on the far side, with gaps to see through
    c.rect(0, DECK, W, 1, 'stone-4')
    c.rect(0, DECK + 1, W, 1, 'stone-2')
    for x in range(W):
        if x % 8 < 6:
            c.rect(x, 6, 1, 4, 'stone-3')
            c.set(x, 6, 'stone-4')
            if x % 8 == 5:
                c.rect(x, 6, 1, 4, 'stone-2')


def scaffold(c, x, top, bottom=43):
    for px in (x, x + 10):
        c.rect(px, top, 2, bottom - top + 1, 'wood-3')
        c.rect(px + 1, top, 1, bottom - top + 1, 'wood-1')
    for y in (15, 27):                                     # ledgers, lashed on
        c.rect(x - 2, y, 16, 1, 'wood-4')
        c.rect(x - 2, y + 1, 16, 1, 'wood-1')
        c.rect(x, y, 2, 2, 'thatch-2')
        c.rect(x + 10, y, 2, 2, 'thatch-2')
    c.line(x + 2, 17, x + 9, 26, 'wood-2')


@sprite('bridge_works', W, 44)
def _(c):
    for x in (8, 34, 60):
        scaffold(c, x, 3 if x < 60 else 6)
    timber_deck(c, 0, 47)
    c.stamp(46, DECK, {'w': 'wood-1', 'W': 'wood-2', 'x': 'wood-3', '!': '!'}, ['xw!', 'W!!', 'WW!', 'ww!'])   # the working end
    # a walkway of loose planks out to the last bay, and stone waiting to be laid
    c.rect(56, 14, 20, 1, 'wood-4')
    c.rect(56, 15, 20, 1, 'wood-1')
    c.rect(60, 15, 2, 1, 'thatch-2')
    c.rect(70, 15, 2, 1, 'thatch-2')
    S = {'s': 'stone-2', 'S': 'stone-3', 'l': 'stone-4', 'd': 'stone-1'}
    c.stamp(62, 9, S, ['...llS....', '.llSSsllS.', '.SSssdSSs.', 'llSllSsllS', 'SSsSSsdSSs'])
    c.stamp(24, 5, S, ['..llS...', '..SSs...', 'llSllSlS', 'SSsSSsSs', 'SssSssSs'])
    # a hoist pole with a rope
    c.line(40, 9, 50, 0, 'wood-2')
    c.line(41, 9, 51, 0, 'wood-1')
    c.rect(51, 1, 1, 6, 'thatch-2')
    c.stamp(50, 7, S, ['lS', 'Ss'])


@sprite('bridge_gone', W, 44)
def _(c):
    # leaning posts first, then the stubs of deck over them
    c.line(13, 14, 17, 43, 'wood-2')
    c.line(14, 14, 18, 43, 'wood-1')
    c.line(12, 14, 16, 43, 'wood-3')
    c.line(160, 13, 155, 43, 'wood-2')
    c.line(161, 13, 156, 43, 'wood-1')
    c.line(159, 13, 154, 43, 'wood-3')
    # a snapped post out in the river
    c.line(84, 26, 89, 43, 'wood-2')
    c.line(85, 26, 90, 43, 'wood-1')
    c.cells('wood-3', (83, 25), (84, 25), (84, 24))
    timber_deck(c, 0, 17)
    timber_deck(c, W - 20, W - 1)
    L = {'w': 'wood-1', 'W': 'wood-2', 'x': 'wood-3', 'X': 'wood-4', '!': '!'}
    c.stamp(14, DECK, L, ['xxw!', 'WW!!', 'WWW.', 'www.', '.W..', '.Ww.', '..w.', '..W.'])   # splintered, a plank hanging
    c.stamp(W - 21, DECK, L, ['.!xX', '.!!W', '.WWW', '.www', '..W.', '.wW.', '.w..'])
    # handrail stumps
    for x in (0, W - 2):
        c.rect(x, 3, 2, 7, 'wood-2')
        c.rect(x, 3, 2, 1, 'wood-4')
    c.rect(2, 4, 5, 1, 'wood-3')
    c.rect(2, 5, 4, 1, 'wood-1')
    c.cells('wood-2', (7, 5), (8, 6))
    c.rect(W - 6, 4, 4, 1, 'wood-3')
    c.rect(W - 5, 5, 3, 1, 'wood-1')


# ---- badges ------------------------------------------------------------------------------------

def small(name, legend, rows):
    @sprite(name, len(rows[0]), len(rows))
    def _(c):
        c.stamp(0, 0, legend, rows)


GOD = {'d': 'god-1', 'b': 'god-2', 'l': 'god-3', 'w': 'god-4'}
small('marker', GOD, [
    '..wlb..',
    '..wlb..',
    'dwlllbd',
    '.dwlbd.',
    '..dld..',
    '...d...',
])
small('marker_dim', {'a': 'silt-3', 'b': 'silt-2', 'c': 'silt-1'}, [
    'aaaab',
    '.bab.',
    '..b..',
])
small('seed', {'e': 'grain-1', 'f': 'grain-2', 'G': 'grain-3', 'H': 'grain-4'}, [
    '.fGG.',
    'fHGGf',
    'GHGGe',
    'fGGfe',
    '.fee.',
])
small('sack', {'A': 'wall-1', 'B': 'wall-2', 'C': 'wall-3', 'D': 'wall-4', 'w': 'wood-2'}, [
    '..CB..',
    '..ww..',
    '.DCCB.',
    'DCCCBA',
    'CCCBBA',
    '.BBAA.',
])

for name, build in SPRITES.items():
    if ONLY and name not in ONLY:
        continue
    c = build()
    with open(os.path.join(OUT, '%s.%dx%d.grid' % (name, c.w, c.h)), 'w') as f:
        f.write(c.text())
PY

for f in "$GRIDS"/*.grid; do
  base="$(basename "$f" .grid)"
  name="${base%.*}"
  new "$name" "${base##*.}"
  grid "$name" < "$f"
done
