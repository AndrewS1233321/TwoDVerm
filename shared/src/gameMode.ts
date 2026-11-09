import {
  CINDER_WATCH,
  GRIM_CAUSEWAY,
  SALT_HOLLOW,
  WEEPING_QUARRY,
} from "./levels/expeditionLevels";
import { MISSION_1 } from "./levels/mission1";
import { TESTING_ZONE } from "./levels/testingZone";
import { WASTES_CAMP } from "./levels/wastesCamp";
import { WASTES_MERCHANT } from "./levels/wastesMerchant";
import { parseLevel, type Level } from "./level";
import { isExpeditionLocationId, WASTES_MERCHANT_LEVEL_ID, type ExpeditionLocationId } from "./data/expedition";

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

export function levelRowsForId(id: string): readonly string[] {
  switch (id) {
    case "testing":
      return TESTING_ZONE;
    case WASTES_CAMP_LEVEL_ID:
      return WASTES_CAMP;
    case WASTES_MERCHANT_LEVEL_ID:
      return WASTES_MERCHANT;
    case "grim_causeway":
      return GRIM_CAUSEWAY;
    case "weeping_quarry":
      return WEEPING_QUARRY;
    case "salt_hollow":
      return SALT_HOLLOW;
    case "cinder_watch":
      return CINDER_WATCH;
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
  const level = parseLevel(levelRowsForId(id));
  if (id === "testing") {
    level.roomLabels = [
      { name: "central", ...averagePoint(level.playerStarts) },
      { name: "summon room", ...averagePoint(level.summonPads) },
    ];
  } else if (id === WASTES_MERCHANT_LEVEL_ID) {
    level.roomLabels = [{ name: "merchant hall", ...averagePoint(level.playerStarts) }];
  } else if (isExpeditionLocationId(id)) {
    level.roomLabels = [{ name: id.replace(/_/g, " "), ...averagePoint(level.playerStarts) }];
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
