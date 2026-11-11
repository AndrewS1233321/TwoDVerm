import { BILE_TROLL, BLIGHTSTORM, dist, GAS, LIFEECH, moveCircle, STORMFIEND_FIRE } from "@twodverm/shared";
import { damageEnemy, damageHero, killEnemy } from "./damage";
import type { Hazard } from "./types";
import type { World } from "./World";

export function updateHazards(world: World, dt: number): void {
  for (const hz of [...world.hazards.values()]) {
    // Drop storms/bolts whose owner died.
    if (hz.ownerId && (hz.kind === "blightstorm" || hz.kind === "leechbolt") && !world.enemies.has(hz.ownerId)) {
      world.hazards.delete(hz.id);
      continue;
    }

    hz.timeLeft -= dt;

    if (hz.kind === "smoke") {
      if (hz.timeLeft <= 0) world.hazards.delete(hz.id);
      continue;
    }

    if (hz.kind === "globe") {
      if (hz.timeLeft <= 0) {
        hz.kind = "gas";
        hz.timeLeft = GAS.cloudTime;
        hz.duration = GAS.cloudTime;
        world.emit({ t: "gasburst", x: hz.x, y: hz.y });
      }
      continue;
    }

    if (hz.kind === "bileglobe") {
      if (hz.timeLeft <= 0) {
        hz.kind = "bile";
        hz.timeLeft = BILE_TROLL.bileDuration;
        hz.duration = BILE_TROLL.bileDuration;
        world.emit({ t: "gasburst", x: hz.x, y: hz.y });
      }
      continue;
    }

    if (hz.kind === "leechbolt") {
      tickLeechBolt(world, hz, dt);
      continue;
    }

    if (hz.kind === "blightstorm") {
      tickBlightstorm(world, hz, dt);
      continue;
    }

    if (hz.timeLeft <= 0) {
      world.hazards.delete(hz.id);
      continue;
    }

    if (hz.kind === "warpflame") {
      tickWarpflame(world, hz, dt);
      continue;
    }

    if (hz.kind === "bile") {
      tickBile(world, hz, dt);
      continue;
    }

    // Default gas cloud.
    for (const h of world.heroes.values()) {
      if (h.state === "dead") continue;
      if (dist(h.x, h.y, hz.x, hz.y) <= hz.radius + h.radius * 0.5) damageHero(world, h, GAS.heroDps * dt);
    }
    for (const e of [...world.enemies.values()]) {
      if (e.def.behavior === "boss") continue;
      if (dist(e.x, e.y, hz.x, hz.y) > hz.radius + e.radius * 0.5) continue;
      e.hp -= GAS.enemyDps * dt;
      if (e.hp <= 0) killEnemy(world, e, null);
    }
  }
}

function tickLeechBolt(world: World, hz: Hazard, dt: number): void {
  if (hz.timeLeft <= 0) {
    world.hazards.delete(hz.id);
    return;
  }
  const target = hz.targetId ? world.heroes.get(hz.targetId) : undefined;
  const owner = hz.ownerId ? world.enemies.get(hz.ownerId) : undefined;
  if (!target || target.state === "dead" || target.state === "downed" || !owner) {
    world.hazards.delete(hz.id);
    return;
  }
  const a = Math.atan2(target.y - hz.y, target.x - hz.x);
  const step = LIFEECH.boltSpeed * dt;
  hz.x += Math.cos(a) * step;
  hz.y += Math.sin(a) * step;
  if (dist(hz.x, hz.y, target.x, target.y) > target.radius + hz.radius) return;

  world.hazards.delete(hz.id);
  // Dodge check at impact — mid-dodge = miss.
  if (target.dodgeT > 0 || target.iframesT > 0) {
    owner.cooldown = LIFEECH.cooldown;
    owner.state = "chase";
    return;
  }
  if (target.state === "grabbed") return;
  owner.grabbedId = target.id;
  owner.state = "drain";
  owner.stateT = 0;
  owner.actionSeq++;
  target.state = "grabbed";
  target.grabbedBy = owner.id;
  target.attack = null;
  target.actionSeq++;
  world.emit({ t: "grab", id: target.id, by: owner.id });
  world.emit({ t: "announce", text: `${target.name} is drained by a Lifeleech!`, kind: "special" });
}

