#!/usr/bin/env bash
# The large sprites: the city row, the Hold, the volcano, the tornado funnel and the landslide.
# They are too big to type as grids, so landmarks.py works each one out as grid text (seeded, the
# same every run) and klad paints it, every pixel bound to a palette colour.
#   art/paint/landmarks.sh            paint them all
#   art/paint/landmarks.sh hold ...   paint only the ones named
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/../lib.sh"

paint() { # <name> <WxH>
  new "$1" "$2"
  python3 "$HERE/landmarks.py" "$1" | grid "$1"
}

size() {
  case "$1" in
    city|city_ruin) echo 400x84 ;;
    hold|hold_ruin) echo 440x156 ;;
    volcano|volcano_hot) echo 320x190 ;;
    funnel) echo 40x110 ;;
    slide) echo 150x46 ;;
    *) echo "landmarks.sh: no sprite called $1" >&2; exit 1 ;;
  esac
}

if [ $# -eq 0 ]; then set -- city city_ruin hold hold_ruin volcano volcano_hot funnel slide; fi
for name in "$@"; do paint "$name" "$(size "$name")"; done
