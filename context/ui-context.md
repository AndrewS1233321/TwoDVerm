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

## Feedback

- Enemy wind-up: telegraph-coloured flash or arc on the ground.
- Hit taken: white flash on the creature, brief hit-pause (~60ms).
- Backstab: larger number/flash and distinct sound.
- Guard break: stamina bar flashes, short screen shake.

## Layout Patterns

- Menus: centered panel on `surface` over `bgBase`, gold accent buttons.
- In-game HUD: own health, block stamina and dodge charges bottom-left;
  teammates' health top-left; ammo bottom-right.
- Camera follows the local player.
