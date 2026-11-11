# Unit 16: Chaos Rotblood roster (minus Lords)

## Goal

Add the Vermintide 2 Rotblood (Chaos) combat roster as a second playable
faction. Named Lords and Beastmen stay out of scope.

## Units

| Id | Name | Role |
| -- | ---- | ---- |
| `fanatic` | Fanatic | Horde |
| `raider` | Raider | Horde |
| `bulwark` | Bulwark | Horde (shielded Raider via `SHIELD_VARIANTS`) |
| `savage` | Savage | Elite (berserker flurry like Plague Monk) |
| `mauler` | Mauler | Elite (heavy hits; armored head) |
| `chaosWarrior` | Chaos Warrior | Elite (super-heavy body armor) |
| `lifeleech` | Lifeleech | Special (teleport + dodgeable grab drain) |
| `blightstormer` | Blightstormer | Special (cast chasing storm vortex) |
| `chaosSpawn` | Chaos Spawn | Monster / boss pool |
| `bileTroll` | Bile Troll | Monster / boss pool (bile spit + regen) |

## Shared mechanics

- **Shields**: Bulwark uses the same frontal `shield` path as shield rats.
- **Flurry**: Savage reuses the Monk-style chase flurry via `SAVAGE` tuning
  and the shared `monkOpened` / chain fields.
- **Lifeleech** (`behavior: "lifeleech"`, `LIFEECH`): teleport near target,
  wind-up, leechbolt hazard; dodge (`dodgeT` / iframes) misses; otherwise
  grab + pull + drain. Damage interrupts and forces chase again. Storm /
  bolt hazards clear when the owner dies.
- **Blightstormer** (`behavior: "blightstormer"`, `BLIGHTSTORM`): cast with
  green tendril telegraph, then a wall-colliding `blightstorm` that chases
  and tosses heroes; kill dissolves the storm.
- **Chaos Spawn**: boss melee + tentacle grab (reuse `grabbed`) with chew
  lifesteal (`SPAWN`).
- **Bile Troll**: boss melee + `bileglobe`/`bile` ground DoT; idle regen;
  one kneel-regen at 50% HP cancelled by damage (`BILE_TROLL`).

## Director and pools

- All ten use `race: "chaos"`. `enemiesForRaces` no longer falls back to
  Skaven when Chaos is in allowable races.
- Default mission Director stays Skaven-hardcoded.
- Wastes with Chaos in `allowableRaces` mix Skaven + Chaos horde/elite/special
  and can roll Chaos Spawn / Bile Troll in the boss pool.

## Testing zone

Chaos summon row markers: `a b c d f g i n t v` (fanatic through bile troll).
Portal spawn path unchanged.

## Tuning

`SAVAGE`, `LIFEECH`, `BLIGHTSTORM`, `SPAWN`, `BILE_TROLL` in
`shared/src/tuning.ts`.
