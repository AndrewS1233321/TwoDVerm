import { isSolidTile, TILE_SIZE, type Level } from "@twodverm/shared";

/**
 * Breadth-first distance map from every target tile. Enemies walk "downhill" to reach the
 * nearest hero around walls. A separate wide field only uses tiles with a full 3x3 clear
 * area, so large creatures do not try to squeeze through narrow gaps.
 */
export class FlowField {
  readonly dist: Int32Array;
  private readonly passable: Uint8Array;

  constructor(
    private readonly level: Level,
    readonly wide: boolean,
  ) {
    this.dist = new Int32Array(level.width * level.height).fill(-1);
    this.passable = new Uint8Array(level.width * level.height);
  }

  rebuild(gateOpen: boolean, targets: { x: number; y: number }[]): void {
    const { width, height } = this.level;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        this.passable[ty * width + tx] = this.isClear(gateOpen, tx, ty) ? 1 : 0;
      }
    }
    this.dist.fill(-1);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    for (const t of targets) {
      const tx = Math.floor(t.x / TILE_SIZE);
      const ty = Math.floor(t.y / TILE_SIZE);
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      const i = ty * width + tx;
      if (this.dist[i] === 0) continue;
      this.dist[i] = 0;
      queue[tail++] = i;
    }
    while (head < tail) {
      const i = queue[head++]!;
      const x = i % width;
      const y = (i - x) / width;
      const d = this.dist[i]! + 1;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (this.dist[j] !== -1 || !this.passable[j]) continue;
        this.dist[j] = d;
        queue[tail++] = j;
      }
    }
  }

  /** World position of the next tile centre to walk towards, or null if no route from here. */
  nextWaypoint(x: number, y: number): { x: number; y: number } | null {
    const { width, height } = this.level;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
    const here = this.dist[ty * width + tx]!;
    if (here < 0) return null;
    if (here === 0) return null;
    let best = here;
    let bx = -1;
    let by = -1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (dx !== 0 && dy !== 0) {
          if (!this.passable[ty * width + nx] || !this.passable[ny * width + tx]) continue;
        }
        const d = this.dist[ny * width + nx]!;
        if (d >= 0 && d < best) {
          best = d;
          bx = nx;
          by = ny;
        }
      }
    }
    if (bx < 0) return null;
    return { x: (bx + 0.5) * TILE_SIZE, y: (by + 0.5) * TILE_SIZE };
  }

  reachable(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) return false;
    return this.dist[ty * this.level.width + tx]! >= 0;
  }

  private isClear(gateOpen: boolean, tx: number, ty: number): boolean {
    if (!this.wide) return !isSolidTile(this.level, gateOpen, tx, ty);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (isSolidTile(this.level, gateOpen, tx + dx, ty + dy)) return false;
      }
    }
    return true;
  }
}
