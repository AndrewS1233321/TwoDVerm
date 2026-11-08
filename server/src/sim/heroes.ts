import {
  BARREL,
  BLOCK,
  collideCircle,
  DODGE,
  DOWNED,
  DT,
  HERO_STATE_SPEED,
  HERO_STATE_TURN,
  HERO_TURN_RATE,
  hasLineOfSight,
  INTERACT_RANGE,
  MAX_INPUTS_PER_TICK,
  MAX_QUEUED_INPUTS,
  MED_HEAL_FRACTION,
  MELEE,
  moveCircle,
  PUSH,
  raycastWalls,
  stepMovement,
  inAttackArc,
  dist,
  type HeroDef,
  type InputMessage,
  type MoveMods,
} from "@twodverm/shared";
import { advanceAttack, applyLunge, heroMeleeHits, newAttack } from "./attacks";
import { damageBarrel, dropBarrel, throwBarrel, tryPickupBarrel, pushBarrels } from "./barrels";
import { damageEnemy, staggerEnemy } from "./damage";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

const SHOOT_RECOVERY = 0.22;
const KNOCKBACK_DECAY = 10;

export function createHero(id: string, name: string, def: HeroDef, x: number, y: number): Hero {
  const hero: Hero = {
    id,
    name,
    def,
    radius: def.radius,
    connected: true,
    x,
    y,
    facing: 0,
    dodgeT: 0,
    dodgeDx: 0,
    dodgeDy: 0,
    dodgeSpeed: DODGE.speed,
    kvx: 0,
    kvy: 0,
    hp: def.hp,
    state: "idle",
    stateT: 0,
    staggerT: 0,
    attack: null,
    actionSeq: 0,
    chainLight: 0,
    chainHeavy: 0,
    comboT: 0,
    attackHeldT: 0,
    prevAttackHeld: false,
    lightBufferT: 0,
    chargeT: 0,
    heavyQueued: false,
    stamina: def.stamina,
    staminaDelay: 0,
    guardBrokenT: 0,
    pushCd: 0,
    dodgeCharges: def.dodges,
    dodgeRefillT: 0,
    dodgeCooldown: 0,
    iframesT: 0,
    ammo: def.ranged.ammo,
    shotCd: 0,
    rangedMode: false,
    carryingBarrelId: "",
    barrelCharge: 0,
    ultCd: 0,
    ultActiveT: 0,
    dashHit: new Set(),
    downHp: 0,
    reviveT: 0,
    reviveTargetId: "",
    respawnT: 0,
    grabbedBy: "",
    inputs: [],
    lastInput: null,
    held: { attack: false, block: false, interact: false },
    edges: { dodgeStarted: false, fire: false, ult: false, interact: false, attackPressed: false, attackReleased: false },
    ackSeq: 0,
    kills: 0,
    damageDealt: 0,
    gold: 0,
    dmgUpStacks: 0,
  };
  return hero;
}

export function resetHeroForMission(hero: Hero, x: number, y: number): void {
  const fresh = createHero(hero.id, hero.name, hero.def, x, y);
  fresh.connected = hero.connected;
  fresh.ackSeq = hero.ackSeq;
  fresh.actionSeq = hero.actionSeq + 1;
  fresh.gold = hero.gold;
  fresh.dmgUpStacks = hero.dmgUpStacks;
  Object.assign(hero, fresh);
}

export function queueInput(hero: Hero, input: InputMessage): void {
  if (input.seq <= hero.ackSeq) return;
  hero.inputs.push(input);
  if (hero.inputs.length > MAX_QUEUED_INPUTS) hero.inputs.splice(0, hero.inputs.length - MAX_QUEUED_INPUTS);
}

