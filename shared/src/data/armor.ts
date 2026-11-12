import type { HeroDef, HeroId } from "./types";
import { sumWeaponMods, type ShopWeaponId } from "./shopWeapons";

export type ArmorLevel = "none" | "light" | "medium" | "heavy" | "superHeavy";

/** Lightest to heaviest. Armor pierce steps a level down this list. */
export const ARMOR_LEVELS: readonly ArmorLevel[] = ["none", "light", "medium", "heavy", "superHeavy"];

/** Fraction of damage removed at each armor level. */
export const ARMOR_REDUCTION: Record<ArmorLevel, number> = {
  none: 0,
  light: 0.25,
  medium: 0.5,
  heavy: 0.75,
  superHeavy: 0.95,
};

export const ARMOR_LEVEL_NAMES: Record<ArmorLevel, string> = {
  none: "Unarmored",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  superHeavy: "Super heavy",
};

export type ArmorLocation = "head" | "front" | "side" | "back";

export const ARMOR_LOCATIONS: readonly ArmorLocation[] = ["head", "front", "side", "back"];

export type ArmorLoadout = Record<ArmorLocation, ArmorLevel>;

export const UNARMORED: ArmorLoadout = { head: "none", front: "none", side: "none", back: "none" };

/** One armor tier lighter, floored at unarmored. */
export function lighterArmorLevel(level: ArmorLevel): ArmorLevel {
  const i = ARMOR_LEVELS.indexOf(level);
  return ARMOR_LEVELS[Math.max(0, i - 1)]!;
}

/**
 * Training-dummy loadout: head / front / side at `level`, back one tier
 * lighter (unarmored stays fully unarmored).
 */
export function dummyArmorLoadout(level: ArmorLevel): ArmorLoadout {
  return {
    head: level,
    front: level,
    side: level,
    back: lighterArmorLevel(level),
  };
}

/** Armor level after `pierce` levels are stripped off (never below none). */
export function effectiveArmorLevel(level: ArmorLevel, pierce = 0): ArmorLevel {
  const i = Math.max(0, ARMOR_LEVELS.indexOf(level) - Math.max(0, Math.floor(pierce)));
  return ARMOR_LEVELS[i]!;
}

/** Fraction of damage removed by the armor at `location`, after armor pierce. */
export function armorReduction(loadout: ArmorLoadout, location: ArmorLocation, pierce = 0): number {
  return ARMOR_REDUCTION[effectiveArmorLevel(loadout[location], pierce)];
}

/** Stat changes a hero armor set brings with it. Omitted fields mean no change. */
export interface ArmorTradeoffs {
  /** Multiplies movement speed. */
  speedMul?: number;
  /** Multiplies turn rate. */
  turnRateMul?: number;
  /** Added to the hero's dodge charges (never below 0). */
  dodgesDelta?: number;
  /** Multiplies dodge speed (and so dodge distance). */
  dodgeDistanceMul?: number;
  /** Multiplies block stamina. */
  staminaMul?: number;
}

export type ArmorSetId = "markusDefault" | "kerriDefault" | "bardinDefault" | "viktorDefault";

/** A full set of hero armor. Heroes always wear exactly one set; buying another replaces it. */
export interface ArmorSetDef {
  id: ArmorSetId;
  name: string;
  hero: HeroId;
  cost: number;
  loadout: ArmorLoadout;
  tradeoffs: ArmorTradeoffs;
  description: string;
}

export const ARMOR_SETS: Record<ArmorSetId, ArmorSetDef> = {
  markusDefault: {
    id: "markusDefault",
    name: "Markus Default",
    hero: "soldier",
    cost: 0,
    loadout: UNARMORED,
    tradeoffs: {},
    description: "Starting kit.",
  },
  kerriDefault: {
    id: "kerriDefault",
    name: "Kerri Default",
    hero: "ranger",
    cost: 0,
    loadout: UNARMORED,
    tradeoffs: {},
    description: "Starting kit.",
  },
  bardinDefault: {
    id: "bardinDefault",
    name: "Bardin Default",
    hero: "dwarf",
    cost: 0,
    loadout: UNARMORED,
    tradeoffs: {},
    description: "Starting kit.",
  },
  viktorDefault: {
    id: "viktorDefault",
    name: "Viktor Default",
    hero: "hunter",
    cost: 0,
    loadout: UNARMORED,
    tradeoffs: {},
    description: "Starting kit.",
  },
};

export const ARMOR_SET_IDS = Object.keys(ARMOR_SETS) as ArmorSetId[];

export const DEFAULT_ARMOR_SET: Record<HeroId, ArmorSetId> = {
  soldier: "markusDefault",
  ranger: "kerriDefault",
  dwarf: "bardinDefault",
  hunter: "viktorDefault",
};

export function isArmorSetId(v: unknown): v is ArmorSetId {
  return typeof v === "string" && v in ARMOR_SETS;
}

/** Armor sets this hero can wear, in merchant listing order. */
export function armorSetsForHero(heroId: string): ArmorSetDef[] {
  return ARMOR_SET_IDS.map((id) => ARMOR_SETS[id]).filter((s) => s.hero === heroId);
}

/** A hero's base stats after their armor set's trade-offs. */
export interface ArmoredHeroStats {
  speed: number;
  turnRateMul: number;
  dodges: number;
  dodgeSpeedMul: number;
  stamina: number;
}

export function armoredHeroStats(def: HeroDef, setId: ArmorSetId): ArmoredHeroStats {
  const t = ARMOR_SETS[setId].tradeoffs;
  return {
    speed: def.speed * (t.speedMul ?? 1),
    turnRateMul: t.turnRateMul ?? 1,
    dodges: Math.max(0, def.dodges + (t.dodgesDelta ?? 0)),
    dodgeSpeedMul: t.dodgeDistanceMul ?? 1,
    stamina: def.stamina * (t.staminaMul ?? 1),
  };
}

/** Armor trade-offs plus additive primary/secondary weapon mods. */
export function heroStatsWithGear(
  def: HeroDef,
  setId: ArmorSetId,
  primaryWeaponId: ShopWeaponId,
  secondaryWeaponId: ShopWeaponId,
): ArmoredHeroStats {
  const base = armoredHeroStats(def, setId);
  const mods = sumWeaponMods(primaryWeaponId, secondaryWeaponId);
  return {
    speed: base.speed + mods.speed,
    turnRateMul: base.turnRateMul,
    dodges: Math.max(0, base.dodges + mods.dodges),
    dodgeSpeedMul: base.dodgeSpeedMul,
    stamina: base.stamina + mods.stamina,
  };
}

/** Short trade-off summary for UI, e.g. "Speed -10%, Dodges -1". */
export function describeTradeoffs(t: ArmorTradeoffs): string {
  const pct = (m: number) => `${m >= 1 ? "+" : ""}${Math.round((m - 1) * 100)}%`;
  const parts: string[] = [];
  if (t.speedMul !== undefined && t.speedMul !== 1) parts.push(`Speed ${pct(t.speedMul)}`);
  if (t.turnRateMul !== undefined && t.turnRateMul !== 1) parts.push(`Turning ${pct(t.turnRateMul)}`);
  if (t.dodgesDelta) parts.push(`Dodges ${t.dodgesDelta > 0 ? "+" : ""}${t.dodgesDelta}`);
  if (t.dodgeDistanceMul !== undefined && t.dodgeDistanceMul !== 1) parts.push(`Dodge distance ${pct(t.dodgeDistanceMul)}`);
  if (t.staminaMul !== undefined && t.staminaMul !== 1) parts.push(`Stamina ${pct(t.staminaMul)}`);
  return parts.join(", ");
}
