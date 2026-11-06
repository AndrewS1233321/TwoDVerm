import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { palette } from "./render/palette";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: palette.bgBase,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [GameScene],
});
