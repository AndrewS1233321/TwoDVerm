import { MISSION_1 } from "./levels/mission1";
import { TESTING_ZONE } from "./levels/testingZone";
import { WASTES_CAMP } from "./levels/wastesCamp";
import { WASTES_MERCHANT } from "./levels/wastesMerchant";
import { parseLevel, tileCenter, type Level } from "./level";
import { isExpeditionLocationId, WASTES_MERCHANT_LEVEL_ID, type ExpeditionLocationId } from "./data/expedition";
import { parseAuthoredMission } from "./procgen/authoredMission";
import { rollLevelProperties } from "./procgen/rollProps";

export type GameMode = "default" | "testing" | "wastes";

export const GAME_MODES: readonly GameMode[] = ["default", "testing", "wastes"];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  default: "Default",
  testing: "Testing zone",
  wastes: "The Gingey Wastes",
};

/** Starting gold when a Wastes room is created with the host's `devTest` option. */
export const DEV_TEST_START_GOLD = 1000;

export function isGameMode(v: unknown): v is GameMode {
  return v === "default" || v === "testing" || v === "wastes";
}

export function sanitizeGameMode(raw: unknown): GameMode {
  return isGameMode(raw) ? raw : "default";
}

/** Level id used while a wastes party is still in lobby / map vote. */
export const WASTES_CAMP_LEVEL_ID = "wastes_camp";

export type LevelId = "default" | "testing" | typeof WASTES_CAMP_LEVEL_ID | typeof WASTES_MERCHANT_LEVEL_ID | ExpeditionLocationId;

export function initialLevelIdForMode(mode: GameMode): LevelId {
  if (mode === "testing") return "testing";
  if (mode === "wastes") return WASTES_CAMP_LEVEL_ID;
  return "default";
}

/** ASCII rows for plain hand-authored maps (Wastes missions go through `parseAuthoredMission`). */
export function levelRowsForId(id: string): readonly string[] {
  switch (id) {
    case "testing":
      return TESTING_ZONE;
    case WASTES_CAMP_LEVEL_ID:
      return WASTES_CAMP;
    case WASTES_MERCHANT_LEVEL_ID:
      return WASTES_MERCHANT;
    case "default":
    default:
      return MISSION_1;
  }
}

/** ASCII rows for the default level of a game mode (before expedition votes). */
export function levelRowsForMode(mode: GameMode): readonly string[] {
  return levelRowsForId(initialLevelIdForMode(mode));
}

export function parseLevelById(id: string): Level {
  if (isExpeditionLocationId(id)) {
    return parseAuthoredMission(id, rollLevelProperties(1, id, 0), 0).level;
  }
  const level = parseLevel(levelRowsForId(id));
  if (id === "testing") {
    const wastesGate =
      level.merchantSpawns.length > 0
        ? level.merchantSpawns
        : [...level.endZone].map((i) => tileCenter(i % level.width, Math.floor(i / level.width)));
    level.roomLabels = [
      { name: "central", ...averagePoint(level.playerStarts) },
      { name: "summon room", ...averagePoint(level.summonPads) },
      { name: "wastes gate", ...averagePoint(wastesGate) },
    ];
  } else if (id === WASTES_MERCHANT_LEVEL_ID) {
    level.roomLabels = [{ name: "merchant hall", ...averagePoint(level.playerStarts) }];
  }
  return level;
}

export function parseLevelForMode(mode: GameMode): Level {
  return parseLevelById(initialLevelIdForMode(mode));
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
