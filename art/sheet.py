#!/usr/bin/env python3
"""Contact sheet for judging sprites: python3 art/sheet.py out.png [scale] name[:frame][@variant] ...
Each sprite is exported from art/sprites at real size, enlarged, and set on the game's sky and ground colours."""
import subprocess, sys, tempfile, os
from PIL import Image
out, scale, names = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
art = os.path.dirname(os.path.abspath(__file__))
tiles = []
with tempfile.TemporaryDirectory() as d:
    for i, spec in enumerate(names):
        name, variant = (spec.split('@') + [None])[:2]
        name, frame = (name.split(':') + ['0'])[:2]
        png = os.path.join(d, f'{i}.png')
        cmd = ['klad', 'export', os.path.join(art, 'sprites', name + '.klad'), '--frame', frame, '--scale', '1', '-o', png]
        if variant: cmd += ['--variant', variant]
        subprocess.run(cmd, check=True, capture_output=True)
        if not os.path.exists(png):  # variants add a suffix to the file name
            png = [os.path.join(d, f) for f in os.listdir(d) if f.startswith(f'{i}-')][0]
        im = Image.open(png).convert('RGBA')
        tiles.append(im.resize((im.width * scale, im.height * scale), Image.NEAREST))
pad = 4 * scale
W = sum(t.width for t in tiles) + pad * (len(tiles) + 1)
H = max(t.height for t in tiles) + pad * 3
sheet = Image.new('RGBA', (W, H), (125, 143, 174, 255))
ground = Image.new('RGBA', (W, pad * 2), (93, 143, 66, 255))
sheet.paste(ground, (0, H - pad * 2))
x = pad
for t in tiles:
    sheet.alpha_composite(t, (x, H - pad * 2 - t.height))
    x += t.width + pad
sheet.save(out)
print(out, sheet.size)
