import {
  dist,
  enemiesForRaces,
  hasLineOfSight,
  isInZone,
  pickAmbientType,
  type EnemyId,
  type Point,
  type SpawnBudgets,
} from "@twodverm/shared";
import type { World } from "./World";

const INTENSITY_DECAY_PER_SEC = 0.06;
const HORDE_INTENSITY_LIMIT = 0.6;
const SPECIAL_INTENSITY_LIMIT = 0.85;
const MIN_SPAWN_DISTANCE = 520;
const MAX_SPAWN_DISTANCE = 1500;
const TRICKLE_INTERVAL = 0.3;
const TRICKLE_BATCH = 2;
const EVENT_DURATION = 50;
const EVENT_WAVE_INTERVAL = 11;
const SPECIAL_TYPES: EnemyId[] = ["gunner", "gas", "hooker"];

interface PendingSpawn {
  type: EnemyId;
  at: Point;
}

/** Server-side pacing: hordes, specials, the hold-the-point event and the boss. */
export class Director {
  intensity = 0;
  private nextHordeT = 0;
  private nextSpecialT = 0;
  private waveT = 0;
  private eventSpecialSpawned = false;
  private bossSpawned = false;
  private trickleT = 0;
  private queue: PendingSpawn[] = [];
  private budgets: SpawnBudgets | null = null;
  private racePools: ReturnType<typeof enemiesForRaces> | null = null;

  constructor(private readonly world: World) {}

  reset(): void {
    this.intensity = 0;
    this.budgets = this.world.procMeta?.budgets ?? null;
    this.racePools = this.world.levelProps ? enemiesForRaces(this.world.levelProps) : null;
    if (this.budgets) {
      this.nextHordeT = this.budgets.hordeInterval * 0.6 + this.world.rng() * this.budgets.hordeInterval * 0.4;
      this.nextSpecialT = this.budgets.specialInterval * 0.5 + this.world.rng() * this.budgets.specialInterval * 0.5;
    } else {
      this.nextHordeT = 45 + this.world.rng() * 20;
      this.nextSpecialT = 30 + this.world.rng() * 15;
    }
    this.waveT = 0;
    this.eventSpecialSpawned = false;
    this.bossSpawned = false;
    this.queue = [];
    this.spawnAmbient();
  }

  addIntensity(amount: number): void {
    this.intensity = Math.min(1.5, this.intensity + amount);
  }

  step(dt: number): void {
    const w = this.world;
    this.intensity = Math.max(0, this.intensity - INTENSITY_DECAY_PER_SEC * dt);
    this.flushQueue(dt);
    if (!w.procMeta) this.checkTriggers();

    if (w.eventActive) {
      if (!w.procMeta) this.stepEvent(dt);
      return;
    }
    if (w.bossActive) return;

    if (this.intensity < HORDE_INTENSITY_LIMIT) this.nextHordeT -= dt;
    if (this.nextHordeT <= 0) {
      this.nextHordeT = this.budgets
        ? this.budgets.hordeInterval + w.rng() * (this.budgets.hordeInterval * 0.4)
        : 70 + w.rng() * 30;
      this.startHorde(this.hordeSize(), w.missionTime > 120);
    }

    if (this.intensity < SPECIAL_INTENSITY_LIMIT) this.nextSpecialT -= dt;
    if (this.nextSpecialT <= 0) {
      this.nextSpecialT = this.budgets
        ? this.budgets.specialInterval + w.rng() * (this.budgets.specialInterval * 0.5)
        : 28 + w.rng() * 22;
      this.spawnSpecial();
    }
  }

  private hordeSize(): number {
    const base = this.budgets?.hordeSize ?? 10;
    return base + 5 * Math.max(1, this.world.heroes.size);
  }

  private maxSpecials(): number {
    return this.budgets?.maxSpecials ?? 2;
  }

  private spawnAmbient(): void {
    const w = this.world;
    if (this.racePools && this.budgets) {
      const eliteChance = this.budgets.eliteChance;
      for (const p of w.level.ambientRats) {
        const n = 2 + Math.floor(w.rng() * 3);
        for (let i = 0; i < n; i++) {
          w.spawnEnemy(this.pickHordeType(), p.x + (w.rng() - 0.5) * 50, p.y + (w.rng() - 0.5) * 50, false);
        }
        w.spawnEnemy(this.pickHordeType(), p.x + (w.rng() - 0.5) * 40, p.y + (w.rng() - 0.5) * 40, false);
      }
      for (const p of w.level.ambientElites) {
        const type = this.pickEliteType();
        w.spawnEnemy(type, p.x - 14, p.y, false);
        w.spawnEnemy(type, p.x + 14, p.y, false);
      }
      let ambient = 0;
      for (const e of w.enemies.values()) {
        if (!e.aggro && (e.def.behavior === "melee" || e.def.elite)) ambient++;
      }
      while (ambient < this.budgets.ambientCount && w.level.hordeSpawns.length > 0) {
        const p = w.level.hordeSpawns[Math.floor(w.rng() * w.level.hordeSpawns.length)]!;
        const type = pickAmbientType(this.racePools, eliteChance, w.rng);
        w.spawnEnemy(type, p.x + (w.rng() - 0.5) * 60, p.y + (w.rng() - 0.5) * 60, false);
        ambient++;
      }
      return;
    }
    for (const p of w.level.ambientRats) {
      const n = 2 + Math.floor(w.rng() * 3);
      for (let i = 0; i < n; i++) w.spawnEnemy("slave", p.x + (w.rng() - 0.5) * 50, p.y + (w.rng() - 0.5) * 50, false);
      w.spawnEnemy("clanrat", p.x + (w.rng() - 0.5) * 40, p.y + (w.rng() - 0.5) * 40, false);
    }
    for (const p of w.level.ambientElites) {
      w.spawnEnemy("stormvermin", p.x - 14, p.y, false);
      w.spawnEnemy("stormvermin", p.x + 14, p.y, false);
    }
  }

