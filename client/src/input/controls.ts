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
  /** Latest cursor position in GameScene world space. */
  aimX = 0;
  aimY = 0;
  /** Latest cursor position in screen / HudScene space. */
  screenX = 0;
  screenY = 0;
  private keys: Record<"w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" | "e" | "f", Phaser.Input.Keyboard.Key>;
  private pressed = { dodge: false, fire: false };
  /** Bitmask mirrored from pointer events (more reliable than polling alone). */
  private buttons = 0;

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
      f: kb.addKey(K.F, false),
    };
    kb.addKey(K.SPACE, false).on("down", () => (this.pressed.dodge = true));
    kb.addKey(K.Q, false).on("down", () => (this.pressed.fire = true));
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) e.preventDefault();
    });
    scene.input.mouse?.disableContextMenu();
    const track = (p: Phaser.Input.Pointer) => {
      this.buttons = p.buttons;
      this.screenX = p.x;
      this.screenY = p.y;
      const cam = scene.cameras.main;
      const world = cam.getWorldPoint(p.x, p.y);
      this.aimX = world.x;
      this.aimY = world.y;
    };
    scene.input.on("pointerdown", track);
    scene.input.on("pointerup", track);
    scene.input.on("pointermove", track);
  }

  leftDown(): boolean {
    return (this.buttons & 1) !== 0 || this.scene.input.activePointer.leftButtonDown();
  }

  rightDown(): boolean {
    return (this.buttons & 2) !== 0 || this.scene.input.activePointer.rightButtonDown();
  }

  sample(): ControlSample {
    const k = this.keys;
    const pointer = this.scene.input.activePointer;
    // Keep button/aim mirrors fresh even if no move event fired this frame.
    this.buttons = pointer.buttons;
    this.screenX = pointer.x;
    this.screenY = pointer.y;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.aimX = world.x;
    this.aimY = world.y;

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
      out.attack = this.leftDown();
      out.block = this.rightDown();
      out.interact = k.e.isDown;
      out.dodge = this.pressed.dodge;
      out.fire = this.pressed.fire;
      // Held while F is down so Elvish Wrath can charge; other ults fire on press edge server-side.
      out.ult = k.f.isDown;
    }
    this.pressed = { dodge: false, fire: false };
    return out;
  }
}
