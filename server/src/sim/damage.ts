import {
  ARMOR_SETS,
  armorReduction,
  BLOCK,
  DOWNED,
  ENEMY_DAMAGE_TAKEN,
  HERO_DAMAGE_TAKEN,
  hitLocation,
  hitSide,
  MELEE,
  RIPOSTE,
  rollGoldDrop,
  RUNE_WARD,
  shopDamageMul,
  splitGoldEvenly,
  type EnemyId,
} from "@twodverm/shared";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

/** Guard is up in block/push, or while channeling a revive with RMB held. */
function heroIsGuarding(hero: Hero): boolean {
  if (hero.guardBrokenT > 0 || hero.rangedMode) return false;
  if (hero.state === "blocking" || hero.state === "pushing") return true;
  return hero.state === "reviving" && hero.held.block;
}

function clearReviveIfNeeded(world: World, hero: Hero): void {
  if (hero.state !== "reviving" && !hero.reviveTargetId) return;
  const target = world.heroes.get(hero.reviveTargetId);
  if (target) target.reviveT = 0;
  hero.reviveT = 0;
  hero.reviveTargetId = "";
}

export interface EnemyHit {
  damage: number;
  stagger: number;
  /** Armor levels stripped off the target before reduction. */
  armorPierce?: number;
  /** Lands on head armor instead of front / side / back. */
  head?: boolean;
  backstabMul?: number;
  heavy?: boolean;
  /** Guaranteed critical (Riposte): applies RIPOSTE.critMul. */
  crit?: boolean;
  /** Skip stagger entirely (even back-hit stagger bonus). */
  noStagger?: boolean;
  srcX: number;
  srcY: number;
}

export interface HeroHit {
  damage: number;
  stagger: number;
  blockCost: number;
  srcX: number;
  srcY: number;
  srcId: string;
  unblockable?: boolean;
  armorPierce?: number;
  head?: boolean;
}

export type HeroHitResult = "dodged" | "blocked" | "hit" | "ignored";

export function damageEnemy(world: World, hero: Hero | null, enemy: Enemy, hit: EnemyHit): void {
  if (!world.enemies.has(enemy.id)) return;
  // Merchant is invulnerable; trade with E instead.
  if (enemy.def.id === "merchant") {
    world.emit({
      t: "hit",
      id: enemy.id,
      by: hero?.id ?? "",
      x: enemy.x,
      y: enemy.y,
      dmg: 0,
      side: "front",
      armor: true,
      heavy: hit.heavy ?? false,
      crit: hit.crit === true,
    });
    return;
  }
  const side = enemy.aggro ? hitSide(enemy.facing, enemy.x, enemy.y, hit.srcX, hit.srcY) : "back";
  const loc = hitLocation(side, hit.head);
  let mul = ENEMY_DAMAGE_TAKEN[loc];
  if (loc === "back") mul *= hit.backstabMul ?? 1;
  const reduction = armorReduction(enemy.def.armor, loc, hit.armorPierce);
  const armor = reduction > 0;
  mul *= 1 - reduction;
  if (hero) mul *= shopDamageMul(hero.dmgUpStacks);
  if (hit.crit) mul *= RIPOSTE.critMul;
  const dmg = hit.damage * mul;

  enemy.hp -= dmg;
  const hidden = !!hero && hero.invisT > 0;
  if (!hidden) enemy.aggro = true;
  if (hero) {
    if (!hidden) enemy.lastDamagerId = hero.id;
    hero.damageDealt += dmg;
  }
  world.emit({
    t: "hit",
    id: enemy.id,
    by: hero?.id ?? "",
    x: enemy.x,
    y: enemy.y,
    dmg: Math.round(dmg),
    side,
    head: loc === "head",
    armor,
    heavy: hit.heavy ?? false,
    crit: hit.crit === true,
  });

  if (enemy.hp <= 0) {
    killEnemy(world, enemy, hero);
    return;
  }
  if (enemy.state === "drag" && dmg > 0) {
    releaseGrab(world, enemy);
    staggerEnemy(enemy, 1.5);
    return;
  }
  if (hit.noStagger) return;
  const power = hit.stagger + (side === "back" ? 1 : 0);
  if (power >= enemy.def.staggerResist) {
    staggerEnemy(enemy, MELEE.staggerTime * (side === "back" ? MELEE.backStaggerMul : 1));
  }
}

