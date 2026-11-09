import {
  allLivingInBossRoom,
  collideCircle,
  confineToBossRoom,
  createRng,
  dist,
  DEV_TEST_START_GOLD,
  ENEMIES,
  initialLevelIdForMode,
  INTERACT_RANGE,
  isInZone,
  isPerkId,
  isShopItemId,
  MAX_ENEMIES,
  MERCHANT_EXIT_HOLD,
  parseLevelById,
  perksOfferedFor,
  SHOP_ITEMS,
  TILE_FLOOR,
  tileIndexAt,
  WASTES_MERCHANT_LEVEL_ID,
  type EnemyId,
  type FxEvent,
  type GameMode,
  type GamePhase,
  type GeneratedLevelMeta,
  type HeroDef,
  type Level,
  type LevelProperties,
} from "@twodverm/shared";
import { createBarrel, updateBarrels } from "./barrels";
import { Director } from "./director";
import { updateEnemy } from "./enemies";
import { FlowField } from "./flowField";
import { updateHazards } from "./hazards";
import { createHero, processHeroInputs, resetHeroForMission, updateHero } from "./heroes";
import { separateCreatures } from "./separation";
import type { Barrel, Enemy, Hazard, Hero, Pickup } from "./types";

const FLOW_REBUILD_INTERVAL = 0.4;
const LONELY_DESPAWN_DISTANCE = 1800;
const LONELY_DESPAWN_TIME = 10;

export class World {
  readonly mode: GameMode;
  /** Wastes create option: merchant-first run with starting gold. */
  devTest = false;
  levelId: string;
  level: Level;
  readonly heroes = new Map<string, Hero>();
  readonly enemies = new Map<string, Enemy>();
  readonly hazards = new Map<string, Hazard>();
  readonly pickups = new Map<string, Pickup>();
  readonly barrels = new Map<string, Barrel>();
  flowSmall: FlowField;
  flowWide: FlowField;
  readonly director: Director;
  readonly rng: () => number;
  /** Room-wide seed used for procgen rolls. */
  readonly roomSeed: number;

  fx: FxEvent[] = [];
  phase: GamePhase = "lobby";
  gateOpen = false;
  eventActive = false;
  eventDone = false;
  eventTimeLeft = 0;
  bossActive = false;
  missionTime = 0;
  totalKills = 0;
  /** Seconds the party has continuously held the merchant exit or wastes exit. */
  merchantHold = 0;
  /** Set when the merchant exit hold finishes; GameRoom clears and advances. */
  merchantDepart = false;

  /** Active procedural wastes level (null for hand-authored maps). */
  procMeta: GeneratedLevelMeta | null = null;
  levelProps: LevelProperties | null = null;
  procSeed = 0;
  finalObjectiveComplete = false;
  /** How many section objectives have been completed (opens soft gates 0..n-1). */
  procProgress = 0;
  private objectiveArmed = false;
  private objectiveEnemyIds = new Set<string>();
  private holdObjectiveId: string | null = null;

  private nextId = 1;
  private flowT = 0;
  /** Hero+pad keys that were occupied last tick (edge-triggered summons). */
  private padOccupancy = new Set<string>();

  constructor(seed: number, mode: GameMode = "default") {
    this.mode = mode;
    this.roomSeed = seed >>> 0;
    this.levelId = initialLevelIdForMode(mode);
    this.level = parseLevelById(this.levelId);
    this.flowSmall = new FlowField(this.level, false);
    this.flowWide = new FlowField(this.level, true);
    this.director = new Director(this);
    this.rng = createRng(seed);
  }

  /** Swap the playable map (hand-authored id). */
  loadLevel(levelId: string): void {
    this.clearProc();
    this.levelId = levelId;
    this.level = parseLevelById(levelId);
    this.flowSmall = new FlowField(this.level, false);
    this.flowWide = new FlowField(this.level, true);
  }

