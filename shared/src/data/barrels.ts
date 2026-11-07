/** Destructible / throwable barrels placed in procedural rooms. */
export const BARREL = {
  /** Slightly smaller than typical hero radii (13–14). */
  radius: 11,
  hp: 45,
  /** Movement speed while carrying. */
  carrySpeedMul: 0.5,
  pickupRange: 48,
  /** Soft shove when a hero walks into a free barrel. */
  walkPush: 95,
  /** Knockback from a hero push. */
  pushKnockback: 260,
  /** Throw charge: hold left click this long for max range. */
  throwChargeTime: 0.85,
  throwMinSpeed: 220,
  throwMaxSpeed: 560,
  /** Flight ends after this many seconds if nothing is hit. */
  throwMaxTime: 0.9,
  /** Damage / blast when a thrown barrel breaks. */
  throwDamage: 55,
  throwRadius: 52,
  throwStagger: 2.5,
  /** Melee/ranged hits deal at least this much so light swings still chip. */
  minHitDamage: 8,
} as const;