export function staggerEnemy(enemy: Enemy, time: number, opts?: { force?: boolean }): void {
  if (enemy.def.behavior === "dummy") return;
  if (!opts?.force && enemy.def.staggerResist >= 99) return;
  enemy.attack = null;
  enemy.state = "staggered";
  enemy.stateT = time;
  enemy.actionSeq++;
}

export function killEnemy(world: World, enemy: Enemy, hero: Hero | null): void {
  if (enemy.grabbedId) releaseGrab(world, enemy);
  world.enemies.delete(enemy.id);
  world.totalKills++;
  if (hero) hero.kills++;
  world.emit({ t: "death", id: enemy.id, x: enemy.x, y: enemy.y, kind: enemy.def.id, by: hero?.id ?? "" });
  awardGoldOnKill(world, enemy.def.id, enemy.x, enemy.y);
  if (enemy.def.behavior === "boss") {
    world.bossActive = false;
    world.emit({ t: "announce", text: "The Rat Ogre is slain!", kind: "boss" });
  }
}

/** Roll a gold drop and split it evenly across every hero's personal purse. */
function awardGoldOnKill(world: World, enemyId: EnemyId, x: number, y: number): void {
  const amount = rollGoldDrop(enemyId, world.rng);
  if (amount <= 0) return;
  const heroes = [...world.heroes.values()];
  const shares = splitGoldEvenly(amount, heroes.length);
  if (shares.length === 0) return;
  for (let i = 0; i < heroes.length; i++) heroes[i]!.gold += shares[i]!;
  world.emit({ t: "gold", x, y, amount });
}

export function releaseGrab(world: World, enemy: Enemy): void {
  const hero = world.heroes.get(enemy.grabbedId);
  enemy.grabbedId = "";
  if (enemy.state === "drag") {
    enemy.state = "chase";
    enemy.cooldown = 6;
  }
  if (!hero || hero.grabbedBy !== enemy.id) return;
  hero.grabbedBy = "";
  if (hero.state === "grabbed") {
    hero.state = "staggered";
    hero.staggerT = 0.5;
  }
  world.emit({ t: "release", id: hero.id });
}

/** A melee or ranged strike on a hero that can be dodged and (from the front) blocked. */
export function strikeHero(world: World, hero: Hero, hit: HeroHit): HeroHitResult {
  if (hero.state === "dead") return "ignored";
  // Whole party is invulnerable while holding the exit countdown.
  if (world.merchantHold > 0) return "ignored";
  if (hero.iframesT > 0) {
    world.emit({ t: "dodge", id: hero.id });
    return "dodged";
  }
  const side = hitSide(hero.facing, hero.x, hero.y, hit.srcX, hit.srcY);
  let damage = hit.damage;

  if (!hit.unblockable && hero.state !== "downed" && hero.state !== "grabbed") {
    if (hero.ultActiveT > 0 && hero.def.ult === "impenetrable") {
      world.emit({ t: "block", id: hero.id, x: hero.x, y: hero.y, broke: false });
      return "blocked";
    }
    const guarding = heroIsGuarding(hero);
    if (guarding && side === "front") {
      const cost = hit.blockCost * hero.def.weapon.blockCostMul;
      if (hero.stamina >= cost - 1e-6) {
        hero.stamina = Math.max(0, hero.stamina - cost);
        hero.staminaDelay = BLOCK.staminaRegenDelay;
        world.emit({ t: "block", id: hero.id, x: hero.x, y: hero.y, broke: false });
        if (hit.stagger >= BLOCK.heavyBlockStaggerPower) {
          clearReviveIfNeeded(world, hero);
          staggerHero(hero, BLOCK.heavyBlockStaggerTime);
        }
        return "blocked";
      }
      if (tryRuneWard(world, hero)) return "blocked";
      hero.stamina = 0;
      hero.staminaDelay = BLOCK.staminaRegenDelay;
      hero.guardBrokenT = BLOCK.guardBreakLockout;
      damage *= BLOCK.guardBreakDamageMul;
      world.emit({ t: "block", id: hero.id, x: hero.x, y: hero.y, broke: true });
      clearReviveIfNeeded(world, hero);
      staggerHero(hero, BLOCK.guardBreakStagger);
    } else if (tryRuneWard(world, hero)) {
      return "blocked";
    }
  } else if (hit.unblockable && hero.state !== "downed" && hero.state !== "grabbed" && tryRuneWard(world, hero)) {
    return "blocked";
  }

  const loc = hitLocation(side, hit.head);
  const reduction = armorReduction(ARMOR_SETS[hero.armorSetId].loadout, loc, hit.armorPierce);
  const dmg = damage * HERO_DAMAGE_TAKEN[loc] * (1 - reduction);
  world.emit({
    t: "hit",
    id: hero.id,
    by: hit.srcId,
    x: hero.x,
    y: hero.y,
    dmg: Math.round(dmg),
    side,
    head: loc === "head",
    armor: reduction > 0,
    heavy: hit.stagger >= 2,
  });
  damageHero(world, hero, dmg);
  if (hit.stagger >= hero.def.staggerResist) {
    clearReviveIfNeeded(world, hero);
    staggerHero(hero, MELEE.staggerTime);
  }
  return "hit";
}

