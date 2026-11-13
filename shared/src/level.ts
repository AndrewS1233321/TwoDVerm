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
/** Mine / quarry dirt: crumbling rock walls, tracks, lanterns, debris props. */
export const DECOR_MINE = 4;

/** ASCII digit → combat enemy for testing-zone summon pads. */
export const SUMMON_PAD_MARKERS: Record<string, EnemyId> = {
  "1": "slave",
  "2": "clanrat",
  "3": "stormvermin",
  "4": "gunner",
  "5": "gas",
  "6": "hooker",
  "7": "ogre",
  "8": "shieldClanrat",
  "9": "shieldStormvermin",
  "0": "plagueMonk",
  q: "gutterRunner",
  w: "warpfire",
  x: "sackRat",
  y: "stormfiend",
  /** Ultra Elite: Warplock Jezzail (Testing summon pad). */
  j: "warplockJezzail",
  /**
   * Chaos Rotblood summon row.
   * Avoid letters already used as level markers (h/p/r/s, E/H/S/…).
   */
  a: "fanatic",
  b: "raider",
  c: "bulwark",
  d: "savage",
  f: "mauler",
  g: "chaosWarrior",
  i: "lifeleech",
  n: "blightstormer",
  t: "chaosSpawn",
  v: "bileTroll",
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
  /**
   * World centre of the warp portal used by summon pads (Testing zone).
   * Pads stay as stand-to-summon triggers; creatures spawn here instead.
   */
  summonPortal: Point | null;
  /** Centres where a merchant NPC should stand (Gingey Wastes hall). */
  merchantSpawns: Point[];
  roomLabels: RoomLabel[];
  /** Authored Wastes set pieces; absent on maps without them. */
  setPieces?: LevelSetPieces;
}

export interface LevelSetPieces {
  cannon: Point | null;
  bell: Point | null;
  /** Floor tiles of the bell room (sealed during the bell event). */
  bellZone: Set<number>;
  /** Gate tiles drawn as a rubble wall (opened by the cannon). */
  rubbleGates: Set<number>;
  /** Floor tiles that become gates while the bell room is sealed. */
  sealDoors: number[];
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
    summonPortal: null,
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
        case "P": level.summonPortal = c; break;
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

/** True when every living hero is standing on a tile of `zone`. */
export function allLivingInZone(
  level: Level,
  zone: Set<number>,
  heroes: Iterable<{ x: number; y: number; state: string }>,
): boolean {
  if (zone.size === 0) return false;
  let n = 0;
  for (const h of heroes) {
    if (h.state === "dead") continue;
    n++;
    if (!isInZone(level, zone, h.x, h.y)) return false;
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
  void radius;
  return confineToZone(level, level.bossRoom, x, y);
}

/** Snap a point back into the nearest tile of `zone` if it left it. */
export function confineToZone(level: Level, zone: Set<number>, x: number, y: number): Point {
  if (zone.size === 0 || isInZone(level, zone, x, y)) {
    return { x, y };
  }
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (const i of zone) {
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

/** Axis-aligned tile bounds of a zone, in world pixels (tile edges). */
export function zonePixelBounds(
  level: Level,
  zone: Set<number>,
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; cx: number; cy: number } | null {
  if (zone.size === 0) return null;
  let minTX = Infinity;
  let minTY = Infinity;
  let maxTX = -Infinity;
  let maxTY = -Infinity;
  for (const i of zone) {
    const tx = i % level.width;
    const ty = Math.floor(i / level.width);
    minTX = Math.min(minTX, tx);
    minTY = Math.min(minTY, ty);
    maxTX = Math.max(maxTX, tx);
    maxTY = Math.max(maxTY, ty);
  }
  const minX = minTX * TILE_SIZE;
  const minY = minTY * TILE_SIZE;
  const maxX = (maxTX + 1) * TILE_SIZE;
  const maxY = (maxTY + 1) * TILE_SIZE;
  const width = maxX - minX;
  const height = maxY - minY;
  return { minX, minY, maxX, maxY, width, height, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * Testing / Wastes staging "TO THE WASTES" pad: circular portal whose diameter
 * equals the long side of the authored rectangular `E` zone.
 */
export function circularExitPortal(level: Level): { x: number; y: number; radius: number } | null {
  if (level.summonPads.length === 0) return null;
  const bounds = zonePixelBounds(level, level.endZone);
  if (!bounds) return null;
  const diameter = Math.max(bounds.width, bounds.height);
  return { x: bounds.cx, y: bounds.cy, radius: diameter / 2 };
}

/** Exit membership: circular portal on staging/testing, otherwise tile zone. */
export function isInEndExit(level: Level, x: number, y: number): boolean {
  const portal = circularExitPortal(level);
  if (portal) {
    const dx = x - portal.x;
    const dy = y - portal.y;
    return dx * dx + dy * dy <= portal.radius * portal.radius;
  }
  return isInZone(level, level.endZone, x, y);
}