/** The movement limits for this hero's current state. Also synced to the client for prediction. */
export function heroMoveMods(hero: Hero): MoveMods {
  const key = hero.state === "attack" && hero.attack ? hero.attack.phase : hero.state;
  // Kerri's daggers keep full move speed through windup / active / recovery / charge.
  const daggerFullSpeed =
    hero.def.weapon.style === "daggers" &&
    !hero.rangedMode &&
    (key === "windup" || key === "active" || key === "recovery" || key === "charging");
  let speed = hero.def.speed * (daggerFullSpeed ? 1 : (HERO_STATE_SPEED[key] ?? 1));
  if (hero.carryingBarrelId) speed *= BARREL.carrySpeedMul;
  const turnRate = HERO_TURN_RATE * (HERO_STATE_TURN[key] ?? 1);
  const stateAllowsDodge =
    hero.state === "idle" ||
    hero.state === "blocking" ||
    hero.state === "charging" ||
    hero.state === "shooting" ||
    (hero.state === "attack" && hero.attack?.phase === "recovery");
  return {
    radius: hero.radius,
    speed,
    turnRate,
    canDodge: stateAllowsDodge && hero.dodgeCharges >= 1 && hero.dodgeCooldown <= 0 && hero.dodgeT <= 0,
  };
}

export function processHeroInputs(world: World, hero: Hero): void {
  hero.edges = { dodgeStarted: false, fire: false, ult: false, interact: false, attackPressed: false, attackReleased: false };
  const mods = heroMoveMods(hero);
  let n = 0;
  while (hero.inputs.length > 0 && n < MAX_INPUTS_PER_TICK) {
    const input = hero.inputs.shift()!;
    n++;
    if (input.attack) {
      if (!hero.prevAttackHeld) hero.edges.attackPressed = true;
      if (!hero.carryingBarrelId && !hero.rangedMode) hero.attackHeldT += DT;
    } else if (hero.prevAttackHeld) {
      if (hero.carryingBarrelId) {
        hero.edges.attackReleased = true;
      } else if (!hero.rangedMode && hero.attackHeldT < MELEE.heavyHoldThreshold) {
        hero.lightBufferT = MELEE.lightBufferTime;
        hero.edges.attackReleased = true;
      } else {
        hero.edges.attackReleased = true;
      }
      if (!hero.carryingBarrelId) hero.attackHeldT = 0;
    }
    hero.prevAttackHeld = input.attack;
    if (input.fire) {
      hero.edges.fire = true;
      if (hero.carryingBarrelId) {
        const barrel = world.barrels.get(hero.carryingBarrelId);
        if (barrel) dropBarrel(world, barrel, hero);
        else {
          hero.carryingBarrelId = "";
          hero.barrelCharge = 0;
        }
      } else {
        toggleRanged(hero);
      }
    }
    if (input.ult) hero.edges.ult = true;
    if (input.interact && !hero.held.interact) hero.edges.interact = true;
    hero.held = { attack: input.attack, block: input.block, interact: input.interact };

    const started = stepMovement(hero, input, mods, world.level, world.gateOpen, DT);
    if (started) {
      hero.dodgeCharges--;
      hero.dodgeCooldown = DODGE.cooldown;
      hero.dodgeRefillT = DODGE.refillDelay + DODGE.refillTime;
      hero.iframesT = DODGE.time;
      hero.edges.dodgeStarted = true;
      mods.canDodge = false;
      if (hero.state === "charging" || hero.state === "attack" || hero.state === "shooting") {
        hero.state = "idle";
        hero.attack = null;
        hero.heavyQueued = false;
      }
      world.emit({ t: "dodge", id: hero.id });
    }
    hero.lastInput = input;
    hero.ackSeq = input.seq;
  }
}

export function updateHero(world: World, hero: Hero, dt: number): void {
  tickTimers(hero, dt);
  applyKnockback(world, hero, dt);

  switch (hero.state) {
    case "dead":
      hero.respawnT -= dt;
      if (hero.respawnT <= 0) tryRespawn(world, hero);
      return;
    case "downed":
      hero.downHp -= DOWNED.bleedPerSec * dt;
      if (hero.downHp <= 0) {
        hero.state = "dead";
        hero.respawnT = DOWNED.respawnTime;
        hero.actionSeq++;
        world.emit({ t: "death", id: hero.id, x: hero.x, y: hero.y, kind: hero.def.id, by: "" });
      }
      return;
    case "grabbed":
      return;
    case "staggered":
      hero.staggerT -= dt;
      if (hero.staggerT <= 0) hero.state = "idle";
      return;
    case "reviving":
      updateReviving(world, hero, dt);
      return;
    case "attack":
      updateAttacking(world, hero, dt);
      break;
    case "charging":
      updateCharging(hero, dt);
      break;
    case "blocking":
      if (!hero.held.block) hero.state = "idle";
      else if (hero.edges.attackPressed && !hero.rangedMode) tryPush(world, hero);
      break;
    case "pushing":
      hero.stateT -= dt;
      if (hero.stateT <= 0) hero.state = hero.held.block ? "blocking" : "idle";
      break;
    case "shooting":
      hero.stateT -= dt;
      if (hero.rangedMode && hero.held.attack) shoot(world, hero);
      else if (hero.stateT <= 0) hero.state = "idle";
      break;
    case "idle":
      updateIdle(world, hero, dt);
      break;
  }

  if (hero.edges.ult) tryUlt(world, hero);
  if (hero.ultActiveT > 0 && hero.def.ult === "dash" && hero.dodgeT > 0) dashHits(world, hero);
}

