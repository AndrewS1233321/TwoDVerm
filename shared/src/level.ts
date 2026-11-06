import { TILE_SIZE } from "./constants";

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_GATE = 2;

export const DECOR_PLAIN = 0;
export const DECOR_COBBLE = 1;
export const DECOR_SEWER = 2;

export interface Point {
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
  /** All marker positions below are world-pixel tile centres. */
  playerStarts: Point[];
  hordeSpawns: Point[];
  specialSpawns: Point[];
  ambientRats: Point[];
  ambientElites: Point[];
  ogreSpawn: Point | null;
  ammoCrates: Point[];
  medKits: Point[];
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
    playerStarts: [],
    hordeSpawns: [],
    specialSpawns: [],
    ambientRats: [],
    ambientElites: [],
    ogreSpawn: null,
    ammoCrates: [],
    medKits: [],
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
      }
    }
  }
  return level;
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
