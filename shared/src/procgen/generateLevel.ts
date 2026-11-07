import { TILE_SIZE } from "../constants";
import { createRng } from "../math";
import {
  DECOR_COBBLE,
  DECOR_PLAIN,
  DECOR_SEWER,
  TILE_FLOOR,
  TILE_GATE,
  TILE_WALL,
  tileCenter,
  type Level,
} from "../level";
import { enemiesForRaces } from "./races";
import { budgetsFromDifficulty } from "./tuning";
import type {
  GeneratedLevelMeta,
  LevelProperties,
  LevelType,
  ProcObjective,
  ProcRoom,
  ProcSection,
} from "./types";

const CASTLE_ROLES = ["feast hall", "barracks", "quarters", "armoury", "corridor", "courtyard", "chapel"];
const DUNGEON_ROLES = ["cell block", "torture chamber", "store room", "guard post", "hallway", "crypt"];

export interface GenerateLevelResult {
  level: Level;
  meta: GeneratedLevelMeta;
}

/** Deterministic room-based layout for all level types (v1). */
export function generateLevel(props: LevelProperties, seed: number): GenerateLevelResult {
  const rng = createRng(seed >>> 0);
  const budgets = budgetsFromDifficulty(props.difficulty);
  // Race pool resolution (non-skaven falls back inside enemiesForRaces).
  const pools = enemiesForRaces(props);

  const sectionCount = budgets.sectionCount;
  const roomsPer = budgets.roomsPerSection;
  const margin = 2;
  const gap = 3;

  const rooms: ProcRoom[] = [];
  let nextId = 0;
  let cursorX = margin;

  for (let s = 0; s < sectionCount; s++) {
    let localX = cursorX;
    let localY = margin;
    const sectionRoomIds: number[] = [];

    for (let r = 0; r < roomsPer; r++) {
      const w = 7 + Math.floor(rng() * 3);
      const h = 6 + Math.floor(rng() * 3);
      // Snake: even index go right on top row, odd drop and go right on bottom offset
      if (r === 0) {
        localX = cursorX;
        localY = margin + (s % 2) * 2;
      } else {
        localX += gap + 7;
        if (r % 3 === 0) {
          localY += gap + 6;
          localX = cursorX + Math.floor(r / 3) * 2;
        }
      }

      const room: ProcRoom = {
        id: nextId++,
        x: localX,
        y: localY,
        w,
        h,
        role: pickRole(props.levelType, rng),
        sectionIndex: s,
        isObjective: false,
      };
      rooms.push(room);
      sectionRoomIds.push(room.id);
    }

    const obj = rooms[rooms.length - 1]!;
    obj.isObjective = true;
    obj.role = s === sectionCount - 1 ? "boss arena" : "objective chamber";
    obj.w = Math.max(obj.w, 9);
    obj.h = Math.max(obj.h, 8);

    const sectionRight = Math.max(...rooms.filter((rm) => rm.sectionIndex === s).map((rm) => rm.x + rm.w));
    cursorX = sectionRight + gap * 3;
  }

  const lastObj = rooms.filter((r) => r.isObjective).sort((a, b) => a.sectionIndex - b.sectionIndex).at(-1)!;
  const exitRoom: ProcRoom = {
    id: nextId++,
    x: lastObj.x + lastObj.w + gap + 1,
    y: lastObj.y,
    w: 6,
    h: 6,
    role: "exit",
    sectionIndex: sectionCount - 1,
    isObjective: false,
  };
  rooms.push(exitRoom);

  const width = Math.max(...rooms.map((r) => r.x + r.w)) + margin + 2;
  const height = Math.max(...rooms.map((r) => r.y + r.h)) + margin + 2;

  const tiles = new Uint8Array(width * height).fill(TILE_WALL);
  const decor = new Uint8Array(width * height);
  const decorId = decorForType(props.levelType);

  const carveRoom = (r: ProcRoom) => {
    for (let ty = r.y; ty < r.y + r.h; ty++) {
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const i = ty * width + tx;
        tiles[i] = TILE_FLOOR;
        decor[i] = decorId;
      }
    }
  };
  for (const r of rooms) carveRoom(r);

  const carveCorridor = (x0: number, y0: number, x1: number, y1: number) => {
    let x = clamp(Math.floor(x0), 1, width - 2);
    let y = clamp(Math.floor(y0), 1, height - 2);
    const tx = clamp(Math.floor(x1), 1, width - 2);
    const ty = clamp(Math.floor(y1), 1, height - 2);
    while (x !== tx) {
      tiles[y * width + x] = TILE_FLOOR;
      decor[y * width + x] = decorId;
      x += x < tx ? 1 : -1;
    }
    while (y !== ty) {
      tiles[y * width + x] = TILE_FLOOR;
      decor[y * width + x] = decorId;
      y += y < ty ? 1 : -1;
    }
  };

  const centerOf = (r: ProcRoom) => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  });

  const sectionGates: number[][] = [];

  for (let s = 0; s < sectionCount; s++) {
    const sr = rooms.filter((r) => r.sectionIndex === s && r.role !== "exit").sort((a, b) => a.id - b.id);
    for (let i = 0; i < sr.length - 1; i++) {
      const a = centerOf(sr[i]!);
      const b = centerOf(sr[i + 1]!);
      carveCorridor(a.x, a.y, b.x, b.y);
    }
    if (s < sectionCount - 1) {
      const from = sr[sr.length - 1]!;
      const next = rooms.filter((r) => r.sectionIndex === s + 1 && r.role !== "exit").sort((a, b) => a.id - b.id)[0]!;
      const a = centerOf(from);
      const b = centerOf(next);
      carveCorridor(a.x, a.y, b.x, b.y);
      const mx = clamp(Math.floor((a.x + b.x) / 2), 1, width - 2);
      const my = clamp(Math.floor((a.y + b.y) / 2), 1, height - 2);
      const gi = my * width + mx;
      tiles[gi] = TILE_GATE;
      sectionGates.push([gi]);
    }
  }

  const exitCenter = centerOf(exitRoom);
  const bossCenter = centerOf(lastObj);
  carveCorridor(bossCenter.x, bossCenter.y, exitCenter.x, exitCenter.y);
  const exitGateX = clamp(Math.floor((bossCenter.x + exitCenter.x) / 2), 1, width - 2);
  const exitGateY = clamp(Math.floor((bossCenter.y + exitCenter.y) / 2), 1, height - 2);
  const exitGateI = exitGateY * width + exitGateX;
  tiles[exitGateI] = TILE_GATE;
  sectionGates.push([exitGateI]);

  const level: Level = {
    width,
    height,
    tiles,
    decor,
    endZone: new Set(),
    holdZone: new Set(),
    bossTrigger: new Set(),
    playerStarts: [],
    hordeSpawns: [],
    specialSpawns: [],
    ambientRats: [],
    ambientElites: [],
    ogreSpawn: null,
    ammoCrates: [],
    medKits: [],
    barrelSpawns: [],
    dummySpawns: [],
    summonPads: [],
    merchantSpawns: [],
    roomLabels: [],
  };

  const startRoom = rooms.find((r) => r.sectionIndex === 0)!;
  for (let i = 0; i < 4; i++) {
    level.playerStarts.push(
      tileCenter(startRoom.x + 2 + (i % 2), startRoom.y + 2 + Math.floor(i / 2)),
    );
  }

  for (let ty = exitRoom.y + 1; ty < exitRoom.y + exitRoom.h - 1; ty++) {
    for (let tx = exitRoom.x + 1; tx < exitRoom.x + exitRoom.w - 1; tx++) {
      level.endZone.add(ty * width + tx);
    }
  }

  const objectives: ProcObjective[] = [];
  const sections: ProcSection[] = [];

  for (let s = 0; s < sectionCount; s++) {
    const sr = rooms.filter((r) => r.sectionIndex === s && r.role !== "exit");
    const objRoom = sr.find((r) => r.isObjective)!;
    const isFinal = s === sectionCount - 1;
    const kind = isFinal ? "boss" : rng() < 0.5 ? "hold" : "mini_boss";
    const zone: number[] = [];
    for (let ty = objRoom.y + 1; ty < objRoom.y + objRoom.h - 1; ty++) {
      for (let tx = objRoom.x + 1; tx < objRoom.x + objRoom.w - 1; tx++) {
        zone.push(ty * width + tx);
      }
    }
    const center = tileCenter(objRoom.x + Math.floor(objRoom.w / 2), objRoom.y + Math.floor(objRoom.h / 2));
    const id = `obj_s${s}`;
    if (kind === "hold") {
      for (const i of zone) level.holdZone.add(i);
    }
    if (isFinal) {
      for (const i of zone) level.bossTrigger.add(i);
      level.ogreSpawn = center;
    }
    objectives.push({
      id,
      kind: isFinal ? "boss" : kind,
      sectionIndex: s,
      zone,
      center,
      spawnType: isFinal ? pools.boss : kind === "mini_boss" ? pools.elite[0]! : null,
    });
    sections.push({
      index: s,
      roomIds: sr.map((r) => r.id),
      objectiveId: id,
    });
    level.roomLabels.push({ name: objRoom.role, x: center.x, y: center.y - 40 });
  }

  const exitLabel = tileCenter(exitRoom.x + Math.floor(exitRoom.w / 2), exitRoom.y + Math.floor(exitRoom.h / 2));
  level.roomLabels.push({ name: "exit", x: exitLabel.x, y: exitLabel.y - 40 });

  const spawnRooms = rooms.filter((r) => r.role !== "exit" && r.id !== startRoom.id);
  for (const r of spawnRooms) {
    const c = tileCenter(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
    if (rng() < 0.55) level.hordeSpawns.push(c);
    if (rng() < 0.4) level.specialSpawns.push({ x: c.x + 20, y: c.y });
    if (rng() < 0.5) level.ambientRats.push({ x: c.x - 16, y: c.y + 10 });
    if (rng() < budgets.eliteChance) level.ambientElites.push({ x: c.x + 16, y: c.y - 10 });
    if (rng() < 0.25) level.ammoCrates.push({ x: r.x * TILE_SIZE + 48, y: r.y * TILE_SIZE + 48 });
    if (rng() < 0.2) level.medKits.push({ x: (r.x + r.w) * TILE_SIZE - 48, y: (r.y + r.h) * TILE_SIZE - 48 });
  }

  if (level.hordeSpawns.length === 0 && spawnRooms[0]) {
    const c = centerOf(spawnRooms[0]);
    level.hordeSpawns.push(tileCenter(c.x, c.y));
  }
  if (level.specialSpawns.length === 0) {
    const r = spawnRooms[1] ?? spawnRooms[0];
    if (r) {
      const c = centerOf(r);
      level.specialSpawns.push(tileCenter(c.x, c.y));
    }
  }

  while (level.ambientRats.length + level.ambientElites.length < budgets.ambientCount && spawnRooms.length > 0) {
    const r = spawnRooms[Math.floor(rng() * spawnRooms.length)]!;
    const p = tileCenter(
      r.x + 2 + Math.floor(rng() * Math.max(1, r.w - 4)),
      r.y + 2 + Math.floor(rng() * Math.max(1, r.h - 4)),
    );
    if (rng() < budgets.eliteChance) level.ambientElites.push(p);
    else level.ambientRats.push(p);
  }

  for (const r of rooms) {
    if (r.isObjective || r.role === "exit") continue;
    if (props.levelType === "castle" || props.levelType === "dungeon") {
      const c = tileCenter(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
      level.roomLabels.push({ name: r.role, x: c.x, y: c.y - 24 });
    }
  }

  // Barrels: per room density roll (exit/start skipped for clear staging).
  for (const r of rooms) {
    if (r.role === "exit" || r.id === startRoom.id) continue;
    placeBarrelsInRoom(level, r, rng);
  }

  const meta: GeneratedLevelMeta = {
    props,
    seed,
    budgets,
    rooms,
    sections,
    objectives,
    sectionGates,
  };

  return { level, meta };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 50% none, 25% few (1–3 or 3% fill), 15% many (4–5 or 7%), 10% lots (6–9 or 15%).
 * Fill uses room tile count; one barrel ≈ one tile of footprint.
 */
function placeBarrelsInRoom(level: Level, r: ProcRoom, rng: () => number): void {
  const roll = rng();
  let count = 0;
  const tiles = Math.max(1, r.w * r.h);
  if (roll < 0.5) return;
  if (roll < 0.75) {
    const ranged = 1 + Math.floor(rng() * 3);
    count = Math.max(ranged, Math.ceil(tiles * 0.03));
  } else if (roll < 0.9) {
    const ranged = 4 + Math.floor(rng() * 2);
    count = Math.max(ranged, Math.ceil(tiles * 0.07));
  } else {
    const ranged = 6 + Math.floor(rng() * 4);
    count = Math.max(ranged, Math.ceil(tiles * 0.15));
  }
  const placed: { x: number; y: number }[] = [];
  const minDist = 28;
  for (let attempt = 0; attempt < count * 8 && placed.length < count; attempt++) {
    const tx = r.x + 1 + Math.floor(rng() * Math.max(1, r.w - 2));
    const ty = r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 2));
    const p = tileCenter(tx, ty);
    if (placed.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < minDist)) continue;
    if (level.playerStarts.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 40)) continue;
    placed.push(p);
    level.barrelSpawns.push(p);
  }
}

