import type { Point } from "../level";
import type { EnemyId } from "../data/types";

export type LevelType = "castle" | "dungeon" | "sewer" | "forest" | "caverns";

export type CreatureRace = "skaven" | "beastmen" | "orcs" | "undead" | "human" | "chaos";

export const LEVEL_TYPES: readonly LevelType[] = ["castle", "dungeon", "sewer", "forest", "caverns"];

export const CREATURE_RACES: readonly CreatureRace[] = [
  "skaven",
  "beastmen",
  "orcs",
  "undead",
  "human",
  "chaos",
];

export const LEVEL_TYPE_LABELS: Record<LevelType, string> = {
  castle: "Castle",
  dungeon: "Dungeon",
  sewer: "Sewer",
  forest: "Forest",
  caverns: "Caverns",
};

export const CREATURE_RACE_LABELS: Record<CreatureRace, string> = {
  skaven: "Skaven",
  beastmen: "Beastmen",
  orcs: "Orcs",
  undead: "Undead",
  human: "Human",
  chaos: "Chaos",
};

/** Authoring / rolled inputs that drive procedural generation. */
export interface LevelProperties {
  levelType: LevelType;
  /** Coefficient, typically 1–4 for Gingey Wastes stops. */
  difficulty: number;
  primaryRace: CreatureRace;
  /** Must include primaryRace. */
  allowableRaces: CreatureRace[];
}

/**
 * hold: survive a timer in the zone. mini_boss / boss: kill the spawned enemy.
 * cannon: hold E at the cannon to blast open the section's rubble wall.
 * bell: ring the bell with the whole party inside; doors seal and waves come
 * until the kill target is reached, then a blast clears every enemy.
 */
export type ObjectiveKind = "hold" | "mini_boss" | "boss" | "cannon" | "bell";

export interface ProcRoom {
  id: number;
  /** Tile bounds inclusive. */
  x: number;
  y: number;
  w: number;
  h: number;
  role: string;
  sectionIndex: number;
  isObjective: boolean;
}

export interface ProcObjective {
  id: string;
  kind: ObjectiveKind;
  sectionIndex: number;
  /** Tile indices (row-major) for the objective zone. */
  zone: number[];
  /** World centre of the objective room. */
  center: Point;
  /** Enemy to spawn for mini_boss / boss; hold has none. */
  spawnType: EnemyId | null;
  /** Hold only: entry/mid elites use `holdEliteMixCount` from the race elite pool via horde spawns. */
  eliteMix?: boolean;
  /** Cannon / bell: where heroes press E. */
  interactPoint?: Point;
  /** Bell: wave spawn points inside the sealed room. */
  spawnPoints?: Point[];
}

export interface ProcSection {
  index: number;
  roomIds: number[];
  objectiveId: string;
}

/** Budgets derived from difficulty for Director + ambient placement. */
export interface SpawnBudgets {
  sectionCount: number;
  roomsPerSection: number;
  ambientCount: number;
  eliteChance: number;
  hordeSize: number;
  hordeInterval: number;
  specialInterval: number;
  maxSpecials: number;
  raceSlots: number;
  holdDuration: number;
  /** Legacy budget field; elite-mix holds use runtime `holdEliteMixCount` instead. */
  holdEliteCount: number;
  /** Seconds of held E at the cannon before it fires. */
  cannonChannel: number;
  /**
   * Placeholder kill target for 1 player. Live games use
   * `bellKillTargetFor(players, difficulty)` when the bell rings.
   */
  bellKillTarget: number;
  /** Seconds between bell waves. */
  bellWaveInterval: number;
  /** Wave-1 stormvermin count (later waves compound +30%). */
  bellWaveElites: number;
  /** Plague Monks on wave 3 only (not compounded). */
  bellWave3Monks: number;
}

export interface GeneratedLevelMeta {
  props: LevelProperties;
  seed: number;
  budgets: SpawnBudgets;
  rooms: ProcRoom[];
  sections: ProcSection[];
  objectives: ProcObjective[];
  /** Gate tile indices that open after the prior section objective completes. */
  sectionGates: number[][];
}
