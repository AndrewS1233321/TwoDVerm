# UI Context

## Theme

Dark, grim, gothic. A plague-ridden medieval city at night: muddy
stone, dim lantern light, rust and blood accents. Gameplay readability
always wins over atmosphere. Enemies, telegraphs and HUD must be
instantly readable at a glance.

## Colors

Defined as constants in `client/src/render/palette.ts` (game) and as
CSS custom properties in `client/index.html` (menus). No raw hex values
elsewhere.

| Role                    | Token            | Value     |
| ----------------------- | ---------------- | --------- |
| Page/void background    | `bgBase`         | `#0e0c0b` |
| Floor stone             | `floor`          | `#2a2623` |
| Wall stone              | `wall`           | `#4a423b` |
| Panel surface (menus)   | `surface`        | `#1c1917` |
| Primary text            | `textPrimary`    | `#e8e0d0` |
| Muted text              | `textMuted`      | `#9a8f80` |
| Accent (buttons, gold)  | `accent`         | `#c9a14a` |
| Health                  | `health`         | `#b3261e` |
| Block stamina           | `stamina`        | `#d9c46a` |
| Dodge charges           | `dodge`          | `#5fa8d3` |
| Enemy telegraph warning | `telegraph`      | `#ff5a1f` |
| Ratmen fur              | `ratFur`         | `#6b5a48` |
| Warpstone glow (specials)| `warp`          | `#7cff4f` |
| Smoke cloud              | `smoke`         | `#c4beb4` |
| Success                 | `success`        | `#6fbf5f` |

### Hero colours

| Hero         | Token          | Value     |
| ------------ | -------------- | --------- |
| Soldier      | `heroSoldier`  | `#3d6fb6` |
| Elf ranger   | `heroRanger`   | `#4f9a4a` |
| Dwarf        | `heroDwarf`    | `#c4782f` |
| Witch hunter | `heroHunter`   | `#8a3fa0` |

## Typography

| Role       | Font                                    |
| ---------- | --------------------------------------- |
| Titles     | "Cinzel", serif fallback                |
| UI and HUD | "Inter", system-ui sans-serif fallback  |

Until web fonts are added, use `Georgia, serif` for titles and
`system-ui, sans-serif` for UI.

## Sprites

- Top-down, one drawing per creature, rotated to `facing`.
- Each sprite has an obvious front (snout, weapon, or face marker).
- Sprite size matches the creature's `radius` from `shared/` data.
- Weapons are separate sprites that swing through their attack arc.
- Animation uses tweens: swing arcs, flashes, squash-and-stretch.
- Skaven looks (code-drawn in `client/src/render/textures.ts`):
  slave / clanrat / stormvermin as before; shield variants carry a round
  or tower shield; Plague Monk wears a ragged green robe; Gutter Runner
  is lean and dark with claw tips; Warpfire Thrower has a tank and nozzle;
  Sack Rat hauls a coin sack; Stormfiend is Rat Ogre–sized with arm cannons;
  Warplock Jezzail reads as a pavise rat in front with a gunner behind and
  a long rifle resting on the shield top.
- Gutter Runners render nearly invisible while stalking; warpfire spray
  shows an orange cone telegraph; leaps leave a short afterimage trail.
- Jezzail aim draws a red laser along facing to wall/range; the shot uses a
  bright, short-lived sniper tracer (`kind: "jezzail"`).
- Chaos Rotblood looks are biped humanoids (not rats): Fanatic/Raider/Bulwark
  (shield), Savage (tattooed dual-axe), Mauler (helmet), Chaos Warrior (plate),
  Lifeleech (hood + staff), Blightstormer (mask + book), Chaos Spawn (tentacles),
  Bile Troll (green bulk + belly maw). Blightstormer cast shows green tendrils;
  storms are pulsing green vortices; bile is a green ground puddle.

## Feedback

- Enemy wind-up: telegraph-coloured flash or arc on the ground.
- Hit taken: white flash on the creature, brief hit-pause (~60ms).
- Backstab: larger number/flash and distinct sound.
- Guard break: stamina bar flashes, short screen shake.

## Layout Patterns

- Menus: centered panel on `surface` over `bgBase`, gold accent buttons.
- In-game HUD: own health, block stamina and dodge charges bottom-left;
  level name and difficulty in small text at the top-left, with
  teammates' health just under that; ammo bottom-right. Levels without
  a rolled difficulty (Default, Testing zone, merchant hall) show the
  name only.
- Camera follows the local player.
