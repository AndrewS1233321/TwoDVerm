import Phaser from "phaser";
import {
  DECOR_COBBLE,
  DECOR_FOREST,
  DECOR_MINE,
  DECOR_SEWER,
  TILE_FLOOR,
  TILE_GATE,
  TILE_SIZE,
  TILE_WALL,
  type Level,
} from "@twodverm/shared";
import { colors, shade } from "./palette";

const CHUNK = 1024;
const TORCH_SPACING = 7;
const LANTERN_SPACING = 6;
/** Near-black basalt; kept well below mine floor (~0x3a342e) for contrast. */
const ROCK_WALL = 0x161310;
const ROCK_FACE = 0x24201c;
const ROCK_HIGHLIGHT = 0x3a342e;

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface LevelRendererOptions {
  /** When true, end zone label warns that the boss must be cleared first. */
  exitLocked?: boolean;
}

export class LevelRenderer {
  private gateGfx: Phaser.GameObjects.Graphics;
  private gateShown = true;
  private exitLabel: Phaser.GameObjects.Text | null = null;
  exitUnlocked = false;
  private readonly forest: boolean;
  private readonly mine: boolean;
  private readonly disposables: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: Level,
    options: LevelRendererOptions = {},
  ) {
    this.exitUnlocked = !options.exitLocked;
    this.forest = level.decor.includes(DECOR_FOREST);
    this.mine = level.decor.includes(DECOR_MINE);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const worldW = level.width * TILE_SIZE;
    const worldH = level.height * TILE_SIZE;
    for (let ox = 0; ox < worldW; ox += CHUNK) {
      for (let oy = 0; oy < worldH; oy += CHUNK) {
        const w = Math.min(CHUNK, worldW - ox);
        const h = Math.min(CHUNK, worldH - oy);
        g.clear();
        this.drawTiles(g, ox, oy, w, h);
        const rt = scene.add.renderTexture(ox, oy, w, h).setOrigin(0, 0).setDepth(0);
        rt.draw(g, -ox, -oy);
        this.disposables.push(rt);
      }
    }
    g.destroy();

    this.drawZones();
    this.gateGfx = scene.add.graphics().setDepth(4);
    this.disposables.push(this.gateGfx);
    this.drawGate();
    this.drawSetPieces();
    if (this.mine) this.placeLanterns();
    else this.placeTorches();
  }

  private lockedExitText(): string {
    return this.level.bossRoom.size > 0 || this.level.bossTrigger.size > 0 ? "EXIT — CLEAR BOSS FIRST" : "EXIT — LOCKED";
  }

  destroy(): void {
    for (const obj of this.disposables) obj.destroy();
    this.disposables.length = 0;
  }

  setGateOpen(open: boolean): void {
    if (open && this.gateShown) {
      this.gateShown = false;
      this.scene.tweens.add({ targets: this.gateGfx, alpha: 0, duration: 900 });
    } else if (!open && !this.gateShown) {
      this.gateShown = true;
      this.gateGfx.setAlpha(1);
    }
  }

  setExitUnlocked(unlocked: boolean): void {
    this.exitUnlocked = unlocked;
    if (this.exitLabel) {
      this.exitLabel.setText(
        this.level.merchantSpawns.length > 0
          ? "HOLD TO DEPART"
          : unlocked
            ? "EXIT"
            : this.lockedExitText(),
      );
    }
  }

  /** Redraw gate bars after soft gates were converted to floor. */
  redrawGates(): void {
    this.gateGfx.clear();
    this.drawGate();
    if (!this.gateShown) this.gateGfx.setAlpha(0);
  }

  private tile(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) return TILE_WALL;
    return this.level.tiles[ty * this.level.width + tx]!;
  }

  private nearFloor(tx: number, ty: number): boolean {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.tile(tx + dx, ty + dy) !== TILE_WALL) return true;
    return false;
  }

  private drawTiles(g: Phaser.GameObjects.Graphics, ox: number, oy: number, w: number, h: number): void {
    const T = TILE_SIZE;
    const t0x = Math.floor(ox / T);
    const t0y = Math.floor(oy / T);
    const t1x = Math.ceil((ox + w) / T);
    const t1y = Math.ceil((oy + h) / T);
    for (let ty = t0y; ty < t1y; ty++) {
      for (let tx = t0x; tx < t1x; tx++) {
        const x = tx * T;
        const y = ty * T;
        const t = this.tile(tx, ty);
        const r = hash(tx, ty);
        if (t === TILE_WALL) {
          if (!this.nearFloor(tx, ty)) {
            g.fillStyle(0x161311);
            g.fillRect(x, y, T, T);
            continue;
          }
          if (this.mine) {
            this.drawMineWall(g, x, y, T, tx, ty, r);
            continue;
          }
          const wall = this.forest ? 0x1e3a1c : colors.wall;
          g.fillStyle(shade(wall, 0.85 + r * 0.25));
          g.fillRect(x, y, T, T);
          g.fillStyle(shade(wall, this.forest ? 1.15 : 1.3), 0.8);
          g.fillRect(x, y, T, 3);
          g.fillRect(x, y, 3, T);
          g.fillStyle(shade(wall, 0.55), 0.9);
          g.fillRect(x, y + T - 3, T, 3);
          g.fillRect(x + T - 3, y, 3, T);
          g.lineStyle(1, shade(wall, 0.6), 0.6);
          g.lineBetween(x + 3, y + T / 2, x + T - 3, y + T / 2);
          const off = ty % 2 === 0 ? T / 2 : T / 4;
          g.lineBetween(x + off, y + 3, x + off, y + T / 2);
          if (this.forest && r > 0.7) {
            g.fillStyle(0x3d6b35, 0.35);
            g.fillCircle(x + T * r, y + 6, 4);
          }
          continue;
        }
        const decor = this.level.decor[ty * this.level.width + tx];
        if (decor === DECOR_COBBLE) {
          g.fillStyle(shade(0x2e2a26, 0.9 + r * 0.2));
          g.fillRect(x, y, T, T);
          g.fillStyle(shade(0x3a352f, 0.85 + hash(tx + 7, ty) * 0.3));
          const s = T / 2 - 2;
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRoundedRect(x + 1 + i * (T / 2), y + 1 + j * (T / 2), s, s, 3);
        } else if (decor === DECOR_SEWER) {
          g.fillStyle(shade(0x1f2621, 0.9 + r * 0.2));
          g.fillRect(x, y, T, T);
          if (r < 0.12) {
            g.lineStyle(2, 0x111614, 1);
            for (let i = 6; i < T; i += 6) g.lineBetween(x + i, y + 6, x + i, y + T - 6);
          }
          g.fillStyle(0x4f7a3a, 0.12);
          if (r > 0.7) g.fillCircle(x + T * r, y + T * (1 - r), 6);
        } else if (decor === DECOR_FOREST) {
          // Lush mossy clearing — layered greens with soft grass flecks.
          g.fillStyle(shade(0x2a4a28, 0.95 + r * 0.2));
          g.fillRect(x, y, T, T);
          g.fillStyle(shade(0x3d6b35, 0.85 + hash(tx + 3, ty + 5) * 0.35), 0.85);
          g.fillCircle(x + T * (0.3 + r * 0.4), y + T * (0.35 + hash(tx, ty + 1) * 0.35), 4 + r * 5);
          if (r > 0.55) {
            g.fillStyle(0x6fbf5f, 0.22);
            g.fillCircle(x + T * hash(tx + 9, ty), y + T * hash(ty + 2, tx), 3 + r * 3);
          }
          if (r < 0.18) {
            g.fillStyle(0x1e331c, 0.35);
            g.fillRect(x + 4, y + T - 6, T - 8, 3);
          }
        } else if (decor === DECOR_MINE) {
          this.drawMineFloor(g, x, y, T, tx, ty, r);
        } else {
          g.fillStyle(shade(colors.floor, 0.9 + r * 0.22));
          g.fillRect(x, y, T, T);
          g.lineStyle(1, 0x1d1a18, 0.7);
          g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
          if (r > 0.92) {
            g.fillStyle(0x4a1414, 0.35);
            g.fillCircle(x + T / 2, y + T / 2, 5 + r * 4);
          }
        }
        if (t === TILE_GATE) {
          g.fillStyle(0x1a1715);
          g.fillRect(x, y, T, T);
        }
      }
    }
  }

  private drawZones(): void {
    const T = TILE_SIZE;
    const zone = (set: Set<number>, color: number, label: string): Phaser.GameObjects.Text | null => {
      if (set.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const i of set) {
        const tx = i % this.level.width;
        const ty = Math.floor(i / this.level.width);
        minX = Math.min(minX, tx);
        minY = Math.min(minY, ty);
        maxX = Math.max(maxX, tx);
        maxY = Math.max(maxY, ty);
      }
      const x = minX * T, y = minY * T, w = (maxX - minX + 1) * T, h = (maxY - minY + 1) * T;
      const g = this.scene.add.graphics().setDepth(1);
      g.fillStyle(color, 0.12);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, color, 0.6);
      g.strokeRect(x + 2, y + 2, w - 4, h - 4);
      const text = this.scene.add
        .text(x + w / 2, y + h / 2, label, { fontFamily: "Georgia, serif", fontSize: "18px", color: "#" + color.toString(16).padStart(6, "0") })
        .setOrigin(0.5)
        .setAlpha(0.55)
        .setDepth(1);
      this.disposables.push(g, text);
      return text;
    };
    zone(this.level.holdZone, colors.accent, this.level.bossRoom.size > 0 || this.level.bossTrigger.size > 0 ? "HOLD" : "HOLD THE SQUARE");
    zone(this.level.bossRoom.size > 0 ? this.level.bossRoom : this.level.bossTrigger, 0x9a2a1a, "BOSS");
    if (this.level.setPieces) zone(this.level.setPieces.bellZone, 0xb08a3a, "RING THE BELL");
    const exitText =
      this.level.summonPads.length > 0 && this.level.endZone.size > 0
        ? "TO THE WASTES"
        : this.level.merchantSpawns.length > 0
          ? "HOLD TO DEPART"
          : this.exitUnlocked
            ? this.level.holdZone.size > 0 || this.level.bossRoom.size > 0 || this.level.bossTrigger.size > 0 || !!this.level.setPieces
              ? "EXIT"
              : "SAFE ROOM"
            : this.lockedExitText();
    this.exitLabel = zone(this.level.endZone, colors.success, exitText);
  }

  private drawGate(): void {
    const T = TILE_SIZE;
    const g = this.gateGfx;
    const rubble = this.level.setPieces?.rubbleGates;
    const doors = new Set(this.level.setPieces?.sealDoors ?? []);
    for (let ty = 0; ty < this.level.height; ty++) {
      for (let tx = 0; tx < this.level.width; tx++) {
        if (this.tile(tx, ty) !== TILE_GATE) continue;
        const x = tx * T;
        const y = ty * T;
        const i = ty * this.level.width + tx;
        if (rubble?.has(i)) {
          this.drawRubbleWall(g, x, y, T, tx, ty);
          continue;
        }
        if (doors.has(i)) {
          this.drawSealDoor(g, x, y, T);
          continue;
        }
        g.fillStyle(0x2b2b2e, 1);
        g.fillRect(x + 4, y, T - 8, T);
        g.lineStyle(3, 0x6a6f78, 1);
        for (let i = 6; i < T; i += 7) g.lineBetween(x + 4, y + i, x + T - 4, y + i);
        g.lineStyle(2, 0x9aa3ad, 1);
        g.lineBetween(x + T / 2, y, x + T / 2, y + T);
      }
    }
  }

  /** Mortared block wall the cannon has to breach. */
  private drawRubbleWall(g: Phaser.GameObjects.Graphics, x: number, y: number, T: number, tx: number, ty: number): void {
    g.fillStyle(shade(colors.wall, 0.8), 1);
    g.fillRect(x, y, T, T);
    const off = ty % 2 === 0 ? 0 : T / 4;
    g.lineStyle(2, shade(colors.wall, 0.45), 1);
    g.lineBetween(x, y + T / 2, x + T, y + T / 2);
    g.lineBetween(x + off + T / 4, y, x + off + T / 4, y + T / 2);
    g.lineBetween(x + ((off + T * 0.75) % T), y + T / 2, x + ((off + T * 0.75) % T), y + T);
    g.fillStyle(shade(colors.wall, 1.25), 0.5);
    g.fillCircle(x + T * hash(tx, ty), y + T * hash(ty, tx + 3), 3);
    g.lineStyle(1.5, 0xc9a14a, 0.35);
    g.strokeRect(x + 1, y + 1, T - 2, T - 2);
  }

  /** Heavy wooden temple door, shown while the bell room is sealed. */
  private drawSealDoor(g: Phaser.GameObjects.Graphics, x: number, y: number, T: number): void {
    g.fillStyle(0x4a3220, 1);
    g.fillRect(x, y, T, T);
    g.lineStyle(2, 0x2a1c12, 1);
    for (let i = 8; i < T; i += 8) g.lineBetween(x + i, y + 2, x + i, y + T - 2);
    g.fillStyle(0x6a6f78, 1);
    g.fillRect(x, y + 6, T, 3);
    g.fillRect(x, y + T - 9, T, 3);
  }

  /** Cannon on its carriage (aimed at the rubble wall) and the temple bell. */
  private drawSetPieces(): void {
    const sp = this.level.setPieces;
    if (!sp) return;
    const g = this.scene.add.graphics().setDepth(3);
    this.disposables.push(g);
    if (sp.cannon) {
      const { x, y } = sp.cannon;
      let aim = 0;
      if (sp.rubbleGates.size > 0) {
        let sx = 0;
        let sy = 0;
        for (const i of sp.rubbleGates) {
          sx += (i % this.level.width + 0.5) * TILE_SIZE;
          sy += (Math.floor(i / this.level.width) + 0.5) * TILE_SIZE;
        }
        aim = Math.atan2(sy / sp.rubbleGates.size - y, sx / sp.rubbleGates.size - x);
      }
      g.fillStyle(0x5a4028, 1);
      g.fillRect(x - 14, y - 10, 28, 20);
      g.fillStyle(0x2a1c12, 1);
      g.fillCircle(x - 10, y - 11, 5);
      g.fillCircle(x + 10, y - 11, 5);
      g.fillCircle(x - 10, y + 11, 5);
      g.fillCircle(x + 10, y + 11, 5);
      const bx = Math.cos(aim);
      const by = Math.sin(aim);
      g.lineStyle(11, 0x2b2b2e, 1);
      g.lineBetween(x - bx * 8, y - by * 8, x + bx * 24, y + by * 24);
      g.lineStyle(3, 0x6a6f78, 1);
      g.lineBetween(x - bx * 8, y - by * 8, x + bx * 24, y + by * 24);
      g.fillStyle(0x111111, 1);
      g.fillCircle(x + bx * 24, y + by * 24, 4);
    }
    if (sp.bell) {
      const { x, y } = sp.bell;
      g.fillStyle(0x3a2a1c, 1);
      g.fillRect(x - 22, y - 4, 44, 8);
      g.fillStyle(0xb08a3a, 1);
      g.fillCircle(x, y, 15);
      g.fillStyle(0xd9b45a, 1);
      g.fillCircle(x - 4, y - 4, 6);
      g.lineStyle(2, 0x6a4f1e, 1);
      g.strokeCircle(x, y, 15);
      g.fillStyle(0x3a2a1c, 1);
      g.fillCircle(x, y, 3);
    }
  }

  private placeTorches(): void {
    let n = 0;
    for (let ty = 1; ty < this.level.height - 1; ty++) {
      for (let tx = 1; tx < this.level.width - 1; tx++) {
        if (this.tile(tx, ty) !== TILE_WALL) continue;
        if (this.tile(tx, ty + 1) !== TILE_FLOOR) continue;
        if ((tx + ty * 3) % TORCH_SPACING !== 0) continue;
        n++;
        const x = (tx + 0.5) * TILE_SIZE;
        const y = (ty + 1) * TILE_SIZE - 4;
        const glow = this.scene.add.image(x, y + 10, "glow").setDepth(2).setTint(0xff9a3a).setAlpha(0.35).setScale(1.8).setBlendMode(Phaser.BlendModes.ADD);
        const flame = this.scene.add.circle(x, y, 3, 0xffd27a).setDepth(3);
        this.disposables.push(glow, flame);
        this.scene.tweens.add({
          targets: glow,
          alpha: { from: 0.28, to: 0.42 },
          scale: { from: 1.7, to: 1.95 },
          duration: 180 + (n % 5) * 60,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  /** Crumbling quarry rock: dark basalt base, boulder blobs, deep cracks. */
  private drawMineWall(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    T: number,
    tx: number,
    ty: number,
    r: number,
  ): void {
    g.fillStyle(shade(ROCK_WALL, 0.9 + r * 0.15));
    g.fillRect(x, y, T, T);
    // Overlapping boulder faces — keep all faces darker than the floor.
    g.fillStyle(shade(ROCK_FACE, 0.85 + hash(tx + 2, ty) * 0.2), 0.95);
    g.fillCircle(x + T * (0.28 + r * 0.15), y + T * (0.32 + hash(tx, ty + 3) * 0.2), 7 + r * 5);
    g.fillStyle(shade(ROCK_FACE, 0.7 + hash(tx + 5, ty) * 0.15), 0.9);
    g.fillCircle(x + T * (0.68 + hash(tx + 5, ty) * 0.12), y + T * (0.58 + r * 0.15), 6 + hash(tx, ty) * 5);
    g.fillStyle(shade(ROCK_WALL, 1.05), 0.75);
    g.fillCircle(x + T * hash(tx + 9, ty + 1), y + T * hash(ty + 4, tx + 2), 4 + r * 3);
    // Deep fissures.
    g.lineStyle(1.5, 0x0a0908, 0.85);
    g.lineBetween(x + 3, y + 5 + r * 10, x + T * 0.55, y + T * 0.75);
    if (r > 0.35) g.lineBetween(x + T * 0.35, y + 3, x + T - 4, y + T * 0.5);
    if (r > 0.65) g.lineBetween(x + 6, y + T * 0.55, x + T * 0.7, y + T - 4);
    // Soft mineral flecks (still below floor brightness).
    if (r > 0.55) {
      g.fillStyle(shade(ROCK_HIGHLIGHT, 0.55), 0.35);
      g.fillCircle(x + T * hash(tx + 1, ty + 7), y + T * (0.15 + hash(ty, tx) * 0.2), 2);
    }
    // Jagged edge where rock meets the passage.
    g.fillStyle(shade(ROCK_WALL, 0.75), 1);
    if (this.tile(tx, ty + 1) !== TILE_WALL) {
      g.fillTriangle(x + r * 6, y + T, x + 8 + r * 12, y + T - 6 - r * 5, x + 20 + r * 4, y + T);
      g.fillTriangle(x + 14 + r * 8, y + T, x + T * 0.7, y + T - 4 - hash(tx, ty) * 5, x + T - 2, y + T);
    }
    if (this.tile(tx + 1, ty) !== TILE_WALL) {
      g.fillTriangle(x + T, y + r * 5, x + T - 6 - r * 4, y + 10 + r * 10, x + T, y + 24);
    }
    if (this.tile(tx - 1, ty) !== TILE_WALL) {
      g.fillTriangle(x, y + 4 + r * 8, x + 5 + r * 3, y + 14 + hash(tx, ty) * 8, x, y + 26);
    }
  }

  private drawMineFloor(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    T: number,
    tx: number,
    ty: number,
    r: number,
  ): void {
    // Warm packed earth — clearly lighter than the near-black rock walls.
    g.fillStyle(shade(0x3a342c, 0.95 + r * 0.18));
    g.fillRect(x, y, T, T);
    g.fillStyle(shade(0x4a4338, 0.9 + hash(tx + 4, ty) * 0.2), 0.5);
    g.fillCircle(x + T * (0.2 + r * 0.5), y + T * (0.25 + hash(ty, tx) * 0.45), 2 + r * 3);
    if (r > 0.55) {
      g.fillStyle(0x5a5248, 0.28);
      g.fillCircle(x + T * hash(tx + 8, ty + 2), y + T * hash(ty + 6, tx), 2);
    }
    const axis = this.corridorAxis(tx, ty);
    if (axis) this.drawMineTracks(g, x, y, T, axis, tx, ty);
    if (this.shouldDrawMineProp(tx, ty, r)) this.drawMineProp(g, x, y, T, tx, ty, r);
  }

  /** Corridor-shaped floor: open farther along one axis than the other. */
  private corridorAxis(tx: number, ty: number): "h" | "v" | null {
    if (this.tile(tx, ty) === TILE_WALL || this.tile(tx, ty) === TILE_GATE) return null;
    const run = (dx: number, dy: number): number => {
      let n = 0;
      let x = tx + dx;
      let y = ty + dy;
      while (n < 12) {
        const t = this.tile(x, y);
        if (t === TILE_WALL || t === TILE_GATE) break;
        n++;
        x += dx;
        y += dy;
      }
      return n;
    };
    const openH = 1 + run(-1, 0) + run(1, 0);
    const openV = 1 + run(0, -1) + run(0, 1);
    if (openH >= 5 && openV <= 4) return "h";
    if (openV >= 5 && openH <= 4) return "v";
    return null;
  }

  private drawMineTracks(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    T: number,
    axis: "h" | "v",
    tx: number,
    ty: number,
  ): void {
    const rust = 0x4a3a2e;
    const rail = 0x2a2420;
    g.fillStyle(rust, 0.55);
    if (axis === "h") {
      // Sleepers.
      if ((tx + ty) % 2 === 0) g.fillRect(x + 4, y + T * 0.35, T - 8, 4);
      g.fillStyle(rail, 0.9);
      g.fillRect(x, y + T * 0.28, T, 2.5);
      g.fillRect(x, y + T * 0.62, T, 2.5);
    } else {
      if ((tx + ty) % 2 === 0) g.fillRect(x + T * 0.35, y + 4, 4, T - 8);
      g.fillStyle(rail, 0.9);
      g.fillRect(x + T * 0.28, y, 2.5, T);
      g.fillRect(x + T * 0.62, y, 2.5, T);
    }
  }

  private inBusyZone(tx: number, ty: number): boolean {
    const i = ty * this.level.width + tx;
    return (
      this.level.holdZone.has(i) ||
      this.level.bossRoom.has(i) ||
      this.level.bossTrigger.has(i) ||
      this.level.endZone.has(i)
    );
  }

  private nearWall(tx: number, ty: number): boolean {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (this.tile(tx + dx, ty + dy) === TILE_WALL) return true;
    }
    return false;
  }

  private shouldDrawMineProp(tx: number, ty: number, r: number): boolean {
    if (this.inBusyZone(tx, ty)) return false;
    if (this.corridorAxis(tx, ty)) return false;
    if (!this.nearWall(tx, ty)) return r > 0.93;
    return r > 0.72 && (tx * 5 + ty * 11) % 3 === 0;
  }

  private drawMineProp(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    T: number,
    tx: number,
    ty: number,
    r: number,
  ): void {
    const kind = Math.floor(hash(tx + 13, ty + 17) * 3);
    const cx = x + T * (0.3 + hash(tx, ty + 9) * 0.4);
    const cy = y + T * (0.3 + hash(ty, tx + 4) * 0.4);
    if (kind === 0) {
      // Broken rock pile.
      g.fillStyle(shade(ROCK_FACE, 0.85 + r * 0.15), 0.9);
      g.fillCircle(cx, cy, 4 + r * 3);
      g.fillCircle(cx + 5, cy + 2, 3);
      g.fillStyle(0x0a0908, 0.45);
      g.fillCircle(cx - 2, cy + 3, 2.5);
    } else if (kind === 1) {
      // Pickaxe (handle + head), decorative only.
      g.lineStyle(2.5, 0x5a4028, 1);
      g.lineBetween(cx - 6, cy + 7, cx + 5, cy - 6);
      g.lineStyle(3, 0x6a6f78, 1);
      g.lineBetween(cx + 2, cy - 8, cx + 9, cy - 3);
      g.lineBetween(cx + 2, cy - 8, cx - 1, cy - 2);
    } else {
      // Bones.
      g.fillStyle(0xc9b896, 0.85);
      g.fillRect(cx - 5, cy - 1, 10, 2.5);
      g.fillCircle(cx - 6, cy, 2.2);
      g.fillCircle(cx + 6, cy + 1, 1.8);
      g.fillStyle(0xa89878, 0.7);
      g.fillRect(cx - 1, cy + 3, 2, 5);
    }
  }

  /** Iron lanterns hung on walls overlooking the floor. */
  private placeLanterns(): void {
    let n = 0;
    for (let ty = 1; ty < this.level.height - 1; ty++) {
      for (let tx = 1; tx < this.level.width - 1; tx++) {
        if (this.tile(tx, ty) !== TILE_WALL) continue;
        if (this.tile(tx, ty + 1) !== TILE_FLOOR && this.tile(tx, ty + 1) !== TILE_GATE) continue;
        if ((tx * 2 + ty * 5) % LANTERN_SPACING !== 0) continue;
        n++;
        const x = (tx + 0.5) * TILE_SIZE;
        const y = (ty + 0.85) * TILE_SIZE;
        const body = this.scene.add.graphics().setDepth(3);
        body.fillStyle(0x2a2622, 1);
        body.fillRect(x - 3, y - 10, 6, 3);
        body.lineStyle(1.5, 0x4a453c, 1);
        body.lineBetween(x, y - 14, x, y - 10);
        body.fillStyle(0xc9a14a, 0.85);
        body.fillRect(x - 4, y - 8, 8, 7);
        body.lineStyle(1.5, 0x2a2622, 1);
        body.strokeRect(x - 4, y - 8, 8, 7);
        body.fillStyle(0x1a1714, 1);
        body.fillRect(x - 5, y - 1, 10, 2);
        const glow = this.scene.add
          .image(x, y + 4, "glow")
          .setDepth(2)
          .setTint(0xffb45a)
          .setAlpha(0.32)
          .setScale(1.55)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.disposables.push(body, glow);
        this.scene.tweens.add({
          targets: glow,
          alpha: { from: 0.24, to: 0.4 },
          scale: { from: 1.4, to: 1.7 },
          duration: 220 + (n % 4) * 70,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }
}
