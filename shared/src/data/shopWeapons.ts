import type { HeroId, RangedDef, WeaponDef } from "./types";
import {
  DUAL_DAGGERS,
  GREATSWORD,
  HANDGUN,
  LONGBOW,
  PISTOLS,
  RAPIER,
  REPEATER,
  SWORD_AND_SHIELD,
  WAR_HAMMER,
} from "./weapons";

export type WeaponSlot = "primary" | "secondary";

/** Additive hero attribute changes from an equipped weapon. V1 uses zeros. */
export interface WeaponHeroMods {
  stamina: number;
  dodges: number;
  speed: number;
  staggerResist: number;
}

export const ZERO_WEAPON_MODS: WeaponHeroMods = {
  stamina: 0,
  dodges: 0,
  speed: 0,
  staggerResist: 0,
};

export type ShopWeaponId =
  | "soldier_greatsword"
  | "soldier_sword_and_shield"
  | "soldier_repeater"
  | "ranger_daggers"
  | "ranger_longbow"
  | "dwarf_hammer"
  | "dwarf_handgun"
  | "hunter_rapier"
  | "hunter_pistols";

interface ShopWeaponBase {
  id: ShopWeaponId;
  hero: HeroId;
  name: string;
  cost: number;
  mods: WeaponHeroMods;
}

export type ShopWeapon =
  | (ShopWeaponBase & { slot: "primary"; melee: WeaponDef })
  | (ShopWeaponBase & { slot: "secondary"; ranged: RangedDef });

const COST = 100;

export const SHOP_WEAPONS: Record<ShopWeaponId, ShopWeapon> = {
  soldier_greatsword: {
    id: "soldier_greatsword",
    hero: "soldier",
    slot: "primary",
    name: "Executioner Greatsword",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    melee: GREATSWORD,
  },
  soldier_sword_and_shield: {
    id: "soldier_sword_and_shield",
    hero: "soldier",
    slot: "primary",
    name: "Sword and Shield",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS, stamina: 4, staggerResist: 1 },
    melee: SWORD_AND_SHIELD,
  },
  soldier_repeater: {
    id: "soldier_repeater",
    hero: "soldier",
    slot: "secondary",
    name: "Repeater Handgun",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    ranged: REPEATER,
  },
  ranger_daggers: {
    id: "ranger_daggers",
    hero: "ranger",
    slot: "primary",
    name: "Dual Daggers",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    melee: DUAL_DAGGERS,
  },
  ranger_longbow: {
    id: "ranger_longbow",
    hero: "ranger",
    slot: "secondary",
    name: "Longbow",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    ranged: LONGBOW,
  },
  dwarf_hammer: {
    id: "dwarf_hammer",
    hero: "dwarf",
    slot: "primary",
    name: "Dwarf War Hammer",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    melee: WAR_HAMMER,
  },
  dwarf_handgun: {
    id: "dwarf_handgun",
    hero: "dwarf",
    slot: "secondary",
    name: "Handgun",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    ranged: HANDGUN,
  },
  hunter_rapier: {
    id: "hunter_rapier",
    hero: "hunter",
    slot: "primary",
    name: "Duellist Rapier",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    melee: RAPIER,
  },
  hunter_pistols: {
    id: "hunter_pistols",
    hero: "hunter",
    slot: "secondary",
    name: "Brace of Pistols",
    cost: COST,
    mods: { ...ZERO_WEAPON_MODS },
    ranged: PISTOLS,
  },
};

export const SHOP_WEAPON_IDS = Object.keys(SHOP_WEAPONS) as ShopWeaponId[];

export const DEFAULT_PRIMARY: Record<HeroId, ShopWeaponId> = {
  soldier: "soldier_greatsword",
  ranger: "ranger_daggers",
  dwarf: "dwarf_hammer",
  hunter: "hunter_rapier",
};

export const DEFAULT_SECONDARY: Record<HeroId, ShopWeaponId> = {
  soldier: "soldier_repeater",
  ranger: "ranger_longbow",
  dwarf: "dwarf_handgun",
  hunter: "hunter_pistols",
};

export function isShopWeaponId(v: unknown): v is ShopWeaponId {
  return typeof v === "string" && v in SHOP_WEAPONS;
}

export function getShopWeapon(id: ShopWeaponId): ShopWeapon {
  return SHOP_WEAPONS[id];
}

/** Weapons this hero can buy, primary then secondary, in merchant listing order. */
export function weaponsForHero(heroId: string): ShopWeapon[] {
  return SHOP_WEAPON_IDS.map((id) => SHOP_WEAPONS[id]).filter((w) => w.hero === heroId);
}

export function sumWeaponMods(primaryId: ShopWeaponId, secondaryId: ShopWeaponId): WeaponHeroMods {
  const a = SHOP_WEAPONS[primaryId].mods;
  const b = SHOP_WEAPONS[secondaryId].mods;
  return {
    stamina: a.stamina + b.stamina,
    dodges: a.dodges + b.dodges,
    speed: a.speed + b.speed,
    staggerResist: a.staggerResist + b.staggerResist,
  };
}
