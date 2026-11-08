import { collideCircle } from "../collision";
import type { Level, Point } from "../level";
import type { HeroId } from "./types";

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
  /** Must hold at least this long to throw (seconds). */
  throwMinHold: 1,
  /** Hold this long for maximum throw distance (seconds). */
  throwMaxHold: 4,
  /** Max range = this × player length (diameter = 2 × hero radius). */
  maxDistancePlayerLengths: 5,
  /** Constant flight speed toward the landing point (px/s). */
  throwFlightSpeed: 380,
  /** Damage / blast when a thrown barrel breaks. */
  throwDamage: 110,
  throwRadius: 52,
  throwStagger: 2.5,
  /** Melee/ranged hits deal at least this much so light swings still chip. */
  minHitDamage: 8,
} as const;

/** Bardin's built-in barrel handling: quicker release, full carry speed. */
export const BARDIN_BARREL = {
  throwMinHold: 0.35,
  carrySpeedMul: 1,
} as const;

export function barrelThrowMinHold(heroId?: HeroId | string): number {
  return heroId === "dwarf" ? BARDIN_BARREL.throwMinHold : BARREL.throwMinHold;
}

export function barrelCarrySpeedMul(heroId?: HeroId | string): number {
  return heroId === "dwarf" ? BARDIN_BARREL.carrySpeedMul : BARREL.carrySpeedMul;
}

/** Player “length” for throw range (rough body size). */
export function playerLength(heroRadius: number): number {
  return heroRadius * 2;
}

export function barrelMaxThrowDistance(heroRadius: number): number {
  return playerLength(heroRadius) * BARREL.maxDistancePlayerLengths;
}

/**
 * Throw distance along aim for a charge hold time.
 * Default: below min hold → 0; min→max hold grows linearly to full range.
 * Bardin: range grows from the first moment of the hold (0 → max over throwMaxHold).
 */
export function barrelThrowDistance(holdSeconds: number, heroRadius: number, heroId?: HeroId | string): number {
  if (heroId === "dwarf") {
    const t = Math.min(1, Math.max(0, holdSeconds) / BARREL.throwMaxHold);
    return barrelMaxThrowDistance(heroRadius) * t;
  }
  if (holdSeconds < BARREL.throwMinHold) return 0;
  const span = BARREL.throwMaxHold - BARREL.throwMinHold;
  const t = Math.min(1, (holdSeconds - BARREL.throwMinHold) / span);
  return barrelMaxThrowDistance(heroRadius) * t;
}

export function barrelThrowReady(holdSeconds: number, heroId?: HeroId | string): boolean {
  return holdSeconds >= barrelThrowMinHold(heroId);
}

/** Walk a charged throw along facing and stop early on walls. */
export function barrelLandingPoint(
  level: Level,
  gateOpen: boolean,
  fromX: number,
  fromY: number,
  facing: number,
  distance: number,
): Point {
  if (distance <= 0) return { x: fromX, y: fromY };
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);
  let x = fromX;
  let y = fromY;
  const step = 4;
  let travelled = 0;
  while (travelled < distance) {
    const rem = Math.min(step, distance - travelled);
    const next = collideCircle(level, gateOpen, x + cos * rem, y + sin * rem, BARREL.radius);
    const moved = Math.hypot(next.x - x, next.y - y);
    x = next.x;
    y = next.y;
    if (moved < rem * 0.45) break;
    travelled += moved;
  }
  return { x, y };
}
