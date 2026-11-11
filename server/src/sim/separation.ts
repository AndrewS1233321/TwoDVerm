import { collideCircle } from "@twodverm/shared";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

const CELL = 64;
/** Heroes count as heavier than their size, so a horde jostles but does not shove them around. */
const HERO_MASS_MUL = 3;

/** Pushes overlapping creatures apart, weighted by mass (radius squared). */
export function separateCreatures(world: World): void {
  const bodies: (Hero | Enemy)[] = [];
  const mass: number[] = [];
  for (const h of world.heroes.values()) {
    if (h.state === "dead" || h.state === "grabbed") continue;
    bodies.push(h);
    mass.push(h.radius * h.radius * HERO_MASS_MUL);
  }
  for (const e of world.enemies.values()) {
    // Leap ignores movement collision; pin sits on the hero; drag is locked.
    if (e.state === "drag" || e.state === "leap" || e.state === "pin") continue;
    bodies.push(e);
    mass.push(e.radius * e.radius);
  }

  const grid = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 100003 + cy;
  bodies.forEach((b, i) => {
    const k = key(Math.floor(b.x / CELL), Math.floor(b.y / CELL));
    const cell = grid.get(k);
    if (cell) cell.push(i);
    else grid.set(k, [i]);
  });

  const moved = new Set<number>();
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    const cx = Math.floor(a.x / CELL);
    const cy = Math.floor(a.y / CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = grid.get(key(cx + dx, cy + dy));
        if (!cell) continue;
        for (const j of cell) {
          if (j <= i) continue;
          const b = bodies[j]!;
          const ox = b.x - a.x;
          const oy = b.y - a.y;
          const min = a.radius + b.radius;
          const d2 = ox * ox + oy * oy;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2);
          const nx = d > 1e-3 ? ox / d : 1;
          const ny = d > 1e-3 ? oy / d : 0;
          const overlap = min - d;
          const total = mass[i]! + mass[j]!;
          const wa = mass[j]! / total;
          const wb = mass[i]! / total;
          a.x -= nx * overlap * wa;
          a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb;
          b.y += ny * overlap * wb;
          moved.add(i);
          moved.add(j);
        }
      }
    }
  }
  for (const i of moved) {
    const b = bodies[i]!;
    const p = collideCircle(world.level, world.gateOpen, b.x, b.y, b.radius);
    b.x = p.x;
    b.y = p.y;
  }
}
