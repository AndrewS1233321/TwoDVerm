# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Playtesting and tuning (all 12 units built)

## Current Goal

- Playtest Default, Testing zone, and The Gingey Wastes expedition
  loop; playtest the four authored Wastes missions and tune layout,
  spawn spots and pacing from feedback.

## Completed

- **Weeping Quarry mine pass**: layout rebuilt with winding 3-wide
  corridors between rooms; `theme: "mine"` paints `DECOR_MINE` floors
  (packed dirt, cart tracks in corridor stretches), dark basalt
  crumbling rock walls (high contrast vs floor), iron wall lanterns
  (instead of torches), and decorative non-interactable debris (broken
  rock, pickaxes, bones). Overview render:
  `npx tsx scripts/render-wastes-maps.ts`.
- **Level corner label**: while playing or in a merchant hall, the HUD
  shows the level name in small text at the top-left, with rolled
  difficulty (`Difficulty 1.0` … `4.0`) on the line under it when the
  level has one. Teammate bars sit below that label.
- **Authored Wastes missions** (spec `13-authored-wastes-missions.md`):
  Grim Causeway, Weeping Quarry, Salt Hollow and Cinder Watch each load
  one fixed layout (`shared/src/levels/expeditionLevels.ts`) instead of
  room procgen. Pacing loosely follows Vermintide 2 missions; layouts
  and names are original. Legend: `H` hold, `K` mini-boss, `B` boss
  arena, gates `1`/`2`/`3` (open after each objective; `3` seals the
  exit), `b` barrel spot (seed keeps ~2/3). `buildWastesLevel` (server
  + client) returns the same `{ level, meta }` as procgen, so the
  objective / gate / Director logic is unchanged. Level types are fixed
  per location (castle, caverns, caverns, castle). Maps are capped at
  180x90 tiles. `npm run check:wastes` validates gating, markers and
  determinism. `generateLevel` is no longer used by the vote flow.

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
- **Wastes staging hall**: on Start (Gingey Wastes), the party always
  enters the Testing zone as a hub (`enterWastesHub`) — merchant NPC,
  summon pads, dummies — whether or not `devTest` is checked. A green
  **TO THE WASTES** pad requires the whole living party for 10s, then
  opens Gingey's Map. HUD shows the countdown, or "Waiting on other
  players..." when only some are on the pad. `devTest` still only
  grants `DEV_TEST_START_GOLD` (1000). Mid-run merchant halls stay on
  `wastes_merchant`. Testing mode ignores the pad for victory. The
  wastes-gate room is open to the central/summon corridor (no sealed
  wall).   Central hall has **two ammo crates** (left/right above the
  dummy row). Wastes staging (`enterWastesHub`) now spawns those
  pickups too — it previously cleared pickups and never re-added them
  (Testing mode `startMission` already did).
- **Block interrupt**: holding block immediately cancels attack /
  charge / shoot / push / barrel charge and raises guard. Revive can
  continue while RMB is held (front blocks still work during the
  channel).
- **Ult interrupt**: pressing F (ultimate) fires immediately from any
  actionable state (attack any phase, charge, shoot, push, revive,
  stagger, idle). It cancels the current action/animation but does
  not cancel blocking or an in-progress dodge. Still blocked while
  dead / downed / grabbed.
- **Staging-hall barrels**: merchant-phase sim now runs `updateBarrels`
  so carried barrels follow the hero and thrown barrels land/explode
  like on wastes proc maps (previously stuck mid-air / not attached).
- **Bardin barrel handling**: built-in — 0.35s throw release (range
  charges from hold start), full move speed while carrying.
- **Ranged precision aim**: with a ranged weapon drawn, RMB no longer
  blocks — screen-space cursor crosshair; LMB fires an instant point-hit
  (tiny radius, impact FX only — no travel tracer). Walls block LOS (shot
  fails). Head hotspot along facing (scales with body size) = 2×
  (`PRECISION_SHOT`).
- **Kerri longbow draw**: hip-fire is hold-LMB to draw (up to 1s),
  release to fire. Damage scales linearly from 20 → 40; full draw flashes
  white (`bowDrawn`). Ammo 45, pierce 1 (no multi-target). RMB precision
  still fires instantly at full damage. Guns keep hold-to-auto-fire.
- **Markus repeater spray**: while holding LMB, the first
  `holdSprayAfterShots` (2) hip-fire shots use normal cooldown/spread;
  further shots in that hold use `holdSprayCooldown` (0.03s) and a very
  wide `holdSpraySpread`. Releasing LMB (or precision aim / dodge)
  resets the streak. RMB precision is unchanged.
