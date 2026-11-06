import {
  angleDiff,
  angleTo,
  dist,
  ENEMY_AGGRO,
  GAS,
  GUNNER,
  hasLineOfSight,
  HOOK,
  inAttackArc,
  moveCircle,
  raycastWalls,
  turnTowards,
  collideCircle,
} from "@twodverm/shared";
import { advanceAttack, applyLunge, enemyMeleeHits, newAttack } from "./attacks";
import { damageHero, downHero, releaseGrab, strikeHero } from "./damage";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

const DIRECT_CHASE_DISTANCE = 220;
const RETARGET_INTERVAL = 0.5;
const KNOCKBACK_DECAY = 9;

export function updateEnemy(world: World, e: Enemy, dt: number): void {
  e.cooldown -= dt;
  applyKnockback(world, e, dt);

  if (e.state === "idle") {
    if (shouldAggro(world, e)) alert(world, e);
    return;
  }
  if (e.state === "staggered") {
    e.stateT -= dt;
    if (e.stateT <= 0) e.state = "chase";
    return;
  }

  e.stateT -= dt;
  if (e.stateT <= 0 || !validTarget(world, e.targetId)) {
    e.targetId = pickTarget(world, e);
    e.stateT = RETARGET_INTERVAL;
  }
  const target = world.heroes.get(e.targetId);

  switch (e.def.behavior) {
    case "melee":
    case "boss":
      updateMelee(world, e, target, dt);
      break;
    case "gunner":
      updateGunner(world, e, target, dt);
      break;
    case "gas":
      updateGas(world, e, target, dt);
      break;
    case "hooker":
      updateHooker(world, e, target, dt);
      break;
  }
}

function applyKnockback(world: World, e: Enemy, dt: number): void {
  if (Math.abs(e.kvx) + Math.abs(e.kvy) < 1) return;
  const p = moveCircle(world.level, world.gateOpen, e.x, e.y, e.radius, e.kvx * dt, e.kvy * dt);
  e.x = p.x;
  e.y = p.y;
  const decay = Math.exp(-KNOCKBACK_DECAY * dt);
  e.kvx *= decay;
  e.kvy *= decay;
}

function shouldAggro(world: World, e: Enemy): boolean {
  for (const h of world.heroes.values()) {
    if (h.state === "dead") continue;
    const d = dist(e.x, e.y, h.x, h.y);
    if (d < ENEMY_AGGRO.alwaysRange) return true;
    if (d < ENEMY_AGGRO.sightRange && hasLineOfSight(world.level, world.gateOpen, e.x, e.y, h.x, h.y)) return true;
  }
  return false;
}

function alert(world: World, source: Enemy): void {
  for (const other of world.enemies.values()) {
    if (other.state !== "idle") continue;
    if (dist(source.x, source.y, other.x, other.y) > ENEMY_AGGRO.alertRadius) continue;
    other.aggro = true;
    other.state = "chase";
    other.stateT = 0;
  }
  source.aggro = true;
  source.state = "chase";
  source.stateT = 0;
}

function validTarget(world: World, id: string): boolean {
  const h = world.heroes.get(id);
  return !!h && h.state !== "dead";
}

function pickTarget(world: World, e: Enemy): string {
  if (e.def.behavior === "hooker") return pickIsolatedHero(world, e);
  const current = world.heroes.get(e.targetId);
  if (current && current.def.ult === "impenetrable" && current.ultActiveT > 0) return current.id;
  if (e.def.behavior === "boss" && e.lastDamagerId && world.rng() < 0.3 && validTarget(world, e.lastDamagerId)) {
    return e.lastDamagerId;
  }
  let best = "";
  let bestScore = Infinity;
  for (const h of world.heroes.values()) {
    if (h.state === "dead") continue;
    let score = dist(e.x, e.y, h.x, h.y);
    if (h.state === "downed") score *= 1.6;
    if (h.id === e.targetId) score *= 0.85;
    if (score < bestScore) {
      bestScore = score;
      best = h.id;
    }
  }
  return best;
}

function pickIsolatedHero(world: World, e: Enemy): string {
  const standing = world.standingHeroes();
  if (standing.length === 0) return "";
  if (standing.length === 1) return standing[0]!.id;
  let best = "";
  let bestScore = -Infinity;
  for (const h of standing) {
    let others = 0;
    for (const o of standing) if (o !== h) others += dist(h.x, h.y, o.x, o.y);
    const score = others / (standing.length - 1) - dist(e.x, e.y, h.x, h.y) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = h.id;
    }
  }
  return best;
}

/** Walks towards a point: directly when close and visible, otherwise along the flow field. */
function moveToward(world: World, e: Enemy, tx: number, ty: number, speedMul: number, dt: number): void {
  let gx = tx;
  let gy = ty;
  const d = dist(e.x, e.y, tx, ty);
  if (d > DIRECT_CHASE_DISTANCE || !hasLineOfSight(world.level, world.gateOpen, e.x, e.y, tx, ty)) {
    const field = e.def.large && world.flowWide.reachable(e.x, e.y) ? world.flowWide : world.flowSmall;
    const wp = field.nextWaypoint(e.x, e.y);
    if (wp) {
      gx = wp.x;
      gy = wp.y;
    }
  }
  walkTo(world, e, gx, gy, speedMul, dt);
}

