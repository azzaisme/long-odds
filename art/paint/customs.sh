#!/usr/bin/env bash
# What villagers carry, so the customs they keep can be seen: a log on the shoulder, game from the hunt.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

new load_log 9x3
grid load_log <<'GRID'
a = wood-1
b = wood-2
c = wood-3
d = wood-4

dccccccbd
cbbbbbbac
.aaaaaaa.
GRID

new load_game 6x6
grid load_game <<'GRID'
k = ink
a = fur-1
b = fur-2
c = fur-3
w = fur-4

.k..k.
.b..b.
bcb.cb
bcbbcb
abwacw
.a..a.
GRID