  private pickHordeType(): EnemyId {
    const pool = this.racePools?.horde;
    if (pool && pool.length > 0) return pool[Math.floor(this.world.rng() * pool.length)]!;
    return this.world.rng() < 0.7 ? "slave" : "clanrat";
  }

  private pickEliteType(): EnemyId {
    const pool = this.racePools?.elite;
    if (pool && pool.length > 0) return pool[Math.floor(this.world.rng() * pool.length)]!;
    return "stormvermin";
  }

  private checkTriggers(): void {
    const w = this.world;
    const standing = w.standingHeroes();
    if (!w.eventDone && !w.eventActive && standing.some((h) => isInZone(w.level, w.level.holdZone, h.x, h.y))) {
      w.eventActive = true;
      w.eventTimeLeft = EVENT_DURATION;
      this.waveT = 2;
      this.eventSpecialSpawned = false;
      w.emit({ t: "announce", text: "Hold the square until the gate opens!", kind: "event" });
    }
    if (!this.bossSpawned && w.level.ogreSpawn && standing.some((h) => isInZone(w.level, w.level.bossTrigger, h.x, h.y))) {
      this.bossSpawned = true;
      w.bossActive = true;
      w.spawnEnemy("ogre", w.level.ogreSpawn.x, w.level.ogreSpawn.y, true);
      w.emit({ t: "announce", text: "A Rat Ogre approaches!", kind: "boss" });
    }
  }

  private stepEvent(dt: number): void {
    const w = this.world;
    w.eventTimeLeft -= dt;
    this.waveT -= dt;
    if (this.waveT <= 0) {
      this.waveT = EVENT_WAVE_INTERVAL;
      const elapsed = EVENT_DURATION - w.eventTimeLeft;
      this.startHorde(6 + 3 * Math.max(1, w.heroes.size), elapsed > 15, false);
    }
    if (!this.eventSpecialSpawned && w.eventTimeLeft < EVENT_DURATION / 2) {
      this.eventSpecialSpawned = true;
      this.spawnSpecial();
    }
    if (w.eventTimeLeft <= 0) {
      w.eventActive = false;
      w.eventDone = true;
      w.gateOpen = true;
      w.rebuildFlow();
      w.emit({ t: "announce", text: "The gate is open! Push on!", kind: "event" });
    }
  }

  private startHorde(size: number, withElites: boolean, announce = true): void {
    const w = this.world;
    const points = this.pickSpawnPoints(w.level.hordeSpawns, 2);
    if (points.length === 0) return;
    if (announce) w.emit({ t: "announce", text: "A horde approaches!", kind: "horde" });
    for (let i = 0; i < size; i++) {
      this.queue.push({ type: this.pickHordeType(), at: points[i % points.length]! });
    }
    if (withElites) {
      this.queue.push({ type: this.pickEliteType(), at: points[0]! });
      if (w.heroes.size >= 3) this.queue.push({ type: this.pickEliteType(), at: points[points.length - 1]! });
    }
  }

  private spawnSpecial(): void {
    const w = this.world;
    let alive = 0;
    for (const e of w.enemies.values()) if (e.def.special) alive++;
    if (alive >= this.maxSpecials()) return;
    const [p] = this.pickSpawnPoints(w.level.specialSpawns, 1);
    if (!p) return;
    const pool = this.racePools?.special ?? SPECIAL_TYPES;
    const type = pool[Math.floor(w.rng() * pool.length)]!;
    w.spawnEnemy(type, p.x, p.y, true);
  }

  private flushQueue(dt: number): void {
    if (this.queue.length === 0) return;
    this.trickleT -= dt;
    if (this.trickleT > 0) return;
    this.trickleT = TRICKLE_INTERVAL;
    const w = this.world;
    for (let i = 0; i < TRICKLE_BATCH && this.queue.length > 0; i++) {
      const s = this.queue.shift()!;
      w.spawnEnemy(s.type, s.at.x + (w.rng() - 0.5) * 40, s.at.y + (w.rng() - 0.5) * 40, true);
    }
  }

  /** Spawn points that are out of sight, not too close, and not too far from the party. */
  private pickSpawnPoints(points: Point[], count: number): Point[] {
    const w = this.world;
    const heroes = w.aliveHeroes();
    if (heroes.length === 0) return [];
    const scored: { p: Point; score: number }[] = [];
    for (const p of points) {
      if (!w.flowSmall.reachable(p.x, p.y)) continue;
      let nearest = Infinity;
      let seen = false;
      for (const h of heroes) {
        const d = dist(p.x, p.y, h.x, h.y);
        nearest = Math.min(nearest, d);
        if (d < 700 && hasLineOfSight(w.level, w.gateOpen, p.x, p.y, h.x, h.y)) seen = true;
      }
      if (nearest < MIN_SPAWN_DISTANCE || nearest > MAX_SPAWN_DISTANCE) continue;
      scored.push({ p, score: nearest + (seen ? 600 : 0) + w.rng() * 200 });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, count).map((s) => s.p);
  }
}