function walkTo(world: World, e: Enemy, gx: number, gy: number, speedMul: number, dt: number): void {
  const a = angleTo(e.x, e.y, gx, gy);
  e.facing = turnTowards(e.facing, a, e.def.turnRate * dt);
  const step = e.def.speed * speedMul * dt;
  const p = moveCircle(world.level, world.gateOpen, e.x, e.y, e.radius, Math.cos(a) * step, Math.sin(a) * step);
  e.x = p.x;
  e.y = p.y;
}

function faceToward(e: Enemy, x: number, y: number, rateMul: number, dt: number): number {
  const a = angleTo(e.x, e.y, x, y);
  e.facing = turnTowards(e.facing, a, e.def.turnRate * rateMul * dt);
  return Math.abs(angleDiff(e.facing, a));
}

function edgeDistance(e: Enemy, h: Hero): number {
  return dist(e.x, e.y, h.x, h.y) - e.radius - h.radius;
}

function updateMelee(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  if (e.state === "attack" && e.attack) {
    const a = e.attack;
    if (a.phase === "windup" && target) faceToward(e, target.x, target.y, 0.5, dt);
    const done = advanceAttack(a, dt, () => enemyMeleeHits(world, e, a));
    applyLunge(world, e, a, dt);
    if (done) {
      e.attack = null;
      e.state = "chase";
      e.stateT = 0;
      e.cooldown = 0.25 + world.rng() * 0.6;
    }
    return;
  }
  e.state = "chase";
  if (!target) return;
  const attack = chooseMeleeAttack(world, e);
  if (!attack) return;
  const gap = edgeDistance(e, target);
  if (gap <= attack.reach * 0.85 && hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y)) {
    const off = faceToward(e, target.x, target.y, 1, dt);
    if (off < 0.5 && e.cooldown <= 0) {
      e.attack = newAttack(attack, "enemy");
      e.state = "attack";
      e.actionSeq++;
    }
    return;
  }
  moveToward(world, e, target.x, target.y, 1, dt);
}

function chooseMeleeAttack(world: World, e: Enemy) {
  const list = e.def.attacks;
  if (list.length <= 1) return list[0];
  if (e.def.behavior === "boss") {
    let near = 0;
    for (const h of world.heroes.values()) if (h.state !== "dead" && dist(e.x, e.y, h.x, h.y) < 110) near++;
    return near >= 2 ? list[1] : list[0];
  }
  return list[Math.floor(world.rng() * list.length)];
}

function updateGunner(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  switch (e.state) {
    case "aim":
      if (target) faceToward(e, target.x, target.y, 1, dt);
      e.shotT -= dt;
      if (e.shotT <= 0) {
        e.state = "fire";
        e.shotT = GUNNER.fireTime;
        e.cooldown = 0;
        e.actionSeq++;
      }
      return;
    case "fire": {
      if (target) {
        const a = angleTo(e.x, e.y, target.x, target.y);
        e.facing = turnTowards(e.facing, a, GUNNER.turnRate * dt);
      }
      e.shotT -= dt;
      while (e.cooldown <= 0) {
        e.cooldown += GUNNER.shotInterval;
        gunnerShot(world, e);
      }
      if (e.shotT <= 0) {
        e.state = "reload";
        e.shotT = GUNNER.reloadTime;
        e.actionSeq++;
      }
      return;
    }
    case "reload":
      e.shotT -= dt;
      if (e.shotT <= 0) e.state = "chase";
      return;
    default:
      e.state = "chase";
      if (!target) return;
      if (dist(e.x, e.y, target.x, target.y) <= GUNNER.range && hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y)) {
        e.state = "aim";
        e.shotT = GUNNER.aimTime;
        e.actionSeq++;
        world.emit({ t: "announce", text: "Ratling Gunner!", kind: "special" });
        return;
      }
      moveToward(world, e, target.x, target.y, 1, dt);
  }
}

function gunnerShot(world: World, e: Enemy): void {
  const angle = e.facing + (world.rng() - 0.5) * 2 * GUNNER.spread;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sx = e.x + cos * (e.radius + 6);
  const sy = e.y + sin * (e.radius + 6);
  const wall = raycastWalls(world.level, world.gateOpen, sx, sy, angle, GUNNER.maxShotDistance);
  let hitHero: Hero | null = null;
  let hitT = wall;
  for (const h of world.heroes.values()) {
    if (h.state === "dead") continue;
    const dx = h.x - sx;
    const dy = h.y - sy;
    const t = dx * cos + dy * sin;
    if (t < 0 || t > hitT) continue;
    if (Math.abs(dx * sin - dy * cos) <= h.radius) {
      hitHero = h;
      hitT = t;
    }
  }
  world.emit({ t: "tracer", x1: sx, y1: sy, x2: sx + cos * hitT, y2: sy + sin * hitT, kind: "bullet" });
  if (hitHero) {
    strikeHero(world, hitHero, { damage: GUNNER.damage, stagger: 0, blockCost: GUNNER.blockCost, srcX: e.x, srcY: e.y, srcId: e.id });
  }
}

