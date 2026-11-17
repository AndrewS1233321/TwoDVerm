import type { CombatEnemyId } from "./types";

export type CastleWavePath = "left" | "top" | "right";
export type CastleWaveKind = "standard" | "miniboss" | "boss";
/** `perPlayer` → count = baseCount × players; `fixed` → count = baseCount. */
export type CastleWaveScale = "perPlayer" | "fixed";

export interface CastleWaveEnemy {
  type: CombatEnemyId;
  baseCount: number;
  /**
   * Defaults: `fixed` for boss waves, otherwise `perPlayer`.
   * Use `fixed` for exact specials that must not scale with party size.
   */
  scale?: CastleWaveScale;
}

export interface CastleWaveDef {
  id: number;
  /** Seconds after the previous wave *started* (wave 1: after mission start). */
  delayAfterPrev: number;
  paths: CastleWavePath[];
  kind: CastleWaveKind;
  composition: CastleWaveEnemy[];
  /**
   * Extra fixed spawns keyed by player count (1–4). Counts here are exact
   * (never multiplied). Use key `4` for parties of 4+.
   */
  specialsByPlayers?: Partial<Record<1 | 2 | 3 | 4, readonly CastleWaveEnemy[]>>;
  /**
   * Boss HP multiplier by player count (1–4). Applied to each spawned enemy
   * from this wave's composition (typically the single Rat Ogre).
   */
  bossHpMulByPlayers?: Partial<Record<1 | 2 | 3 | 4, number>>;
}

/** Resolved spawn line after applying player scaling. */
export interface CastleSpawnLine {
  type: CombatEnemyId;
  count: number;
  hpMul: number;
}

/** Tunable Castle Defence wave table. Edit delays and counts here. */
export const CASTLE_DEFENCE_WAVES: readonly CastleWaveDef[] = [
  {
    id: 1,
    delayAfterPrev: 30,
    paths: ["top"],
    kind: "standard",
    composition: [{ type: "slave", baseCount: 8 }],
  },
  {
    id: 2,
    delayAfterPrev: 30,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "slave", baseCount: 6 },
      { type: "clanrat", baseCount: 4 },
    ],
  },
  {
    id: 3,
    delayAfterPrev: 30,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "slave", baseCount: 10 },
      { type: "clanrat", baseCount: 8 },
    ],
  },
  {
    id: 4,
    delayAfterPrev: 35,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "slave", baseCount: 12 },
      { type: "clanrat", baseCount: 12 },
    ],
  },
  {
    id: 5,
    delayAfterPrev: 40,
    paths: ["top"],
    kind: "miniboss",
    composition: [
      { type: "stormvermin", baseCount: 2 },
      { type: "slave", baseCount: 5 },
    ],
    specialsByPlayers: {
      1: [{ type: "gas", baseCount: 1, scale: "fixed" }],
      2: [
        { type: "gas", baseCount: 1, scale: "fixed" },
        { type: "gutterRunner", baseCount: 1, scale: "fixed" },
      ],
      3: [
        { type: "gas", baseCount: 1, scale: "fixed" },
        { type: "gutterRunner", baseCount: 1, scale: "fixed" },
        { type: "gunner", baseCount: 1, scale: "fixed" },
      ],
      4: [
        { type: "gas", baseCount: 2, scale: "fixed" },
        { type: "gutterRunner", baseCount: 1, scale: "fixed" },
        { type: "gunner", baseCount: 1, scale: "fixed" },
      ],
    },
  },
  {
    id: 6,
    delayAfterPrev: 40,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "slave", baseCount: 10 },
      { type: "clanrat", baseCount: 5 },
      { type: "shieldClanrat", baseCount: 5 },
      { type: "stormvermin", baseCount: 1 },
    ],
  },
  {
    id: 7,
    delayAfterPrev: 40,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "shieldClanrat", baseCount: 10 },
      { type: "hooker", baseCount: 1 },
      { type: "slave", baseCount: 5 },
    ],
  },
  {
    id: 8,
    delayAfterPrev: 45,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "clanrat", baseCount: 15 },
      { type: "warpfire", baseCount: 1 },
      { type: "gas", baseCount: 1 },
    ],
  },
  {
    id: 9,
    delayAfterPrev: 45,
    paths: ["top"],
    kind: "standard",
    composition: [
      { type: "stormvermin", baseCount: 2 },
      { type: "shieldStormvermin", baseCount: 1 },
      { type: "clanrat", baseCount: 5 },
    ],
  },
  {
    id: 10,
    delayAfterPrev: 50,
    paths: ["top"],
    kind: "boss",
    composition: [{ type: "ogre", baseCount: 1, scale: "fixed" }],
    // 1p ×1, 2p ×1.5, 3p ×2, 4p ×2.5
    bossHpMulByPlayers: { 1: 1, 2: 1.5, 3: 2, 4: 2.5 },
  },
];

export const CASTLE_KING_HP = 5000;
export const CASTLE_KING_RADIUS = 18;
/** GP granted to each living hero when a wave is cleared. */
export const CASTLE_WAVE_GOLD = 25;

function playerKey(players: number): 1 | 2 | 3 | 4 {
  const p = Math.max(1, Math.round(players));
  if (p >= 4) return 4;
  if (p === 3) return 3;
  if (p === 2) return 2;
  return 1;
}

export function castleWaveEnemyCount(
  baseCount: number,
  scale: CastleWaveScale,
  players: number,
): number {
  const p = Math.max(1, Math.round(players));
  if (scale === "fixed") return Math.max(0, Math.floor(baseCount));
  return Math.max(0, Math.floor(baseCount * p));
}

/** Expand a wave def into concrete spawn lines for the current party size. */
export function resolveCastleWaveSpawns(def: CastleWaveDef, players: number): CastleSpawnLine[] {
  const key = playerKey(players);
  const defaultScale: CastleWaveScale = def.kind === "boss" ? "fixed" : "perPlayer";
  const hpMul = def.bossHpMulByPlayers?.[key] ?? 1;
  const lines: CastleSpawnLine[] = [];

  for (const entry of def.composition) {
    const scale = entry.scale ?? defaultScale;
    lines.push({
      type: entry.type,
      count: castleWaveEnemyCount(entry.baseCount, scale, players),
      hpMul: def.kind === "boss" ? hpMul : 1,
    });
  }

  const specials = def.specialsByPlayers?.[key];
  if (specials) {
    for (const entry of specials) {
      const scale = entry.scale ?? "fixed";
      lines.push({
        type: entry.type,
        count: castleWaveEnemyCount(entry.baseCount, scale, players),
        hpMul: 1,
      });
    }
  }

  return lines;
}
