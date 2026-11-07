import {
  collideCircle,
  createRng,
  dist,
  ENEMIES,
  initialLevelIdForMode,
  isInZone,
  MAX_ENEMIES,
  MERCHANT_EXIT_HOLD,
  parseLevelById,
  tileIndexAt,
  WASTES_MERCHANT_LEVEL_ID,
  type EnemyId,
  type FxEvent,
  type GameMode,
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
  readonly mode: GameMode;
  levelId: string;
  level: Level;
  readonly heroes = new Map<string, Hero>();
  readonly enemies = new Map<string, Enemy>();
  readonly hazards = new Map<string, Hazard>();
  readonly pickups = new Map<string, Pickup>();
  flowSmall: FlowField;
  flowWide: FlowField;
  readonly director: Director;
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
  /** Seconds the party has continuously held the merchant exit. */
  merchantHold = 0;
  /** Set when the merchant exit hold finishes; GameRoom clears and advances. */
  merchantDepart = false;

  private nextId = 1;
  private flowT = 0;
  /** Hero+pad keys that were occupied last tick (edge-triggered summons). */
  private padOccupancy = new Set<string>();

  constructor(seed: number, mode: GameMode = "default") {
    this.mode = mode;
    this.levelId = initialLevelIdForMode(mode);
    this.level = parseLevelById(this.levelId);
    this.flowSmall = new FlowField(this.level, false);
    this.flowWide = new FlowField(this.level, true);
    this.director = new Director(this);
    this.rng = createRng(seed);
  }

  /** Swap the playable map (Gingey Wastes after a Holseher's Map vote). */
  loadLevel(levelId: string): void {
    this.levelId = levelId;
    this.level = parseLevelById(levelId);
    this.flowSmall = new FlowField(this.level, false);
    this.flowWide = new FlowField(this.level, true);
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
    this.gateOpen = this.mode === "testing" || this.mode === "wastes";
    this.eventActive = false;
    this.eventDone = false;
    this.eventTimeLeft = 0;
    this.bossActive = false;
    this.missionTime = 0;
    this.totalKills = 0;
    this.padOccupancy.clear();
    let i = 0;
    for (const hero of this.heroes.values()) {
      const start = this.level.playerStarts[i++ % this.level.playerStarts.length]!;
      resetHeroForMission(hero, start.x, start.y);
    }
    for (const p of this.level.ammoCrates) this.addPickup("ammo", p.x, p.y);
    for (const p of this.level.medKits) this.addPickup("med", p.x, p.y);
    if (this.mode === "testing") this.setupTestingZone();
    else if (this.mode !== "wastes") this.director.reset();
    this.rebuildFlow();
    this.phase = "playing";
  }

  private setupTestingZone(): void {
    for (const d of this.level.dummySpawns) {
      this.spawnEnemy(d.armored ? "dummyArmored" : "dummy", d.x, d.y, false);
    }
  }

  /** After a wastes mission, send the party to the merchant hall. */
  enterMerchantHall(): void {
    this.loadLevel(WASTES_MERCHANT_LEVEL_ID);
    this.enemies.clear();
    this.hazards.clear();
    this.pickups.clear();
    this.fx = [];
    this.gateOpen = true;
    this.eventActive = false;
    this.eventDone = false;
    this.eventTimeLeft = 0;
    this.bossActive = false;
    this.merchantHold = 0;
    this.merchantDepart = false;
    let i = 0;
    for (const hero of this.heroes.values()) {
      const start = this.level.playerStarts[i++ % this.level.playerStarts.length]!;
      resetHeroForMission(hero, start.x, start.y);
    }
    for (const p of this.level.merchantSpawns) {
      this.spawnEnemy("merchant", p.x, p.y, false);
    }
    this.rebuildFlow();
    this.phase = "merchant";
    this.emit({
      t: "announce",
      text: "A merchant waits. Gather at the exit to continue.",
      kind: "info",
    });
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
    if (this.phase !== "playing" && this.phase !== "merchant") {
      for (const hero of this.heroes.values()) {
        hero.inputs.length = 0;
      }
      return;
    }

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

    separateCreatures(this);

    if (this.phase === "merchant") {
      this.updateMerchantExit(dt);
      return;
    }

    this.missionTime += dt;
    updateHazards(this, dt);
    if (this.mode === "testing") this.updateSummonPads();
    else if (this.mode !== "wastes") this.director.step(dt);
    this.checkMissionEnd();
  }

  /** Whole living party must stand in the exit zone for MERCHANT_EXIT_HOLD seconds. */
  private updateMerchantExit(dt: number): void {
    if (this.merchantDepart) return;
    const living = this.aliveHeroes();
    const standing = this.standingHeroes();
    const ready =
      living.length > 0 &&
      standing.length === living.length &&
      standing.every((h) => isInZone(this.level, this.level.endZone, h.x, h.y));
    if (ready) {
      this.merchantHold += dt;
      if (this.merchantHold >= MERCHANT_EXIT_HOLD) {
        this.merchantHold = MERCHANT_EXIT_HOLD;
        this.merchantDepart = true;
      }
    } else {
      this.merchantHold = 0;
    }
  }

  /** Summon one enemy when a hero first steps onto a pad (not while standing on it). */
  private updateSummonPads(): void {
    const next = new Set<string>();
    for (const hero of this.standingHeroes()) {
      const heroTile = tileIndexAt(this.level, hero.x, hero.y);
      this.level.summonPads.forEach((pad, i) => {
        if (tileIndexAt(this.level, pad.x, pad.y) !== heroTile) return;
        const key = `${hero.id}:${i}`;
        next.add(key);
        if (!this.padOccupancy.has(key)) {
          const offset = 40 + (pad.type === "ogre" ? 20 : 0);
          this.spawnEnemy(pad.type, pad.x, pad.y + offset, true);
        }
      });
    }
    this.padOccupancy = next;
  }

  private despawnIfLonely(enemy: Enemy, dt: number): void {
    if (!enemy.aggro || enemy.def.behavior === "boss" || enemy.def.behavior === "dummy") return;
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
    // Testing zone has no end zone; empty endZone must not auto-win.
    if (this.level.endZone.size === 0) return;
    if (standing.every((h) => isInZone(this.level, this.level.endZone, h.x, h.y))) {
      this.phase = "victory";
      this.emit({ t: "announce", text: "Mission complete!", kind: "info" });
    }
  }
}