/** Spend a charged Rune Ward to absorb one discrete hit. */
function tryRuneWard(world: World, hero: Hero): boolean {
  if (!hero.perks.has("rune_ward") || hero.wardCd > 0) return false;
  hero.wardCd = RUNE_WARD.cooldown;
  world.emit({ t: "ward", id: hero.id, x: hero.x, y: hero.y });
  return true;
}

/** Raw damage with no blocking or dodging (gas, being dragged, bleeding). */
export function damageHero(world: World, hero: Hero, dmg: number): void {
  if (dmg <= 0) return;
  if (world.merchantHold > 0) return;
  world.director.addIntensity(dmg / hero.def.hp);
  if (hero.state === "dead") return;
  if (hero.state === "downed") {
    hero.downHp -= dmg;
    if (hero.downHp <= 0) killHero(world, hero);
    return;
  }
  hero.hp -= dmg;
  if (hero.hp <= 0) downHero(world, hero);
}

export function staggerHero(hero: Hero, time: number): void {
  if (hero.state === "dead" || hero.state === "downed" || hero.state === "grabbed") return;
  hero.attack = null;
  hero.heavyQueued = false;
  hero.state = "staggered";
  hero.staggerT = Math.max(hero.staggerT, time);
  hero.actionSeq++;
}

export function downHero(world: World, hero: Hero): void {
  if (hero.invisT > 0 || hero.vanishAfterDodge) world.rebuildFlow();
  hero.invisT = 0;
  hero.vanishAfterDodge = false;
  hero.riposteReady = false;
  if (hero.grabbedBy) {
    const e = world.enemies.get(hero.grabbedBy);
    if (e) releaseGrab(world, e);
    hero.grabbedBy = "";
  }
  clearReviveIfNeeded(world, hero);
  hero.hp = 0;
  hero.state = "downed";
  hero.downHp = DOWNED.hp;
  hero.attack = null;
  hero.reviveT = 0;
  hero.actionSeq++;
  world.emit({ t: "down", id: hero.id });
}

export function killHero(world: World, hero: Hero): void {
  if (hero.invisT > 0 || hero.vanishAfterDodge) world.rebuildFlow();
  hero.invisT = 0;
  hero.vanishAfterDodge = false;
  hero.riposteReady = false;
  hero.state = "dead";
  hero.downHp = 0;
  hero.respawnT = DOWNED.respawnTime;
  hero.actionSeq++;
  world.emit({ t: "death", id: hero.id, x: hero.x, y: hero.y, kind: hero.def.id, by: "" });
}