function updateGas(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  if (e.state === "throw") {
    if (target) faceToward(e, target.x, target.y, 1.5, dt);
    e.shotT -= dt;
    if (e.shotT <= 0 && target) {
      const id = world.newId("h");
      world.hazards.set(id, {
        id,
        kind: "globe",
        x: target.x,
        y: target.y,
        fromX: e.x,
        fromY: e.y,
        radius: GAS.cloudRadius,
        timeLeft: GAS.flightTime,
        duration: GAS.flightTime,
      });
      e.cooldown = GAS.cooldown;
      e.state = "chase";
      e.actionSeq++;
    }
    return;
  }
  e.state = "chase";
  if (!target) return;
  const d = dist(e.x, e.y, target.x, target.y);
  const visible = hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y);
  if (d < GAS.fleeDistance) {
    const away = angleTo(target.x, target.y, e.x, e.y);
    walkTo(world, e, e.x + Math.cos(away) * 64, e.y + Math.sin(away) * 64, 1, dt);
    return;
  }
  if (visible && d <= GAS.throwRangeMax && e.cooldown <= 0) {
    e.state = "throw";
    e.shotT = GAS.windup;
    e.actionSeq++;
    return;
  }
  if (!visible || d > GAS.throwRangeMin + 60) moveToward(world, e, target.x, target.y, 1, dt);
  else faceToward(e, target.x, target.y, 1, dt);
}

function updateHooker(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  if (e.state === "drag") {
    updateDrag(world, e, dt);
    return;
  }
  if (e.state === "attack" && e.attack) {
    const a = e.attack;
    if (a.phase === "windup" && target) faceToward(e, target.x, target.y, 0.8, dt);
    const done = advanceAttack(a, dt, () => {
      if (!target || a.hitsLeft <= 0) return;
      if (target.state === "dead" || target.state === "downed" || target.state === "grabbed") return;
      if (!inAttackArc(e.x, e.y, e.radius, e.facing, a.def.reach, a.def.arc, target.x, target.y, target.radius)) return;
      a.hitsLeft = 0;
      if (target.iframesT > 0) {
        world.emit({ t: "dodge", id: target.id });
        return;
      }
      grab(world, e, target);
    });
    if (e.grabbedId) return;
    if (done) {
      e.attack = null;
      e.state = "chase";
      e.cooldown = 1.5;
    }
    return;
  }
  e.state = "chase";
  if (!target) return;
  const gap = edgeDistance(e, target);
  const attack = e.def.attacks[0]!;
  if (gap <= attack.reach * 0.9 && e.cooldown <= 0 && hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y)) {
    faceToward(e, target.x, target.y, 2, dt);
    e.attack = newAttack(attack, "enemy");
    e.state = "attack";
    e.actionSeq++;
    return;
  }
  moveToward(world, e, target.x, target.y, 1, dt);
}

function grab(world: World, e: Enemy, hero: Hero): void {
  e.attack = null;
  e.state = "drag";
  e.stateT = 0;
  e.grabbedId = hero.id;
  e.actionSeq++;
  hero.state = "grabbed";
  hero.grabbedBy = e.id;
  hero.attack = null;
  hero.heavyQueued = false;
  hero.actionSeq++;
  world.emit({ t: "grab", id: hero.id, by: e.id });
  world.emit({ t: "announce", text: `${hero.name} has been grabbed!`, kind: "special" });
}

function updateDrag(world: World, e: Enemy, dt: number): void {
  const hero = world.heroes.get(e.grabbedId);
  if (!hero || hero.state !== "grabbed") {
    releaseGrab(world, e);
    return;
  }
  e.stateT += dt;
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (const h of world.standingHeroes()) {
    cx += h.x;
    cy += h.y;
    n++;
  }
  const away = n > 0 ? angleTo(cx / n, cy / n, e.x, e.y) : e.facing + Math.PI;
  const step = HOOK.dragSpeed * dt;
  const p = moveCircle(world.level, world.gateOpen, e.x, e.y, e.radius, Math.cos(away) * step, Math.sin(away) * step);
  e.x = p.x;
  e.y = p.y;
  e.facing = turnTowards(e.facing, angleTo(e.x, e.y, hero.x, hero.y), 6 * dt);
  const hold = e.radius + hero.radius + 4;
  const hp = collideCircle(world.level, world.gateOpen, e.x + Math.cos(e.facing) * hold, e.y + Math.sin(e.facing) * hold, hero.radius);
  hero.x = hp.x;
  hero.y = hp.y;
  damageHero(world, hero, HOOK.dps * dt);
  if (hero.state === "grabbed" && e.stateT >= HOOK.maxDragTime) {
    downHero(world, hero);
  }
}
