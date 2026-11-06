import Phaser from "phaser";
import { clamp, DIRECTION, GUNNER, getAttack, lerp } from "@twodverm/shared";
import { colors } from "./palette";
import { handOffset, TEX_SCALE, WEAPON_INFO, weaponTextureKey } from "./textures";

export interface PoseInfo {
  x: number;
  y: number;
  facing: number;
  state: string;
  action: string;
  phase: number;
  actionSeq: number;
  hp: number;
  maxHp: number;
  charge?: number;
  stamina?: number;
  maxStamina?: number;
  guardBroken?: boolean;
  ultActive?: number;
  impenetrable?: boolean;
  reviveProgress?: number;
  dodging?: boolean;
  connected?: boolean;
}

export interface ViewOptions {
  kind: "hero" | "enemy";
  typeId: string;
  radius: number;
  texture: string;
  weaponStyle: keyof typeof WEAPON_INFO | null;
  name?: string;
  isLocal?: boolean;
  showHpAlways?: boolean;
  onSwing?: (heavy: boolean) => void;
}

const REST_ANGLE = 0.55;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class CreatureView {
  readonly root: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly weapon: Phaser.GameObjects.Image | null = null;
  private readonly weapon2: Phaser.GameObjects.Image | null = null;
  private readonly label: Phaser.GameObjects.Text | null = null;
  private readonly grave: Phaser.GameObjects.Image | null = null;

  private animKey = "";
  private animStart = 0;
  private clock = 0;
  private pauseUntil = 0;
  private flashUntil = 0;
  private lastInfo: PoseInfo | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly opts: ViewOptions,
  ) {
    const r = opts.radius;
    this.shadow = scene.add.image(0, 0, "shadow").setAlpha(0.35).setDepth(6).setDisplaySize(r * 2.4, r * 1.6);
    this.root = scene.add.container(0, 0).setDepth(opts.kind === "hero" ? 12 : 10);
    this.body = scene.add.image(0, 0, opts.texture).setScale(1 / TEX_SCALE);
    if (opts.weaponStyle) {
      const info = WEAPON_INFO[opts.weaponStyle];
      const key = weaponTextureKey(opts.weaponStyle);
      const originX = info.handle / (info.length + 4);
      this.weapon = scene.add.image(0, 0, key).setScale(1 / TEX_SCALE).setOrigin(originX, 0.5);
      if (opts.weaponStyle === "daggers") {
        this.weapon2 = scene.add.image(0, 0, key).setScale(1 / TEX_SCALE).setOrigin(originX, 0.5);
      }
    }
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (this.weapon2) parts.push(this.weapon2);
    parts.push(this.body);
    if (this.weapon) parts.push(this.weapon);
    this.root.add(parts);

    if (opts.name !== undefined) {
      this.label = scene.add
        .text(0, 0, opts.name, { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: opts.isLocal ? "#e8d08a" : "#e8e0d0", stroke: "#000", strokeThickness: 3 })
        .setOrigin(0.5, 1)
        .setDepth(25);
    }
    if (opts.kind === "hero") {
      this.grave = scene.add.image(0, 0, "grave").setDepth(9).setVisible(false);
    }
  }

  flash(durationMs = 80): void {
    this.flashUntil = performance.now() + durationMs;
  }

  hitPause(ms: number): void {
    this.pauseUntil = Math.max(this.pauseUntil, performance.now() + ms);
  }

  /** Copies the body sprite as a fading ghost, used for dodges. */
  afterimage(): void {
    const ghost = this.scene.add
      .image(this.root.x, this.root.y, this.opts.texture)
      .setScale(1 / TEX_SCALE)
      .setRotation(this.root.rotation)
      .setAlpha(0.45)
      .setTint(0x9fd3ff)
      .setDepth(this.root.depth - 1);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  get position(): { x: number; y: number } {
    return { x: this.root.x, y: this.root.y };
  }

  get info(): PoseInfo | null {
    return this.lastInfo;
  }

  update(info: PoseInfo, dtMs: number, ground: Phaser.GameObjects.Graphics, top: Phaser.GameObjects.Graphics): void {
    this.lastInfo = info;
    const now = performance.now();
    if (now >= this.pauseUntil) this.clock += dtMs;
    const r = this.opts.radius;
    const dead = info.state === "dead";

    this.root.setVisible(!dead);
    this.shadow.setVisible(!dead);
    this.label?.setVisible(!dead);
    if (this.grave) {
      this.grave.setVisible(dead).setPosition(info.x, info.y);
    }
    if (dead) return;

    let rot = info.facing;
    let scale = 1;
    let ox = 0;
    let oy = 0;
    if (info.state === "staggered") rot += Math.sin(now * 0.025) * 0.18;
    if (info.state === "downed") {
      rot += 1.3;
      scale = 0.9;
    }
    if (info.state === "grabbed") {
      ox = (Math.random() - 0.5) * 2;
      oy = (Math.random() - 0.5) * 2;
    }
    this.root.setPosition(info.x + ox, info.y + oy).setRotation(rot).setScale(scale);
    this.shadow.setPosition(info.x + 2, info.y + 3);
    this.label?.setPosition(info.x, info.y - r - 6);

    const flashing = now < this.flashUntil;
    if (flashing) this.body.setTintFill(0xffffff);
    else if (info.state === "downed") this.body.setTint(0x777777);
    else if (info.state === "staggered") this.body.setTint(0xc8c8ff);
    else if (this.opts.kind === "enemy" && info.state === "idle") this.body.setTint(0xb0a898);
    else this.body.clearTint();
    this.root.setAlpha(info.dodging ? 0.55 : info.connected === false ? 0.4 : 1);

    this.animateWeapon(info, now);
    this.drawOverlays(info, now, ground, top);
  }

  private animateWeapon(info: PoseInfo, now: number): void {
    const key = `${info.actionSeq}:${info.phase}:${info.state}:${info.action}`;
    if (key !== this.animKey) {
      this.animKey = key;
      this.animStart = this.clock;
      if (info.phase === 2 && info.action) this.opts.onSwing?.(getAttack(info.action)?.stagger !== undefined && (getAttack(info.action)?.stagger ?? 0) >= 2);
    }
    if (!this.weapon) {
      this.animateBodyLunge(info);
      return;
    }
    const r = this.opts.radius;
    const hand = handOffset(r);
    let angle = REST_ANGLE;
    let thrust = 0;
    let hx = hand.x;
    let hy = hand.y;
    const elapsed = (this.clock - this.animStart) / 1000;
    const def = info.action ? getAttack(info.action) : undefined;

    if (def && info.phase > 0) {
      const back = def.swing.from === def.swing.to ? 0 : Math.sign(def.swing.from) * 0.25;
      if (info.phase === 1) {
        const t = clamp(elapsed / Math.max(0.01, def.windup), 0, 1);
        angle = lerp(REST_ANGLE, def.swing.from + back, easeOut(t));
        thrust = -4 * t;
      } else if (info.phase === 2) {
        const t = clamp(elapsed / Math.max(0.01, def.active), 0, 1);
        angle = lerp(def.swing.from, def.swing.to, easeOutCubic(t));
        thrust = (def.swing.thrust ?? 0) * Math.sin(t * Math.PI);
      } else {
        const t = clamp(elapsed / Math.max(0.01, def.recovery), 0, 1);
        angle = lerp(def.swing.to, REST_ANGLE, easeInOut(t));
      }
    } else {
      switch (info.state) {
        case "charging": {
          const c = info.charge ?? 0;
          angle = 2.1 + Math.sin(now * 0.04) * 0.06 * c;
          thrust = -3 - 3 * c;
          break;
        }
        case "blocking":
        case "pushing":
          angle = -1.35;
          hx = r * 0.8;
          hy = r * 0.25;
          thrust = info.state === "pushing" ? 6 : 0;
          break;
        case "staggered":
          angle = REST_ANGLE + Math.sin(now * 0.02) * 0.5;
          break;
        case "shooting":
          angle = 0.05;
          thrust = 2;
          break;
        case "downed":
          angle = 1.9;
          break;
        case "reviving":
          angle = 1.4;
          break;
      }
    }
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    this.weapon.setPosition(hx + ca * thrust, hy + sa * thrust).setRotation(angle);
    const charge = info.state === "charging" ? (info.charge ?? 0) : 0;
    if (charge > 0) this.weapon.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - 60 * charge), Math.round(255 - 160 * charge)));
    else this.weapon.clearTint();
    if (this.weapon2) {
      this.weapon2.setPosition(hx + ca * thrust, -hy - sa * thrust).setRotation(-angle);
    }
  }

  /** Creatures without a weapon sprite (ogre, gunner, gas rat) show attacks with body movement. */
  private animateBodyLunge(info: PoseInfo): void {
    const def = info.action ? getAttack(info.action) : undefined;
    const elapsed = (this.clock - this.animStart) / 1000;
    let sx = 1;
    let fx = 0;
    if (def && info.phase === 1) {
      const t = clamp(elapsed / def.windup, 0, 1);
      sx = 1 - 0.12 * t;
      fx = -4 * t;
    } else if (def && info.phase === 2) {
      const t = clamp(elapsed / def.active, 0, 1);
      sx = 1.12;
      fx = 8 * Math.sin(t * Math.PI);
    }
    this.body.setScale(sx / TEX_SCALE, (2 - sx) / TEX_SCALE).setPosition(fx, 0);
  }

  private drawOverlays(info: PoseInfo, now: number, ground: Phaser.GameObjects.Graphics, top: Phaser.GameObjects.Graphics): void {
    const r = this.opts.radius;
    const def = info.action ? getAttack(info.action) : undefined;
    const elapsed = (this.clock - this.animStart) / 1000;

    if (this.opts.kind === "enemy") {
      if (def && info.phase === 1) {
        const t = clamp(elapsed / def.windup, 0, 1);
        const reach = r + def.reach + 6;
        const half = Math.min(Math.PI, def.arc / 2);
        ground.fillStyle(colors.telegraph, 0.12 + 0.33 * t);
        ground.slice(info.x, info.y, reach, info.facing - half, info.facing + half, false);
        ground.fillPath();
        ground.lineStyle(2, colors.telegraph, 0.5 + 0.5 * t);
        ground.slice(info.x, info.y, reach * t, info.facing - half, info.facing + half, false);
        ground.strokePath();
      }
      if (info.state === "aim") {
        const pulse = 0.4 + 0.4 * Math.sin(now * 0.02);
        ground.lineStyle(2, colors.telegraph, pulse);
        ground.lineBetween(info.x, info.y, info.x + Math.cos(info.facing) * GUNNER.range, info.y + Math.sin(info.facing) * GUNNER.range);
      }
      if (info.state === "throw") {
        top.fillStyle(colors.warp, 0.5 + 0.3 * Math.sin(now * 0.03));
        top.fillCircle(info.x + Math.cos(info.facing) * r, info.y + Math.sin(info.facing) * r, 5);
      }
      if (info.state === "staggered") {
        top.lineStyle(2, 0xffe27a, 0.8);
        top.strokeCircle(info.x, info.y - r - 4, 4 + Math.sin(now * 0.02) * 1.5);
      }
      if (info.hp < info.maxHp || this.opts.showHpAlways) this.drawHpBar(top, info, r);
      return;
    }

    if (info.state === "blocking" || info.state === "pushing") {
      const frac = info.maxStamina ? clamp((info.stamina ?? 0) / info.maxStamina, 0, 1) : 1;
      const color = info.guardBroken ? colors.health : colors.stamina;
      top.lineStyle(3, color, 0.35 + 0.6 * frac);
      top.beginPath();
      top.arc(info.x, info.y, r + 6, info.facing - DIRECTION.frontHalfArc, info.facing + DIRECTION.frontHalfArc, false);
      top.strokePath();
    }
    if (info.state === "pushing") {
      top.lineStyle(4, 0xffffff, 0.6);
      top.beginPath();
      top.arc(info.x, info.y, r + 18, info.facing - 1.1, info.facing + 1.1, false);
      top.strokePath();
    }
    if (info.impenetrable && (info.ultActive ?? 0) > 0) {
      top.lineStyle(3, colors.accent, 0.5 + 0.3 * Math.sin(now * 0.015));
      top.strokeCircle(info.x, info.y, r + 8);
    }
    if (info.state === "charging" && (info.charge ?? 0) >= 1) {
      top.fillStyle(0xffd27a, 0.25 + 0.2 * Math.sin(now * 0.03));
      top.fillCircle(info.x, info.y, r + 4);
    }
    if (info.state === "downed") {
      ground.lineStyle(3, colors.health, 0.5 + 0.4 * Math.sin(now * 0.01));
      ground.strokeCircle(info.x, info.y, r + 10);
      const p = info.reviveProgress ?? 0;
      if (p > 0) {
        top.fillStyle(0x000000, 0.6);
        top.fillRect(info.x - 18, info.y - r - 22, 36, 5);
        top.fillStyle(colors.success, 1);
        top.fillRect(info.x - 18, info.y - r - 22, 36 * p, 5);
      }
    }
    if (!this.opts.isLocal) this.drawHpBar(top, info, r);
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, info: PoseInfo, r: number): void {
    const w = Math.max(22, r * 2);
    const frac = clamp(info.hp / Math.max(1, info.maxHp), 0, 1);
    const y = info.y - r - (this.opts.kind === "hero" ? 4 : 8);
    g.fillStyle(0x000000, 0.6);
    g.fillRect(info.x - w / 2, y, w, 3);
    g.fillStyle(this.opts.kind === "hero" ? colors.success : colors.health, 1);
    g.fillRect(info.x - w / 2, y, w * frac, 3);
  }

  destroy(): void {
    this.root.destroy();
    this.shadow.destroy();
    this.label?.destroy();
    this.grave?.destroy();
  }
}
