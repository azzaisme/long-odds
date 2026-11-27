# Helpers for painting Long Odds sprites with klad. Source this from a script in art/paint/.
#   new <name> <WxH> [frames]     start a pixel drawing art/sprites/<name>.klad with the shared palette
#   grid <name> [frame] <<'GRID'   write a text grid (legend, blank line, rows) to a frame (default 0)
#   look <name> [frame]            render enlarged to /tmp for checking by eye; prints the path
ART="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
new() {
  local b="$ART/sprites/$1.klad"
  rm -rf "$b"
  klad new "$b" --pixel "$2" --frames "${3:-1}" >/dev/null
  klad palette "$b" --load "$ART/palette.gpl" >/dev/null
}
grid() {
  local b="$ART/sprites/$1.klad" f="${2:-0}"
  if [ "$f" != 0 ]; then klad add "$b" cel --in l1 frame="$f" >/dev/null 2>&1 || true; fi
  klad pixel "$b" l1 --frame "$f" --grid - >/dev/null
}
look() {
  local out="${TMPDIR:-/tmp}/look-$1-${2:-0}.png"
  klad export "$ART/sprites/$1.klad" --frame "${2:-0}" --scale "${3:-8}" -o "$out" >/dev/null && echo "$out"
}
