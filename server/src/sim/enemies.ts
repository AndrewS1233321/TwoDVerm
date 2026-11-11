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
  MONK,
  RUNNER,
  SACK_RAT,
  STORMFIEND_FIRE,
  TILE_SIZE,
  turnTowards,
  WARPFIRE,
  collideCircle,
  type AttackDef,
} from "@twodverm/shared";
import { advanceAttack, applyLunge, enemyMeleeHits, newAttack } from "./attacks";
import { damageHero, downHero, releaseGrab, strikeHero } from "./damage";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

const DIRECT_CHASE_DISTANCE = 220;
const RETARGET_INTERVAL = 0.5;
const KNOCKBACK_DECAY = 9;
const CHAIN_WINDUP_MUL = 0.35;
const CHAIN_RECOVERY_MUL = 0.35;

export function updateEnemy(world: World, e: Enemy, dt: number): void {
  e.cooldown -= dt;
  e.fireCd -= dt;
  applyKnockback(world, e, dt);

  // Test dummies never chase or attack; they only take hits.
  if (e.def.behavior === "dummy") {
    e.state = "idle";
    e.attack = null;
    e.aggro = false;
    return;
  }
  if (e.def.behavior === "loot") {
    updateLoot(world, e, dt);
    return;
  }

  if (e.state === "idle") {
    if (shouldAggro(world, e)) alert(world, e);
    return;
  }
  if (e.state === "staggered") {
    e.stateT -= dt;
    if (e.stateT <= 0) {
      // After a push stun (or missed pounce), runners flee until their leap is ready again.
      if (e.def.behavior === "runner" && e.cooldown > 0) e.state = "flee";
      else e.state = e.aggro ? "chase" : "idle";
    }
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
      updateMelee(world, e, target, dt);
      break;
    case "boss":
      if (e.def.warpfire) updateStormfiend(world, e, target, dt);
      else updateMelee(world, e, target, dt);
      break;
    case "runner":
      updateRunner(world, e, target, dt);
      break;
    case "warpfire":
      updateWarpfire(world, e, target, dt);
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
    if (h.state === "dead" || h.invisT > 0) continue;
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
  return !!h && h.state !== "dead" && h.invisT <= 0;
}

function pickTarget(world: World, e: Enemy): string {
  if (e.def.behavior === "hooker" || e.def.behavior === "runner") return pickIsolatedHero(world, e);
  const current = world.heroes.get(e.targetId);
  if (current && current.def.ult === "impenetrable" && current.ultActiveT > 0) return current.id;
  if (e.def.behavior === "boss" && e.lastDamagerId && world.rng() < 0.3 && validTarget(world, e.lastDamagerId)) {
    return e.lastDamagerId;
  }
  let best = "";
  let bestScore = Infinity;
  for (const h of world.heroes.values()) {
    if (h.state === "dead" || h.invisT > 0) continue;
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
  const standing = world.standingHeroes().filter((h) => h.invisT <= 0);
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
    const monk = e.def.id === "plagueMonk";
    if (target) {
      if (monk) {
        // Chase while flurrying so each slash's arc follows the new position.
        faceToward(e, target.x, target.y, 1.6, dt);
        moveToward(world, e, target.x, target.y, MONK.chaseSpeedMul, dt);
      } else if (a.phase === "windup") {
        faceToward(e, target.x, target.y, 0.5, dt);
      }
    }
    const done = advanceAttack(a, dt, () => enemyMeleeHits(world, e, a));
    if (!monk) applyLunge(world, e, a, dt);
    if (done) {
      if (e.chainLeft > 0 && target && target.state !== "dead" && target.state !== "downed") {
        e.chainLeft--;
        e.attack = newAttack(monk ? monkSwing(a.def, e.chainLeft) : chainSwing(a.def, e.chainLeft, true), "enemy");
        e.actionSeq++;
        return;
      }
      e.attack = null;
      e.state = "chase";
      e.stateT = 0;
      if (monk) {
        e.monkOpened = true;
        e.cooldown = MONK.pause;
      } else {
        e.cooldown = 0.25 + world.rng() * 0.6;
      }
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
      if (e.def.id === "plagueMonk") {
        const hits = e.monkOpened ? MONK.followHits : MONK.openerHits;
        e.chainLeft = hits - 1;
        e.attack = newAttack(monkSwing({ ...attack, chain: hits, windup: MONK.windup }, e.chainLeft), "enemy");
      } else {
        e.chainLeft = Math.max(0, (attack.chain ?? 1) - 1);
        e.attack = newAttack(chainSwing(attack, e.chainLeft, false), "enemy");
      }
      e.state = "attack";
      e.actionSeq++;
    }
    return;
  }
  moveToward(world, e, target.x, target.y, 1, dt);
}

/** Flurry swings: follow-ups wind up fast and every swing but the last recovers quickly. */
function chainSwing(def: AttackDef, left: number, followUp: boolean): AttackDef {
  if (!def.chain || def.chain <= 1) return def;
  return {
    ...def,
    windup: followUp ? def.windup * CHAIN_WINDUP_MUL : def.windup,
    recovery: left > 0 ? def.recovery * CHAIN_RECOVERY_MUL : def.recovery,
  };
}

/** Plague Monk: every slash keeps the short wind-up; only the last hit of a flurry recovers longer. */
function monkSwing(def: AttackDef, left: number): AttackDef {
  return {
    ...def,
    windup: MONK.windup,
    recovery: left > 0 ? def.recovery : Math.max(def.recovery, 0.2),
  };
}

/** Damages every hero in a cone in front of `e` with line of sight; dodging heroes are skipped. */
export function sprayCone(world: World, e: Enemy, range: number, arc: number, dps: number, dt: number): void {
  for (const h of world.heroes.values()) {
    if (h.state === "dead" || h.iframesT > 0) continue;
    if (!inAttackArc(e.x, e.y, e.radius, e.facing, range, arc, h.x, h.y, h.radius)) continue;
    if (!hasLineOfSight(world.level, world.gateOpen, e.x, e.y, h.x, h.y)) continue;
    damageHero(world, h, dps * dt);
  }
}

interface SprayTuning {
  windup: number;
  sprayTime: number;
  range: number;
  arc: number;
  dps: number;
  sprayTurnRate: number;
}

/** Shared wind-up / spray step. Returns true while the spray sequence is still running. */
function stepSpray(world: World, e: Enemy, target: Hero | undefined, t: SprayTuning, dt: number): boolean {
  if (e.state === "spray_windup") {
    if (target) faceToward(e, target.x, target.y, 1, dt);
    e.shotT -= dt;
    if (e.shotT <= 0) {
      e.state = "spray";
      e.shotT = t.sprayTime;
      e.actionSeq++;
    }
    return true;
  }
  if (e.state === "spray") {
    if (target) e.facing = turnTowards(e.facing, angleTo(e.x, e.y, target.x, target.y), t.sprayTurnRate * dt);
    sprayCone(world, e, t.range, t.arc, t.dps, dt);
    if (e.def.warpfire) paintStormfiendBurn(world, e);
    e.shotT -= dt;
    return e.shotT > 0;
  }
  return false;
}

/**
 * Leaves green warpflame patches on every floor tile the Stormfiend cone currently covers.
 * Re-hitting a tile refreshes its 5s burn timer.
 */
function paintStormfiendBurn(world: World, e: Enemy): void {
  const t = STORMFIEND_FIRE;
  const half = t.arc / 2;
  const steps = t.groundBurnSteps;
  const rays = t.groundBurnRays;
  for (let s = 1; s <= steps; s++) {
    const reach = e.radius + (s / steps) * t.range;
    for (let r = 0; r < rays; r++) {
      const a = rays === 1 ? e.facing : e.facing - half + (half * 2 * r) / (rays - 1);
      const x = e.x + Math.cos(a) * reach;
      const y = e.y + Math.sin(a) * reach;
      if (!hasLineOfSight(world.level, world.gateOpen, e.x, e.y, x, y)) continue;
      const tx = Math.floor(x / TILE_SIZE);
      const ty = Math.floor(y / TILE_SIZE);
      const id = `wf_${tx}_${ty}`;
      const existing = world.hazards.get(id);
      if (existing && existing.kind === "warpflame") {
        existing.timeLeft = t.groundBurnDuration;
        existing.x = (tx + 0.5) * TILE_SIZE;
        existing.y = (ty + 0.5) * TILE_SIZE;
        continue;
      }
      world.hazards.set(id, {
        id,
        kind: "warpflame",
        x: (tx + 0.5) * TILE_SIZE,
        y: (ty + 0.5) * TILE_SIZE,
        fromX: e.x,
        fromY: e.y,
        radius: t.groundBurnRadius,
        timeLeft: t.groundBurnDuration,
        duration: t.groundBurnDuration,
      });
    }
  }
}

function startSpray(e: Enemy, windup: number): void {
  e.state = "spray_windup";
  e.shotT = windup;
  e.attack = null;
  e.actionSeq++;
}

function updateWarpfire(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  if (e.state === "spray_windup" || e.state === "spray") {
    if (stepSpray(world, e, target, WARPFIRE, dt)) return;
    e.state = "reload";
    e.shotT = WARPFIRE.reloadTime;
    e.actionSeq++;
    return;
  }
  if (e.state === "reload") {
    e.shotT -= dt;
    if (e.shotT <= 0) e.state = "chase";
    return;
  }
  e.state = "chase";
  if (!target) return;
  const d = dist(e.x, e.y, target.x, target.y);
  if (d <= WARPFIRE.approachRange && hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y)) {
    startSpray(e, WARPFIRE.windup);
    world.emit({ t: "announce", text: "Warpfire Thrower!", kind: "special" });
    return;
  }
  moveToward(world, e, target.x, target.y, 1, dt);
}

