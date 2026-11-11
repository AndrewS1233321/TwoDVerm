import type { LevelProperties, SpawnBudgets } from "./types";

/** Stormvermin in an elite-mix hold's entry horde, by difficulty 1–4. */
const HOLD_ELITES_BY_DIFFICULTY = [1, 2, 3, 5];

/** Derive spawn / layout budgets from level difficulty. */
export function budgetsFromDifficulty(difficulty: number): SpawnBudgets {
  const d = Math.max(1, Math.min(4, difficulty));
  const sectionCount = Math.max(1, Math.min(4, Math.round(d)));
  return {
    sectionCount,
    roomsPerSection: 3 + Math.floor(d),
    ambientCount: Math.round(6 + d * 4),
    eliteChance: Math.min(0.45, 0.08 + d * 0.08),
    hordeSize: Math.round(8 + d * 4),
    hordeInterval: Math.max(28, 70 - d * 8),
    specialInterval: Math.max(18, 40 - d * 4),
    maxSpecials: Math.min(4, 1 + Math.floor(d)),
    raceSlots: Math.min(3, 1 + Math.floor(d / 2)),
    holdDuration: Math.round(18 + d * 4),
    holdEliteCount: HOLD_ELITES_BY_DIFFICULTY[Math.round(d) - 1]!,
    cannonChannel: 2.5,
    /** Placeholder for 1 player; runtime uses `bellKillTargetFor(players, d)`. */
    bellKillTarget: bellKillTargetFor(1, d),
    bellWaveInterval: Math.max(6, 11 - d),
    /** Wave-1 stormvermin count; later waves scale with `bellWaveCompound`. */
    bellWaveElites: Math.floor(d / 2),
    /** Fixed on wave 3 only — not compounded. */
    bellWave3Monks: 2 + 2 * d,
  };
}

export function difficultyForStop(stop: number): number {
  return Math.max(1, Math.min(4, stop));
}

/** Bell kill goal: `players × (45 + 15 × difficulty)`. */
export function bellKillTargetFor(players: number, difficulty: number): number {
  const p = Math.max(1, Math.round(players));
  const d = Math.max(1, Math.min(4, difficulty));
  return p * (45 + 15 * d);
}

/** Per-wave size multiplier: wave 1 = 1, wave 2 = 1.3, wave 3 = 1.69, … */
export function bellWaveCompound(waveIndex: number): number {
  return Math.pow(1.3, Math.max(0, waveIndex - 1));
}

/** Round a base creature count through the wave compound (specials/monks excluded). */
export function bellWaveCount(base: number, waveIndex: number): number {
  return Math.max(0, Math.round(base * bellWaveCompound(waveIndex)));
}

/** Compact serialisable props for Colyseus string fields / vote UI. */
export function serializeLevelProps(p: LevelProperties): string {
  return JSON.stringify({
    t: p.levelType,
    d: p.difficulty,
    p: p.primaryRace,
    a: p.allowableRaces,
  });
}

export function parseLevelProps(raw: string): LevelProperties | null {
  try {
    const o = JSON.parse(raw) as {
      t?: unknown;
      d?: unknown;
      p?: unknown;
      a?: unknown;
    };
    if (typeof o.t !== "string" || typeof o.d !== "number" || typeof o.p !== "string") return null;
    if (!Array.isArray(o.a) || !o.a.every((x) => typeof x === "string")) return null;
    return {
      levelType: o.t as LevelProperties["levelType"],
      difficulty: o.d,
      primaryRace: o.p as LevelProperties["primaryRace"],
      allowableRaces: o.a as LevelProperties["allowableRaces"],
    };
  } catch {
    return null;
  }
}
