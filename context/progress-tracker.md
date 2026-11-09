# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Playtesting and tuning (all 12 units built)

## Current Goal

- Playtest Default, Testing zone, and The Gingey Wastes procedural
  expedition loop.

## Completed

- **Sewer layout**: each section rolls 5–12 rooms; tunnels between
  rooms / sections are 10–25 tiles long and 2 wide; barrel density
  halved vs other level types.
- **Forest layout**: 3–5 large clearings (~75 tiles each), short wide
  paths (4–10 long, 3–5 wide), lush green decor, barrels render as
  bushes/small trees, higher ambient/horde density in clearings.
- **Boss room lock**: Rat Ogre only spawns when every living hero is in
  the boss arena; while `bossActive`, heroes are confined to that room
  until the ogre dies (Default + Wastes proc). Boss area covers the
  full room footprint (proc) / full chamber including trigger strip
  (mission 1); client paints BOSS over `bossRoom`.
- **Hold entry horde**: first time players enter a hold event (mission
  square or proc hold objective), Director spawns a horde at 2× regular
  size (`hordeSize() * 2`).
- **Merchant exit countdown**: HudScene runs in `merchant` phase so the
  centered exit hold timer matches mission / wastes exits.
- **Gold drops**: kills can drop GP (slave 5%, clanrat 10%, elite 15%,
  special 50% → 1–5 GP; Rat Ogre 100% → 100–200 GP). Drop is split
  evenly across every hero’s personal purse (remainder distributed);
  gold persists across wastes stops for merchant spending.
- **Merchant shop**: E near the merchant opens a buy menu. Item
  `dmg up +10%` costs 50 GP, stackable for the run (+10% all hero
  damage per stack via `shopDamageMul`); stacks shown under the
  explosion icon. Economy resets when a new run starts.
- **Wastes `devTest`**: host-only create checkbox when mode is The
  Gingey Wastes. Room stores `devTest`; on Start the party begins in
  the merchant hall with `DEV_TEST_START_GOLD` (1000) each, then the
  normal map vote after the exit hold (expeditionStop still 0).
- **Block interrupt**: holding block immediately cancels attack /
  charge / shoot / push / barrel charge and raises guard. Revive can
  continue while RMB is held (front blocks still work during the
  channel).
- **Bardin barrel handling**: built-in — 0.35s throw release (range
  charges from hold start), full move speed while carrying.
- **Ranged precision aim**: with a ranged weapon drawn, RMB no longer
  blocks — screen-space cursor crosshair; LMB fires an instant point-hit
  (tiny radius, impact FX only — no travel tracer). Walls block LOS (shot
  fails). Head hotspot along facing (scales with body size) = 2×
  (`PRECISION_SHOT`).
- **Hero perks**: data-driven `PERKS` table (`shared/src/data/perks.ts`)
  with per-hero eligibility and `requires` / `excludes` fields for
  future dependencies. Merchant lists every eligible perk each visit
  (`perksOfferedFor`); one-time buys at 50 GP; persist for the run.
  Bardin's **Rune Ward** — every 20s absorbs one discrete hit
  (`strikeHero`; gas / drag ticks ignore it), shown as a faint light
  blue glow while charged. Kerri's **Smoke Bomb** — a dodge drops a
  smoke cloud (radius = 5 × her diameter) for 0.75s that staggers
  enemies inside it and deals no damage; when the dodge ends she is
  hidden for 3s (no aggro, not a target, current chasers drop her).
  Future: random offer pools and per-perk pricing slot into
  `perksOfferedFor` / `PerkDef.cost`.
- **Barrels**: procedural rooms roll density (50% none / 25% few /
  15% many / 10% lots); barrels are pushable, destroyable, pick-upable
  (E), throw with charged left-click (breaks for AoE damage), Q drops;
  carry halves move speed. Testing zone also spawns a few near start.
- **Procedural Gingey Wastes levels**: shared `generateLevel(props, seed)`
  room-based layouts (castle/dungeon aesthetics; other types stub the
  same generator). `LevelProperties` (type, difficulty, races), Skaven
  race tags, Director budgets from difficulty, section objectives
  (hold / mini-boss / final boss), exit gate + 10s hold → merchant →
  next vote. Client regenerates from synced seed/props; vote UI shows
  rolled props. `npm run check:procgen`.
- **The Gingey Wastes** game mode: Chaos Wastes–style Holseher's Map
  after lobby; majority vote on randomised forks; after each clear,
  party enters a merchant hall (shop NPC + exit hold 10s) then next
  map vote; 4 stops then results.
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
  Optional host `devTest` (Wastes only) starts the run in the merchant
  hall with 1000 GP before the first map vote. Wastes uses phase
  `expedition` for map voting, then `generateLevel` +
  `loadGeneratedLevel` before `startMission`. Testing disables the
  Director and uses edge-triggered summon pads instead of horde
  pacing. Hand-authored ASCII remains for Default, Testing, merchant,
  and camp.
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
