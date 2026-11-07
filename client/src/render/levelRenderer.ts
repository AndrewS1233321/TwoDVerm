import Phaser from "phaser";
import {
  DECOR_COBBLE,
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
  private readonly disposables: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: Level,
    options: LevelRendererOptions = {},
  ) {
    this.exitUnlocked = !options.exitLocked;
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
    this.placeTorches();
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
            : "EXIT — CLEAR BOSS FIRST",
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
          g.fillStyle(shade(colors.wall, 0.85 + r * 0.25));
          g.fillRect(x, y, T, T);
          g.fillStyle(shade(colors.wall, 1.3), 0.8);
          g.fillRect(x, y, T, 3);
          g.fillRect(x, y, 3, T);
          g.fillStyle(shade(colors.wall, 0.55), 0.9);
          g.fillRect(x, y + T - 3, T, 3);
          g.fillRect(x + T - 3, y, 3, T);
          g.lineStyle(1, shade(colors.wall, 0.6), 0.6);
          g.lineBetween(x + 3, y + T / 2, x + T - 3, y + T / 2);
          const off = ty % 2 === 0 ? T / 2 : T / 4;
          g.lineBetween(x + off, y + 3, x + off, y + T / 2);
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
    const exitText =
      this.level.merchantSpawns.length > 0
        ? "HOLD TO DEPART"
        : this.exitUnlocked
          ? this.level.holdZone.size > 0 || this.level.bossRoom.size > 0 || this.level.bossTrigger.size > 0
            ? "EXIT"
            : "SAFE ROOM"
          : "EXIT — CLEAR BOSS FIRST";
    this.exitLabel = zone(this.level.endZone, colors.success, exitText);
  }

  private drawGate(): void {
    const T = TILE_SIZE;
    const g = this.gateGfx;
    for (let ty = 0; ty < this.level.height; ty++) {
      for (let tx = 0; tx < this.level.width; tx++) {
        if (this.tile(tx, ty) !== TILE_GATE) continue;
        const x = tx * T;
        const y = ty * T;
        g.fillStyle(0x2b2b2e, 1);
        g.fillRect(x + 4, y, T - 8, T);
        g.lineStyle(3, 0x6a6f78, 1);
        for (let i = 6; i < T; i += 7) g.lineBetween(x + 4, y + i, x + T - 4, y + i);
        g.lineStyle(2, 0x9aa3ad, 1);
        g.lineBetween(x + T / 2, y, x + T / 2, y + T);
      }
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
}
