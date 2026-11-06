import Phaser from "phaser";

export interface ControlSample {
  mx: number;
  my: number;
  attack: boolean;
  block: boolean;
  interact: boolean;
  dodge: boolean;
  fire: boolean;
  ult: boolean;
}

/**
 * Keyboard and mouse reader. Held buttons are read when sampled; presses (dodge, fire=toggle
 * ranged, ult) are remembered until the next sample so a quick tap between samples is never lost.
 */
export class Controls {
  enabled = true;
  private keys: Record<"w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" | "e", Phaser.Input.Keyboard.Key>;
  private pressed = { dodge: false, fire: false, ult: false };

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      w: kb.addKey(K.W, false),
      a: kb.addKey(K.A, false),
      s: kb.addKey(K.S, false),
      d: kb.addKey(K.D, false),
      up: kb.addKey(K.UP, false),
      down: kb.addKey(K.DOWN, false),
      left: kb.addKey(K.LEFT, false),
      right: kb.addKey(K.RIGHT, false),
      e: kb.addKey(K.E, false),
    };
    kb.addKey(K.SPACE, false).on("down", () => (this.pressed.dodge = true));
    kb.addKey(K.Q, false).on("down", () => (this.pressed.fire = true));
    kb.addKey(K.F, false).on("down", () => (this.pressed.ult = true));
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) e.preventDefault();
    });
    scene.input.mouse?.disableContextMenu();
  }

  sample(): ControlSample {
    const k = this.keys;
    const pointer = this.scene.input.activePointer;
    const out: ControlSample = {
      mx: 0,
      my: 0,
      attack: false,
      block: false,
      interact: false,
      dodge: false,
      fire: false,
      ult: false,
    };
    if (this.enabled) {
      out.mx = (k.d.isDown || k.right.isDown ? 1 : 0) - (k.a.isDown || k.left.isDown ? 1 : 0);
      out.my = (k.s.isDown || k.down.isDown ? 1 : 0) - (k.w.isDown || k.up.isDown ? 1 : 0);
      const len = Math.hypot(out.mx, out.my);
      if (len > 1) {
        out.mx /= len;
        out.my /= len;
      }
      out.attack = pointer.leftButtonDown();
      out.block = pointer.rightButtonDown();
      out.interact = k.e.isDown;
      out.dodge = this.pressed.dodge;
      out.fire = this.pressed.fire;
      out.ult = this.pressed.ult;
    }
    this.pressed = { dodge: false, fire: false, ult: false };
    return out;
  }
}
