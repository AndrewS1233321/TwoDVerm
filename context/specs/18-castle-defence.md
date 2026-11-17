# Unit 18: Castle Defence mode (v1)

## Goal

New game mode: defend the king in a moated castle against escalating
waves. Win when the last wave is cleared; lose if the king dies.

## Map

- Rectangular keep with king (5000 HP) at centre and a merchant inside.
  Keep interior is solid floor (no water inside the walls).
- Full water moat (`~` → impassable `TILE_WATER`) around the keep;
  only crossable via three large (6-tile) bridges: left, top/middle, right.
- Outside the moat: grassy fields (`;` → `DECOR_GRASS`). Field depth is
  36 tiles (3× the original 12-tile band / 200% larger); outer map
  border grows to fit. Castle, moat, and bridges stay the same size.
- v1 waves spawn only from the **top** bridge approach (`h` markers).
- Spawn clusters render as a dark circle with a red pentagram (one per
  left / top / right path).

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

### Wave schedule

1–4. Horde ramps (slaves / clanrats), top path.
5. Mini-boss: 2 stormvermin + 5 slaves per player; fixed specials by
   party size (gas / gutter / gunner — exact counts, not × players).
6–9. Escalating mixes (shielded rats, hooker, warpfire, etc.).
10. Boss: 1 Rat Ogre; HP ×1 / ×1.5 / ×2 / ×2.5 for 1–4 players.

## Targeting

Enemies use normal hero pick logic, then chase whichever is closer —
that hero or the king. Melee hits can damage either.

## Merchant

Shop allowed during `playing` in this mode when near the merchant.
Ammo crate 4 tiles right of the merchant (reusable). Med kit 4 tiles
left; it respawns at the start of each wave.

## Non-goals

Left/right path waves; boss/miniboss special rules; water swimming.
