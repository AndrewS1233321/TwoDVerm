import {
  BARREL,
  barrelLandingPoint,
  barrelThrowDistance,
  collideCircle,
  dist,
  moveCircle,
} from "@twodverm/shared";
import { damageEnemy, killEnemy, strikeHero } from "./damage";
import type { Barrel, Hero } from "./types";
import type { World } from "./World";

export function createBarrel(id: string, x: number, y: number): Barrel {
  return {
    id,
    x,
    y,
    hp: BARREL.hp,
    kvx: 0,
    kvy: 0,
    carriedBy: "",
    flying: false,
    vx: 0,
    vy: 0,
    flightT: 0,
    landX: x,
    landY: y,
    throwerId: "",
  };
}

export function damageBarrel(world: World, barrel: Barrel, amount: number, byId: string): void {
  if (barrel.carriedBy || barrel.flying) return;
  barrel.hp -= Math.max(BARREL.minHitDamage, amount);
  if (barrel.hp <= 0) destroyBarrel(world, barrel, byId, false);
}

export function destroyBarrel(world: World, barrel: Barrel, byId: string, explode: boolean): void {
  if (explode) blastBarrel(world, barrel, byId);
  if (barrel.carriedBy) {
    const hero = world.heroes.get(barrel.carriedBy);
    if (hero) {
      hero.carryingBarrelId = "";
      hero.barrelCharge = 0;
    }
  }
  world.barrels.delete(barrel.id);
  world.emit({ t: "death", id: barrel.id, x: barrel.x, y: barrel.y, kind: "barrel", by: byId });
}

function blastBarrel(world: World, barrel: Barrel, byId: string): void {
  const thrower = byId ? world.heroes.get(byId) : undefined;
  for (const e of world.enemies.values()) {
    if (dist(barrel.x, barrel.y, e.x, e.y) > BARREL.throwRadius + e.radius) continue;
    if (thrower) {
      damageEnemy(world, thrower, e, {
        damage: BARREL.throwDamage,
        stagger: BARREL.throwStagger,
        armorPierce: false,
        srcX: barrel.x,
        srcY: barrel.y,
      });
    } else {
      e.hp -= BARREL.throwDamage;
      e.aggro = true;
      const a = Math.atan2(e.y - barrel.y, e.x - barrel.x);
      e.kvx += Math.cos(a) * 180;
      e.kvy += Math.sin(a) * 180;
      if (e.hp <= 0) killEnemy(world, e, null);
    }
  }
  for (const h of world.heroes.values()) {
    if (h.id === byId || h.state === "dead" || h.state === "downed") continue;
    if (dist(barrel.x, barrel.y, h.x, h.y) > BARREL.throwRadius + h.radius) continue;
    strikeHero(world, h, {
      damage: BARREL.throwDamage * 0.35,
      stagger: 1,
      blockCost: 0.4,
      srcX: barrel.x,
      srcY: barrel.y,
      srcId: byId || barrel.id,
    });
  }
  world.emit({ t: "gasburst", x: barrel.x, y: barrel.y });
}

export function updateBarrels(world: World, dt: number): void {
  for (const barrel of [...world.barrels.values()]) {
    if (!world.barrels.has(barrel.id)) continue;
    if (barrel.carriedBy) {
      const hero = world.heroes.get(barrel.carriedBy);
      if (!hero || hero.state === "dead" || hero.state === "downed" || hero.state === "grabbed") {
        dropBarrel(world, barrel, hero ?? null);
        continue;
      }
      barrel.x = hero.x + Math.cos(hero.facing) * (hero.radius + BARREL.radius * 0.4);
      barrel.y = hero.y + Math.sin(hero.facing) * (hero.radius + BARREL.radius * 0.4);
      continue;
    }

    if (barrel.flying) {
      barrel.flightT -= dt;
      const beforeX = barrel.x;
      const beforeY = barrel.y;
      const p = moveCircle(
        world.level,
        world.gateOpen,
        barrel.x,
        barrel.y,
        BARREL.radius,
        barrel.vx * dt,
        barrel.vy * dt,
      );
      barrel.x = p.x;
      barrel.y = p.y;
      const blocked =
        Math.hypot(barrel.x - (beforeX + barrel.vx * dt), barrel.y - (beforeY + barrel.vy * dt)) > 2;
      const arrived = dist(barrel.x, barrel.y, barrel.landX, barrel.landY) <= 10 || barrel.flightT <= 0;
      if (blocked || arrived) {
        destroyBarrel(world, barrel, barrel.throwerId, true);
      }
      continue;
    }

    if (Math.abs(barrel.kvx) + Math.abs(barrel.kvy) >= 1) {
      const p = moveCircle(
        world.level,
        world.gateOpen,
        barrel.x,
        barrel.y,
        BARREL.radius,
        barrel.kvx * dt,
        barrel.kvy * dt,
      );
      barrel.x = p.x;
      barrel.y = p.y;
      const decay = Math.exp(-8 * dt);
      barrel.kvx *= decay;
      barrel.kvy *= decay;
    }

    for (const hero of world.standingHeroes()) {
      if (hero.carryingBarrelId) continue;
      const d = dist(hero.x, hero.y, barrel.x, barrel.y);
      const overlap = hero.radius + BARREL.radius - d;
      if (overlap <= 0 || d < 0.001) continue;
      const nx = (barrel.x - hero.x) / d;
      const ny = (barrel.y - hero.y) / d;
      const pushed = collideCircle(
        world.level,
        world.gateOpen,
        barrel.x + nx * overlap,
        barrel.y + ny * overlap,
        BARREL.radius,
      );
      barrel.x = pushed.x;
      barrel.y = pushed.y;
      barrel.kvx += nx * BARREL.walkPush;
      barrel.kvy += ny * BARREL.walkPush;
    }
  }
}

