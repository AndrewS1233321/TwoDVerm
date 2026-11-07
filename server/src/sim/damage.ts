import {
  ARMOR_NON_PIERCE_MUL,
  BLOCK,
  DOWNED,
  ENEMY_DAMAGE_TAKEN,
  HERO_DAMAGE_TAKEN,
  hitSide,
  MELEE,
} from "@twodverm/shared";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

export interface EnemyHit {
  damage: number;
  stagger: number;
  armorPierce?: boolean;
  backstabMul?: number;
  heavy?: boolean;
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
}

export type HeroHitResult = "dodged" | "blocked" | "hit" | "ignored";

export function damageEnemy(world: World, hero: Hero | null, enemy: Enemy, hit: EnemyHit): void {
  if (!world.enemies.has(enemy.id)) return;
  // Merchant is invulnerable (shop UI comes later).
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
    });
    return;
  }
  const side = enemy.aggro ? hitSide(enemy.facing, enemy.x, enemy.y, hit.srcX, hit.srcY) : "back";
  let mul = ENEMY_DAMAGE_TAKEN[side];
  if (side === "back") mul *= hit.backstabMul ?? 1;
  const armor = enemy.def.armored && !hit.armorPierce && side !== "back";
  if (armor) mul *= ARMOR_NON_PIERCE_MUL;
  const dmg = hit.damage * mul;

  enemy.hp -= dmg;
  enemy.aggro = true;
  if (hero) {
    enemy.lastDamagerId = hero.id;
    hero.damageDealt += dmg;
  }
  world.emit({ t: "hit", id: enemy.id, by: hero?.id ?? "", x: enemy.x, y: enemy.y, dmg: Math.round(dmg), side, armor, heavy: hit.heavy ?? false });

  if (enemy.hp <= 0) {
    killEnemy(world, enemy, hero);
    return;
  }
  if (enemy.state === "drag" && dmg > 0) {
    releaseGrab(world, enemy);
    staggerEnemy(enemy, 1.5);
    return;
  }
  const power = hit.stagger + (side === "back" ? 1 : 0);
  if (power >= enemy.def.staggerResist) {
    staggerEnemy(enemy, MELEE.staggerTime * (side === "back" ? MELEE.backStaggerMul : 1));
  }
}

export function staggerEnemy(enemy: Enemy, time: number): void {
  if (enemy.def.staggerResist >= 99) return;
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
  if (enemy.def.behavior === "boss") {
    world.bossActive = false;
    world.emit({ t: "announce", text: "The Rat Ogre is slain!", kind: "boss" });
  }
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
    const guarding = hero.state === "blocking" || hero.state === "pushing";
    if (guarding && side === "front") {
      const cost = hit.blockCost * hero.def.weapon.blockCostMul;
      if (hero.stamina >= cost - 1e-6) {
        hero.stamina = Math.max(0, hero.stamina - cost);
        hero.staminaDelay = BLOCK.staminaRegenDelay;
        world.emit({ t: "block", id: hero.id, x: hero.x, y: hero.y, broke: false });
        if (hit.stagger >= BLOCK.heavyBlockStaggerPower) staggerHero(hero, BLOCK.heavyBlockStaggerTime);
        return "blocked";
      }
      hero.stamina = 0;
      hero.staminaDelay = BLOCK.staminaRegenDelay;
      hero.guardBrokenT = BLOCK.guardBreakLockout;
      damage *= BLOCK.guardBreakDamageMul;
      world.emit({ t: "block", id: hero.id, x: hero.x, y: hero.y, broke: true });
      staggerHero(hero, BLOCK.guardBreakStagger);
    }
  }

  const dmg = damage * HERO_DAMAGE_TAKEN[side];
  world.emit({ t: "hit", id: hero.id, by: hit.srcId, x: hero.x, y: hero.y, dmg: Math.round(dmg), side, armor: false, heavy: hit.stagger >= 2 });
  damageHero(world, hero, dmg);
  if (hit.stagger >= hero.def.staggerResist) staggerHero(hero, MELEE.staggerTime);
  return "hit";
}

/** Raw damage with no blocking or dodging (gas, being dragged, bleeding). */
export function damageHero(world: World, hero: Hero, dmg: number): void {
  if (dmg <= 0) return;
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
  if (hero.grabbedBy) {
    const e = world.enemies.get(hero.grabbedBy);
    if (e) releaseGrab(world, e);
    hero.grabbedBy = "";
  }
  hero.hp = 0;
  hero.state = "downed";
  hero.downHp = DOWNED.hp;
  hero.attack = null;
  hero.reviveT = 0;
  hero.actionSeq++;
  world.emit({ t: "down", id: hero.id });
}

export function killHero(world: World, hero: Hero): void {
  hero.state = "dead";
  hero.downHp = 0;
  hero.respawnT = DOWNED.respawnTime;
  hero.actionSeq++;
  world.emit({ t: "death", id: hero.id, x: hero.x, y: hero.y, kind: hero.def.id, by: "" });
}
