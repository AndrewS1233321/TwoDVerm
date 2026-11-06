import Phaser from "phaser";
import { getSettings } from "../settings";
import { colors } from "./palette";
import { TEX_SCALE } from "./textures";

const MAX_CORPSES = 70;

export class Effects {
  private corpses: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  damageNumber(x: number, y: number, text: string, color: string, big = false): void {
    if (!getSettings().damageNumbers) return;
    const t = this.scene.add
      .text(x + (Math.random() - 0.5) * 10, y - 10, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: big ? "16px" : "12px",
        fontStyle: "bold",
        color,
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: big ? 900 : 650, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }

  sparks(x: number, y: number, color: number, count = 8, speed = 120): void {
    const p = this.scene.add.particles(x, y, "dot", {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      lifespan: 260,
      tint: color,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    });
    p.setDepth(28);
    p.explode(count);
    this.scene.time.delayedCall(400, () => p.destroy());
  }

  blood(x: number, y: number, amount = 1): void {
    this.sparks(x, y, 0x8a1414, Math.round(6 * amount), 90);
  }

  tracer(x1: number, y1: number, x2: number, y2: number, kind: string): void {
    const g = this.scene.add.graphics().setDepth(27);
    const color = kind === "bullet" ? 0xffd27a : kind === "arrow" ? 0xe8e0d0 : 0xfff0b0;
    g.lineStyle(kind === "gun" ? 3 : 2, color, 0.9);
    g.lineBetween(x1, y1, x2, y2);
    if (kind !== "arrow") {
      g.fillStyle(0xffe9a0, 0.9);
      g.fillCircle(x1, y1, kind === "gun" ? 6 : 3);
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: kind === "arrow" ? 260 : 120, onComplete: () => g.destroy() });
  }

  corpse(x: number, y: number, texture: string, rotation: number): void {
    const pool = this.scene.add.circle(x, y, 8 + Math.random() * 6, 0x4a0d0d, 0.6).setDepth(1);
    const body = this.scene.add.image(x, y, texture).setScale(1 / TEX_SCALE).setRotation(rotation + (Math.random() - 0.5)).setTint(0x5a4040).setAlpha(0.85).setDepth(2);
    this.corpses.push(pool, body);
    this.scene.tweens.add({ targets: body, alpha: 0, delay: 9000, duration: 2000, onComplete: () => body.destroy() });
    this.scene.tweens.add({ targets: pool, alpha: 0, delay: 20000, duration: 3000, onComplete: () => pool.destroy() });
    while (this.corpses.length > MAX_CORPSES * 2) this.corpses.shift()?.destroy();
  }

  ring(x: number, y: number, color: number, radius: number, duration = 450): void {
    const c = this.scene.add.circle(x, y, 10, color, 0).setStrokeStyle(4, color, 0.9).setDepth(26);
    this.scene.tweens.add({ targets: c, radius, alpha: 0, duration, ease: "Cubic.easeOut", onComplete: () => c.destroy() });
  }

  pushArc(x: number, y: number, facing: number): void {
    const g = this.scene.add.graphics().setDepth(26);
    g.lineStyle(5, 0xffffff, 0.7);
    g.beginPath();
    g.arc(0, 0, 30, -1.1, 1.1, false);
    g.strokePath();
    g.setPosition(x, y).setRotation(facing);
    this.scene.tweens.add({ targets: g, scale: 1.6, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  gasBurst(x: number, y: number, radius: number): void {
    this.ring(x, y, colors.warp, radius, 500);
    this.sparks(x, y, colors.warp, 16, 160);
  }
}