  /** Load a deterministically generated wastes level. */
  loadGeneratedLevel(
    levelId: string,
    level: Level,
    meta: GeneratedLevelMeta,
    props: LevelProperties,
    seed: number,
  ): void {
    this.levelId = levelId;
    this.level = level;
    this.procMeta = meta;
    this.levelProps = props;
    this.procSeed = seed >>> 0;
    this.finalObjectiveComplete = false;
    this.procProgress = 0;
    this.objectiveArmed = false;
    this.objectiveEnemyIds.clear();
    this.holdObjectiveId = null;
    this.flowSmall = new FlowField(this.level, false);
    this.flowWide = new FlowField(this.level, true);
  }

  private clearProc(): void {
    this.procMeta = null;
    this.levelProps = null;
    this.procSeed = 0;
    this.finalObjectiveComplete = false;
    this.procProgress = 0;
    this.objectiveArmed = false;
    this.objectiveEnemyIds.clear();
    this.holdObjectiveId = null;
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

  /** Clear gold and shop upgrades at the start of a fresh run. */
  resetRunEconomy(): void {
    for (const hero of this.heroes.values()) {
      hero.gold = 0;
      hero.dmgUpStacks = 0;
      hero.perks.clear();
      hero.wardCd = 0;
      hero.invisT = 0;
      hero.vanishAfterDodge = false;
      hero.riposteReady = false;
    }
  }

  /** Give every hero the Wastes `devTest` starting purse. */
  grantDevTestStartingGold(): void {
    if (!this.devTest) return;
    for (const hero of this.heroes.values()) hero.gold = DEV_TEST_START_GOLD;
  }

  /** Hero who may trade right now (merchant phase, standing, next to the merchant). */
  private shopper(heroId: string): Hero | null {
    if (this.phase !== "merchant") return null;
    const hero = this.heroes.get(heroId);
    if (!hero || hero.state === "dead" || hero.state === "downed") return null;
    const nearMerchant = [...this.enemies.values()].some(
      (e) => e.def.id === "merchant" && dist(hero.x, hero.y, e.x, e.y) <= INTERACT_RANGE + e.radius + 24,
    );
    return nearMerchant ? hero : null;
  }

  /** Buy a one-time hero perk. Returns false if the buy is rejected. */
  buyPerk(heroId: string, perkId: string): boolean {
    if (!isPerkId(perkId)) return false;
    const hero = this.shopper(heroId);
    if (!hero) return false;
    const perk = perksOfferedFor(hero.def.id, hero.perks).find((p) => p.id === perkId);
    if (!perk || hero.gold < perk.cost) return false;
    hero.gold -= perk.cost;
    hero.perks.add(perk.id);
    if (perk.id === "rune_ward") hero.wardCd = 0;
    this.emit({ t: "pickup", id: hero.id, kind: "shop" });
    return true;
  }

  /** Spend gold on a merchant item. Returns false if the buy is rejected. */
  buyShopItem(heroId: string, itemId: string): boolean {
    if (!isShopItemId(itemId)) return false;
    const hero = this.shopper(heroId);
    if (!hero) return false;
    const item = SHOP_ITEMS[itemId];
    if (hero.gold < item.cost) return false;
    hero.gold -= item.cost;
    if (itemId === "dmg_up") hero.dmgUpStacks += 1;
    this.emit({ t: "pickup", id: hero.id, kind: "shop" });
    return true;
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
    this.barrels.clear();
    this.fx = [];
    this.gateOpen = this.mode === "testing" || (this.mode === "wastes" && !this.procMeta);
    this.eventActive = false;
    this.eventDone = false;
    this.eventTimeLeft = 0;
    this.bossActive = false;
    this.missionTime = 0;
    this.totalKills = 0;
    this.merchantHold = 0;
    this.finalObjectiveComplete = false;
    this.procProgress = 0;
    this.objectiveArmed = false;
    this.objectiveEnemyIds.clear();
    this.holdObjectiveId = null;
    this.padOccupancy.clear();
    let i = 0;
    for (const hero of this.heroes.values()) {
      const start = this.level.playerStarts[i++ % this.level.playerStarts.length]!;
      resetHeroForMission(hero, start.x, start.y);
    }
    for (const p of this.level.ammoCrates) this.addPickup("ammo", p.x, p.y);
    for (const p of this.level.medKits) this.addPickup("med", p.x, p.y);
    for (const p of this.level.barrelSpawns) {
      const id = this.newId("b");
      this.barrels.set(id, createBarrel(id, p.x, p.y));
    }
    if (this.mode === "testing") this.setupTestingZone();
    else if (this.mode === "wastes" && this.procMeta) this.director.reset();
    else if (this.mode !== "wastes") this.director.reset();
    this.rebuildFlow();
    this.phase = "playing";
  }

  private setupTestingZone(): void {
    for (const d of this.level.dummySpawns) {
      this.spawnEnemy(d.armored ? "dummyArmored" : "dummy", d.x, d.y, false);
    }
    // A few barrels near the centre for interact / throw testing.
    const starts = this.level.playerStarts;
    const origin = starts[0] ?? { x: 200, y: 200 };
    for (let i = 0; i < 4; i++) {
      const id = this.newId("b");
      this.barrels.set(
        id,
        createBarrel(id, origin.x + 80 + (i % 2) * 36, origin.y + 40 + Math.floor(i / 2) * 36),
      );
    }
  }

  /** After a wastes mission, send the party to the merchant hall. */
  enterMerchantHall(): void {
    this.loadLevel(WASTES_MERCHANT_LEVEL_ID);
    this.enemies.clear();
    this.hazards.clear();
    this.pickups.clear();
    this.barrels.clear();
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
      text: "A merchant waits. Press E to trade, then gather at the exit.",
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
    const visible = (h: Hero) => h.invisT <= 0;
    const targets = this.standingHeroes().filter(visible);
    const list = targets.length > 0 ? targets : this.aliveHeroes().filter(visible);
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
    this.confineHeroesToBossRoom();

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
    updateHazards(this, dt);

    if (this.phase === "merchant") {
      this.updateMerchantExit(dt);
      return;
    }

    this.missionTime += dt;
    updateBarrels(this, dt);
    if (this.mode === "testing") this.updateSummonPads();
    else if (this.procMeta) {
      this.updateProcObjectives(dt);
      this.director.step(dt);
    } else if (this.mode !== "wastes") this.director.step(dt);
    this.checkMissionEnd(dt);
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

  private currentObjective() {
    if (!this.procMeta) return null;
    return this.procMeta.objectives[this.procProgress] ?? null;
  }

  private updateProcObjectives(dt: number): void {
    const obj = this.currentObjective();
    if (!obj) return;
    const standing = this.standingHeroes();
    const zone = new Set(obj.zone);
    const inZone = standing.some((h) => isInZone(this.level, zone, h.x, h.y));

    if (obj.kind === "hold") {
      if (!this.eventDone && !this.eventActive && inZone) {
        this.eventActive = true;
        this.holdObjectiveId = obj.id;
        this.eventTimeLeft = this.procMeta!.budgets.holdDuration;
        this.emit({
          t: "announce",
          text: `Hold the chamber (${Math.ceil(this.eventTimeLeft)}s)!`,
          kind: "event",
        });
        this.director.triggerHoldEntryHorde();
      }
      if (this.eventActive && this.holdObjectiveId === obj.id) {
        this.eventTimeLeft -= dt;
        if (this.eventTimeLeft <= 0) {
          this.eventActive = false;
          this.eventDone = true;
          this.completeCurrentObjective("Chamber secured!");
        }
      }
      return;
    }

    if (!this.objectiveArmed) {
      const canArm =
        obj.kind === "boss"
          ? allLivingInBossRoom(this.level, this.heroes.values())
          : inZone;
      if (canArm) {
        this.objectiveArmed = true;
        const type = (obj.spawnType ?? (obj.kind === "boss" ? "ogre" : "stormvermin")) as EnemyId;
        const spawned = this.spawnEnemy(type, obj.center.x, obj.center.y, true);
        if (spawned) this.objectiveEnemyIds.add(spawned.id);
        if (obj.kind === "boss") {
          this.bossActive = true;
          this.emit({ t: "announce", text: "A Rat Ogre approaches! The way out is sealed!", kind: "boss" });
        } else {
          this.emit({ t: "announce", text: "Elite vermin defend the chamber!", kind: "event" });
          if (this.rng() < 0.5) {
            const extra = this.spawnEnemy("stormvermin", obj.center.x + 40, obj.center.y, true);
            if (extra) this.objectiveEnemyIds.add(extra.id);
          }
        }
      }
    }

    if (this.objectiveArmed) {
      for (const id of [...this.objectiveEnemyIds]) {
        if (!this.enemies.has(id)) this.objectiveEnemyIds.delete(id);
      }
      if (this.objectiveEnemyIds.size === 0) {
        if (obj.kind === "boss") this.bossActive = false;
        this.completeCurrentObjective(obj.kind === "boss" ? "The ogre falls! Exit unlocked." : "Path ahead opens!");
      }
    }
  }

  private completeCurrentObjective(announce: string): void {
    if (!this.procMeta) return;
    const idx = this.procProgress;
    this.openProcGate(idx);
    this.procProgress += 1;
    this.objectiveArmed = false;
    this.objectiveEnemyIds.clear();
    this.holdObjectiveId = null;
    this.eventActive = false;
    this.eventDone = false;
    this.eventTimeLeft = 0;

    if (this.procProgress >= this.procMeta.objectives.length) {
      this.finalObjectiveComplete = true;
      this.gateOpen = true;
      this.rebuildFlow();
    }
    this.emit({ t: "announce", text: announce, kind: "event" });
  }

  /** While the boss fight is active, keep every living hero inside the arena. */
  private confineHeroesToBossRoom(): void {
    if (!this.bossActive || this.level.bossRoom.size === 0) return;
    for (const hero of this.heroes.values()) {
      if (hero.state === "dead") continue;
      const p = confineToBossRoom(this.level, hero.x, hero.y, hero.radius);
      hero.x = p.x;
      hero.y = p.y;
    }
  }

  /** Convert soft/exit gate tiles for the completed section into floor. */
  private openProcGate(index: number): void {
    if (!this.procMeta) return;
    const gates = this.procMeta.sectionGates[index];
    if (!gates) return;
    for (const i of gates) {
      if (i >= 0 && i < this.level.tiles.length) this.level.tiles[i] = TILE_FLOOR;
    }
    this.rebuildFlow();
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

  private checkMissionEnd(dt: number): void {
    if (this.heroes.size === 0) return;
    const standing = this.standingHeroes();
    if (standing.length === 0) {
      this.phase = "defeat";
      this.emit({ t: "announce", text: "Your party has fallen...", kind: "info" });
      return;
    }
    if (this.level.endZone.size === 0) return;

    if (this.procMeta) {
      if (!this.finalObjectiveComplete) {
        this.merchantHold = 0;
        return;
      }
      const living = this.aliveHeroes();
      const ready =
        living.length > 0 &&
        standing.length === living.length &&
        standing.every((h) => isInZone(this.level, this.level.endZone, h.x, h.y));
      if (ready) {
        this.merchantHold += dt;
        if (this.merchantHold >= MERCHANT_EXIT_HOLD) {
          this.merchantHold = MERCHANT_EXIT_HOLD;
          this.phase = "victory";
          this.emit({ t: "announce", text: "Mission complete!", kind: "info" });
        }
      } else {
        this.merchantHold = 0;
      }
      return;
    }

    if (standing.every((h) => isInZone(this.level, this.level.endZone, h.x, h.y))) {
      this.phase = "victory";
      this.emit({ t: "announce", text: "Mission complete!", kind: "info" });
    }
  }
}