/** Rat Ogre melee, plus warpfire bursts at heroes who keep their distance. */
function updateStormfiend(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  if (e.state === "spray_windup" || e.state === "spray") {
    if (stepSpray(world, e, target, STORMFIEND_FIRE, dt)) return;
    e.state = "chase";
    e.fireCd = STORMFIEND_FIRE.cooldown;
    e.cooldown = 0.4;
    e.actionSeq++;
    return;
  }
  if (e.state !== "attack" && target && e.fireCd <= 0) {
    const d = dist(e.x, e.y, target.x, target.y);
    if (
      d >= STORMFIEND_FIRE.minRange &&
      d <= STORMFIEND_FIRE.maxRange &&
      hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y)
    ) {
      startSpray(e, STORMFIEND_FIRE.windup);
      return;
    }
  }
  updateMelee(world, e, target, dt);
}

/** Stalks towards an isolated hero, crouches, leaps, and pins whoever it lands on. */
function updateRunner(world: World, e: Enemy, target: Hero | undefined, dt: number): void {
  switch (e.state) {
    case "pin":
      updatePin(world, e, dt);
      return;
    case "flee": {
      if (e.cooldown <= 0) {
        e.state = "stalk";
        e.actionSeq++;
        return;
      }
      const away = target ?? nearestStandingHero(world, e);
      if (away) fleeFrom(world, e, away.x, away.y, dt);
      return;
    }
    case "crouch":
      if (target) faceToward(e, target.x, target.y, 2, dt);
      e.shotT -= dt;
      if (e.shotT <= 0) {
        e.leapAngle = target ? angleTo(e.x, e.y, target.x, target.y) : e.facing;
        e.facing = e.leapAngle;
        e.state = "leap";
        e.shotT = RUNNER.leapMaxTime;
        e.actionSeq++;
      }
      return;
    case "leap":
      updateLeap(world, e, dt);
      return;
    default: {
      e.state = "stalk";
      if (!target) return;
      const d = dist(e.x, e.y, target.x, target.y);
      if (
        e.cooldown <= 0 &&
        d <= RUNNER.leapRange &&
        target.state !== "grabbed" &&
        target.state !== "downed" &&
        target.state !== "pushing" &&
        hasLineOfSight(world.level, world.gateOpen, e.x, e.y, target.x, target.y)
      ) {
        e.state = "crouch";
        e.shotT = RUNNER.leapWindup;
        e.actionSeq++;
        return;
      }
      moveToward(world, e, target.x, target.y, 1, dt);
    }
  }
}

