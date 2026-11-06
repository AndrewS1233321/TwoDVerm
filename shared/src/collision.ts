import { TILE_SIZE } from "./constants";
import { isSolidTile, type Level } from "./level";
import { clamp } from "./math";

/** Pushes a circle out of any solid tiles it overlaps. Returns the corrected position. */
export function collideCircle(level: Level, gateOpen: boolean, x: number, y: number, r: number): { x: number; y: number } {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    const minTx = Math.floor((x - r) / TILE_SIZE);
    const maxTx = Math.floor((x + r) / TILE_SIZE);
    const minTy = Math.floor((y - r) / TILE_SIZE);
    const maxTy = Math.floor((y + r) / TILE_SIZE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!isSolidTile(level, gateOpen, tx, ty)) continue;
        const left = tx * TILE_SIZE;
        const top = ty * TILE_SIZE;
        const cx = clamp(x, left, left + TILE_SIZE);
        const cy = clamp(y, top, top + TILE_SIZE);
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = r - d;
          x += (dx / d) * push;
          y += (dy / d) * push;
        } else {
          const pushL = x - left + r;
          const pushR = left + TILE_SIZE - x + r;
          const pushU = y - top + r;
          const pushD = top + TILE_SIZE - y + r;
          const m = Math.min(pushL, pushR, pushU, pushD);
          if (m === pushL) x -= pushL;
          else if (m === pushR) x += pushR;
          else if (m === pushU) y -= pushU;
          else y += pushD;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, y };
}

/** Moves a circle by (dx, dy) in small sub-steps so fast movement cannot tunnel through walls. */
export function moveCircle(
  level: Level,
  gateOpen: boolean,
  x: number,
  y: number,
  r: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
  let p = { x, y };
  for (let i = 0; i < steps; i++) {
    p = collideCircle(level, gateOpen, p.x + dx / steps, p.y + dy / steps, r);
  }
  return p;
}

/** Distance along a ray until it hits a solid tile, capped at maxDist. */
export function raycastWalls(level: Level, gateOpen: boolean, x0: number, y0: number, angle: number, maxDist: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let tx = Math.floor(x0 / TILE_SIZE);
  let ty = Math.floor(y0 / TILE_SIZE);
  if (isSolidTile(level, gateOpen, tx, ty)) return 0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(TILE_SIZE / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(TILE_SIZE / dy) : Infinity;
  let tMaxX = dx !== 0 ? ((dx > 0 ? (tx + 1) * TILE_SIZE - x0 : x0 - tx * TILE_SIZE) / Math.abs(dx)) : Infinity;
  let tMaxY = dy !== 0 ? ((dy > 0 ? (ty + 1) * TILE_SIZE - y0 : y0 - ty * TILE_SIZE) / Math.abs(dy)) : Infinity;
  let t = 0;
  while (t < maxDist) {
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      tx += stepX;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      ty += stepY;
    }
    if (t >= maxDist) return maxDist;
    if (isSolidTile(level, gateOpen, tx, ty)) return t;
  }
  return maxDist;
}

export function hasLineOfSight(level: Level, gateOpen: boolean, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1) return true;
  return raycastWalls(level, gateOpen, x0, y0, Math.atan2(y1 - y0, x1 - x0), d) >= d;
}
