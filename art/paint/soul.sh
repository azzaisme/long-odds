#!/usr/bin/env bash
# The things that make the valley feel lived in: children, graves, the flood stone, the shrine,
# birds, fish, window light.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

CHILD='h = hair-1
H = hair-2
s = skin-2
S = skin-3
e = ink
c = cloth-2
C = cloth-3
x = cloth-1
t = trou-2
b = boot
'
new child 6x9 3
grid child 0 <<GRID
$CHILD
.hhhh.
hHHhhh
hSSss.
.sese.
.CCcx.
SCccxs
.ccxx.
.t..t.
.b..b.
GRID
grid child 1 <<GRID
$CHILD
.hhhh.
hHHhhh
hSSss.
.sese.
SCCcx.
.Cccxs
.ccxx.
t...t.
b....b
GRID
grid child 2 <<GRID
$CHILD
.hhhh.
hHHhhh
hSSss.
.sese.
.CCcxs
SCccx.
.ccxx.
..tt..
..bb..
GRID
for s in "green #3f6a3c #6a9f5b #9cc783" "yellow #9a6c22 #d9a441 #f0cf7a" "blue #2a4f86 #3f7fbf #74aede"; do
  set -- $s
  b="$ART/sprites/child.klad"
  klad palette "$b" --new-variant "$1" >/dev/null
  klad palette "$b" --recolour cloth-1 --to "$2" >/dev/null
  klad palette "$b" --recolour cloth-2 --to "$3" >/dev/null
  klad palette "$b" --recolour cloth-3 --to "$4" >/dev/null
done
klad palette "$ART/sprites/child.klad" --variant base >/dev/null

# ---- the burying ground: a stone and a wooden marker ------------------------------------------
new grave_stone 6x8
grid grave_stone <<'GRID'
a = stone-1
b = stone-2
c = stone-3
d = stone-4
g = grass-2

.dcc..
dcccb.
dcbcba
dccbba
dcbcba
dccbba
gbbbag
gggggg
GRID
new grave_post 6x8
grid grave_post <<'GRID'
a = wood-1
b = wood-2
c = wood-3
g = grass-2
f = lamp-1

..c...
..cb..
ccccba
..cb..
..cb..
.fcb..
gfcbg.
gggggg
GRID

# ---- the flood stone: a standing stone with a notch cut for each flood ------------------------
new flood_stone 9x16
grid flood_stone <<'GRID'
a = stone-1
b = stone-2
c = stone-3
d = stone-4
n = ink
g = grass-2
G = grass-3

...dcc...
..dcccb..
..dccbb..
.dcccbba.
.dnnncba.
.dcccbba.
.dnnncba.
.dccbbba.
.dnncbba.
.dcccbba.
.dccbbba.
.dcbcbba.
.dccbbba.
gdcbbbaag
GgbbbaagG
.GgggggG.
GRID

# ---- the shrine to the blue one: tended, and bare ---------------------------------------------
SHRINE='a = stone-1
b = stone-2
c = stone-3
d = stone-4
l = god-3
w = god-4
u = god-2
f = lamp-1
F = lamp-2
p = cloth-3
P = cloth-2
g = grass-2
G = grass-4
y = grain-3
k = ink
'
new shrine 14x16 2
grid shrine 0 <<GRID
$SHRINE
.....dcc......
....dcccb.....
...dccccbb....
...dcuuubb....
...dculwbb....
...dcuwlbb....
...dcuuubb....
...dccccbb....
..ddccccbba...
..dcccccbba...
.F.dccccbb.p..
.f.dcyycbb.Pp.
.f.dyyyybb.GP.
gfgdccccbbgGg.
GgggbbbbaagggG
.GggggggggggG.
GRID
grid shrine 1 <<GRID
$SHRINE
.....dcc......
....dcccb.....
...dccccbb....
...dckkkbb....
...dckukbb....
...dckkkbb....
...dckkkbb....
...dccccbb....
..ddccccbba...
..dcccccbba...
...dccccbb....
...dckkcbb....
...dkkkkbb..g.
g.gdccccbbg.g.
GgggbbbbaagggG
.GggggggggggG.
GRID

# ---- birds, fish, window light ----------------------------------------------------------------
new bird 7x4 2
grid bird 0 <<'GRID'
k = ink
w = stone-1

k.....k
.k...k.
..kwk..
...k...
GRID
grid bird 1 <<'GRID'
k = ink
w = stone-1

.......
..kwk..
.k.k.k.
k.....k
GRID
new fish 6x4
grid fish <<'GRID'
a = water-1
b = stone-3
c = stone-4
k = ink

..bcc.
abcckc
.abcc.
a.....
GRID
new glow 5x5
grid glow <<'GRID'
a = lamp-1
b = lamp-2

.aaa.
aabaa
abbba
aabaa
.aaa.
GRID