function nearestStandingHero(world: World, e: Enemy): Hero | undefined {
  let best: Hero | undefined;
  let bestD = Infinity;
  for (const h of world.standingHeroes()) {
    const d = dist(e.x, e.y, h.x, h.y);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function updateLeap(world: World, e: Enemy, dt: number): void {
  const step = RUNNER.leapSpeed * dt;
  const dx = Math.cos(e.leapAngle) * step;
  const dy = Math.sin(e.leapAngle) * step;
  const x0 = e.x;
  const y0 = e.y;
  // Airborne: no wall / floor collision. Hit radius still applies to pushes.
  e.x += dx;
  e.y += dy;
  for (const h of world.heroes.values()) {
    if (h.state === "dead" || h.state === "downed" || h.state === "grabbed" || h.invisT > 0) continue;
    // Push-block: while the hero is pushing, the pounce cannot land.
    if (h.state === "pushing") continue;
    // Near-centre connect along this step (radii ignored).
    if (pointToSegmentDistance(h.x, h.y, x0, y0, e.x, e.y) > RUNNER.leapConnectDist) continue;
    if (h.iframesT > 0) {
      world.emit({ t: "dodge", id: h.id });
      continue;
    }
    pin(world, e, h);
    return;
  }
  e.shotT -= dt;
  if (e.shotT <= 0) {
    e.cooldown = Math.max(e.cooldown, RUNNER.cooldown);
    e.state = "staggered";
    e.stateT = RUNNER.recoverTime * 0.5;
    e.actionSeq++;
  }
}

/** Shortest distance from point P to segment AB. */
function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-8) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function pin(world: World, e: Enemy, hero: Hero): void {
  e.attack = null;
  e.state = "pin";
  e.grabbedId = hero.id;
  e.actionSeq++;
  hero.state = "grabbed";
  hero.grabbedBy = e.id;
  hero.attack = null;
  hero.heavyQueued = false;
  hero.actionSeq++;
  world.emit({ t: "grab", id: hero.id, by: e.id });
  world.emit({ t: "announce", text: `${hero.name} is pinned by a Gutter Runner!`, kind: "special" });
}

function updatePin(world: World, e: Enemy, dt: number): void {
  const hero = world.heroes.get(e.grabbedId);
  if (!hero || hero.state !== "grabbed") {
    releaseGrab(world, e);
    return;
  }
  e.x = hero.x + Math.cos(e.facing + Math.PI) * 4;
  e.y = hero.y + Math.sin(e.facing + Math.PI) * 4;
  damageHero(world, hero, RUNNER.pinDps * dt);
}

/** Sack Rat: idles until it sees the party, then runs away; escapes if it gets clear. */
function updateLoot(world: World, e: Enemy, dt: number): void {
  if (e.state === "staggered") {
    e.stateT -= dt;
    if (e.stateT <= 0) e.state = "flee";
    return;
  }
  let nearest: Hero | null = null;
  let nearestD = Infinity;
  for (const h of world.standingHeroes()) {
    const d = dist(e.x, e.y, h.x, h.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = h;
    }
  }
  const visible = !!nearest && hasLineOfSight(world.level, world.gateOpen, e.x, e.y, nearest.x, nearest.y);
  if (e.state !== "flee") {
    if (nearest && (e.aggro || (visible && nearestD < SACK_RAT.fleeSight))) {
      e.state = "flee";
      e.aggro = true;
      e.actionSeq++;
    }
    return;
  }
  if (!nearest) return;
  if (!visible && nearestD > SACK_RAT.escapeDistance) {
    e.escapeT += dt;
    if (e.escapeT > SACK_RAT.escapeTime) {
      world.enemies.delete(e.id);
      world.emit({ t: "announce", text: "The Sack Rat escaped with its loot!", kind: "info" });
      return;
    }
  } else {
    e.escapeT = 0;
  }
  fleeFrom(world, e, nearest.x, nearest.y, dt);
}

/** Steps in whichever of 8 directions opens the most distance from (hx, hy) without walking into a wall. */
function fleeFrom(world: World, e: Enemy, hx: number, hy: number, dt: number): void {
  const probe = e.def.speed * 0.4;
  let bestA = angleTo(hx, hy, e.x, e.y);
  let bestScore = -Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = moveCircle(world.level, world.gateOpen, e.x, e.y, e.radius, Math.cos(a) * probe, Math.sin(a) * probe);
    const score = dist(p.x, p.y, hx, hy) + Math.hypot(p.x - e.x, p.y - e.y) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestA = a;
    }
  }
  walkTo(world, e, e.x + Math.cos(bestA) * 64, e.y + Math.sin(bestA) * 64, 1, dt);
}

function chooseMeleeAttack(world: World, e: Enemy) {
  const list = e.def.attacks;
  if (list.length <= 1) return list[0];
  if (e.def.id === "plagueMonk") return list[0];
  if (e.def.behavior === "boss") {
    let near = 0;
    for (const h of world.heroes.values()) {
      if (h.state === "dead" || h.invisT > 0) continue;
      if (dist(e.x, e.y, h.x, h.y) < 110) near++;
    }
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
    if (h.state === "dead" || h.invisT > 0) continue;
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
      if (target.state === "dead" || target.state === "downed" || target.state === "grabbed" || target.invisT > 0) return;
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
      e.cooldown = 0.75;
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
