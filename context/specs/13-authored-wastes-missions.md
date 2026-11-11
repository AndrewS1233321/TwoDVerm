# Unit 13: Authored Gingey Wastes missions

## Goal

The four Gingey Wastes locations stop using the procedural room
generator. Each location loads one fixed, hand-designed map whose pacing
loosely follows a Vermintide 2 mission. Layouts are original (not traced)
and use no Vermintide 2 names.

The Wastes run flow is unchanged: vote, three section objectives (hold,
mini-boss, final boss), exit unlocks after the boss, 10s party hold at
the exit, merchant hall, next vote.

## Missions

| Location       | Level type | Inspiration (pacing only) | Beats |
| -------------- | ---------- | ------------------------- | ----- |
| Grim Causeway  | castle     | Fort Brachsenbrucke       | Gatehouse, outer bailey, causeway platform hold, keep courtyard mini-boss, tower boss arena |
| Weeping Quarry | caverns (mine theme) | Hunger in the Dark | Winding mine galleries, flooded upper pit, pump-room hold, collapsed gallery mini-boss, deep pit boss arena; `theme: "mine"` (crumbling rock, lanterns, cart tracks, debris props) |
| Salt Hollow    | caverns    | Mountain-pass missions    | Open salt flats, narrowing canyon, choke-point hold, side-canyon camp mini-boss, basin boss arena |
| Cinder Watch   | castle     | Empire in Flames          | Ash streets and burned houses, watchtower hold, market square mini-boss, gutted keep boss arena |
| Hallowed Rampart | castle   | Righteous Stand           | Custom sections (spec 14): training-yard elite hold, gatehouse cannon breach, temple bell finale |

Each map's level type is fixed (`LOCATION_TYPE_BIAS` has one entry per
location). Difficulty and race rolls still apply per stop.

## Map format

Each mission in `shared/src/levels/expeditionLevels.ts` is an
`AuthoredMission`: `rows` (ASCII), `floor` (the floor character that
markers sit on, so their tiles get the right decor) and `labels` (room
names in tile coordinates).

`rows` uses the normal level characters from `shared/src/level.ts`
(`#` `.` `,` `_` `S` `E` `h` `p` `r` `s` `A` `M`) plus the authored
mission legend:

| Char | Meaning |
| ---- | ------- |
| `H`  | Section 1 objective zone: hold |
| `K`  | Section 2 objective zone: mini-boss (spawns at the zone centre) |
| `B`  | Section 3 objective zone: boss arena (whole arena; the boss spawns at its centre and the party is sealed in during the fight) |
| `1`  | Gate opened when the hold completes |
| `2`  | Gate opened when the mini-boss dies |
| `3`  | Exit gate, opened when the boss dies |
| `b`  | Barrel spot; the run seed keeps about two thirds of them |

`G`, `T`, `O` and summon-pad digits are not used in authored missions.

A mission can override the default chain with `sections` (a list of
`{ zone, gate, kind, eliteMix? }` in play order) and then also use the
set-piece markers `C` (cannon), `R` (bell zone), `L` (bell), `V` (bell
wave spawn) and `4` (seal door). See spec 14.

## Rules

- Maps stay within 180 x 90 tiles so the client's pre-drawn map chunks
  stay under about 100 MB of graphics memory.
- Horde (`h`) and special (`p`) spawns sit 16 to 45 tiles from where the
  party fights (the Director only uses points 520 to 1500 px away), and
  away from the start so ambient fill does not spawn on the party.
- Corridors the party fights through are at least 3 tiles wide so large
  creatures can path.
- `buildWastesLevel(locationId, props, seed)` is the only way the server
  and client build a Wastes map; both get identical output.
- `generateLevel` stays in the codebase but the vote flow no longer
  calls it.

## Checks

`npm run check:wastes`, for every mission at difficulties 1 to 4:

- size within the cap; at least 4 starts; exit zone present;
- objectives in the mission's section order (default hold, mini-boss,
  boss), each with a zone;
- with every gate closed, the hold zone is reachable and the next
  section is not; opening gates one by one reaches each next objective
  and finally the exit;
- every spawn marker and pickup sits on a reachable floor tile once all
  gates are open;
- same seed gives identical output.
