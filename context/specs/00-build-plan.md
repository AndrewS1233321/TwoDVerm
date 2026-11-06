# Build Plan

Each unit ends with something playable. Write the spec file for a unit
(`context/specs/NN-name.md`) right before building it.

| Unit | Name                    | Builds                                                                                       | Depends on |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| 01   | Context                 | Six context files, AGENTS.md, this plan                                                      | —          |
| 02   | Skeleton                | npm workspaces; Phaser client shows a floor; Colyseus server runs; `npm run dev` starts both | 01         |
| 03   | Rooms and deploy        | Create/join by 4-letter code; players as circles moved by server; deploy to Fly.io           | 02         |
| 04   | Smooth netcode          | Client prediction and reconciliation for own player; interpolation for others; lag simulator | 03         |
| 05a  | Facing and hero sprite  | Aim angle input, turn speed, code-drawn hero sprite rotated to facing, radius from data      | 04         |
| 05b  | Attack chains           | Weapon data tables; light chain and heavy (charge) chain; windup/active/recovery; buffering  | 05a        |
| 05c  | Directional hits        | Hit arcs and cleave vs training dummies of varied sizes; front/back detection; backstab bonus; hit feedback | 05b |
| 05d  | Defence and resources   | Block (front only) with block stamina, push, guard break; dodge with dodge charges; HUD bars | 05c        |
| 06   | First enemies           | Horde rat sprite and AI, telegraphed attacks, player damage, downed state, revive            | 05d        |
| 07   | Level                   | Tiled map, wall collision, flow-field pathfinding (separate field for large creatures), start/end zones, win/lose | 06 |
| 08   | AI Director             | Horde waves, ambient spawns, intensity pacing                                                | 07         |
| 09   | Elites and specials     | Armoured rat, gas thrower, hooker, gunner, with warnings                                     | 08         |
| 10   | Heroes                  | 4 archetypes, ranged weapons and ammo, ultimates, hero-select lobby                          | 09         |
| 11   | Boss and event          | Rat ogre; hold-the-point horde event                                                         | 10         |
| 12   | Polish                  | Sound, music, full HUD, improved sprites and effects, settings                               | 11         |

Units 01 to 06 deliver a playable multiplayer brawler.
