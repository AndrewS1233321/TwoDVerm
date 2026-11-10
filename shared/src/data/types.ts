import type { ArmorLoadout } from "./armor";

/** One attack in a chain. Durations are seconds; angles are radians; distances are world pixels. */
export interface AttackDef {
  id: string;
  windup: number;
  active: number;
  recovery: number;
  /** Distance beyond the attacker's own radius that the attack reaches. */
  reach: number;
  /** Full width of the hit arc, centred on the attacker's facing. */
  arc: number;
  damage: number;
  /** Maximum number of targets one swing can hit. */
  cleave: number;
  /** Stagger power. A target staggers if this is at least its stagger resistance. */
  stagger: number;
  /** Stamina a blocker spends to block this attack. */
  blockCost: number;
  /** Armor levels this attack strips off the target (1 = heavy acts as medium). */
  armorPierce?: number;
  /** Lands on the head armor location instead of front / side / back. */
  head?: boolean;
  /** Extra multiplier for hits from behind, on top of the normal back-hit bonus. */
  backstabMul?: number;
  /** Forward speed (px/s) during the active phase. */
  lunge?: number;
  /** Visual swing of the weapon, relative to facing. */
  swing: { from: number; to: number; thrust?: number };
}

export type WeaponStyle = "greatsword" | "daggers" | "hammer" | "rapier" | "claws" | "halberd" | "fists";

export interface WeaponDef {
  id: string;
  name: string;
  light: AttackDef[];
  heavy: AttackDef[];
  /** Seconds of charging (after the hold threshold) before the heavy attack can be released. */
  heavyCharge: number;
  blockCostMul: number;
  style: WeaponStyle;
}

export interface RangedDef {
  id: string;
  name: string;
  damage: number;
  ammo: number;
  cooldown: number;
  pierce: number;
  spread: number;
  range: number;
  /** Armor levels each shot strips off the target. */
  armorPierce: number;
  /** Every shot lands on the head armor location. Precision headshots always do. */
  head?: boolean;
  stagger: number;
}

export type UltId = "rally" | "volley" | "impenetrable" | "dash";

export type HeroId = "soldier" | "ranger" | "dwarf" | "hunter";

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  color: string;
  radius: number;
  hp: number;
  stamina: number;
  dodges: number;
  speed: number;
  staggerResist: number;
  weapon: WeaponDef;
  ranged: RangedDef;
  ult: UltId;
  ultName: string;
  ultCooldown: number;
  description: string;
}

export type EnemyBehavior = "melee" | "gunner" | "gas" | "hooker" | "boss" | "dummy";

/** Combat enemies that appear in missions and on testing-zone summon pads. */
export type CombatEnemyId = "slave" | "clanrat" | "stormvermin" | "gunner" | "gas" | "hooker" | "ogre";

/** Training dummies in the Testing / Staging hall (one per armor tier). */
export type DummyEnemyId = "dummy" | "dummyLight" | "dummyMedium" | "dummyHeavy" | "dummySuperHeavy";

export type EnemyId = CombatEnemyId | DummyEnemyId | "merchant";

/** Faction / race tag for procedural level filters. */
export type EnemyRace = "skaven" | "beastmen" | "orcs" | "undead" | "human" | "chaos" | "none";

export interface EnemyDef {
  id: EnemyId;
  name: string;
  radius: number;
  hp: number;
  speed: number;
  turnRate: number;
  armor: ArmorLoadout;
  staggerResist: number;
  attacks: AttackDef[];
  behavior: EnemyBehavior;
  /** Uses the wide-creature flow field, avoiding gaps narrower than 3 tiles. */
  large: boolean;
  special: boolean;
  elite: boolean;
  /** Creature race for procgen filters (`none` for dummies / merchant). */
  race: EnemyRace;
}
