#!/usr/bin/env bash
# The backdrop layers: the sky gradient, the far mountains, the middle hills with the river bend,
# and the two frames of the foreground river's surface. They are too big to type as grids, so
# backdrop.py works the pixels out (seeded, the same every run) and prints them as grid text.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"
PY="$(dirname "$0")/backdrop.py"

paint() {  # paint <name> <WxH>
  new "$1" "$2"
  python3 "$PY" "$1" | grid "$1"
}

paint sky 4x128
paint far 2048x260
paint mid 2048x150
paint water0 64x64
paint water1 64x64
