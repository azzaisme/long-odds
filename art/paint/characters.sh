#!/usr/bin/env bash
# The god, the villagers and the deer.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

# ---- the god: a hooded figure of blue light, lit from the top left -------------------------
GOD='d = god-1
b = god-2
l = god-3
w = god-4
e = god-eye
g = lamp-1
G = lamp-2
'
new god 12x18 3
grid god 0 <<GRID
$GOD
....dlld....
...dlwwbd...
..dlwwwlbd..
..dweeeebd..
..dweGeGbd..
..dleeeebd..
...dllbbd...
..dlllbbbd..
.dlwllbbbbd.
.dlwllbbbbd.
.dlGggggbbd.
.dlllbbbbbd.
.dlwllbbbbd.
dllwllbbbbbd
dlllllbbbbbd
dllllbbbbbbd
dlllbbbbbbdd
.dddddddddd.
GRID
grid god 1 <<GRID
$GOD
....dlld....
...dlwwbd...
..dlwwwlbd..
..dweeeebd..
..dweGeGbd..
..dleeeebd..
...dllbbd...
..dlllbbbd..
.dlwllbbbbd.
.dlwllbbbbd.
.dlGggggbbd.
.dlllbbbbbd.
.dlwllbbbbd.
.dlwllbbbbbd
.dllllbbbbbd
..dlllbbbbbd
..dllbbbbbdd
...dddddddd.
GRID
grid god 2 <<GRID
$GOD
....dlld....
...dlwwbd...
..dlwwwlbd..
..dweeeebd..
..dweGeGbd..
..dleeeebd..
...dllbbd...
..dlllbbbd..
.dlwllbbbbd.
.dlwllbbbbd.
.dlGggggbbd.
.dlllbbbbbd.
.dlwllbbbbd.
dllwllbbbbd.
dlllllbbbbd.
dllllbbbbd..
dlllbbbbdd..
.dddddddd...
GRID

# ---- a villager: one drawing, eight shirts as palette variants -----------------------------
VIL='h = hair-1
H = hair-2
s = skin-2
S = skin-3
k = skin-1
e = ink
c = cloth-2
C = cloth-3
x = cloth-1
t = trou-2
T = trou-1
b = boot
'
new villager 9x13 3
grid villager 0 <<GRID
$VIL
..hhhh...
.hhHHhh..
.hhSSss..
.hsSese..
..kssss..
.CCcccx..
SCCcccxk.
sCcccxxk.
..ccxxx..
..tttTT..
..tt.TT..
..tt.TT..
..bb.bb..
GRID
grid villager 1 <<GRID
$VIL
..hhhh...
.hhHHhh..
.hhSSss..
.hsSese..
..kssss..
.CCcccx..
.SCcccxk.
..sccxk..
..ccxxx..
..tttTT..
.tt..TT..
.tt...TT.
.bb...bb.
GRID
grid villager 2 <<GRID
$VIL
..hhhh...
.hhHHhh..
.hhSSss..
.hsSese..
..kssss..
.CCcccx..
.CCcccxk.
.sCccxx..
..ccxxx..
..tttTT..
...ttT...
...tTT...
...bbb...
GRID
# name: dark, mid, light
shirts=(
  "blue #2a4f86 #3f7fbf #74aede"
  "yellow #9a6c22 #d9a441 #f0cf7a"
  "green #3f6a3c #6a9f5b #9cc783"
  "purple #643a7a #9a62b0 #c193d0"
  "pink #96506c #d17f9f #eeb0c4"
  "teal #2c6c70 #4fa3a3 #86cdc6"
  "brown #70431f #b0703a #d69a62"
)
for s in "${shirts[@]}"; do
  set -- $s
  b="$ART/sprites/villager.klad"
  klad palette "$b" --new-variant "$1" >/dev/null
  klad palette "$b" --recolour cloth-1 --to "$2" >/dev/null
  klad palette "$b" --recolour cloth-2 --to "$3" >/dev/null
  klad palette "$b" --recolour cloth-3 --to "$4" >/dev/null
done
klad palette "$ART/sprites/villager.klad" --variant base >/dev/null

# ---- deer -----------------------------------------------------------------------------------
DEER='f = fur-1
F = fur-2
l = fur-3
w = fur-4
e = ink
a = wood-4
'
new deer 14x12 2
grid deer 0 <<GRID
$DEER
..........a.a.
..........aaa.
.........Flll.
.........Flel.
........FFlll.
wFFFFFFFFll...
wFlllllFFF....
.FlllllFFf....
.FFFFFFFFf....
.F.f...F.f....
.F.f...F.f....
.f.f...f.f....
GRID
grid deer 1 <<GRID
$DEER
..........a.a.
..........aaa.
.........Flll.
.........Flel.
........FFlll.
wFFFFFFFFll...
wFlllllFFF....
.FlllllFFf....
.FFFFFFFFf....
F..f..F...f...
F...f.F...f...
f...f.f....f..
GRID
