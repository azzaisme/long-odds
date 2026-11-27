#!/usr/bin/env bash
# Sunset: the dusk sky, the low sun, and the black foreground that frames the valley.
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

# ---- the dusk sky: deep maroon overhead, through red and orange, to a pale glow at the horizon
new sky_dusk 4x128
python3 - <<'PY' | klad pixel "$ART/sprites/sky_dusk.klad" l1 --grid - >/dev/null
bands = [('1', 30), ('2', 22), ('3', 20), ('4', 20), ('5', 18), ('6', 18)]
rows = []
for i, (c, n) in enumerate(bands):
    rows += [c] * n
# one alternating row either side of each boundary, so the steps read as deliberate banding
y = 0
for i, (c, n) in enumerate(bands[:-1]):
    y += n
    nxt = bands[i + 1][0]
    rows[y - 2], rows[y + 1] = nxt, c
print('\n'.join(f'{k} = dusk-{k}' for k in '123456') + '\n')
print('\n'.join(r * 4 for r in rows))
PY

# ---- the sun: a pale disc in a soft halo -----------------------------------------------------
new sun 56x56
B="$ART/sprites/sun.klad"
klad pixel "$B" l1 --color dusk-6 --ellipse 4,4,48,48 --filled --dither 25 >/dev/null
klad pixel "$B" l1 --color dusk-6 --ellipse 10,10,36,36 --filled --dither 50 >/dev/null
klad pixel "$B" l1 --color sun-2 --ellipse 15,15,26,26 --filled --dither 75 >/dev/null
klad pixel "$B" l1 --color sun-2 --ellipse 18,18,20,20 --filled >/dev/null
klad pixel "$B" l1 --color sun-1 --ellipse 19,19,18,18 --filled >/dev/null

# ---- the foreground: black grass, a leaning marker and a stone, tiled sideways ---------------
new fore 512x44
python3 - <<'PY' | klad pixel "$ART/sprites/fore.klad" l1 --grid - >/dev/null
import math
W, H = 512, 44
g = [['.'] * W for _ in range(H)]
def put(x, y):
    if 0 <= y < H: g[y][x % W] = 'n'
# a rolling black bank along the bottom
for x in range(W):
    top = 30 + round(3 * math.sin(x * 2 * math.pi / W * 3) + 2 * math.sin(x * 2 * math.pi / W * 7 + 1))
    for y in range(top, H): put(x, y)
# grass blades in clumps: thin curved strokes
def blade(x0, base, height, lean):
    for i in range(height):
        t = i / height
        put(x0 + round(lean * t * t), base - i)
        if t < 0.5: put(x0 + round(lean * t * t) + 1, base - i)
clumps = [(18, 14, 5), (41, 9, -4), (96, 17, 6), (131, 11, -6), (150, 8, 3), (212, 15, -5), (246, 10, 4), (305, 18, 7),
          (338, 9, -3), (372, 13, 5), (421, 16, -6), (455, 10, 4), (489, 12, -4)]
for cx, h, lean in clumps:
    for k, (dx, dh, dl) in enumerate([(-4, 0.6, -0.7), (-2, 0.85, -0.3), (0, 1, 1), (2, 0.8, 0.5), (5, 0.55, 1.2)]):
        blade(cx + dx, 32, max(3, round(h * dh)), round(lean * dl))
# a leaning wooden marker with a crosspiece
for i in range(22):
    x = 176 + round(i * 0.22)
    for d in range(3): put(x + d, 34 - i)
for d in range(-6, 8):
    put(180 + d, 19 + round(d * 0.2)); put(180 + d, 20 + round(d * 0.2))
# a rounded stone
for y in range(18, 34):
    half = round(7 * math.sqrt(max(0, 1 - ((y - 27) / 10) ** 2))) if y < 27 else 7
    for x in range(398 - half, 398 + half + 1): put(x, y)
print('n = night\n')
print('\n'.join(''.join(r) for r in g))
PY
