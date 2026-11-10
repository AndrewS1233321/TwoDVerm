import { angleDiff, angleTo } from "./math";
import type { ArmorLocation } from "./data/armor";
import type { HitSide } from "./messages";
import { DIRECTION } from "./tuning";

/** Which side of the defender a hit coming from (srcX, srcY) lands on. */
export function hitSide(defFacing: number, defX: number, defY: number, srcX: number, srcY: number): HitSide {
  const rel = Math.abs(angleDiff(defFacing, angleTo(defX, defY, srcX, srcY)));
  if (rel <= DIRECTION.frontHalfArc) return "front";
  if (rel >= Math.PI - DIRECTION.backHalfArc) return "back";
  return "side";
}

/** Armor location a hit lands on: the head for head-targeting hits, otherwise its side. */
export function hitLocation(side: HitSide, head: boolean | undefined): ArmorLocation {
  return head ? "head" : side;
}

/**
 * Whether a target circle is inside an attack's arc. The arc reaches `reach` beyond the
 * attacker's edge, and a target counts if any part of its circle is inside the arc.
 */
export function inAttackArc(
  ax: number,
  ay: number,
  aRadius: number,
  facing: number,
  reach: number,
  arc: number,
  tx: number,
  ty: number,
  tRadius: number,
): boolean {
  const dx = tx - ax;
  const dy = ty - ay;
  const d = Math.hypot(dx, dy);
  if (d > aRadius + reach + tRadius) return false;
  if (arc >= Math.PI * 2 - 1e-3 || d < 1e-3) return true;
  const widen = Math.asin(Math.min(1, tRadius / d));
  return Math.abs(angleDiff(facing, Math.atan2(dy, dx))) <= arc / 2 + widen;
}
