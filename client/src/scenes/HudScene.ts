import Phaser from "phaser";
import {
  BARREL,
  barrelThrowReady,
  clamp,
  dist,
  DOWNED,
  ENEMIES,
  HEROES,
  INTERACT_RANGE,
  isHeroId,
  MERCHANT_EXIT_HOLD,
} from "@twodverm/shared";
import { hasState } from "../net/connection";
import type { PlayerView } from "../net/types";
import { colors, palette, toColorNumber } from "../render/palette";
import type { Announcement, GameScene } from "./GameScene";

const FONT = "system-ui, sans-serif";
const TITLE_FONT = "Georgia, serif";
const HINT_SECONDS = 25;

export class HudScene extends Phaser.Scene {
  private game_!: GameScene;
  private g!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Image;
  private hurtAlpha = 0;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private announce: { text: string; kind: string; until: number } | null = null;
  private teamTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("HudScene");
  }

  create(): void {
    this.game_ = this.scene.get("GameScene") as GameScene;
    this.makeVignette();
    this.vignette = this.add.image(0, 0, "vignette").setOrigin(0, 0).setAlpha(0.85);
    this.g = this.add.graphics();
    const t = (key: string, style: Phaser.Types.GameObjects.Text.TextStyle, ox = 0, oy = 0) => {
      this.texts[key] = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "13px", color: palette.textPrimary, stroke: "#000", strokeThickness: 3, ...style }).setOrigin(ox, oy);
    };
    t("hp", { fontSize: "14px" }, 0, 0.5);
    t("ammo", { fontSize: "28px", fontStyle: "bold" }, 0, 0.5);
    t("ammoName", { fontSize: "12px", color: palette.textMuted }, 0, 0);
    t("ult", { fontSize: "13px", fontStyle: "bold" }, 0.5, 0.5);
    t("ultName", { fontSize: "12px", color: palette.textMuted }, 0.5, 0);
    t("announce", { fontFamily: TITLE_FONT, fontSize: "30px", color: palette.accent, strokeThickness: 5 }, 0.5, 0.5);
    t("event", { fontSize: "16px", fontStyle: "bold", color: palette.accent }, 0.5, 0);
    t("boss", { fontFamily: TITLE_FONT, fontSize: "16px", color: "#ff8a70" }, 0.5, 1);
    t("prompt", { fontSize: "15px", color: "#ffffff" }, 0.5, 0.5);
    t("status", { fontFamily: TITLE_FONT, fontSize: "24px", color: "#ff8a70", strokeThickness: 5 }, 0.5, 0.5);
    t("info", { fontSize: "12px", color: palette.textMuted }, 1, 0);
    t("hint", { fontSize: "12px", color: palette.textMuted, align: "center" }, 0.5, 0);
    t("heroName", { fontFamily: TITLE_FONT, fontSize: "15px", color: palette.accent }, 0, 1);
    for (let i = 0; i < 3; i++) {
      this.teamTexts.push(this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "12px", color: palette.textPrimary, stroke: "#000", strokeThickness: 3 }));
    }

    this.game_.hud.on("announce", (a: Announcement) => {
      this.announce = { ...a, until: performance.now() + 3200 };
    });
    this.game_.hud.on("hurt", () => (this.hurtAlpha = 0.35));
    this.game_.hud.on("guardbreak", () => (this.hurtAlpha = 0.25));
    this.scale.on("resize", () => this.makeVignette());
  }

  private makeVignette(): void {
    const w = Math.max(2, Math.floor(this.scale.width / 4));
    const h = Math.max(2, Math.floor(this.scale.height / 4));
    if (this.textures.exists("vignette")) this.textures.remove("vignette");
    const tex = this.textures.createCanvas("vignette", w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
    this.vignette?.setTexture("vignette").setDisplaySize(this.scale.width, this.scale.height);
  }

  update(_t: number, delta: number): void {
    const room = this.game_.room;
    const W = this.scale.width;
    const H = this.scale.height;
    this.g.clear();
    this.vignette.setDisplaySize(W, H);
    const playing = hasState(room) && room.state.phase === "playing";
    const me = this.game_.localPlayer;
    for (const t of Object.values(this.texts)) t.setVisible(playing);
    for (const t of this.teamTexts) t.setVisible(false);
    this.vignette.setVisible(!!room);
    if (!playing || !room || !me || !isHeroId(me.heroId)) return;

    this.hurtAlpha = Math.max(0, this.hurtAlpha - delta / 600);
    if (this.hurtAlpha > 0) {
      this.g.fillStyle(colors.health, this.hurtAlpha);
      this.g.fillRect(0, 0, W, H);
    }

    this.drawSelf(me, W, H);
    this.drawTeam(me);
    this.drawCenter(W, H);
    this.drawPrompt(me, W, H);
    this.drawOffscreen(me);
    const t = this.texts;
    t.info!.setPosition(W - 12, 10).setText(`Ping ${this.game_.ping} ms   Kills ${me.kills}   Team ${room.state.totalKills}   ${formatTime(room.state.missionTime)}`);
    t.hint!
      .setPosition(W / 2, 36)
      .setVisible(room.state.missionTime < HINT_SECONDS)
      .setText("Left click: attack (hold for heavy)   Right click: block (+ left click: push)   Space: dodge\nQ: switch melee / ranged   F: ultimate   Hold E: revive / pick up barrel   Esc: menu");
  }

  private drawSelf(me: PlayerView, W: number, H: number): void {
    const def = HEROES[me.heroId as keyof typeof HEROES];
    const g = this.g;
    const t = this.texts;

    const panelW = 560;
    const panelH = 118;
    const x = Math.round(W / 2 - panelW / 2);
    const y = H - panelH - 14;
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x, y, panelW, panelH, 10);

    const portraitX = x + 34;
    const portraitY = y + 52;
    g.fillStyle(toColorNumber(def.color), 1);
    g.fillCircle(portraitX, portraitY, 24);
    g.lineStyle(2, colors.accent, 1);
    g.strokeCircle(portraitX, portraitY, 24);
    t.heroName!.setOrigin(0, 1).setPosition(x + 66, y + 28).setText(`${def.name} the ${def.title}`);

    const bx = x + 66;
    const bw = 300;
    const ammoX = bx + bw + 18;
    const downed = me.state === "downed";
    const hpFrac = downed ? me.downHp / DOWNED.hp : me.hp / Math.max(1, me.maxHp);
    bar(g, bx, y + 34, bw, 18, hpFrac, downed ? 0x7a1010 : colors.health);
    t.hp!.setPosition(bx + 8, y + 43).setText(downed ? `DOWNED ${Math.ceil(me.downHp)}` : `${Math.ceil(me.hp)} / ${me.maxHp}`);

    const segs = me.maxStamina;
    const gap = 4;
    const segH = 12;
    const segW = (bw - (segs - 1) * gap) / segs;
    const staminaY = y + 58;
    for (let i = 0; i < segs; i++) {
      const fill = clamp(me.stamina - i, 0, 1);
      const sx = bx + i * (segW + gap);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(sx, staminaY, segW, segH);
      const flash = me.guardBroken && Math.floor(performance.now() / 120) % 2 === 0;
      g.fillStyle(flash ? colors.health : colors.stamina, 1);
      g.fillRect(sx, staminaY, segW * fill, segH);
    }

    const dodgeY = y + 88;
    const dodgeR = 9;
    for (let i = 0; i < me.maxDodges; i++) {
      const cx = bx + dodgeR + i * (dodgeR * 2 + 8);
      g.fillStyle(0x000000, 0.6);
      g.fillCircle(cx, dodgeY, dodgeR + 1);
      if (i < me.dodgeCharges) {
        g.fillStyle(colors.dodge, 1);
        g.fillCircle(cx, dodgeY, dodgeR);
      }
    }

    const ux = bx + bw - 20;
    const uy = dodgeY;
    const ultReady = me.ultCooldown <= 0;
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(ux, uy, 18);
    if (ultReady) {
      g.fillStyle(colors.accent, 0.6 + 0.3 * Math.sin(performance.now() * 0.006));
      g.fillCircle(ux, uy, 16);
    } else {
      const frac = 1 - me.ultCooldown / def.ultCooldown;
      g.fillStyle(colors.accent, 0.5);
      g.slice(ux, uy, 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
      g.fillPath();
    }
    t.ult!.setPosition(ux, uy).setText(ultReady ? "F" : `${Math.ceil(me.ultCooldown)}`);
    t.ultName!.setOrigin(1, 0.5).setPosition(ux - 26, uy).setText(def.ultName);

    if (me.carryingBarrel) {
      const throwReady = barrelThrowReady(me.barrelCharge * BARREL.throwMaxHold);
      t.ammo!.setOrigin(0, 0.5).setPosition(ammoX, y + 43).setText("Barrel").setColor(palette.accent);
      t.ammoName!
        .setOrigin(0, 0)
        .setPosition(ammoX, y + 62)
        .setText(throwReady ? "Release to throw" : "Hold 1s+ to throw");
      if (me.barrelCharge > 0) {
        const chargeW = 120;
        const chargeY = y + 84;
        const minMark = (BARREL.throwMinHold / BARREL.throwMaxHold) * chargeW;
        g.fillStyle(0x000000, 0.55);
        g.fillRect(ammoX, chargeY, chargeW, 10);
        g.fillStyle(throwReady ? colors.accent : colors.textMuted, 1);
        g.fillRect(ammoX, chargeY, chargeW * clamp(me.barrelCharge, 0, 1), 10);
        g.lineStyle(1, 0xffffff, 0.7);
        g.lineBetween(ammoX + minMark, chargeY - 1, ammoX + minMark, chargeY + 11);
      }
    } else {
      const ranged = me.rangedMode;
      t.ammo!
        .setOrigin(0, 0.5)
        .setPosition(ammoX, y + 43)
        .setText(ranged ? `${me.ammo} / ${me.maxAmmo}` : def.weapon.name)
        .setColor(ranged && me.ammo === 0 ? "#ff6b5a" : palette.textPrimary);
      t.ammoName!
        .setOrigin(0, 0)
        .setPosition(ammoX, y + 62)
        .setText(ranged ? `Fire · Q: ${def.weapon.name}` : `Q: ${def.ranged.name}`);
    }
  }

  private drawTeam(me: PlayerView): void {
    const room = this.game_.room!;
    let i = 0;
    room.state.players.forEach((p) => {
      if (p.id === me.id || !isHeroId(p.heroId) || i >= this.teamTexts.length) return;
      const def = HEROES[p.heroId];
      const y = 14 + i * 34;
      const x = 14;
      const g = this.g;
      g.fillStyle(0x000000, 0.45);
      g.fillRoundedRect(x - 4, y - 4, 190, 30, 6);
      g.fillStyle(toColorNumber(def.color), 1);
      g.fillCircle(x + 9, y + 11, 8);
      const status =
        p.state === "dead" ? `DEAD (${Math.ceil(p.respawnIn)}s)` : p.state === "downed" ? "DOWNED" : p.state === "grabbed" ? "GRABBED" : !p.connected ? "reconnecting" : "";
      const frac = p.state === "downed" ? p.downHp / DOWNED.hp : p.hp / Math.max(1, p.maxHp);
      bar(g, x + 22, y + 15, 160, 6, p.state === "dead" ? 0 : frac, p.state === "downed" ? 0x7a1010 : colors.success);
      const text = this.teamTexts[i]!;
      text.setVisible(true).setPosition(x + 22, y - 2).setText(`${p.name}${status ? "  " + status : ""}`).setColor(status ? "#ff8a70" : palette.textPrimary);
      i++;
    });
  }

  private drawCenter(W: number, H: number): void {
    const room = this.game_.room!;
    const t = this.texts;
    const now = performance.now();
    if (this.announce && now < this.announce.until) {
      const left = this.announce.until - now;
      t.announce!.setPosition(W / 2, H * 0.22).setText(this.announce.text).setAlpha(Math.min(1, left / 500));
      t.announce!.setColor(this.announce.kind === "boss" || this.announce.kind === "special" ? "#ff8a70" : palette.accent);
    } else {
      t.announce!.setText("");
    }
    let eventText = "";
    if (room.state.phase === "merchant") {
      const left = Math.max(0, MERCHANT_EXIT_HOLD - room.state.merchantHold);
      eventText =
        room.state.merchantHold > 0
          ? `Departing in ${Math.ceil(left)}s — stay in the exit`
          : "Merchant hall — gather in the exit to continue";
    } else if (room.state.phase === "playing" && room.state.procSeed && room.state.finalObjectiveComplete) {
      const left = Math.max(0, MERCHANT_EXIT_HOLD - room.state.merchantHold);
      eventText =
        room.state.merchantHold > 0
          ? `Extracting in ${Math.ceil(left)}s — stay in the exit`
          : "Boss down — gather in the exit to leave";
    } else if (room.state.phase === "playing" && room.state.procSeed && !room.state.finalObjectiveComplete) {
      eventText = room.state.eventActive
        ? `Hold the chamber: ${Math.ceil(room.state.eventTimeLeft)}s`
        : `Section ${room.state.procProgress + 1} objective`;
    } else if (room.state.eventActive) {
      eventText = `Hold the square: ${Math.ceil(room.state.eventTimeLeft)}s`;
    }
    t.event!.setPosition(W / 2, 12).setText(eventText);

    let boss: { hp: number; maxHp: number } | null = null;
    room.state.enemies.forEach((e) => {
      if (e.type === "ogre") boss = e;
    });
    if (boss) {
      const b = boss as { hp: number; maxHp: number };
      const bw = Math.min(500, W * 0.5);
      bar(this.g, W / 2 - bw / 2, 58, bw, 12, b.hp / b.maxHp, 0x9a2a1a);
      t.boss!.setPosition(W / 2, 54).setText(ENEMIES.ogre.name);
    } else {
      t.boss!.setText("");
    }

    const me = this.game_.localPlayer!;
    let status = "";
    if (me.state === "dead") status = `You have fallen. Rejoining the fight in ${Math.ceil(me.respawnIn)}s`;
    else if (me.state === "downed") status = "You are down! A teammate must hold E next to you";
    else if (me.state === "grabbed") status = "GRABBED! Teammates must strike the Packmaster!";
    t.status!.setPosition(W / 2, H * 0.68).setText(status);
  }

  private drawPrompt(me: PlayerView, W: number, H: number): void {
    const room = this.game_.room!;
    const pos = this.game_.localPosition;
    let prompt = "";
    if (me.state !== "downed" && me.state !== "dead") {
      room.state.players.forEach((p) => {
        if (p.id !== me.id && p.state === "downed" && dist(pos.x, pos.y, p.x, p.y) < DOWNED.reviveRange) {
          prompt = me.state === "reviving" ? `Reviving ${p.name}...` : `Hold E to revive ${p.name}`;
        }
      });
      if (!prompt && me.carryingBarrel) {
        const hold = me.barrelCharge * BARREL.throwMaxHold;
        prompt = barrelThrowReady(hold)
          ? "Release to throw"
          : me.barrelCharge > 0
            ? `Charging… ${Math.ceil(BARREL.throwMinHold - hold)}s`
            : "Hold left click 1s+ to throw · Q to drop";
      }
      if (!prompt && !me.carryingBarrel && room.state.barrels) {
        room.state.barrels.forEach((b) => {
          if (b.carriedBy || b.flying) return;
          if (dist(pos.x, pos.y, b.x, b.y) <= BARREL.pickupRange) prompt = "E: Pick up barrel";
        });
      }
      if (!prompt) {
        room.state.pickups.forEach((p) => {
          if (p.used || dist(pos.x, pos.y, p.x, p.y) > INTERACT_RANGE) return;
          if (p.kind === "ammo") prompt = me.ammo < me.maxAmmo ? "E: Refill ammo" : "Ammo full";
          else prompt = me.hp < me.maxHp ? "E: Use medical supplies" : "Health full";
        });
      }
    }
    this.texts.prompt!.setPosition(W / 2, H * 0.6).setText(prompt);
  }

  private drawOffscreen(me: PlayerView): void {
    const room = this.game_.room!;
    const W = this.scale.width;
    const H = this.scale.height;
    room.state.players.forEach((p) => {
      if (p.id === me.id || (p.state !== "downed" && p.state !== "grabbed")) return;
      const s = this.game_.worldToScreen(p.x, p.y);
      if (s.onScreen) return;
      const a = Math.atan2(s.y - H / 2, s.x - W / 2);
      const ex = clamp(W / 2 + Math.cos(a) * W, 24, W - 24);
      const ey = clamp(H / 2 + Math.sin(a) * H, 24, H - 24);
      const g = this.g;
      g.fillStyle(colors.health, 0.6 + 0.4 * Math.sin(performance.now() * 0.01));
      g.fillTriangle(
        ex + Math.cos(a) * 14,
        ey + Math.sin(a) * 14,
        ex + Math.cos(a + 2.5) * 10,
        ey + Math.sin(a + 2.5) * 10,
        ex + Math.cos(a - 2.5) * 10,
        ey + Math.sin(a - 2.5) * 10,
      );
    });
  }
}

function bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number): void {
  g.fillStyle(0x000000, 0.6);
  g.fillRect(x, y, w, h);
  g.fillStyle(color, 1);
  g.fillRect(x, y, w * clamp(frac, 0, 1), h);
  g.lineStyle(1, 0x000000, 0.8);
  g.strokeRect(x, y, w, h);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