function tickTimers(hero: Hero, dt: number): void {
  hero.dodgeCooldown = Math.max(0, hero.dodgeCooldown - dt);
  hero.iframesT = Math.max(0, hero.iframesT - dt);
  hero.pushCd = Math.max(0, hero.pushCd - dt);
  hero.shotCd = Math.max(0, hero.shotCd - dt);
  hero.ultCd = Math.max(0, hero.ultCd - dt);
  hero.ultActiveT = Math.max(0, hero.ultActiveT - dt);
  hero.guardBrokenT = Math.max(0, hero.guardBrokenT - dt);
  hero.lightBufferT = Math.max(0, hero.lightBufferT - dt);
  if (hero.state !== "attack" && hero.state !== "charging") {
    hero.comboT += dt;
    if (hero.comboT > MELEE.comboResetTime) {
      hero.chainLight = 0;
      hero.chainHeavy = 0;
    }
  }
  if (hero.dodgeCharges < hero.def.dodges) {
    hero.dodgeRefillT -= dt;
    if (hero.dodgeRefillT <= 0) {
      hero.dodgeCharges++;
      hero.dodgeRefillT = DODGE.refillTime;
    }
  }
  if (hero.state !== "blocking" && hero.state !== "pushing") {
    hero.staminaDelay -= dt;
    if (hero.staminaDelay <= 0) hero.stamina = Math.min(hero.def.stamina, hero.stamina + BLOCK.staminaRegenPerSec * dt);
  }
}

function applyKnockback(world: World, hero: Hero, dt: number): void {
  if (Math.abs(hero.kvx) + Math.abs(hero.kvy) < 1) return;
  const p = moveCircle(world.level, world.gateOpen, hero.x, hero.y, hero.radius, hero.kvx * dt, hero.kvy * dt);
  hero.x = p.x;
  hero.y = p.y;
  const decay = Math.exp(-KNOCKBACK_DECAY * dt);
  hero.kvx *= decay;
  hero.kvy *= decay;
}

function startLight(hero: Hero): void {
  const chain = hero.def.weapon.light;
  const def = chain[hero.chainLight % chain.length]!;
  hero.chainLight = (hero.chainLight + 1) % chain.length;
  hero.attack = newAttack(def, "light");
  hero.state = "attack";
  hero.lightBufferT = 0;
  hero.comboT = 0;
  hero.actionSeq++;
}

function startCharging(hero: Hero): void {
  hero.state = "charging";
  hero.attack = null;
  hero.chargeT = Math.max(0, hero.attackHeldT - MELEE.heavyHoldThreshold);
  hero.heavyQueued = false;
  hero.comboT = 0;
  hero.actionSeq++;
}

function startHeavy(hero: Hero): void {
  const chain = hero.def.weapon.heavy;
  const def = chain[hero.chainHeavy % chain.length]!;
  hero.chainHeavy = (hero.chainHeavy + 1) % chain.length;
  hero.attack = newAttack(def, "heavy");
  hero.state = "attack";
  hero.heavyQueued = false;
  hero.comboT = 0;
  hero.actionSeq++;
}

/** Starts the next attack if one has been requested. Returns true if something started. */
function tryStartAttack(hero: Hero): boolean {
  if (hero.lightBufferT > 0) {
    startLight(hero);
    return true;
  }
  if (hero.held.attack && hero.attackHeldT >= MELEE.heavyHoldThreshold) {
    startCharging(hero);
    return true;
  }
  return false;
}