function tickBlightstorm(world: World, hz: Hazard, dt: number): void {
  if (hz.timeLeft <= 0) {
    world.hazards.delete(hz.id);
    return;
  }
  let target = hz.targetId ? world.heroes.get(hz.targetId) : undefined;
  if (!target || target.state === "dead") {
    target = [...world.heroes.values()].find((h) => h.state !== "dead" && h.state !== "downed");
    hz.targetId = target?.id;
  }
  if (target && target.state !== "grabbed") {
    const a = Math.atan2(target.y - hz.y, target.x - hz.x);
    const step = BLIGHTSTORM.stormSpeed * dt;
    const p = moveCircle(world.level, world.gateOpen, hz.x, hz.y, hz.radius * 0.35, Math.cos(a) * step, Math.sin(a) * step);
    hz.x = p.x;
    hz.y = p.y;
  }

  for (const h of world.heroes.values()) {
    if (h.state === "dead" || h.state === "downed" || h.state === "grabbed") continue;
    if (dist(h.x, h.y, hz.x, hz.y) > hz.radius + h.radius * 0.4) continue;
    // Incapacitate: grab-like lock briefly then toss.
    h.state = "grabbed";
    h.grabbedBy = hz.ownerId ?? hz.id;
    h.attack = null;
    h.actionSeq++;
    world.emit({ t: "grab", id: h.id, by: hz.ownerId ?? "" });
    // Mark toss via hero kv — use a short delay by damaging then knocking.
    damageHero(world, h, BLIGHTSTORM.grabDps * 0.35);
    const away = Math.atan2(h.y - hz.y, h.x - hz.x);
    h.kvx = Math.cos(away) * BLIGHTSTORM.tossSpeed;
    h.kvy = Math.sin(away) * BLIGHTSTORM.tossSpeed;
    // Release immediately after toss impulse so they aren't stuck forever.
    h.state = "idle";
    h.grabbedBy = "";
    world.emit({ t: "release", id: h.id });
    break;
  }

  // Storm also flings non-boss enemies.
  for (const e of [...world.enemies.values()]) {
    if (e.def.behavior === "boss" || e.def.id === "chaosWarrior") continue;
    if (dist(e.x, e.y, hz.x, hz.y) > hz.radius + e.radius * 0.4) continue;
    const away = Math.atan2(e.y - hz.y, e.x - hz.x);
    e.kvx = Math.cos(away) * BLIGHTSTORM.tossSpeed * 0.7;
    e.kvy = Math.sin(away) * BLIGHTSTORM.tossSpeed * 0.7;
  }
}

function tickBile(world: World, hz: { x: number; y: number; radius: number }, dt: number): void {
  for (const h of world.heroes.values()) {
    if (h.state === "dead") continue;
    if (dist(h.x, h.y, hz.x, hz.y) > hz.radius + h.radius * 0.5) continue;
    damageHero(world, h, BILE_TROLL.bileDps * dt);
    // Soft slow: cut current velocity impulse.
    h.kvx *= BILE_TROLL.bileSlowMul;
    h.kvy *= BILE_TROLL.bileSlowMul;
  }
}

/** Stormfiend ground burn: green warpflame that keeps cooking anyone who stands in it. */
function tickWarpflame(world: World, hz: { x: number; y: number; radius: number }, dt: number): void {
  const dps = STORMFIEND_FIRE.groundBurnDps;
  for (const h of world.heroes.values()) {
    if (h.state === "dead") continue;
    if (dist(h.x, h.y, hz.x, hz.y) <= hz.radius + h.radius * 0.5) damageHero(world, h, dps * dt);
  }
  for (const e of [...world.enemies.values()]) {
    if (e.def.behavior === "boss" || e.def.id === "warpfire") continue;
    if (dist(e.x, e.y, hz.x, hz.y) > hz.radius) continue;
    e.hp -= dps * 0.35 * dt;
    if (e.hp <= 0) damageEnemy(world, null, e, { damage: 1, stagger: 0, srcX: hz.x, srcY: hz.y });
  }
}

/** Clear blightstorms owned by a dead stormer (also handled each tick). */
export function clearHazardsForEnemy(world: World, enemyId: string): void {
  for (const hz of [...world.hazards.values()]) {
    if (hz.ownerId === enemyId) world.hazards.delete(hz.id);
  }
}
