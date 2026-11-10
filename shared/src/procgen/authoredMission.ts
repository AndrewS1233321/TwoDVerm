import { isExpeditionLocationId, type ExpeditionLocationId } from "../data/expedition";
import type { EnemyId } from "../data/types";
import {
  computeBossRoom,
  DECOR_COBBLE,
  DECOR_PLAIN,
  DECOR_SEWER,
  parseLevel,
  TILE_WALL,
  tileCenter,
  type Level,
  type Point,
} from "../level";
import { EXPEDITION_MISSIONS } from "../levels/expeditionLevels";
import { createRng } from "../math";
import { generateLevel, type GenerateLevelResult } from "./generateLevel";
import { enemiesForRaces } from "./races";
import { budgetsFromDifficulty } from "./tuning";
import type { GeneratedLevelMeta, LevelProperties, ObjectiveKind, ProcObjective, ProcSection } from "./types";

/** Floor characters an authored mission can lay its markers on. */
export type AuthoredFloor = "." | "," | "_";

export interface AuthoredMission {
  rows: readonly string[];
  /** Floor drawn under marker tiles (S, h, H, gates, ...). */
  floor: AuthoredFloor;
  /** Room names, in tile coordinates. */
  labels: readonly { name: string; tx: number; ty: number }[];
}

/** Section objectives in play order; each opens its gate when complete. */
export const AUTHORED_SECTIONS: readonly { zone: string; gate: string; kind: ObjectiveKind }[] = [
  { zone: "H", gate: "1", kind: "hold" },
  { zone: "K", gate: "2", kind: "mini_boss" },
  { zone: "B", gate: "3", kind: "boss" },
];

export const AUTHORED_BARREL_MARKER = "b";
/** Share of authored barrel spots the run seed keeps. */
export const AUTHORED_BARREL_KEEP = 0.67;

export const AUTHORED_MAX_WIDTH = 180;
export const AUTHORED_MAX_HEIGHT = 90;

const FLOOR_DECOR: Record<AuthoredFloor, number> = {
  ".": DECOR_PLAIN,
  ",": DECOR_COBBLE,
  _: DECOR_SEWER,
};

/** Wastes map for a vote winner: authored mission for known locations, procgen otherwise. */
export function buildWastesLevel(locationId: string, props: LevelProperties, seed: number): GenerateLevelResult {
  if (isExpeditionLocationId(locationId)) return parseAuthoredMission(locationId, props, seed);
  return generateLevel(props, seed);
}

/** Deterministic: same mission, props and seed give the same level and meta. */
export function parseAuthoredMission(
  id: ExpeditionLocationId,
  props: LevelProperties,
  seed: number,
): GenerateLevelResult {
  const mission = EXPEDITION_MISSIONS[id];
  const width = Math.max(...mission.rows.map((r) => r.length));
  const zoneTiles = new Map<string, number[]>();
  const gateTiles = new Map<string, number[]>();
  const barrelTiles: number[] = [];
  const markerTiles: number[] = [];

  const zoneChars = new Set(AUTHORED_SECTIONS.map((s) => s.zone));
  const gateChars = new Set(AUTHORED_SECTIONS.map((s) => s.gate));
  const cleaned = mission.rows.map((row, ty) => {
    let out = "";
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx]!;
      const i = ty * width + tx;
      if (ch !== "#" && ch !== " " && !(ch in FLOOR_DECOR)) markerTiles.push(i);
      if (zoneChars.has(ch)) {
        push(zoneTiles, ch, i);
        // H stays so parseLevel fills holdZone (drawn as the HOLD area).
        out += ch === "H" ? ch : mission.floor;
      } else if (gateChars.has(ch)) {
        push(gateTiles, ch, i);
        out += "G";
      } else if (ch === AUTHORED_BARREL_MARKER) {
        barrelTiles.push(i);
        out += mission.floor;
      } else {
        out += ch;
      }
    }
    return out;
  });

  const level = parseLevel(cleaned);
  const floorDecor = FLOOR_DECOR[mission.floor];
  for (const i of markerTiles) {
    if (level.tiles[i] !== TILE_WALL) level.decor[i] = floorDecor;
  }

  const rng = createRng(seed >>> 0);
  for (const i of barrelTiles) {
    if (rng() < AUTHORED_BARREL_KEEP) level.barrelSpawns.push(tileCenter(i % width, Math.floor(i / width)));
  }

  const pools = enemiesForRaces(props);
  const objectives: ProcObjective[] = [];
  const sections: ProcSection[] = [];
  const sectionGates: number[][] = [];
  AUTHORED_SECTIONS.forEach((s, index) => {
    const zone = zoneTiles.get(s.zone) ?? [];
    const center = zoneCenter(level, zone);
    const objId = `obj_s${index}`;
    const spawnType: EnemyId | null = s.kind === "boss" ? pools.boss : s.kind === "mini_boss" ? pools.elite[0]! : null;
    objectives.push({ id: objId, kind: s.kind, sectionIndex: index, zone, center, spawnType });
    sections.push({ index, roomIds: [], objectiveId: objId });
    sectionGates.push(gateTiles.get(s.gate) ?? []);
    if (s.kind === "boss") {
      for (const i of zone) level.bossTrigger.add(i);
      level.ogreSpawn = center;
    }
  });
  level.bossRoom = computeBossRoom(level);

  for (const l of mission.labels) {
    const c = tileCenter(l.tx, l.ty);
    level.roomLabels.push({ name: l.name, x: c.x, y: c.y });
  }

  const meta: GeneratedLevelMeta = {
    props: { ...props },
    seed,
    budgets: { ...budgetsFromDifficulty(props.difficulty), sectionCount: AUTHORED_SECTIONS.length, roomsPerSection: 0 },
    rooms: [],
    sections,
    objectives,
    sectionGates,
  };
  return { level, meta };
}

function push(map: Map<string, number[]>, key: string, i: number): void {
  const list = map.get(key);
  if (list) list.push(i);
  else map.set(key, [i]);
}

/** Zone tile closest to the zone's average position, so spawns never land in a pillar. */
function zoneCenter(level: Level, zone: readonly number[]): Point {
  if (zone.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const i of zone) {
    sx += i % level.width;
    sy += Math.floor(i / level.width);
  }
  const ax = sx / zone.length;
  const ay = sy / zone.length;
  let best = zone[0]!;
  let bestD = Infinity;
  for (const i of zone) {
    const d = (i % level.width - ax) ** 2 + (Math.floor(i / level.width) - ay) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return tileCenter(best % level.width, Math.floor(best / level.width));
}