function updateAttacking(world: World, hero: Hero, dt: number): void {
  const a = hero.attack;
  if (!a) {
    hero.state = "idle";
    return;
  }
  const done = advanceAttack(a, dt, () => heroMeleeHits(world, hero, a));
  applyLunge(world, hero, a, dt);
  if (a.phase === "recovery" && a.t >= a.def.recovery * MELEE.chainWindow) {
    if (hero.held.block && hero.guardBrokenT <= 0) {
      hero.attack = null;
      hero.state = "blocking";
      hero.actionSeq++;
      return;
    }
    if (tryStartAttack(hero)) return;
  }
  if (done) {
    hero.attack = null;
    hero.state = "idle";
    hero.comboT = 0;
  }
}

function updateCharging(hero: Hero, dt: number): void {
  hero.chargeT += dt;
  if (hero.held.block) {
    hero.state = "blocking";
    hero.heavyQueued = false;
    hero.attackHeldT = 0;
    hero.actionSeq++;
    return;
  }
  if (!hero.held.attack || hero.edges.attackReleased) hero.heavyQueued = true;
  if (hero.heavyQueued && hero.chargeT >= hero.def.weapon.heavyCharge) startHeavy(hero);
}

function toggleRanged(hero: Hero): void {
  hero.rangedMode = !hero.rangedMode;
  hero.lightBufferT = 0;
  hero.attackHeldT = 0;
  hero.heavyQueued = false;
  if (hero.state === "charging" || hero.state === "attack" || hero.state === "shooting") {
    hero.attack = null;
    hero.state = "idle";
    hero.actionSeq++;
  }
}

function updateIdle(world: World, hero: Hero, dt: number): void {
  if (hero.carryingBarrelId) {
    if (hero.held.attack) hero.barrelCharge = Math.min(BARREL.throwMaxHold, hero.barrelCharge + dt);
    if (hero.edges.attackReleased) {
      if (hero.barrelCharge >= BARREL.throwMinHold) throwBarrel(world, hero);
      else hero.barrelCharge = 0;
      return;
    }
    if (!hero.held.attack) hero.barrelCharge = 0;
    if (hero.held.interact) tryInteract(world, hero);
    return;
  }
  if (hero.held.block && hero.guardBrokenT <= 0) {
    hero.state = "blocking";
    hero.actionSeq++;
    return;
  }
  if (hero.rangedMode) {
    hero.lightBufferT = 0;
    // Held left click keeps firing whenever the weapon is ready.
    if (hero.held.attack) {
      shoot(world, hero);
      return;
    }
  } else if (tryStartAttack(hero)) {
    return;
  }
  if (hero.held.interact) tryInteract(world, hero);
}

function tryPush(world: World, hero: Hero): void {
  hero.lightBufferT = 0;
  hero.attackHeldT = 0;
  if (hero.pushCd > 0 || hero.stamina < PUSH.cost) return;
  hero.stamina -= PUSH.cost;
  hero.staminaDelay = BLOCK.staminaRegenDelay;
  hero.pushCd = PUSH.cooldown;
  hero.state = "pushing";
  hero.stateT = PUSH.duration;
  hero.actionSeq++;
  world.emit({ t: "push", id: hero.id, x: hero.x, y: hero.y, facing: hero.facing });
  pushBarrels(world, hero);
  for (const e of world.enemies.values()) {
    if (!inAttackArc(hero.x, hero.y, hero.radius, hero.facing, PUSH.reach, PUSH.arc, e.x, e.y, e.radius)) continue;
    if (e.def.staggerResist > PUSH.power) continue;
    if (e.state === "drag") {
      damageEnemy(world, hero, e, { damage: 1, stagger: PUSH.power, srcX: hero.x, srcY: hero.y });
      continue;
    }
    staggerEnemy(e, MELEE.staggerTime);
    e.aggro = true;
    const a = Math.atan2(e.y - hero.y, e.x - hero.x);
    e.kvx = Math.cos(a) * PUSH.knockback;
    e.kvy = Math.sin(a) * PUSH.knockback;
  }
}

function shoot(world: World, hero: Hero): void {
  const r = hero.def.ranged;
  if (hero.ammo <= 0 || hero.shotCd > 0) return;
  hero.ammo--;
  hero.shotCd = r.cooldown;
  hero.state = "shooting";
  hero.stateT = SHOOT_RECOVERY;
  hero.actionSeq++;
  const angle = hero.facing + (world.rng() - 0.5) * 2 * r.spread;
  fireRay(world, hero, angle, r.range, r.pierce, r.damage, r.armorPierce, r.stagger, r.id === "longbow" ? "arrow" : "gun");
}

