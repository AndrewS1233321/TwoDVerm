import Phaser from "phaser";
import { TILE_SIZE } from "@twodverm/shared";
import { joinGame } from "../net/connection";
import { palette, toColorNumber } from "../render/palette";

const FLOOR_TILES = 40;

export class GameScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.drawFloor();

    this.add
      .text(this.scale.width / 2, 80, "TwoDVerm", {
        fontFamily: "Georgia, serif",
        fontSize: "48px",
        color: palette.accent,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.statusText = this.add
      .text(16, 16, "Connecting...", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: palette.textMuted,
      })
      .setScrollFactor(0);

    void this.connect();
  }

  private drawFloor(): void {
    const size = FLOOR_TILES * TILE_SIZE;
    const g = this.add.graphics();
    g.fillStyle(toColorNumber(palette.floor));
    g.fillRect(0, 0, size, size);
    g.lineStyle(1, toColorNumber(palette.wall), 0.5);
    for (let i = 0; i <= FLOOR_TILES; i++) {
      const p = i * TILE_SIZE;
      g.lineBetween(p, 0, p, size);
      g.lineBetween(0, p, size, p);
    }
    this.cameras.main.centerOn(size / 2, size / 2);
  }

  private async connect(): Promise<void> {
    try {
      const room = await joinGame();
      this.statusText.setText(`Connected (session ${room.sessionId})`);
      room.onLeave(() => this.statusText.setText("Disconnected from server"));
    } catch (err) {
      console.error(err);
      this.statusText.setText("Cannot reach server");
    }
  }
}
