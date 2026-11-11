# Unit 14: Campaign-style Wastes missions

## Goal

Add Wastes missions that play like Vermintide 2 campaign levels, with
set-piece events instead of the stock hold / mini-boss / boss chain.
They join the existing four locations in one shared random vote pool,
and difficulty still rises with the number of Wastes stops completed
(`difficultyForStop`). Layouts and names are original.

The first one is **Hallowed Rampart** (castle, cobble floor), paced
loosely after Righteous Stand.

## Hallowed Rampart

| Section | Area | Objective | Opens |
| ------- | ---- | --------- | ----- |
| 1 | barracks quarter, cart lane, fountain plaza, training yard | Elite-mix hold in the training yard (`H`) | Gate `1` to the rampart barracks |
| 2 | rampart barracks, wall walk, two towers, gatehouse | Fire the gatehouse cannon (`C`) | Rubble wall `2` to the north wall |
| 3 | north wall, statue terrace, temple | Ring the temple bell (`R`/`L`), survive | Exit gate `3` |

Generator: `npx tsx scripts/build-hallowed-rampart.ts` writes
`tmp/hallowed_rampart_gen.ts`, which is pasted into
`shared/src/levels/expeditionLevels.ts` as `HALLOWED_RAMPART`.

## Custom section list

`AuthoredMission.sections` (optional) lists the objectives in play order
as `{ zone, gate, kind, eliteMix? }`. Missions without it keep the
default `H`/`1` hold, `K`/`2` mini-boss, `B`/`3` boss chain.

Extra map characters (only meaningful with a custom section list):

| Char | Meaning |
| ---- | ------- |
| `C`  | Cannon tile; it is the cannon section's zone and interact point. That section's gate tiles are drawn as a rubble wall |
| `R`  | Bell temple zone (every tile the party must stand in to ring, and where heroes are confined while sealed) |
| `L`  | Bell tile (part of `R`, interact point) |
| `V`  | Bell wave spawn (part of `R`) |
| `4`  | Temple doorway; floor normally, gate while the bell event runs |

`level.setPieces` carries the cannon and bell positions, the bell zone,
the rubble gate tiles and the seal-door tiles for the client.

## Objectives

- **Elite-mix hold** (`kind: "hold"`, `eliteMix: true`): same timer and
  gate as the normal hold, but the entry horde adds `holdEliteCount`
  stormvermin (1/2/3/5 at difficulty 1–4) and a second horde with
  `ceil(holdEliteCount / 2)` stormvermin arrives halfway through.
- **Cannon** (`kind: "cannon"`): stand within `OBJECTIVE_INTERACT_RANGE`
  (72 px) of the cannon and hold E for `cannonChannel` (2.5 s). Letting go
  resets the charge. On firing: muzzle and breach effects, the rubble
  wall (gate) opens and a horde is triggered.
- **Bell** (`kind: "bell"`): press E at the bell with every living hero
  inside `R`. The doors seal, regular hordes stop (event active) and
  waves spawn at the `V` points every `bellWaveInterval` seconds
  (`max(6, 11 - d)`), sized `round(4 + 2d) + 3 * heroes` plus
  `floor(d / 2)` stormvermin. After `bellKillTarget` kills
  (`round(25 + 15d)`) the hammer falls: every enemy dies, the doors
  unseal and the exit gate opens.

The server syncs `objectiveCharge`, `objectiveCount`, `objectiveTarget`
and `doorsSealed`. The client mirrors `doorsSealed` into its level tiles
so prediction collides with the doors, and shows HUD text, the cannon
charge bar and E prompts for the active set piece. Set-piece effects
arrive as `setpiece` FX events (`cannon`, `breach`, `bell`, `hammer`).

## Rules

Everything from spec 13 applies (180 x 90 cap, 3-wide corridors, spawn
markers 16 to 45 tiles from where the party fights). In addition:

- Pickups and other markers never sit inside `R`, since those tiles
  would drop out of the bell zone.
- Seal doors sit just outside `R` and border it; with them shut, `R` is
  cut off from the rest of the map (the exit gate sits flush against the
  temple).
- Every non-boss objective has at least 2 horde spawns 520 to 1500 px
  from its fight point that are reachable before its gate opens.

## Checks

`npm run check:wastes` covers spec 13's checks with the expected order
taken from each mission's own section list, plus: interact points and
`V` spawns reachable in their section, seal doors bordering and sealing
the bell zone, the rubble wall matching the cannon gate, a boss room
only when there is a boss section, and the horde-spawn distance rule.
