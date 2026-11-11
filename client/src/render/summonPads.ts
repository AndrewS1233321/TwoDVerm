import Phaser from "phaser";
import { ENEMIES, TILE_SIZE, type Level } from "@twodverm/shared";
import { colors } from "./palette";
import { enemyTextureKey, TEX_SCALE } from "./textures";

/** Green lit summon pads with creature icon and name for the testing zone. */
export class SummonPadRenderer {
  private readonly root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, level: Level) {
    this.root = scene.add.container(0, 0).setDepth(3);
    const half = TILE_SIZE * 1.15;
    for (const pad of level.summonPads) {
      const def = ENEMIES[pad.type];
      const g = scene.add.graphics();
      g.fillStyle(colors.success, 0.22);
      g.fillRect(pad.x - half, pad.y - half, half * 2, half * 2);
      g.lineStyle(2, colors.success, 0.85);
      g.strokeRect(pad.x - half + 1, pad.y - half + 1, half * 2 - 2, half * 2 - 2);
      g.fillStyle(colors.success, 0.12);
      g.fillCircle(pad.x, pad.y, half * 0.85);

      const icon = scene.add
        .image(pad.x, pad.y - 4, enemyTextureKey(pad.type))
        .setScale((1 / TEX_SCALE) * (def.large ? 0.35 : 0.55))
        .setAlpha(0.95);

      const label = scene.add
        .text(pad.x, pad.y + half - 6, def.name, {
          fontFamily: "Georgia, serif",
          fontSize: "11px",
          color: "#c8f0b8",
          align: "center",
          stroke: "#0e0c0b",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1);

      this.root.add([g, icon, label]);
    }

    if (level.summonPortal) {
      this.root.add(drawSummonPortal(scene, level.summonPortal.x, level.summonPortal.y));
    }

    for (const room of level.roomLabels) {
      const label = scene.add
        .text(room.x, room.y, room.name, {
          fontFamily: "Georgia, serif",
          fontSize: "20px",
          color: "#9a8f80",
          align: "center",
        })
        .setOrigin(0.5)
        .setAlpha(0.55);
      this.root.add(label);
    }
  }

  destroy(): void {
    this.root.destroy(true);
  }
}

/** Tall warp oval on the far-right wall of the summon room. */
function drawSummonPortal(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x0a1208, 0.72);
  g.fillEllipse(0, 0, 36, 78);
  g.lineStyle(3, colors.warp, 0.95);
  g.strokeEllipse(0, 0, 36, 78);
  g.lineStyle(2, 0xb8ff8a, 0.55);
  g.strokeEllipse(0, 0, 22, 52);
  g.fillStyle(colors.warp, 0.18);
  g.fillEllipse(0, 0, 18, 44);
  const glow = scene.add.graphics();
  glow.lineStyle(5, colors.warp, 0.35);
  glow.strokeEllipse(0, 0, 42, 88);
  root.add([glow, g]);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.35, to: 0.85 },
    scaleX: { from: 1, to: 1.08 },
    scaleY: { from: 1, to: 1.04 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  const label = scene.add
    .text(0, 48, "PORTAL", {
      fontFamily: "Georgia, serif",
      fontSize: "11px",
      color: "#b8ff8a",
      align: "center",
      stroke: "#0e0c0b",
      strokeThickness: 3,
    })
    .setOrigin(0.5, 0);
  root.add(label);
  return root;
}
