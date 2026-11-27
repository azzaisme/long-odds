# Painting Long Odds sprites with klad

Long Odds is a side-on pixel-art game about a riverside village watched over by a god. Every
sprite is being repainted in klad (a pixel-art tool driven from the `klad` command line) to
replace sprites that were drawn by code in `src/game/sprites.js`.

## Before you paint

1. Run `klad skill pixel` and read all of it: it is the craft guide.
2. Run `klad skill` and read only its "Pixel art" section: the commands.
3. Look at `art/reference-characters.png` (already painted: the god, villagers, deer). Match it:
   chunky clusters, no black outlines (a darker step of the same colour at the edge instead),
   light from the top left, three or four steps per material, nothing noisy.
4. Read the function in `src/game/sprites.js` that draws your sprite today, for what it
   depicts and for its exact size. Your version should be better art of the same thing.

## How

- `source art/lib.sh`, then `new <name> <WxH> [frames]` makes `art/sprites/<name>.klad` with the
  shared palette, and `grid <name> [frame] <<'GRID' ... GRID` writes a text grid (legend lines
  `x = palette-name`, a blank line, then rows; `.` is empty).
- For big sprites, use `klad pixel <bundle> l1 --color <name> --rect/--ellipse/--line/--path/--fill`
  and `--shade`, or generate the grid text with a small Python script and pipe it to `grid`.
- **Use only colours from `art/palette.gpl`, by name.** Do not edit `palette.gpl`. If you truly
  need a colour it lacks, add it to your own drawing with `klad palette <bundle> --add '#hex'
  --name <name>` and list it in your report.
- Put everything that makes your drawings in one script, `art/paint/<group>.sh`, so running it
  recreates them from nothing. `art/paint/characters.sh` is the model.
- List what the game should load in `art/manifest/<group>.txt`, one line each:
  `bundle frame variant sprite-name` (`-` for no variant). `art/manifest/characters.txt` is the
  model. Related states of one thing (a house lived in, empty, ruined) can be frames of one
  drawing or separate drawings; either is fine.
- Judge by eye, often: `python3 art/sheet.py <out.png> <scale> name[:frame] ...` puts sprites
  side by side on the game's sky and grass colours; open the PNG with the Read tool. Also look
  at real size (scale 1 or 2): that is what the player sees. Run `klad check` on each drawing
  and fix what is a slip.
- Write temporary files only under the scratch directory you were given.

## Rules

- **Keep the exact canvas size given for each sprite** unless your list says the size is free.
  The game positions things by these sizes.
- Sprites are anchored bottom-centre. The bottom row sits on (or one pixel into) the ground.
- Transparent where there is nothing. No background colour.
- Do not touch anything under `src/`, do not run `art/export.sh`, and do not commit. Other
  painters are working in the same repository on other sprites at the same time: only create
  or change files whose names belong to your group.
- When done, report: each sprite name with its size, anything you could not do or did
  differently, any colours you added, and what you checked by eye.
