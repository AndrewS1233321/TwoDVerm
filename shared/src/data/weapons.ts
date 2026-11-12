import { clamp, deg, lerp } from "../math";
import type { RangedDef, WeaponDef } from "./types";

export const GREATSWORD: WeaponDef = {
  id: "greatsword",
  name: "Executioner Greatsword",
  style: "greatsword",
  heavyCharge: 0.45,
  blockCostMul: 1,
  light: [
    { id: "gs_l1", windup: 0.22, active: 0.12, recovery: 0.3, reach: 42, arc: deg(110), damage: 14, cleave: 3, stagger: 1, blockCost: 1, swing: { from: -1.3, to: 1.1 } },
    { id: "gs_l2", windup: 0.2, active: 0.12, recovery: 0.3, reach: 42, arc: deg(110), damage: 14, cleave: 3, stagger: 1, blockCost: 1, swing: { from: 1.2, to: -1.1 } },
    { id: "gs_l3", windup: 0.18, active: 0.1, recovery: 0.35, reach: 54, arc: deg(30), damage: 22, cleave: 1, stagger: 1, blockCost: 1, swing: { from: 0, to: 0, thrust: 16 } },
  ],
  heavy: [
    { id: "gs_h1", windup: 0.1, active: 0.16, recovery: 0.45, reach: 48, arc: deg(170), damage: 24, cleave: 5, stagger: 2, blockCost: 2, swing: { from: -1.6, to: 1.6 } },
    { id: "gs_h2", windup: 0.1, active: 0.12, recovery: 0.5, reach: 50, arc: deg(50), damage: 42, cleave: 2, stagger: 3, blockCost: 2, armorPierce: 1, head: true, swing: { from: 0.4, to: -0.2, thrust: 10 } },
  ],
};

/** Markus Sword and Shield: shorter reach than the greatsword; fast lights + shield bash. */
export const SWORD_AND_SHIELD: WeaponDef = {
  id: "swordAndShield",
  name: "Sword and Shield",
  style: "swordAndShield",
  heavyCharge: 0.4,
  blockCostMul: 0.85,
  light: [
    { id: "ss_l1", windup: 0.1, active: 0.07, recovery: 0.14, reach: 30, arc: deg(100), damage: 11, cleave: 2, stagger: 0, blockCost: 1, swing: { from: -1.15, to: 1.0 } },
    { id: "ss_l2", windup: 0.1, active: 0.07, recovery: 0.14, reach: 30, arc: deg(100), damage: 11, cleave: 2, stagger: 0, blockCost: 1, swing: { from: 1.15, to: -1.0 } },
    { id: "ss_l3", windup: 0.1, active: 0.07, recovery: 0.15, reach: 30, arc: deg(110), damage: 12, cleave: 3, stagger: 1, blockCost: 1, swing: { from: -1.25, to: 1.15 } },
    { id: "ss_l4", windup: 0.12, active: 0.08, recovery: 0.2, reach: 34, arc: deg(28), damage: 16, cleave: 1, stagger: 1, blockCost: 1, armorPierce: 1, swing: { from: 0, to: 0, thrust: 14 } },
  ],
  heavy: [
    { id: "ss_h1", windup: 0.1, active: 0.14, recovery: 0.4, reach: 36, arc: deg(160), damage: 20, cleave: 4, stagger: 2, blockCost: 2, swing: { from: -1.55, to: 1.55 } },
    { id: "ss_h2", windup: 0.08, active: 0.1, recovery: 0.35, reach: 22, arc: deg(80), damage: 10, cleave: 2, stagger: 4, blockCost: 2, swing: { from: 0, to: 0, thrust: 12 } },
    { id: "ss_h3", windup: 0.1, active: 0.12, recovery: 0.45, reach: 34, arc: deg(24), damage: 36, cleave: 1, stagger: 2, blockCost: 2, armorPierce: 1, swing: { from: 0, to: 0, thrust: 16 } },
  ],
};

export const DUAL_DAGGERS: WeaponDef = {
  id: "daggers",
  name: "Dual Daggers",
  style: "daggers",
  heavyCharge: 0.3,
  blockCostMul: 1.5,
  light: [
    { id: "dd_l1", windup: 0.12, active: 0.08, recovery: 0.18, reach: 30, arc: deg(70), damage: 9, cleave: 1, stagger: 0, blockCost: 1, backstabMul: 1.6, swing: { from: -0.9, to: 0.7 } },
    { id: "dd_l2", windup: 0.12, active: 0.08, recovery: 0.18, reach: 30, arc: deg(70), damage: 9, cleave: 1, stagger: 0, blockCost: 1, backstabMul: 1.6, swing: { from: 0.9, to: -0.7 } },
    { id: "dd_l3", windup: 0.1, active: 0.08, recovery: 0.2, reach: 34, arc: deg(30), damage: 12, cleave: 1, stagger: 1, blockCost: 1, backstabMul: 1.6, swing: { from: 0, to: 0, thrust: 12 } },
    { id: "dd_l4", windup: 0.14, active: 0.12, recovery: 0.28, reach: 32, arc: deg(120), damage: 10, cleave: 3, stagger: 1, blockCost: 1, backstabMul: 1.6, swing: { from: -1.4, to: 1.4 } },
  ],
  heavy: [
    { id: "dd_h1", windup: 0.08, active: 0.1, recovery: 0.3, reach: 36, arc: deg(50), damage: 22, cleave: 1, stagger: 1, blockCost: 1, armorPierce: 1, backstabMul: 2, lunge: 220, swing: { from: 0, to: 0, thrust: 14 } },
    { id: "dd_h2", windup: 0.08, active: 0.2, recovery: 0.35, reach: 34, arc: deg(360), damage: 12, cleave: 5, stagger: 1, blockCost: 1, backstabMul: 1.6, swing: { from: -3.1, to: 3.1 } },
  ],
};

