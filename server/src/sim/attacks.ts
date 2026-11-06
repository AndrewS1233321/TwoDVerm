import { hasLineOfSight, inAttackArc, moveCircle, type AttackDef } from "@twodverm/shared";
import { damageEnemy, strikeHero } from "./damage";
import type { ActiveAttack, AttackKind, Enemy, Hero } from "./types";
import type { World } from "./World";

export function newAttack(def: AttackDef, kind: AttackKind): ActiveAttack {
  return { def, kind, phase: "windup", t: 0, hit: new Set(), hitsLeft: def.cleave };
}

export function phaseNumber(a: ActiveAttack | null): number {
  if (!a) return 0;
  return a.phase === "windup" ? 1 : a.phase === "active" ? 2 : 3;
}

/**
 * Advances an attack's timer. Calls applyHits on every tick of the active window.
 * Returns true once recovery has finished.
 */
export function advanceAttack(a: ActiveAttack, dt: number, applyHits: () => void): boolean {
  a.t += dt;
  if (a.phase === "windup" && a.t >= a.def.windup) {
    a.t -= a.def.windup;
    a.phase = "active";
  }
  if (a.phase === "active") {
    applyHits();
    if (a.t >= a.def.active) {
      a.t -= a.def.active;
      a.phase = "recovery";
    }
  }
  return a.phase === "recovery" && a.t >= a.def.recovery;
}

export function applyLunge(world: World, c: Hero | Enemy, a: ActiveAttack, dt: number): void {
  if (a.phase !== "active" || !a.def.lunge) return;
  const p = moveCircle(world.level, world.gateOpen, c.x, c.y, c.radius, Math.cos(c.facing) * a.def.lunge * dt, Math.sin(c.facing) * a.def.lunge * dt);
  c.x = p.x;
  c.y = p.y;
}

export function heroMeleeHits(world: World, hero: Hero, a: ActiveAttack): void {
  if (a.hitsLeft <= 0) return;
  const targets: { e: Enemy; d: number }[] = [];
  for (const e of world.enemies.values()) {
    if (a.hit.has(e.id)) continue;
    if (!inAttackArc(hero.x, hero.y, hero.radius, hero.facing, a.def.reach, a.def.arc, e.x, e.y, e.radius)) continue;
    if (!hasLineOfSight(world.level, world.gateOpen, hero.x, hero.y, e.x, e.y)) continue;
    targets.push({ e, d: Math.hypot(e.x - hero.x, e.y - hero.y) });
  }
  targets.sort((p, q) => p.d - q.d);
  for (const { e } of targets) {
    if (a.hitsLeft <= 0) break;
    a.hit.add(e.id);
    a.hitsLeft--;
    damageEnemy(world, hero, e, {
      damage: a.def.damage,
      stagger: a.def.stagger,
      armorPierce: a.def.armorPierce,
      backstabMul: a.def.backstabMul,
      heavy: a.kind === "heavy",
      srcX: hero.x,
      srcY: hero.y,
    });
  }
}

export function enemyMeleeHits(world: World, enemy: Enemy, a: ActiveAttack): void {
  if (a.hitsLeft <= 0) return;
  for (const h of world.heroes.values()) {
    if (a.hitsLeft <= 0) break;
    if (a.hit.has(h.id) || h.state === "dead") continue;
    if (!inAttackArc(enemy.x, enemy.y, enemy.radius, enemy.facing, a.def.reach, a.def.arc, h.x, h.y, h.radius)) continue;
    if (!hasLineOfSight(world.level, world.gateOpen, enemy.x, enemy.y, h.x, h.y)) continue;
    const result = strikeHero(world, h, {
      damage: a.def.damage,
      stagger: a.def.stagger,
      blockCost: a.def.blockCost,
      srcX: enemy.x,
      srcY: enemy.y,
      srcId: enemy.id,
    });
    a.hit.add(h.id);
    if (result !== "dodged") a.hitsLeft--;
  }
}