export function tryPickupBarrel(world: World, hero: Hero): boolean {
  if (hero.carryingBarrelId) return false;
  let best: Barrel | null = null;
  let bestD: number = BARREL.pickupRange;
  for (const b of world.barrels.values()) {
    if (b.carriedBy || b.flying) continue;
    const d = dist(hero.x, hero.y, b.x, b.y);
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  if (!best) return false;
  best.carriedBy = hero.id;
  best.kvx = 0;
  best.kvy = 0;
  hero.carryingBarrelId = best.id;
  hero.barrelCharge = 0;
  hero.rangedMode = false;
  hero.lightBufferT = 0;
  hero.attackHeldT = 0;
  hero.attack = null;
  if (hero.state === "charging" || hero.state === "attack" || hero.state === "shooting") {
    hero.state = "idle";
  }
  hero.actionSeq++;
  world.emit({ t: "pickup", id: hero.id, kind: "barrel" });
  return true;
}

export function dropBarrel(world: World, barrel: Barrel, hero: Hero | null): void {
  barrel.carriedBy = "";
  barrel.flying = false;
  barrel.vx = 0;
  barrel.vy = 0;
  if (hero) {
    hero.carryingBarrelId = "";
    hero.barrelCharge = 0;
    const ahead = collideCircle(
      world.level,
      world.gateOpen,
      hero.x + Math.cos(hero.facing) * (hero.radius + BARREL.radius + 4),
      hero.y + Math.sin(hero.facing) * (hero.radius + BARREL.radius + 4),
      BARREL.radius,
    );
    barrel.x = ahead.x;
    barrel.y = ahead.y;
  }
}

export function throwBarrel(world: World, hero: Hero): void {
  const barrel = world.barrels.get(hero.carryingBarrelId);
  if (!barrel) {
    hero.carryingBarrelId = "";
    hero.barrelCharge = 0;
    return;
  }
  const distance = barrelThrowDistance(hero.barrelCharge, hero.radius);
  if (distance <= 0) {
    hero.barrelCharge = 0;
    return;
  }

  const cos = Math.cos(hero.facing);
  const sin = Math.sin(hero.facing);
  const startX = hero.x + cos * (hero.radius + BARREL.radius);
  const startY = hero.y + sin * (hero.radius + BARREL.radius);
  const land = barrelLandingPoint(world.level, world.gateOpen, startX, startY, hero.facing, distance);
  const travel = Math.max(1, dist(startX, startY, land.x, land.y));
  const ang = Math.atan2(land.y - startY, land.x - startX);

  barrel.carriedBy = "";
  barrel.flying = true;
  barrel.vx = Math.cos(ang) * BARREL.throwFlightSpeed;
  barrel.vy = Math.sin(ang) * BARREL.throwFlightSpeed;
  barrel.flightT = travel / BARREL.throwFlightSpeed + 0.05;
  barrel.landX = land.x;
  barrel.landY = land.y;
  barrel.throwerId = hero.id;
  barrel.x = startX;
  barrel.y = startY;
  hero.carryingBarrelId = "";
  hero.barrelCharge = 0;
  hero.actionSeq++;
  world.emit({ t: "push", id: hero.id, x: hero.x, y: hero.y, facing: hero.facing });
}

export function pushBarrels(world: World, hero: Hero): void {
  for (const b of world.barrels.values()) {
    if (b.carriedBy || b.flying) continue;
    if (dist(hero.x, hero.y, b.x, b.y) > PUSH_REACH + BARREL.radius) continue;
    const a = Math.atan2(b.y - hero.y, b.x - hero.x);
    const facingDiff = Math.abs(Math.atan2(Math.sin(a - hero.facing), Math.cos(a - hero.facing)));
    if (facingDiff > 1.3) continue;
    b.kvx = Math.cos(a) * BARREL.pushKnockback;
    b.kvy = Math.sin(a) * BARREL.pushKnockback;
  }
}

const PUSH_REACH = 40;
