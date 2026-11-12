# Unit 17: Merchant weapons (v1 defaults-only)

## Goal

Players can buy weapons at the merchant. Weapons are **primary** (melee
kits) or **secondary** (ranged kits), **hero-bound**, and replace the
matching slot. V1 ships only each hero’s current default kits,
pre-equipped for free. Buying costs **100 GP** and re-equips that same
kit (gold sink; combat unchanged). Weapon **hero mods** are **+0
placeholders** for a later pass.

## Rules

- Primary buy replaces the current primary; secondary buy replaces the
  current secondary.
- Weapons are not interchangeable between characters (shop ids are
  hero-scoped, e.g. `ranger_daggers`).
- Weapons are whole packages (dual daggers = one entry; no component
  purchases).
- Combat numbers stay on existing `WeaponDef` / `RangedDef` tables.
- Hero attribute mods on weapons (`stamina`, `dodges`, `speed`,
  `staggerResist`, …) exist but are all `0` in v1.
- Buy is allowed even when that weapon is already equipped (unlike
  armor). Cost is always 100 GP when the buyer can afford it.

## Catalog (v1)

| Id | Hero | Slot | Combat kit |
| -- | ---- | ---- | ---------- |
| `soldier_greatsword` | Markus | primary | Executioner Greatsword |
| `soldier_sword_and_shield` | Markus | primary | Sword and Shield (+4 stamina, +1 stagger resist) |
| `soldier_repeater` | Markus | secondary | Repeater Handgun |
| `ranger_daggers` | Kerri | primary | Dual Daggers |
| `ranger_longbow` | Kerri | secondary | Longbow |
| `dwarf_hammer` | Bardin | primary | Dwarf War Hammer |
| `dwarf_handgun` | Bardin | secondary | Handgun |
| `hunter_rapier` | Viktor | primary | Duellist Rapier |
| `hunter_pistols` | Viktor | secondary | Brace of Pistols |

## Runtime

- Live heroes store `primaryWeaponId` / `secondaryWeaponId`.
- `createHero` / `equipWeapon` clone the hero def and assign
  `weapon` / `ranged` from the equipped shop entries (never mutate
  shared `HEROES`).
- Stats path: armor tradeoffs + weapon mods (zeros in v1).
- Secondary equip caps ammo to the new max.
- Equipped ids persist across Wastes stops with gold / armor / perks.

## Merchant UI

Shop shows a **Weapons** section filtered to the local hero, with
Primary and Secondary entries. Equipped label when ids match; Buy when
gold ≥ 100 (including re-buy of the equipped kit).