- **Hero perks**: data-driven `PERKS` table (`shared/src/data/perks.ts`)
  with per-hero eligibility and `requires` / `excludes` fields for
  future dependencies. Merchant lists every eligible perk each visit
  (`perksOfferedFor`); one-time buys at 50 GP; persist for the run.
  Bardin's **Rune Ward** — every 20s absorbs one discrete hit
  (`strikeHero`; gas / drag ticks ignore it), shown as a faint light
  blue glow while charged. Bardin's **Old Goat** — dodging into an
  enemy stops the dodge, deals 160 armour-piercing damage with heavy
  knockback and no stagger, and forces those enemies to target him.
  Kerri's **Smoke Bomb** — a dodge drops a smoke cloud (radius =
  2.5 × her diameter) for 0.75s that staggers enemies inside it and
  deals no damage; when the dodge ends she is hidden for 1.5s (no
  aggro, not a target, current chasers drop her). Kerri's **Elvish
  Wrath** — hold F to charge Trueflight Volley (purple pulsing glow);
  every 0.5s adds +2 arrows and +25 range (max 4s, purple flash +
  rapid glow); release fires with the same targeting as the base
  volley. Without the perk, F still fires the base 3-arrow volley
  instantly. Viktor's **Riposte**
  — after a player dodge (not Animosity), the next melee attack has
  1.5× reach and deals a guaranteed critical (`RIPOSTE.critMul`); gold
  arc shows when charged, and the strike draws a white flash along the
  extended attack path. Markus's **No retreating** — while dodging,
  body-check contacts stagger enemies (no damage); stagger/knockback
  scale up sharply toward the end of the dodge (`noRetreatingWeight`),
  with end contact radius 1.5× his body size. Future: random offer
  pools and per-perk pricing slot into `perksOfferedFor` /
  `PerkDef.cost`.
- **Layered armor** (`shared/src/data/armor.ts`): armor sits per
  location (head / front / side / back) at one of five levels (none 0%,
  light 25%, medium 50%, heavy 75%, super heavy 95% reduction). Enemies
  carry an `armor` loadout (placeholders: Stormvermin head/front heavy,
  side medium, back light; others unarmored). Testing / Staging hall
  spawns one dummy per armor tier (none / light / medium / heavy /
  super heavy); each has matching head/front/side and a back one tier
  lighter (`dummyArmorLoadout`). `armorPierce` is now a number of levels
  stripped (all old piercing attacks start at 1). Head hits come from
  `head`-flagged attacks (overhead heavies `gs_h2` / `wh_h1`, rapier
  thrusts `ra_l3` / `ra_h1`, handgun, Stormvermin overhead) and
  precision headshots. Backstabs double the attack's base damage, then
  back armor applies (no longer ignored). Back armor levels are chosen
  per enemy by hand; there is no rule tying them to front/side armor.
  Heroes wear one full armor set (`ARMOR_SETS`, starting on
  `markusDefault` / `kerriDefault` / `bardinDefault` / `viktorDefault`,
  all unarmored with no trade-offs). Sets carry trade-offs (speed, turn,
  dodges, dodge distance, stamina) applied via `hero.stats`; bought
  from the merchant's Armour section (`MSG.buyArmorSet`), replacing the
  worn set for the rest of the run. Real sets are still to be defined.
- **Bardin dodges**: 1 dodge charge.
- **Barrels**: procedural rooms roll density (50% none / 25% few /
  15% many / 10% lots); barrels are pushable, destroyable, pick-upable
  (E), throw with charged left-click (breaks for AoE damage), Q drops;
  carry halves move speed. Testing zone also spawns a few near start.
- **Procedural Gingey Wastes levels** (superseded by authored missions
  above; kept as a fallback): shared `generateLevel(props, seed)`
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
  central room (starts + five armor-tier dummies spaced ~5 hero
  diameters apart, clear head/front/back), a summon room with one
  green pad per combat enemy type (step on pad to spawn), a merchant,
  and a **TO THE WASTES** hold room. Director disabled in testing; no
  auto-victory (the wastes pad is ignored). Staging Hall uses the same
  Testing zone map.
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
  Optional host `devTest` (Wastes only) grants 1000 GP at start.
  Wastes Start always loads the Testing zone staging hall (merchant +
  TO THE WASTES hold) before the first map vote. Wastes uses phase
  `expedition` for map voting, then `generateLevel` +
  `loadGeneratedLevel` before `startMission`. Testing disables the
  Director and uses edge-triggered summon pads instead of horde
  pacing; its end-zone pad never ends the mission. Hand-authored ASCII
  remains for Default, Testing, merchant, and camp.
- Q toggles melee / ranged. Guns: hold left click to keep firing on
  cooldown (Markus's repeater sprays after the first two shots in a
  hold). Kerri's longbow: hold to draw, release to fire (RMB precision
  is still click-to-fire). Q again returns to melee.
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