function decorForType(t: LevelType): number {
  switch (t) {
    case "castle":
    case "dungeon":
      return DECOR_COBBLE;
    case "sewer":
      return DECOR_SEWER;
    default:
      return DECOR_PLAIN;
  }
}

function pickRole(t: LevelType, rng: () => number): string {
  const list = t === "castle" ? CASTLE_ROLES : t === "dungeon" ? DUNGEON_ROLES : ["chamber", "passage", "hollow"];
  return list[Math.floor(rng() * list.length)]!;
}

/** Flood-fill reachability check from first player start. */
export function validateGeneratedLevel(
  level: Level,
  gateOpen: boolean,
): { ok: boolean; reachable: number; problems: string[] } {
  const problems: string[] = [];
  if (level.playerStarts.length < 1) problems.push("No player starts");
  if (level.endZone.size === 0) problems.push("No exit zone");
  const start = level.playerStarts[0];
  if (!start) return { ok: false, reachable: 0, problems };

  const sx = Math.floor(start.x / TILE_SIZE);
  const sy = Math.floor(start.y / TILE_SIZE);
  const startI = sy * level.width + sx;
  const seen = new Set<number>([startI]);
  const q = [startI];
  while (q.length > 0) {
    const i = q.shift()!;
    const x = i % level.width;
    const y = Math.floor(i / level.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
      const t = level.tiles[ny * level.width + nx]!;
      if (t === TILE_WALL) continue;
      if (t === TILE_GATE && !gateOpen) continue;
      const j = ny * level.width + nx;
      if (!seen.has(j)) {
        seen.add(j);
        q.push(j);
      }
    }
  }

  const endReachable = [...level.endZone].some((i) => seen.has(i));
  if (!endReachable && gateOpen) problems.push("Exit not reachable with gates open");

  return { ok: problems.length === 0, reachable: seen.size, problems };
}
