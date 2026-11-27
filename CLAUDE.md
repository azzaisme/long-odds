# Long Odds: working rules

## Branches

- Every working branch is merged into `testing`. Never open a pull request from a working branch
  straight into `main`.
- Only `testing` is merged into `main`.
- Every merge into `main` publishes the game to itch.io (`.github/workflows/itch.yml`), so
  treat a merge into `main` as a release.

## Checks before pushing

- `npm test` (about 70 s) and `npm run build` must pass.
- `npm run sim -- 100` reports balance across seeds; rerun it after changing `src/sim/balance.js`
  or anything in `src/sim/`.

## Layout

The simulation in `src/sim/` is plain JavaScript with no browser imports and must stay
deterministic for a given seed and set of player actions. Everything the player can decide is
data in `src/sim/decisions.js`; every tuning number is in `src/sim/balance.js`.
