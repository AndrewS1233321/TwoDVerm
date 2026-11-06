import {
  collideCircle,
  createRng,
  dist,
  ENEMIES,
  isInZone,
  MAX_ENEMIES,
  MISSION_1,
  parseLevel,
  type EnemyId,
  type FxEvent,
  type GamePhase,
  type HeroDef,
  type Level,
} from "@twodverm/shared";
import { Director } from "./director";
import { updateEnemy } from "./enemies";
import { FlowField } from "./flowField";
import { updateHazards } from "./hazards";
import { createHero, processHeroInputs, resetHeroForMission, updateHero } from "./heroes";
import { separateCreatures } from "./separation";
import type { Enemy, Hazard, Hero, Pickup } from "./types";

const FLOW_REBUILD_INTERVAL = 0.4;
const LONELY_DESPAWN_DISTANCE = 1800;
const LONELY_DESPAWN_TIME = 10;

export class World {
  readonly level: Level = parseLevel(MISSION_1);
  readonly heroes = new Map<string, Hero>();
  readonly enemies = new Map<string, Enemy>();
  readonly hazards = new Map<string, Hazard>();
  readonly pickups = new Map<string, Pickup>();
  readonly flowSmall = new FlowField(this.level, false);
  readonly flowWide = new FlowField(this.level, true);
  readonly director = new Director(this);
  readonly rng: () => number;

  fx: FxEvent[] = [];
  phase: GamePhase = "lobby";
  gateOpen = false;
  eventActive = false;
  eventDone = false;
  eventTimeLeft = 0;
  bossActive = false;
  missionTime = 0;
  totalKills = 0;

  private nextId = 1;
  private flowT = 0;

  constructor(seed: number) {
    this.rng = createRng(seed);
  }

  newId(prefix: string): string {
    return `${prefix}${this.nextId++}`;
  }

  emit(e: FxEvent): void {
    this.fx.push(e);
  }

  addHero(id: string, name: string, def: HeroDef): Hero {
    const start = this.level.playerStarts[this.heroes.size % this.level.playerStarts.length]!;
    const hero = createHero(id, name, def, start.x, start.y);
    this.heroes.set(id, hero);
    return hero;
  }

  /** Puts a hero who joins mid-mission next to a standing teammate. */
  placeLateJoiner(hero: Hero): void {
    const buddy = this.standingHeroes().find((h) => h.id !== hero.id);
    if (!buddy) return;
    const p = collideCircle(this.level, this.gateOpen, buddy.x - 20, buddy.y + 20, hero.radius);
    hero.x = p.x;
    hero.y = p.y;
  }

  startMission(): void {
    this.enemies.clear();
    this.hazards.clear();
    this.pickups.clear();
    this.fx = [];
    this.gateOpen = false;
    this.eventActive = false;
    this.eventDone = false;
    this.eventTimeLeft = 0;
    this.bossActive = false;
    this.missionTime = 0;
    this.totalKills = 0;
    let i = 0;
    for (const hero of this.heroes.values()) {
      const start = this.level.playerStarts[i++ % this.level.playerStarts.length]!;
      resetHeroForMission(hero, start.x, start.y);
    }
    for (const p of this.level.ammoCrates) this.addPickup("ammo", p.x, p.y);
    for (const p of this.level.medKits) this.addPickup("med", p.x, p.y);
    this.director.reset();
    this.rebuildFlow();
    this.phase = "playing";
  }

  private addPickup(kind: Pickup["kind"], x: number, y: number): void {
    const id = this.newId("p");
    this.pickups.set(id, { id, kind, x, y, used: false });
  }

  spawnEnemy(type: EnemyId, x: number, y: number, aggro: boolean): Enemy | null {
    if (this.enemies.size >= MAX_ENEMIES) return null;
    const def = ENEMIES[type];
    const p = collideCircle(this.level, this.gateOpen, x, y, def.radius);
    const id = this.newId("e");
    const enemy: Enemy = {
      id,
      def,
      x: p.x,
      y: p.y,
      facing: this.rng() * Math.PI * 2 - Math.PI,
      radius: def.radius,
      kvx: 0,
      kvy: 0,
      hp: def.hp,
      state: aggro ? "chase" : "idle",
      stateT: 0,
      attack: null,
      actionSeq: 0,
      aggro,
      targetId: "",
      cooldown: this.rng() * 0.6,
      grabbedId: "",
      shotT: 0,
      lastDamagerId: "",
      lonelyT: 0,
    };
    this.enemies.set(id, enemy);
    return enemy;
  }

  standingHeroes(): Hero[] {
    const out: Hero[] = [];
    for (const h of this.heroes.values()) {
      if (h.state !== "downed" && h.state !== "dead" && h.state !== "grabbed") out.push(h);
    }
    return out;
  }

  aliveHeroes(): Hero[] {
    const out: Hero[] = [];
    for (const h of this.heroes.values()) if (h.state !== "dead") out.push(h);
    return out;
  }

  nearestHeroDistance(x: number, y: number): number {
    let best = Infinity;
    for (const h of this.heroes.values()) {
      if (h.state === "dead") continue;
      best = Math.min(best, dist(x, y, h.x, h.y));
    }
    return best;
  }

  rebuildFlow(): void {
    const targets = this.standingHeroes();
    const list = targets.length > 0 ? targets : this.aliveHeroes();
    this.flowSmall.rebuild(this.gateOpen, list);
    this.flowWide.rebuild(this.gateOpen, list);
  }

  step(dt: number): void {
    if (this.phase !== "playing") {
      for (const hero of this.heroes.values()) {
        hero.inputs.length = 0;
      }
      return;
    }
    this.missionTime += dt;

    for (const hero of this.heroes.values()) processHeroInputs(this, hero);
    for (const hero of this.heroes.values()) updateHero(this, hero, dt);

    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = FLOW_REBUILD_INTERVAL;
      this.rebuildFlow();
    }

    for (const enemy of [...this.enemies.values()]) {
      if (!this.enemies.has(enemy.id)) continue;
      updateEnemy(this, enemy, dt);
      this.despawnIfLonely(enemy, dt);
    }

    updateHazards(this, dt);
    separateCreatures(this);
    this.director.step(dt);
    this.checkMissionEnd();
  }

  private despawnIfLonely(enemy: Enemy, dt: number): void {
    if (!enemy.aggro || enemy.def.behavior === "boss") return;
    if (this.nearestHeroDistance(enemy.x, enemy.y) > LONELY_DESPAWN_DISTANCE) {
      enemy.lonelyT += dt;
      if (enemy.lonelyT > LONELY_DESPAWN_TIME) this.enemies.delete(enemy.id);
    } else {
      enemy.lonelyT = 0;
    }
  }

  private checkMissionEnd(): void {
    if (this.heroes.size === 0) return;
    const standing = this.standingHeroes();
    if (standing.length === 0) {
      this.phase = "defeat";
      this.emit({ t: "announce", text: "Your party has fallen...", kind: "info" });
      return;
    }
    if (standing.every((h) => isInZone(this.level, this.level.endZone, h.x, h.y))) {
      this.phase = "victory";
      this.emit({ t: "announce", text: "Mission complete!", kind: "info" });
    }
  }
}
