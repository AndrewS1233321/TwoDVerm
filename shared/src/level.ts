import { TILE_SIZE } from "./constants";
import { DUMMY_SPAWN_MARKERS } from "./data/enemies";
import type { DummyEnemyId, EnemyId } from "./data/types";

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_GATE = 2;

export const DECOR_PLAIN = 0;
export const DECOR_COBBLE = 1;
export const DECOR_SEWER = 2;
export const DECOR_FOREST = 3;

/** ASCII digit → combat enemy for testing-zone summon pads. */
export const SUMMON_PAD_MARKERS: Record<string, EnemyId> = {
  "1": "slave",
  "2": "clanrat",
  "3": "stormvermin",
  "4": "gunner",
  "5": "gas",
  "6": "hooker",
  "7": "ogre",
};

export { DUMMY_SPAWN_MARKERS };

export interface Point {
  x: number;
  y: number;
}

export interface SummonPad {
  type: EnemyId;
  x: number;
  y: number;
}

export interface DummySpawn {
  type: DummyEnemyId;
  x: number;
  y: number;
}

export interface RoomLabel {
  name: string;
  x: number;
  y: number;
}

export interface Level {
  width: number;
  height: number;
  /** TILE_FLOOR, TILE_WALL or TILE_GATE per tile, row-major. */
  tiles: Uint8Array;
  decor: Uint8Array;
  endZone: Set<number>;
  holdZone: Set<number>;
  bossTrigger: Set<number>;
  /**
   * Floor tiles that form the boss arena. Used to require the whole party
   * inside before spawn, and to lock them in until the boss dies.
   */
  bossRoom: Set<number>;
  /** All marker positions below are world-pixel tile centres. */
  playerStarts: Point[];
  hordeSpawns: Point[];
  specialSpawns: Point[];
  ambientRats: Point[];
  ambientElites: Point[];
  ogreSpawn: Point | null;
  ammoCrates: Point[];
  medKits: Point[];
  /** World centres for destructible barrels (mostly from procgen). */
  barrelSpawns: Point[];
  dummySpawns: DummySpawn[];
  summonPads: SummonPad[];
  /** Centres where a merchant NPC should stand (Gingey Wastes hall). */
  merchantSpawns: Point[];
  roomLabels: RoomLabel[];
}

export function tileCenter(tx: number, ty: number): Point {
  return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
}

export function parseLevel(rows: readonly string[]): Level {
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const tiles = new Uint8Array(width * height).fill(TILE_WALL);
  const decor = new Uint8Array(width * height);
  const level: Level = {
    width,
    height,
    tiles,
    decor,
    endZone: new Set(),
    holdZone: new Set(),
    bossTrigger: new Set(),
    bossRoom: new Set(),
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

  for (let ty = 0; ty < height; ty++) {
    const row = rows[ty] ?? "";
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx] ?? "#";
      const i = ty * width + tx;
      if (ch === "#" || ch === " ") continue;
      if (ch === "G") {
        tiles[i] = TILE_GATE;
        continue;
      }
      tiles[i] = TILE_FLOOR;
      const c = tileCenter(tx, ty);
      const summonType = SUMMON_PAD_MARKERS[ch];
      if (summonType) {
        level.summonPads.push({ type: summonType, x: c.x, y: c.y });
        continue;
      }
      const dummyType = DUMMY_SPAWN_MARKERS[ch];
      if (dummyType) {
        level.dummySpawns.push({ type: dummyType, x: c.x, y: c.y });
        continue;
      }
      switch (ch) {
        case ",": decor[i] = DECOR_COBBLE; break;
        case "_": decor[i] = DECOR_SEWER; break;
        case "E": level.endZone.add(i); break;
        case "H": level.holdZone.add(i); break;
        case "T": level.bossTrigger.add(i); break;
        case "S": level.playerStarts.push(c); break;
        case "h": level.hordeSpawns.push(c); break;
        case "p": level.specialSpawns.push(c); break;
        case "r": level.ambientRats.push(c); break;
        case "s": level.ambientElites.push(c); break;
        case "O": level.ogreSpawn = c; break;
        case "A": level.ammoCrates.push(c); break;
        case "M": level.medKits.push(c); break;
        case "N": level.merchantSpawns.push(c); break;
      }
    }
  }
  level.bossRoom = computeBossRoom(level);
  return level;
}

/**
 * Resolve the boss arena. Procgen marks the whole objective room as
 * `bossTrigger` (including the ogre tile); hand maps use a thin trigger strip
 * and we flood-fill the chamber from the ogre spawn.
 */
export function computeBossRoom(level: Level): Set<number> {
  const room = new Set<number>();
  if (!level.ogreSpawn) return room;
  const start = tileIndexAt(level, level.ogreSpawn.x, level.ogreSpawn.y);
  if (start < 0) return room;

  // Procedural levels: trigger set is already the full boss room.
  if (level.bossTrigger.has(start)) {
    for (const i of level.bossTrigger) {
      if (!level.endZone.has(i)) room.add(i);
    }
    return room;
  }

  // Hand maps: flood from spawn; exit tiles form the soft wall. Include the
  // trigger strip so the boss area covers the whole chamber up to the doorway.
  const blocked = new Set<number>([...level.endZone]);
  const q = [start];
  room.add(start);
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
      const j = ny * level.width + nx;
      if (room.has(j) || blocked.has(j)) continue;
      const t = level.tiles[j]!;
      if (t === TILE_WALL || t === TILE_GATE) continue;
      room.add(j);
      q.push(j);
    }
  }
  // Cap westward spill: keep tiles at/after the trigger column when present.
  if (level.bossTrigger.size > 0) {
    let minTx = Infinity;
    for (const i of level.bossTrigger) minTx = Math.min(minTx, i % level.width);
    for (const i of [...room]) {
      if (i % level.width < minTx) room.delete(i);
    }
    for (const i of level.bossTrigger) room.add(i);
  }
  return room;
}

/** True when every living hero is currently standing on a boss-room tile. */
export function allLivingInBossRoom(
  level: Level,
  heroes: Iterable<{ x: number; y: number; state: string }>,
): boolean {
  if (level.bossRoom.size === 0) return false;
  let n = 0;
  for (const h of heroes) {
    if (h.state === "dead") continue;
    n++;
    if (!isInZone(level, level.bossRoom, h.x, h.y)) return false;
  }
  return n > 0;
}

/** Snap a body back into the nearest boss-room tile if it left the arena. */
export function confineToBossRoom(
  level: Level,
  x: number,
  y: number,
  radius: number,
): Point {
  if (level.bossRoom.size === 0 || isInZone(level, level.bossRoom, x, y)) {
    return { x, y };
  }
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (const i of level.bossRoom) {
    const c = tileCenter(i % level.width, Math.floor(i / level.width));
    const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d < bestD) {
      bestD = d;
      bestX = c.x;
      bestY = c.y;
    }
  }
  // Keep a little inside the tile so the next frame is still “in zone”.
  const inward = 0.15;
  bestX = bestX * (1 - inward) + x * inward;
  bestY = bestY * (1 - inward) + y * inward;
  void radius;
  return { x: bestX, y: bestY };
}

export function tileIndexAt(level: Level, x: number, y: number): number {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return -1;
  return ty * level.width + tx;
}

export function isSolidTile(level: Level, gateOpen: boolean, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return true;
  const t = level.tiles[ty * level.width + tx];
  if (t === TILE_WALL) return true;
  if (t === TILE_GATE) return !gateOpen;
  return false;
}

export function isInZone(level: Level, zone: Set<number>, x: number, y: number): boolean {
  return zone.has(tileIndexAt(level, x, y));
}
