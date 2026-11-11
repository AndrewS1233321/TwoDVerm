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

  /** Precision shot: flash at the aim point only (no travel line). */
  impact(x: number, y: number, kind: string): void {
    const color = kind === "arrow" ? 0xe8e0d0 : 0xfff0b0;
    const g = this.scene.add.graphics().setDepth(27);
    g.lineStyle(1.5, color, 1);
    g.strokeCircle(x, y, 4);
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y, 1.5);
    this.sparks(x, y, color, kind === "gun" ? 10 : 6, 140);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 180,
      onComplete: () => g.destroy(),
    });
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

  /** Warp flare when a creature emerges from the summon portal. */
  portalBurst(x: number, y: number): void {
    this.ring(x, y, colors.warp, 56, 420);
    this.sparks(x, y, colors.warp, 18, 180);
    this.sparks(x, y, 0xb8ff8a, 10, 110);
  }

  /** Cannon muzzle flash and smoke. */
  cannonBlast(x: number, y: number): void {
    this.ring(x, y, 0xffd27a, 70, 300);
    this.sparks(x, y, 0xffb45a, 18, 220);
    this.sparks(x, y, colors.smoke, 14, 90);
  }

  /** Stone dust where the rubble wall collapses. */
  breachDust(x: number, y: number): void {
    this.ring(x, y, colors.smoke, 110, 700);
    this.sparks(x, y, colors.smoke, 30, 200);
    this.sparks(x, y, colors.wall, 20, 160);
  }

  /** Bell toll: slow expanding bronze rings. */
  bellToll(x: number, y: number): void {
    this.ring(x, y, 0xd9b45a, 160, 900);
    this.scene.time.delayedCall(350, () => this.ring(x, y, 0xd9b45a, 240, 1100));
  }

  /** Holy hammer blast that clears the bell room. */
  hammerBlast(x: number, y: number): void {
    this.ring(x, y, 0xfff0b0, 420, 900);
    this.ring(x, y, colors.accent, 300, 700);
    this.sparks(x, y, 0xfff0b0, 40, 320);
  }

  /** Brief white flash of a melee arc (Plague Monk dash strikes). */
  slashFlash(x: number, y: number, facing: number, reach: number, arc: number): void {
    const g = this.scene.add.graphics().setDepth(26);
    const half = Math.min(Math.PI, arc / 2);
    g.fillStyle(0xffffff, 0.45);
    g.slice(0, 0, reach, -half, half, false);
    g.fillPath();
    g.lineStyle(3, 0xffffff, 0.95);
    g.slice(0, 0, reach, -half, half, false);
    g.strokePath();
    g.setPosition(x, y).setRotation(facing);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scale: 1.08,
      duration: 180,
      ease: "Cubic.easeOut",
      onComplete: () => g.destroy(),
    });
  }
}