function fireRay(
  world: World,
  hero: Hero,
  angle: number,
  range: number,
  pierce: number,
  damage: number,
  armorPierce: boolean,
  stagger: number,
  kind: "arrow" | "gun",
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sx = hero.x + cos * hero.radius;
  const sy = hero.y + sin * hero.radius;
  const wall = raycastWalls(world.level, world.gateOpen, sx, sy, angle, range);
  type RayHit = { kind: "enemy"; e: Enemy; t: number } | { kind: "barrel"; id: string; t: number };
  const hits: RayHit[] = [];
  for (const e of world.enemies.values()) {
    const dx = e.x - sx;
    const dy = e.y - sy;
    const t = dx * cos + dy * sin;
    if (t < 0 || t > wall) continue;
    const perp = Math.abs(dx * sin - dy * cos);
    if (perp <= e.radius) hits.push({ kind: "enemy", e, t });
  }
  for (const b of world.barrels.values()) {
    if (b.carriedBy || b.flying) continue;
    const dx = b.x - sx;
    const dy = b.y - sy;
    const t = dx * cos + dy * sin;
    if (t < 0 || t > wall) continue;
    const perp = Math.abs(dx * sin - dy * cos);
    if (perp <= BARREL.radius) hits.push({ kind: "barrel", id: b.id, t });
  }
  hits.sort((a, b) => a.t - b.t);
  let end = wall;
  let left = pierce;
  for (const hit of hits) {
    if (left <= 0) break;
    left--;
    if (hit.kind === "enemy") {
      damageEnemy(world, hero, hit.e, { damage, stagger, armorPierce, srcX: hero.x, srcY: hero.y });
    } else {
      const barrel = world.barrels.get(hit.id);
      if (barrel) damageBarrel(world, barrel, damage, hero.id);
    }
    if (left === 0) end = hit.t;
  }
  world.emit({ t: "tracer", x1: sx, y1: sy, x2: sx + cos * end, y2: sy + sin * end, kind });
}

function tryOpenMerchantShop(world: World, hero: Hero): boolean {
  if (world.phase !== "merchant") return false;
  for (const e of world.enemies.values()) {
    if (e.def.id !== "merchant") continue;
    if (dist(hero.x, hero.y, e.x, e.y) > INTERACT_RANGE + e.radius) continue;
    world.emit({ t: "shop", id: hero.id });
    return true;
  }
  return false;
}

function tryInteract(world: World, hero: Hero): void {
  for (const other of world.heroes.values()) {
    if (other.id === hero.id || other.state !== "downed") continue;
    if (dist(hero.x, hero.y, other.x, other.y) > DOWNED.reviveRange) continue;
    hero.state = "reviving";
    hero.reviveTargetId = other.id;
    hero.reviveT = 0;
    hero.actionSeq++;
    return;
  }
  if (!hero.edges.interact) return;
  if (tryOpenMerchantShop(world, hero)) return;
  if (tryPickupBarrel(world, hero)) return;
  for (const p of world.pickups.values()) {
    if (p.used || dist(hero.x, hero.y, p.x, p.y) > INTERACT_RANGE) continue;
    if (p.kind === "ammo") {
      if (hero.ammo >= hero.def.ranged.ammo) continue;
      hero.ammo = hero.def.ranged.ammo;
    } else {
      if (hero.hp >= hero.def.hp) continue;
      hero.hp = Math.min(hero.def.hp, hero.hp + hero.def.hp * MED_HEAL_FRACTION);
      p.used = true;
    }
    world.emit({ t: "pickup", id: hero.id, kind: p.kind });
    return;
  }
}

function updateReviving(world: World, hero: Hero, dt: number): void {
  const target = world.heroes.get(hero.reviveTargetId);
  if (!hero.held.interact || !target || target.state !== "downed" || dist(hero.x, hero.y, target.x, target.y) > DOWNED.reviveRange + 10) {
    hero.state = "idle";
    hero.reviveT = 0;
    if (target) target.reviveT = 0;
    return;
  }
  hero.reviveT += dt;
  target.reviveT = hero.reviveT;
  if (hero.reviveT >= DOWNED.reviveTime) {
    target.state = "idle";
    target.hp = target.def.hp * DOWNED.reviveHpFraction;
    target.downHp = 0;
    target.reviveT = 0;
    target.actionSeq++;
    hero.state = "idle";
    hero.reviveT = 0;
    world.emit({ t: "revive", id: target.id });
  }
}

