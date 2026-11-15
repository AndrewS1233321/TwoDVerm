import type { CombatEnemyId } from "./types";

export type CastleWavePath = "left" | "top" | "right";
export type CastleWaveKind = "standard" | "miniboss" | "boss";

export interface CastleWaveEnemy {
  type: CombatEnemyId;
  /** Multiplied by player count for standard/miniboss; used as-is for boss. */
  baseCount: number;
}

export interface CastleWaveDef {
  id: number;
  /** Seconds after the previous wave *started* (wave 1: after mission start). */
  delayAfterPrev: number;
  paths: CastleWavePath[];
  kind: CastleWaveKind;
  composition: CastleWaveEnemy[];
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
    kind: "standard",
    composition: [
      { type: "slave", baseCount: 14 },
      { type: "clanrat", baseCount: 16 },
    ],
  },
];

export const CASTLE_KING_HP = 5000;
export const CASTLE_KING_RADIUS = 18;

export function castleWaveEnemyCount(
  baseCount: number,
  kind: CastleWaveKind,
  players: number,
): number {
  const p = Math.max(1, Math.round(players));
  if (kind === "boss") return Math.max(0, Math.floor(baseCount));
  return Math.max(0, Math.floor(baseCount * p));
}
