#!/usr/bin/env bash
# Exports every painted sprite listed in art/manifest/*.txt to src/assets/sprites/<name>.png at real size.
# Run after painting or editing a drawing: bash art/export.sh
set -euo pipefail
ART="$(cd "$(dirname "$0")" && pwd)"
OUT="$ART/../src/assets/sprites"
mkdir -p "$OUT"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
n=0
cat "$ART"/manifest/*.txt | grep -v '^#' | grep -v '^\s*$' | while read -r bundle frame variant name; do
  rm -f "$tmp"/*
  args=(klad export "$ART/sprites/$bundle.klad" --frame "$frame" --scale 1 -o "$tmp/x.png")
  [ "$variant" != "-" ] && args+=(--variant "$variant")
  "${args[@]}" >/dev/null 2>&1 || { echo "export failed: $bundle frame $frame $variant" >&2; exit 1; }
  f="$(ls "$tmp"/*.png | head -1)"   # a variant export adds the variant to the file name
  mv "$f" "$OUT/$name.png"
  n=$((n + 1))
done
echo "exported $(ls "$OUT"/*.png | wc -l) sprites to src/assets/sprites"
