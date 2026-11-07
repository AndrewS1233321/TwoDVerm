# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Playtesting and tuning (all 12 units built)

## Current Goal

- Playtest Default, Testing zone, and The Gingey Wastes map vote;
  expand wastes levels beyond bare shells.

## Completed

- **The Gingey Wastes** game mode: Chaos Wastes–style Holseher's Map
  (Gingey's Map) after lobby. Two random location forks with
  placeholder info; majority vote; after each win a new randomised
  fork (prefer unplayed); 4 stops then expedition results. Four
  bare placeholder levels in the pool.
- Game modes: create-menu select for **Default** (mission 1) and
  **Testing zone**. Mode is fixed for the room. Testing zone has a
  central room (starts + unarmoured/armoured dummies) and a summon
  room with one green pad per combat enemy type (step on pad to
  spawn). Director disabled in testing; no auto-victory.
- Unit 01: context files and build plan written.
- Unit 02: skeleton. `npm run dev` starts Colyseus (port 2567) and Vite
  (port 5173). Colyseus 0.16, Phaser 3, Vite 6.
- Unit 03: main menu, 4-letter room codes, invite link (`?code=ABCD`),
  lobby with hero picks and host start, reconnect after refresh, results
  screen. One Node server serves the client build and the game in
  production. `Dockerfile` and `fly.toml` written (region `syd`).
- Unit 04: local prediction with replay of unacknowledged inputs and eased
  corrections; others interpolated 110ms behind. Tested with `npm run
  dev:lag` (100ms each way): ~150ms ping, corrections under 12px, final
  positions match the server exactly.
- Unit 05: separate light and heavy chains (hold 0.2s for heavy), block
  (front only, block stamina, guard break), push, dodge (own charges,
  i-frames), front/side/back damage, hit numbers, hit-pause, shake, sounds.
- Unit 06: slave rats, clanrats, Stormvermin with telegraphed swings;
  downed state with bleed-out, hold-E revive, respawn after 45s.
- Unit 07: 118x32 tile mission as an ASCII map; flow-field pathing (wide
  field for large creatures); victory in the end zone, defeat when all are
  down.
- Units 08-09: AI Director (intensity, hordes, elites after 2 minutes,
  specials capped at 2); Ratling Gunner, Globadier, Packmaster.
- Units 10-12: four heroes with their own weapons, ranged weapons and
  ultimates; hold-the-square event that opens the gate; Rat Ogre boss;
  HUD, generated music and sound, settings, pause menu.
- Tests: `npm run combat-test` (17 checks) and `npm run mission-test`
  (19 checks, including 90 rats at ~0.2ms per tick) all pass.

## In Progress

- None.

## Next Up

- First deploy (`fly launch`, `fly deploy --ha=false`) and a friend test.
- Tuning pass from playtest notes.

## Open Questions

- Is the horde size right for 4 real players (10 + 5 per player)?
- Should ammo crates be single-use like medical supplies?

## Architecture Decisions

- Game mode is chosen by the host at create time and stored on the
  room (`default` | `testing` | `wastes`). Joiners inherit it.
  Wastes uses phase `expedition` for map voting, then `loadLevel`
  swaps the ASCII map before `startMission`. Testing disables the
  Director and uses edge-triggered summon pads instead of horde pacing.
- Q toggles melee / ranged. While ranged is drawn, left click fires
  (hold to keep shooting on cooldown); Q again returns to melee.
- Server-authoritative simulation from the start, because retrofitting
  multiplayer onto a single-player game is very costly.
- Colyseus for rooms and state sync, to avoid writing low-level netcode.
- Phaser physics not used; collision lives in `shared/` so the server
  (which has no Phaser) runs the same rules.
- Every creature has facing and radius, so directional hits and
  different sizes work identically for heroes and enemies.
- Two separate player resources: block stamina and dodge charges.
- Light and heavy chains are independent counters (a heavy in the middle
  does not reset the light chain); both reset after 0.9s without attacking.
- Levels are ASCII maps in `shared/` instead of Tiled, so the server and
  client read the same file with no extra tool or loader.
- Menus are an HTML overlay rather than Phaser scenes: text input,
  buttons and copy-to-clipboard come for free.
- Sprites are drawn in code and sounds are synthesised, so the game is a
  single ~400KB (gzipped) download.
- Unaware enemies count every hit as a back hit (rewards sneaking up).

## Session Notes

- Node v24 and git are installed on the dev machine.
- The Fly CLI is not installed yet; Docker Desktop is installed but was
  not running, so the image was not built locally (Fly builds it remotely).