function tryRespawn(world: World, hero: Hero): void {
  const buddy = world.standingHeroes()[0];
  if (!buddy) return;
  const p = collideCircle(world.level, world.gateOpen, buddy.x - 24, buddy.y, hero.radius);
  hero.x = p.x;
  hero.y = p.y;
  hero.state = "idle";
  hero.hp = hero.def.hp * DOWNED.respawnHpFraction;
  hero.ammo = Math.floor(hero.def.ranged.ammo / 2);
  hero.stamina = hero.def.stamina;
  hero.dodgeCharges = hero.def.dodges;
  hero.actionSeq++;
  world.emit({ t: "revive", id: hero.id });
}

function tryUlt(world: World, hero: Hero): void {
  if (hero.ultCd > 0) return;
  const ok =
    hero.state === "idle" ||
    hero.state === "blocking" ||
    hero.state === "charging" ||
    hero.state === "shooting" ||
    (hero.state === "attack" && hero.attack?.phase === "recovery");
  if (!ok) return;
  hero.ultCd = hero.def.ultCooldown;
  hero.attack = null;
  hero.state = "idle";
  hero.actionSeq++;
  world.emit({ t: "ult", id: hero.id, ult: hero.def.ult, x: hero.x, y: hero.y });

  switch (hero.def.ult) {
    case "rally": {
      for (const e of world.enemies.values()) {
        if (dist(hero.x, hero.y, e.x, e.y) > 220 || e.def.staggerResist > 3) continue;
        staggerEnemy(e, 1.2);
        e.aggro = true;
        const a = Math.atan2(e.y - hero.y, e.x - hero.x);
        e.kvx = Math.cos(a) * 320;
        e.kvy = Math.sin(a) * 320;
      }
      for (const h of world.heroes.values()) {
        if (h.state === "dead" || h.state === "downed") continue;
        if (dist(hero.x, hero.y, h.x, h.y) > 300) continue;
        h.hp = Math.min(h.def.hp, h.hp + 25);
        h.stamina = h.def.stamina;
      }
      break;
    }
    case "volley": {
      const candidates = [...world.enemies.values()]
        .filter((e) => dist(hero.x, hero.y, e.x, e.y) < 700 && hasLineOfSight(world.level, world.gateOpen, hero.x, hero.y, e.x, e.y))
        .sort((a, b) => Number(b.def.special) - Number(a.def.special) || dist(hero.x, hero.y, a.x, a.y) - dist(hero.x, hero.y, b.x, b.y));
      for (let i = 0; i < 3 && candidates.length > 0; i++) {
        const e = candidates[i % candidates.length]!;
        world.emit({ t: "tracer", x1: hero.x, y1: hero.y, x2: e.x, y2: e.y, kind: "arrow" });
        damageEnemy(world, hero, e, { damage: 60, stagger: 2, armorPierce: true, srcX: hero.x, srcY: hero.y });
      }
      break;
    }
    case "impenetrable": {
      hero.ultActiveT = 6;
      hero.stamina = hero.def.stamina;
      for (const e of world.enemies.values()) {
        if (dist(hero.x, hero.y, e.x, e.y) < 400) e.targetId = hero.id;
      }
      break;
    }
    case "dash": {
      hero.ultActiveT = 0.32;
      hero.dodgeT = 0.3;
      hero.dodgeSpeed = 800;
      hero.dodgeDx = Math.cos(hero.facing);
      hero.dodgeDy = Math.sin(hero.facing);
      hero.iframesT = 0.34;
      hero.dashHit.clear();
      break;
    }
  }
}

function dashHits(world: World, hero: Hero): void {
  for (const e of world.enemies.values()) {
    if (hero.dashHit.has(e.id)) continue;
    if (dist(hero.x, hero.y, e.x, e.y) > hero.radius + e.radius + 18) continue;
    hero.dashHit.add(e.id);
    damageEnemy(world, hero, e, { damage: 40, stagger: 2, armorPierce: true, srcX: hero.x, srcY: hero.y });
  }
}
