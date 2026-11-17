# Unit 18: Castle Defence mode (v1)

## Goal

New game mode: defend the king in a moated castle against escalating
waves. Win when the last wave is cleared; lose if the king dies.

## Map

- Rectangular keep with king (5000 HP) at centre and a merchant inside.
  Keep interior is solid floor (no water inside the walls).
- Full water moat (`~` → impassable `TILE_WATER`) around the keep;
  only crossable via three large (6-tile) bridges: left, top/middle, right.
- Outside the moat: grassy fields (`;` → `DECOR_GRASS`) whose depth is
  50% of the castle width on each side.
- v1 waves spawn only from the **top** bridge approach (`h` markers).

## Waves

Data table in `shared/src/data/castleDefence.ts`. Each wave has
`delayAfterPrev` (seconds after previous wave start; wave 1 from mission
start), `paths`, `kind` (`standard` | `miniboss` | `boss`), and
`composition` of `{ type, baseCount }`.

- Standard / miniboss: `count = baseCount × players`.
- Boss: `count = baseCount` (no player multiply; no special scaling yet).
- Do not start the next wave until the current wave is cleared; if the
  delay has already elapsed, spawn immediately.
- Wave timer HUD always visible (top-left).

### v1 schedule

1. Slaves only (base 8), delay 30s from start.
2. Slaves 6 + clanrats 4, delay 30s after wave 1 start.
3–5. Placeholder escalating slave/clanrat mixes.

## Merchant

Shop allowed during `playing` in this mode when near the merchant.

## Non-goals

Left/right path waves; boss/miniboss special rules; water swimming.
