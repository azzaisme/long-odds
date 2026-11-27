#!/usr/bin/env bash
# Flood water, its foam crest, and the wreckage it carries.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

# ---- muddy flood water: two frames, tiled sideways -------------------------------------------
for f in 0 1; do
  new flood$f 64x64
  python3 - "$f" <<'PY' | klad pixel "$ART/sprites/flood$f.klad" l1 --grid - >/dev/null
import sys
shift = int(sys.argv[1]) * 5
W = H = 64
g = [['m'] * W for _ in range(H)]
def dash(y, x, n, c):
    for i in range(n):
        g[y][(x + i + shift) % W] = c
for x in range(W): g[0][x] = 'f'                     # the crest line
for x, n in [(2, 5), (14, 3), (25, 6), (39, 4), (52, 5)]: dash(1, x, n, 'f')
for x, n in [(8, 4), (30, 3), (46, 5)]: dash(2, x, n, 'l')
for y, x, n in [(4, 20, 7), (6, 3, 9), (6, 41, 6), (9, 28, 10), (11, 55, 7), (13, 10, 8), (16, 36, 9)]: dash(y, x, n, 'l')   # pale silt streaks
for y, x, n in [(5, 50, 5), (8, 12, 6), (12, 44, 8), (15, 0, 7), (19, 24, 9), (23, 48, 8), (27, 6, 10), (32, 34, 9),
                (37, 16, 8), (42, 50, 9), (47, 2, 10), (52, 30, 9), (57, 44, 8), (61, 12, 9)]: dash(y, x, n, 'd')             # dark swirls
for y in range(40, H):                                # deeper and darker toward the bed
    for x in range(W):
        if g[y][x] == 'm' and (x + y * 3) % 7 == 0: g[y][x] = 'd'
print('m = silt-1\nl = silt-2\nf = silt-3\nd = soil-2\n')
print('\n'.join(''.join(r) for r in g))
PY
done

# ---- the foam that rides the crest: a strip, tiled sideways, mostly gaps ----------------------
new foam 64x3
grid foam <<'GRID'
w = cloud-1
s = silt-3

..www......ww.......wwww.....w......www........ww......www......
.wwwww..s.wwww..s..wwwwww...www..s.wwwww..ss..wwww..s.wwwww..s..
ssswssssssswsssssssswwsssssssssssssswsssssssssswssssssswssssssss
GRID

# ---- wreckage carried by the water ------------------------------------------------------------
new drift_log 16x5
grid drift_log <<'GRID'
a = wood-1
b = wood-2
c = wood-3
d = wood-4
g = grass-2

............g...
.dccccccccccbg..
dccbbcccbbcccba.
.bbaabbbaabbbba.
..aa...aa....a..
GRID
new drift_thatch 12x6
grid drift_thatch <<'GRID'
a = thatch-1
b = thatch-2
c = thatch-3
d = thatch-4
w = wood-2

....dc......
..dccccd....
.cccbccccw..
bccbbcbccbw.
.bbabbabbba.
..aa.aa.aa..
GRID
new drift_barrel 8x7
grid drift_barrel <<'GRID'
a = wood-1
b = wood-2
c = wood-3
d = wood-4
i = stone-1

..icci..
.dccccb.
dicccib.
dccccbba
bicccia.
.bbbba..
..aaa...
GRID
