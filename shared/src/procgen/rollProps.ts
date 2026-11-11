import type { ExpeditionLocationId } from "../data/expedition";
import { createRng } from "../math";
import { difficultyForStop } from "./tuning";
import {
  CREATURE_RACES,
  LEVEL_TYPES,
  type CreatureRace,
  type LevelProperties,
  type LevelType,
} from "./types";

const LOCATION_TYPE_BIAS: Record<ExpeditionLocationId, LevelType[]> = {
  grim_causeway: ["castle"],
  weeping_quarry: ["caverns"],
  salt_hollow: ["caverns"],
  cinder_watch: ["castle"],
  hallowed_rampart: ["castle"],
};

/**
 * Rolls level properties for a wastes stop.
 * Primary race stays skaven until other race kits exist; allowable may list stubs.
 */
export function rollLevelProperties(
  stop: number,
  locationId: ExpeditionLocationId,
  seed: number,
): LevelProperties {
  const rng = createRng(seed >>> 0);
  const difficulty = difficultyForStop(stop);
  const bias = LOCATION_TYPE_BIAS[locationId] ?? [...LEVEL_TYPES];
  const levelType = bias[Math.floor(rng() * bias.length)]!;

  const primaryRace: CreatureRace = "skaven";
  const slots = Math.min(3, 1 + Math.floor(difficulty / 2));
  const allowable: CreatureRace[] = [primaryRace];
  const others = CREATURE_RACES.filter((r) => r !== primaryRace);
  for (let i = 0; i < others.length; i++) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j]!, others[i]!];
  }
  for (let i = 0; i < slots - 1 && i < others.length; i++) {
    allowable.push(others[i]!);
  }

  return {
    levelType,
    difficulty,
    primaryRace,
    allowableRaces: allowable,
  };
}

export function rollProcSeed(baseSeed: number, stop: number, locationId: string): number {
  let h = (baseSeed ^ (stop * 2654435761)) >>> 0;
  for (let i = 0; i < locationId.length; i++) {
    h = (Math.imul(h ^ locationId.charCodeAt(i), 16777619) >>> 0);
  }
  return h >>> 0;
}
