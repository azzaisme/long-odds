#!/usr/bin/env bash
# The foam at a flood's advancing edge, and the wreckage it carries. (The flood water itself is
# the river's own water, water0 and water1, so the overflow and the river are one body.)
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

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
