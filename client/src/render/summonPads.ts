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
        .setScale((1 / TEX_SCALE) * (pad.type === "ogre" ? 0.35 : 0.55))
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
