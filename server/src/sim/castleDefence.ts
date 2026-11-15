import {
  CASTLE_DEFENCE_WAVES,
  CASTLE_KING_HP,
  CASTLE_KING_RADIUS,
  castleWaveEnemyCount,
  type CastleWavePath,
  type Point,
} from "@twodverm/shared";
import type { World } from "./World";

export interface CastleKing {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
}

/**
 * Scripted wave runner for Castle Defence. Normal Director is disabled in this mode.
 * Next wave waits until the current wave is cleared; if delay already elapsed, spawns now.
 * Timer always counts from the previous wave's start (`delayAfterPrev`).
 */
export class CastleDefenceDirector {
  /** Waves started so far (0 before the first spawn). */
  waveIndex = 0;
  /** Seconds until the next wave is allowed to start (from previous wave start / mission start). */
  waveTimer = 0;
  /** True while any enemies from the latest started wave are still alive. */
  waveActive = false;
  private waveEnemyIds = new Set<string>();
  private started = false;
  private won = false;

  reset(world: World): void {
    this.waveIndex = 0;
    this.waveActive = false;
    this.waveEnemyIds.clear();
    this.won = false;
    this.started = true;
    const first = CASTLE_DEFENCE_WAVES[0];
    this.waveTimer = first?.delayAfterPrev ?? 30;
    this.syncHud(world);
  }

  step(world: World, dt: number): void {
    if (!this.started || this.won || world.phase !== "playing") return;
    if (world.king && world.king.hp <= 0) {
      this.syncHud(world);
      return;
    }

    this.pruneDead(world);

    if (this.waveActive && this.waveEnemyIds.size === 0) {
      this.waveActive = false;
      if (this.waveIndex >= CASTLE_DEFENCE_WAVES.length) {
        this.won = true;
        world.phase = "victory";
        world.emit({ t: "announce", text: "The castle holds! Victory!", kind: "info" });
        this.waveTimer = 0;
        this.syncHud(world);
        return;
      }
    }

    // Timer runs from previous wave start even while the current wave is alive.
    if (this.waveIndex < CASTLE_DEFENCE_WAVES.length) {
      this.waveTimer = Math.max(0, this.waveTimer - dt);
    }

    if (!this.waveActive && this.waveIndex < CASTLE_DEFENCE_WAVES.length && this.waveTimer <= 0) {
      this.spawnWave(world);
    }

    this.syncHud(world);
  }

  private syncHud(world: World): void {
    world.castleWaveNumber = this.waveIndex;
    world.castleWaveTotal = CASTLE_DEFENCE_WAVES.length;
    world.castleWaveTimer = this.waveTimer;
    world.castleWaveActive = this.waveActive;
  }

  private pruneDead(world: World): void {
    for (const id of [...this.waveEnemyIds]) {
      if (!world.enemies.has(id)) this.waveEnemyIds.delete(id);
    }
  }

  private spawnWave(world: World): void {
    const def = CASTLE_DEFENCE_WAVES[this.waveIndex];
    if (!def) return;
    const players = Math.max(1, world.standingHeroes().length || world.heroes.size);
    const points = this.spawnPointsFor(world, def.paths);
    if (points.length === 0) points.push(...world.level.hordeSpawns);
    if (points.length === 0) {
      this.waveIndex++;
      this.armNextTimer();
      return;
    }

    this.waveEnemyIds.clear();
    for (const entry of def.composition) {
      const n = castleWaveEnemyCount(entry.baseCount, def.kind, players);
      for (let i = 0; i < n; i++) {
        const at = points[i % points.length]!;
        const e = world.spawnEnemy(
          entry.type,
          at.x + (world.rng() - 0.5) * 20,
          at.y + (world.rng() - 0.5) * 20,
          true,
        );
        if (e) {
          e.aggro = true;
          e.state = "chase";
          this.waveEnemyIds.add(e.id);
        }
      }
    }

    this.waveActive = true;
    this.waveIndex++;
    world.emit({ t: "announce", text: `Wave ${def.id} incoming!`, kind: "horde" });
    this.armNextTimer();
  }

  private armNextTimer(): void {
    const next = CASTLE_DEFENCE_WAVES[this.waveIndex];
    this.waveTimer = next ? next.delayAfterPrev : 0;
  }

  private spawnPointsFor(world: World, paths: CastleWavePath[]): Point[] {
    const out: Point[] = [];
    const bags = world.level.castlePathSpawns;
    for (const p of paths) {
      const list = bags[p];
      if (list.length > 0) out.push(...list);
    }
    return out;
  }
}

export function createCastleKing(at: Point): CastleKing {
  return {
    x: at.x,
    y: at.y,
    radius: CASTLE_KING_RADIUS,
    hp: CASTLE_KING_HP,
    maxHp: CASTLE_KING_HP,
  };
}