export const WAR_HAMMER: WeaponDef = {
  id: "hammer",
  name: "Dwarf War Hammer",
  style: "hammer",
  heavyCharge: 0.55,
  blockCostMul: 0.6,
  light: [
    { id: "wh_l1", windup: 0.3, active: 0.14, recovery: 0.4, reach: 40, arc: deg(120), damage: 16, cleave: 3, stagger: 2, blockCost: 1, swing: { from: -1.3, to: 1.1 } },
    { id: "wh_l2", windup: 0.28, active: 0.14, recovery: 0.4, reach: 40, arc: deg(120), damage: 16, cleave: 3, stagger: 2, blockCost: 1, swing: { from: 1.3, to: -1.1 } },
    { id: "wh_l3", windup: 0.3, active: 0.12, recovery: 0.45, reach: 42, arc: deg(45), damage: 24, cleave: 1, stagger: 2, blockCost: 1, armorPierce: 1, swing: { from: 0.3, to: -0.1, thrust: 8 } },
  ],
  heavy: [
    { id: "wh_h1", windup: 0.12, active: 0.14, recovery: 0.55, reach: 44, arc: deg(50), damage: 48, cleave: 2, stagger: 3, blockCost: 2, armorPierce: 1, head: true, swing: { from: 0.5, to: -0.2, thrust: 10 } },
    { id: "wh_h2", windup: 0.12, active: 0.18, recovery: 0.55, reach: 44, arc: deg(160), damage: 28, cleave: 4, stagger: 3, blockCost: 2, swing: { from: -1.5, to: 1.5 } },
  ],
};

export const RAPIER: WeaponDef = {
  id: "rapier",
  name: "Duellist Rapier",
  style: "rapier",
  heavyCharge: 0.35,
  blockCostMul: 1.2,
  light: [
    { id: "ra_l1", windup: 0.14, active: 0.08, recovery: 0.22, reach: 54, arc: deg(25), damage: 13, cleave: 1, stagger: 0, blockCost: 1, swing: { from: 0, to: 0, thrust: 18 } },
    { id: "ra_l2", windup: 0.16, active: 0.1, recovery: 0.25, reach: 46, arc: deg(90), damage: 11, cleave: 2, stagger: 1, blockCost: 1, swing: { from: -1, to: 1 } },
    { id: "ra_l3", windup: 0.14, active: 0.08, recovery: 0.25, reach: 54, arc: deg(25), damage: 17, cleave: 1, stagger: 1, blockCost: 1, armorPierce: 1, head: true, swing: { from: 0, to: 0, thrust: 18 } },
  ],
  heavy: [
    { id: "ra_h1", windup: 0.08, active: 0.12, recovery: 0.35, reach: 60, arc: deg(20), damage: 38, cleave: 1, stagger: 2, blockCost: 2, armorPierce: 1, head: true, lunge: 320, swing: { from: 0, to: 0, thrust: 22 } },
    { id: "ra_h2", windup: 0.08, active: 0.12, recovery: 0.4, reach: 50, arc: deg(130), damage: 20, cleave: 3, stagger: 2, blockCost: 2, swing: { from: 1.3, to: -1.3 } },
  ],
};

export const REPEATER: RangedDef = {
  id: "repeater",
  name: "Repeater Handgun",
  damage: 22,
  ammo: 30,
  cooldown: 0.18,
  pierce: 1,
  spread: 0.04,
  range: 650,
  armorPierce: 0,
  stagger: 1,
  /** First N hip-fire shots in a hold stay accurate; after that, dump the mag. */
  holdSprayAfterShots: 2,
  holdSprayCooldown: 0.03,
  /** Half-angle of the rapid-fire cone (±15° → 30° full). */
  holdSpraySpread: deg(15),
};
export const LONGBOW: RangedDef = {
  id: "longbow",
  name: "Longbow",
  damage: 40,
  minDamage: 20,
  drawTime: 1,
  ammo: 45,
  cooldown: 0.5,
  pierce: 1,
  spread: 0,
  range: 800,
  armorPierce: 1,
  stagger: 1,
};
export const HANDGUN: RangedDef = { id: "handgun", name: "Handgun", damage: 70, ammo: 10, cooldown: 1, pierce: 2, spread: 0, range: 750, armorPierce: 1, head: true, stagger: 2 };
export const PISTOLS: RangedDef = { id: "pistols", name: "Brace of Pistols", damage: 26, ammo: 20, cooldown: 0.3, pierce: 1, spread: 0.03, range: 600, armorPierce: 0, stagger: 1 };

/** Hip-fire damage for a drawn bow: minDamage at 0s → damage at full drawTime. */
export function bowDrawDamage(ranged: RangedDef, drawT: number): number {
  const max = ranged.drawTime ?? 0;
  if (max <= 0) return ranged.damage;
  const min = ranged.minDamage ?? ranged.damage;
  return Math.round(lerp(min, ranged.damage, clamp(drawT / max, 0, 1)));
}
