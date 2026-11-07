import { parseLevel, type Level } from "./level";
import { MISSION_1 } from "./levels/mission1";
import { TESTING_ZONE } from "./levels/testingZone";

export type GameMode = "default" | "testing";

export const GAME_MODES: readonly GameMode[] = ["default", "testing"];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  default: "Default",
  testing: "Testing zone",
};

export function isGameMode(v: unknown): v is GameMode {
  return v === "default" || v === "testing";
}

export function sanitizeGameMode(raw: unknown): GameMode {
  return isGameMode(raw) ? raw : "default";
}

/** ASCII rows for the level that belongs to a game mode. */
export function levelRowsForMode(mode: GameMode): readonly string[] {
  return mode === "testing" ? TESTING_ZONE : MISSION_1;
}

export function parseLevelForMode(mode: GameMode): Level {
  const level = parseLevel(levelRowsForMode(mode));
  if (mode === "testing") {
    level.roomLabels = [
      { name: "central", ...averagePoint(level.playerStarts) },
      { name: "summon room", ...averagePoint(level.summonPads) },
    ];
  }
  return level;
}

function averagePoint(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length - 48 };
}
