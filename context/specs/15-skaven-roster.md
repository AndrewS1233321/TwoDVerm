# Unit 15: Full Skaven roster (minus Lords)

## Goal

Fill out the Vermintide 2 Skaven roster beyond the original seven combat
enemies. Named Lords and stormvermin patrol formations stay out of scope.

## Already present

Slave Rat, Clanrat, Stormvermin, Ratling Gunner, Globadier, Packmaster,
Rat Ogre.

## Added

| Id | Name | Role |
| -- | ---- | ---- |
| `shieldClanrat` | Shielded Clanrat | Horde (about 20% of clanrat picks) |
| `shieldStormvermin` | Shielded Stormvermin | Elite |
| `plagueMonk` | Plague Monk | Elite (wind-up opener + 3 dash strikes with white flash) |
| `gutterRunner` | Gutter Runner | Special (leap + pin) |
| `warpfire` | Warpfire Thrower | Special (fire cone) |
| `sackRat` | Sack Rat | Loot runner (ambient, not a Director special) |
| `stormfiend` | Stormfiend | Monster / Wastes boss pool (400px / 50° green warpflame cone; ground burns for 5s) |

## Shared mechanics

- **Shields** (`EnemyDef.shield`): a frontal hit on an aware, non-staggered
  shield-bearer does no damage and emits a `block` fx. Stagger power >= 2
  (heavies / push) breaks the guard for `SHIELD.breakStagger` seconds.
  Side and back hits land normally.
- **Cone spray** (`sprayCone`): used by the Warpfire Thrower and the
  Stormfiend. Damages heroes in an arc with line of sight; cannot be
  blocked (dodge or leave the cone).
- **Pin**: Gutter Runner reuses the hero `grabbed` state. The runner stays
  on top dealing DPS; any teammate hit or push releases it (same path as
  Packmaster drag).
- **Boss pool**: `enemiesForRaces` exposes `bosses`. Authored Wastes maps
  pick the final boss from that list with the run seed (Rat Ogre or
  Stormfiend). The Default mission still always spawns a Rat Ogre. The HUD
  boss bar shows any `behavior === "boss"` enemy by name.

## Director and pools

- Specials: gunner, gas, hooker, gutterRunner, warpfire (Wastes uses the
  race special pool).
- Elites: stormvermin, shieldStormvermin, plagueMonk.
- Horde clanrats can roll a shield via `maybeShielded`.
- Sack Rats: 0–2 per Wastes map at ambient-rat markers.

## Testing zone

Second summon-pad row: `8 9 0 q w x y` for the seven new enemies.

## Tuning

Numbers live in each enemy def and in `shared/src/tuning.ts`
(`WARPFIRE`, `STORMFIEND_FIRE`, `RUNNER`, `SHIELD`, `SACK_RAT`). Tweaks
are one-prompt changes after playtest.
