import { DOWNED } from "@twodverm/shared";
import { EnemyState, HazardState, PickupState, type GameState, type PlayerState } from "../state/GameState";
import { phaseNumber } from "./attacks";
import { heroMoveMods } from "./heroes";
import type { Hero } from "./types";
import type { World } from "./World";

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function syncHero(hero: Hero, s: PlayerState): void {
  s.connected = hero.connected;
  s.heroId = hero.def.id;
  s.x = r2(hero.x);
  s.y = r2(hero.y);
  s.facing = r3(hero.facing);
  s.state = hero.state;
  s.action = hero.attack?.def.id ?? "";
  s.phase = hero.state === "charging" ? 1 : phaseNumber(hero.attack);
  s.actionSeq = hero.actionSeq % 65536;
  s.charge = hero.state === "charging" ? r2(Math.min(1, hero.chargeT / hero.def.weapon.heavyCharge)) : 0;
  s.hp = r1(Math.max(0, hero.hp));
  s.maxHp = hero.def.hp;
  s.downHp = r1(Math.max(0, hero.downHp));
  s.stamina = r2(hero.stamina);
  s.maxStamina = hero.def.stamina;
  s.guardBroken = hero.guardBrokenT > 0;
  s.dodgeCharges = hero.dodgeCharges;
  s.maxDodges = hero.def.dodges;
  s.ammo = hero.ammo;
  s.maxAmmo = hero.def.ranged.ammo;
  s.rangedMode = hero.rangedMode;
  s.ultCooldown = r1(hero.ultCd);
  s.ultActive = r1(hero.ultActiveT);
  s.reviveProgress = hero.state === "downed" ? r2(hero.reviveT / DOWNED.reviveTime) : 0;
  s.respawnIn = hero.state === "dead" ? r1(Math.max(0, hero.respawnT)) : 0;
  s.grabbedBy = hero.grabbedBy;

  const mods = heroMoveMods(hero);
  s.moveSpeed = r2(mods.speed);
  s.turnRate = r2(mods.turnRate);
  s.canDodge = mods.canDodge;
  s.dodgeT = r3(hero.dodgeT);
  s.dodgeDx = r3(hero.dodgeDx);
  s.dodgeDy = r3(hero.dodgeDy);
  s.dodgeSpeed = hero.dodgeSpeed;
  s.ackSeq = hero.ackSeq;
  s.kills = hero.kills;
  s.damageDealt = Math.round(hero.damageDealt);
}

export function syncWorld(world: World, state: GameState): void {
  state.phase = world.phase;
  state.levelId = world.levelId;
  state.gateOpen = world.gateOpen;
  state.eventActive = world.eventActive;
  state.eventDone = world.eventDone;
  state.eventTimeLeft = r1(Math.max(0, world.eventTimeLeft));
  state.bossActive = world.bossActive;
  state.missionTime = Math.floor(world.missionTime);
  state.totalKills = world.totalKills;
  state.merchantHold = r1(world.merchantHold);

  for (const hero of world.heroes.values()) {
    const s = state.players.get(hero.id);
    if (s) syncHero(hero, s);
  }

  for (const id of [...state.enemies.keys()]) {
    if (!world.enemies.has(id)) state.enemies.delete(id);
  }
  for (const e of world.enemies.values()) {
    let s = state.enemies.get(e.id);
    if (!s) {
      s = new EnemyState();
      s.id = e.id;
      s.type = e.def.id;
      s.maxHp = e.def.hp;
      state.enemies.set(e.id, s);
    }
    s.x = r1(e.x);
    s.y = r1(e.y);
    s.facing = r2(e.facing);
    s.state = e.state;
    s.action = e.attack?.def.id ?? "";
    s.phase = phaseNumber(e.attack);
    s.actionSeq = e.actionSeq % 65536;
    s.hp = Math.max(0, Math.ceil(e.hp));
  }

  for (const id of [...state.hazards.keys()]) {
    if (!world.hazards.has(id)) state.hazards.delete(id);
  }
  for (const hz of world.hazards.values()) {
    let s = state.hazards.get(hz.id);
    if (!s) {
      s = new HazardState();
      s.id = hz.id;
      state.hazards.set(hz.id, s);
    }
    s.kind = hz.kind;
    s.x = r1(hz.x);
    s.y = r1(hz.y);
    s.fromX = r1(hz.fromX);
    s.fromY = r1(hz.fromY);
    s.radius = hz.radius;
    s.timeLeft = r1(hz.timeLeft);
    s.duration = hz.duration;
  }

  for (const id of [...state.pickups.keys()]) {
    if (!world.pickups.has(id)) state.pickups.delete(id);
  }
  for (const p of world.pickups.values()) {
    let s = state.pickups.get(p.id);
    if (!s) {
      s = new PickupState();
      s.id = p.id;
      s.kind = p.kind;
      s.x = p.x;
      s.y = p.y;
      state.pickups.set(p.id, s);
    }
    s.used = p.used;
  }
}
