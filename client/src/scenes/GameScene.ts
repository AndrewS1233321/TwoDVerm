import Phaser from "phaser";
import {
  angleTo,
  clamp,
  ENEMIES,
  generateLevel,
  HEROES,
  isHeroId,
  MSG,
  parseLevelById,
  parseLevelProps,
  TILE_FLOOR,
  TICK_MS,
  type EnemyId,
  type FxEvent,
  type GeneratedLevelMeta,
  type InputMessage,
  type Level,
} from "@twodverm/shared";
import { Music } from "../audio/music";
import { playSfx, type SfxName } from "../audio/sfx";
import { Controls } from "../input/controls";
import { hasState, type GameRoom } from "../net/connection";
import { SnapshotBuffer } from "../net/interpolation";
import { Predictor } from "../net/prediction";
import type { EnemyView, PlayerView } from "../net/types";
import { Effects } from "../render/effects";
import { LevelRenderer } from "../render/levelRenderer";
import { colors } from "../render/palette";
import { SummonPadRenderer } from "../render/summonPads";
import { enemyTextureKey, enemyWeaponStyle, generateTextures, heroTextureKey, rangedWeaponStyle } from "../render/textures";
import { CreatureView, type PoseInfo } from "../render/views";
import { getSettings } from "../settings";

const LOOKAHEAD = 0.18;
const MAX_LOOKAHEAD = 110;
const CAMERA_LERP = 0.16;

export interface Announcement {
  text: string;
  kind: string;
}

export class GameScene extends Phaser.Scene {
  level: Level = parseLevelById("default");
  readonly music = new Music();
  readonly hud = new Phaser.Events.EventEmitter();
  room: GameRoom | null = null;
  localId = "";
  inputBlocked = false;
  ping = 0;

  private levelRenderer!: LevelRenderer;
  private summonPads: SummonPadRenderer | null = null;
  private effects!: Effects;
  private controls!: Controls;
  private ground!: Phaser.GameObjects.Graphics;
  private top!: Phaser.GameObjects.Graphics;
  private readonly predictor = new Predictor();
  private readonly heroViews = new Map<string, CreatureView>();
  private readonly enemyViews = new Map<string, CreatureView>();
  private readonly pickupViews = new Map<string, Phaser.GameObjects.Image>();
  private readonly interp = new Map<string, SnapshotBuffer>();
  private readonly sendTimes = new Map<number, number>();
  private inputAcc = 0;
  private lastPhase = "";
  private backdropT = 0;
  private activeProcKey = "";
  private appliedProcProgress = -1;
  private procMeta: GeneratedLevelMeta | null = null;
  private readonly lagMs = Number(new URLSearchParams(location.search).get("lag") ?? 0);

  constructor() {
    super("GameScene");
  }

  create(): void {
    generateTextures(this);
    this.levelRenderer = new LevelRenderer(this, this.level);
    this.ground = this.add.graphics().setDepth(5);
    this.top = this.add.graphics().setDepth(15);
    this.effects = new Effects(this);
    this.controls = new Controls(this);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.level.width * 32, this.level.height * 32);
    cam.setBackgroundColor("#0e0c0b");
    this.updateZoom();
    this.scale.on("resize", () => this.updateZoom());
    const start = this.level.playerStarts[0]!;
    cam.centerOn(start.x, start.y);
    this.scene.launch("HudScene");
  }

  private updateZoom(): void {
    this.cameras.main.setZoom(clamp(this.scale.height / 640, 1, 2.2));
  }

  attach(room: GameRoom): void {
    this.detach();
    this.room = room;
    this.localId = room.sessionId;
    this.predictor.reset();
    this.lastPhase = "";
    room.onStateChange(() => this.onPatch());
    room.onMessage(MSG.fx, (list: FxEvent[]) => this.handleFx(list));
    if (hasState(room) && room.state.levelId) this.setActiveLevelFromState(room.state);
  }

  detach(): void {
    for (const v of this.heroViews.values()) v.destroy();
    for (const v of this.enemyViews.values()) v.destroy();
    for (const v of this.pickupViews.values()) v.destroy();
    this.heroViews.clear();
    this.enemyViews.clear();
    this.pickupViews.clear();
    this.interp.clear();
    this.room = null;
    this.localId = "";
    this.levelRenderer?.setGateOpen(false);
  }

  /** Rebuilds the world map when the synced level / proc seed changes. */
  private setActiveLevelFromState(state: {
    levelId: string;
    procSeed: number;
    levelProps: string;
    procProgress: number;
    finalObjectiveComplete: boolean;
  }): void {
    const props = state.procSeed && state.levelProps ? parseLevelProps(state.levelProps) : null;
    const procKey = props ? `${state.levelId}:${state.procSeed}:${state.levelProps}` : state.levelId;
    if (procKey === this.activeProcKey && this.levelRenderer) {
      this.applyProcProgress(state.procProgress, state.finalObjectiveComplete);
      return;
    }
    this.activeProcKey = procKey;
    this.appliedProcProgress = -1;
    if (props && state.procSeed) {
      const { level, meta } = generateLevel(props, state.procSeed);
      this.level = level;
      this.procMeta = meta;
    } else {
      this.level = parseLevelById(state.levelId);
      this.procMeta = null;
    }
    this.levelRenderer?.destroy();
    this.summonPads?.destroy();
    this.levelRenderer = new LevelRenderer(this, this.level, {
      exitLocked: !!props && !state.finalObjectiveComplete,
    });
    this.summonPads = this.level.summonPads.length > 0 ? new SummonPadRenderer(this, this.level) : null;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.level.width * 32, this.level.height * 32);
    const start = this.level.playerStarts[0];
    if (start) cam.centerOn(start.x, start.y);
    this.applyProcProgress(state.procProgress, state.finalObjectiveComplete);
  }

  private applyProcProgress(progress: number, finalDone: boolean): void {
    if (!this.procMeta) return;
    if (progress === this.appliedProcProgress) {
      this.levelRenderer?.setExitUnlocked(finalDone);
      this.levelRenderer?.setGateOpen(finalDone);
      return;
    }
    this.appliedProcProgress = progress;
    for (let i = 0; i < progress && i < this.procMeta.sectionGates.length; i++) {
      for (const ti of this.procMeta.sectionGates[i]!) {
        if (ti >= 0 && ti < this.level.tiles.length) this.level.tiles[ti] = TILE_FLOOR;
      }
    }
    this.levelRenderer?.setExitUnlocked(finalDone);
    this.levelRenderer?.setGateOpen(finalDone);
    this.levelRenderer?.redrawGates();
  }

  get localPlayer(): PlayerView | undefined {
    return hasState(this.room) ? this.room.state.players.get(this.localId) : undefined;
  }

  /** Where the local hero is drawn (predicted), for the HUD and sound distance. */
  get localPosition(): { x: number; y: number } {
    const v = this.heroViews.get(this.localId);
    if (v) return v.position;
    const c = this.cameras.main.midPoint;
    return { x: c.x, y: c.y };
  }

  worldToScreen(x: number, y: number): { x: number; y: number; onScreen: boolean } {
    const cam = this.cameras.main;
    const sx = (x - cam.worldView.x) * cam.zoom;
    const sy = (y - cam.worldView.y) * cam.zoom;
    return { x: sx, y: sy, onScreen: sx >= 0 && sy >= 0 && sx <= cam.width && sy <= cam.height };
  }

  private buffer(id: string): SnapshotBuffer {
    let b = this.interp.get(id);
    if (!b) {
      b = new SnapshotBuffer();
      this.interp.set(id, b);
    }
    return b;
  }

  private onPatch(): void {
    const room = this.room;
    if (!hasState(room)) return;
    const state = room.state;
    if (state.levelId) this.setActiveLevelFromState(state);
    const now = performance.now();
    if (state.phase !== this.lastPhase) {
      if (state.phase === "playing" || state.phase === "merchant") {
        this.predictor.reset();
        this.interp.clear();
      }
      this.lastPhase = state.phase;
    }
    state.players.forEach((p) => {
      if (p.id === this.localId) return;
      this.buffer(p.id).push(now, p.x, p.y, p.facing);
    });
    state.enemies.forEach((e) => this.buffer(e.id).push(now, e.x, e.y, e.facing));

    const me = state.players.get(this.localId);
    if (me && me.heroId) {
      this.predictor.reconcile(me, this.level, state.gateOpen);
      const sent = this.sendTimes.get(me.ackSeq);
      if (sent !== undefined) {
        this.ping = Math.round(this.ping * 0.8 + (now - sent) * 0.2);
        for (const seq of this.sendTimes.keys()) if (seq <= me.ackSeq) this.sendTimes.delete(seq);
      }
    }
  }

  update(_time: number, delta: number): void {
    this.music.update(delta / 1000);
    const room = this.room;
    if (!hasState(room)) {
      this.backdrop(delta);
      return;
    }
    const state = room.state;
    const me = state.players.get(this.localId);
    if ((state.phase === "playing" || state.phase === "merchant") && me?.heroId) {
      this.inputAcc += delta;
      if (this.inputAcc > 250) this.inputAcc = TICK_MS;
      while (this.inputAcc >= TICK_MS) {
        this.inputAcc -= TICK_MS;
        this.sendInput(state.gateOpen);
      }
    }
    this.predictor.decay(delta / 1000);
    this.ground.clear();
    this.top.clear();
    this.syncHeroes(delta);
    this.syncEnemies(delta);
    this.syncPickups();
    this.drawHazards();
    this.levelRenderer.setGateOpen(state.gateOpen);
    this.followCamera();
  }

  private backdrop(delta: number): void {
    this.backdropT += delta / 1000;
    const cam = this.cameras.main;
    const w = this.level.width * 32;
    const x = (Math.sin(this.backdropT * 0.03) * 0.5 + 0.5) * (w - 600) + 300;
    cam.centerOn(x, 16 * 32);
  }

  private sendInput(gateOpen: boolean): void {
    const room = this.room;
    if (!room) return;
    this.controls.enabled = !this.inputBlocked;
    const s = this.controls.sample();
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    const body = this.predictor.body;
    const input: InputMessage = { seq: this.predictor.nextSeq(), aim: angleTo(body.x, body.y, pointer.worldX, pointer.worldY), ...s };
    if (this.inputBlocked) input.aim = body.facing;
    if (s.fire && !this.inputBlocked) playSfx("click", { volume: 0.6 });
    this.sendTimes.set(input.seq, performance.now());
    if (this.lagMs > 0) setTimeout(() => room.send(MSG.input, input), this.lagMs);
    else room.send(MSG.input, input);
    this.predictor.apply(input, this.level, gateOpen);
  }

  private heroPose(p: PlayerView): PoseInfo {
    let x = p.x;
    let y = p.y;
    let facing = p.facing;
    let dodging = p.dodgeT > 0;
    if (p.id === this.localId && (this.room?.state.phase === "playing" || this.room?.state.phase === "merchant")) {
      const b = this.predictor.body;
      x = b.x + this.predictor.offset.x;
      y = b.y + this.predictor.offset.y;
      facing = b.facing;
      dodging = b.dodgeT > 0;
    } else {
      const s = this.interp.get(p.id)?.sample(performance.now());
      if (s) {
        x = s.x;
        y = s.y;
        facing = s.facing;
      }
    }
    return {
      x,
      y,
      facing,
      state: p.state,
      action: p.action,
      phase: p.phase,
      actionSeq: p.actionSeq,
      hp: p.hp,
      maxHp: p.maxHp,
      charge: p.charge,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      guardBroken: p.guardBroken,
      ultActive: p.ultActive,
      impenetrable: p.heroId === "dwarf",
      reviveProgress: p.reviveProgress,
      dodging,
      connected: p.connected,
      rangedMode: p.rangedMode,
    };
  }

  private syncHeroes(delta: number): void {
    const state = this.room!.state;
    const seen = new Set<string>();
    state.players.forEach((p) => {
      if (!isHeroId(p.heroId)) return;
      seen.add(p.id);
      let view = this.heroViews.get(p.id);
      if (view && view.opts.typeId !== p.heroId) {
        view.destroy();
        view = undefined;
      }
      if (!view) {
        const def = HEROES[p.heroId];
        view = new CreatureView(this, {
          kind: "hero",
          typeId: p.heroId,
          radius: def.radius,
          texture: heroTextureKey(p.heroId),
          weaponStyle: def.weapon.style,
          rangedStyle: rangedWeaponStyle(p.heroId),
          name: p.name,
          isLocal: p.id === this.localId,
          onSwing: (heavy) => this.sfxAt(heavy ? "heavySwing" : "swing", view!.position, p.id === this.localId ? 0.8 : 0.5),
        });
        this.heroViews.set(p.id, view);
      }
      view.update(this.heroPose(p), delta, this.ground, this.top);
    });
    for (const [id, v] of this.heroViews) {
      if (!seen.has(id)) {
        v.destroy();
        this.heroViews.delete(id);
      }
    }
    for (const e of state.enemies.values()) {
      if (e.state !== "drag") continue;
      const victim = [...state.players.values()].find((p) => p.grabbedBy === e.id);
      const a = this.enemyViews.get(e.id);
      const b = victim ? this.heroViews.get(victim.id) : undefined;
      if (a && b) {
        this.top.lineStyle(2, 0x9aa3ad, 0.9);
        this.top.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);
      }
    }
  }

  private enemyPose(e: EnemyView): PoseInfo {
    const s = this.interp.get(e.id)?.sample(performance.now());
    return {
      x: s?.x ?? e.x,
      y: s?.y ?? e.y,
      facing: s?.facing ?? e.facing,
      state: e.state,
      action: e.action,
      phase: e.phase,
      actionSeq: e.actionSeq,
      hp: e.hp,
      maxHp: e.maxHp,
    };
  }

  private syncEnemies(delta: number): void {
    const state = this.room!.state;
    const seen = new Set<string>();
    state.enemies.forEach((e) => {
      const def = ENEMIES[e.type as EnemyId];
      if (!def) return;
      seen.add(e.id);
      let view = this.enemyViews.get(e.id);
      if (!view) {
        const created: CreatureView = new CreatureView(this, {
          kind: "enemy",
          typeId: e.type,
          radius: def.radius,
          texture: enemyTextureKey(e.type),
          weaponStyle: enemyWeaponStyle(def.id),
          showHpAlways: def.special || def.elite,
          onSwing: (heavy) => this.sfxAt(heavy ? "heavySwing" : "swing", created.position, 0.35),
        });
        view = created;
        this.enemyViews.set(e.id, view);
      }
      view.update(this.enemyPose(e), delta, this.ground, this.top);
    });
    for (const [id, v] of this.enemyViews) {
      if (!seen.has(id)) {
        v.destroy();
        this.enemyViews.delete(id);
        this.interp.delete(id);
      }
    }
  }

  private syncPickups(): void {
    const state = this.room!.state;
    const now = performance.now();
    state.pickups.forEach((p) => {
      let img = this.pickupViews.get(p.id);
      if (!img) {
        img = this.add.image(p.x, p.y, `pickup_${p.kind}`).setScale(0.5).setDepth(3);
        this.pickupViews.set(p.id, img);
      }
      img.setVisible(!p.used);
      img.y = p.y + Math.sin(now * 0.003 + p.x) * 1.5;
    });
  }

  private drawHazards(): void {
    const state = this.room!.state;
    const now = performance.now();
    const g = this.ground;
    state.hazards.forEach((h) => {
      if (h.kind === "globe") {
        const t = 1 - h.timeLeft / Math.max(0.01, h.duration);
        g.lineStyle(2, colors.warp, 0.4 + 0.4 * Math.sin(now * 0.03));
        g.strokeCircle(h.x, h.y, h.radius);
        const gx = h.fromX + (h.x - h.fromX) * t;
        const gy = h.fromY + (h.y - h.fromY) * t - Math.sin(t * Math.PI) * 50;
        this.top.fillStyle(colors.warp, 1);
        this.top.fillCircle(gx, gy, 5);
      } else {
        const fade = Math.min(1, h.timeLeft / 1.5);
        g.fillStyle(colors.warp, 0.18 * fade);
        g.fillCircle(h.x, h.y, h.radius);
        for (let i = 0; i < 5; i++) {
          const a = now * 0.0006 * (i % 2 ? 1 : -1) + i * 1.3;
          g.fillStyle(colors.warp, 0.1 * fade);
          g.fillCircle(h.x + Math.cos(a) * h.radius * 0.45, h.y + Math.sin(a) * h.radius * 0.45, h.radius * 0.45);
        }
      }
    });
  }

  private followCamera(): void {
    const cam = this.cameras.main;
    let target = this.heroViews.get(this.localId)?.position;
    const me = this.localPlayer;
    if (me?.state === "dead") {
      const buddy = [...this.heroViews.entries()].find(([id, v]) => id !== this.localId && v.info?.state !== "dead");
      if (buddy) target = buddy[1].position;
    }
    if (!target) return;
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(cam);
    const lx = clamp((pointer.worldX - target.x) * LOOKAHEAD, -MAX_LOOKAHEAD, MAX_LOOKAHEAD);
    const ly = clamp((pointer.worldY - target.y) * LOOKAHEAD, -MAX_LOOKAHEAD, MAX_LOOKAHEAD);
    const mid = cam.midPoint;
    cam.centerOn(mid.x + (target.x + lx - mid.x) * CAMERA_LERP, mid.y + (target.y + ly - mid.y) * CAMERA_LERP);
  }

  private shake(ms: number, intensity: number): void {
    if (getSettings().screenShake) this.cameras.main.shake(ms, intensity);
  }

  private sfxAt(name: SfxName, at: { x: number; y: number }, volume = 1): void {
    playSfx(name, { at, listener: this.localPosition, volume });
  }

  private viewFor(id: string): CreatureView | undefined {
    return this.heroViews.get(id) ?? this.enemyViews.get(id);
  }

  private handleFx(list: FxEvent[]): void {
    for (const e of list) {
      switch (e.t) {
        case "hit": {
          const view = this.viewFor(e.id);
          view?.flash();
          const at = view?.position ?? { x: e.x, y: e.y };
          if (this.heroViews.has(e.id)) {
            this.effects.damageNumber(at.x, at.y, `-${e.dmg}`, "#ff6b5a", e.heavy);
            this.effects.blood(at.x, at.y, 0.6);
            if (e.id === this.localId) {
              this.shake(110, 0.006);
              playSfx("hurt", { volume: 0.8 });
              this.hud.emit("hurt");
            }
          } else {
            const back = e.side === "back";
            const color = e.armor ? "#9aa3ad" : back ? "#ff9a3a" : e.heavy ? "#ffd27a" : "#e8e0d0";
            this.effects.damageNumber(at.x, at.y, back && !e.armor ? `${e.dmg}!` : `${e.dmg}`, color, back || e.heavy);
            if (e.armor) this.effects.sparks(at.x, at.y, 0xd8d0c0, 5, 90);
            else this.effects.blood(at.x, at.y, back ? 1.5 : 1);
            this.sfxAt(e.armor ? "armor" : back ? "backstab" : "hit", at, 0.7);
            if (e.by === this.localId) {
              this.heroViews.get(this.localId)?.hitPause(e.heavy || back ? 90 : 55);
              if (e.heavy || back) this.shake(60, 0.0025);
            }
          }
          break;
        }
        case "block": {
          const at = this.viewFor(e.id)?.position ?? e;
          this.effects.sparks(at.x, at.y, e.broke ? colors.health : colors.stamina, e.broke ? 14 : 8);
          this.sfxAt(e.broke ? "guardBreak" : "block", at, 0.8);
          if (e.id === this.localId && e.broke) {
            this.shake(160, 0.008);
            this.hud.emit("guardbreak");
          }
          break;
        }
        case "dodge": {
          const v = this.viewFor(e.id);
          v?.afterimage();
          if (v) this.sfxAt("dodge", v.position, 0.6);
          break;
        }
        case "death": {
          const v = this.viewFor(e.id);
          if (this.heroViews.has(e.id)) {
            playSfx("down", { volume: 0.7 });
          } else {
            this.effects.corpse(e.x, e.y, enemyTextureKey(e.kind), v?.root.rotation ?? 0);
            this.effects.blood(e.x, e.y, 1.5);
            this.sfxAt("squeak", e, 0.5);
          }
          break;
        }
        case "tracer":
          this.effects.tracer(e.x1, e.y1, e.x2, e.y2, e.kind);
          this.sfxAt(e.kind === "bullet" ? "bullet" : e.kind === "arrow" ? "arrow" : "gun", { x: e.x1, y: e.y1 }, e.kind === "bullet" ? 0.4 : 0.8);
          break;
        case "push":
          this.effects.pushArc(e.x, e.y, e.facing);
          this.sfxAt("push", e, 0.7);
          break;
        case "down": {
          const p = this.room?.state.players.get(e.id);
          playSfx("down", { volume: 0.8 });
          if (p) this.hud.emit("announce", { text: e.id === this.localId ? "You are down! Hold on..." : `${p.name} is down! Hold E to revive`, kind: "info" } satisfies Announcement);
          break;
        }
        case "revive":
          playSfx("revive", { volume: 0.7 });
          break;
        case "grab":
          this.sfxAt("chain", this.viewFor(e.id)?.position ?? this.localPosition, 1);
          break;
        case "release":
          break;
        case "ult": {
          const color = e.ult === "rally" ? colors.accent : e.ult === "volley" ? colors.success : e.ult === "impenetrable" ? colors.accent : 0xc070e0;
          this.effects.ring(e.x, e.y, color, e.ult === "rally" ? 220 : 90, 500);
          this.sfxAt("ult", e, 0.9);
          break;
        }
        case "pickup":
          if (e.id === this.localId) playSfx("pickup", { volume: 0.8 });
          break;
        case "gasburst":
          this.effects.gasBurst(e.x, e.y, 72);
          this.sfxAt("gas", e, 0.9);
          break;
        case "announce":
          this.hud.emit("announce", { text: e.text, kind: e.kind } satisfies Announcement);
          if (e.kind === "horde") {
            playSfx("horn", { volume: 0.9 });
            this.music.combat(40);
          } else if (e.kind === "boss") {
            playSfx("roar", { volume: 1 });
            this.music.combat(90);
          } else if (e.kind === "event") {
            playSfx("horn", { volume: 0.8 });
            this.music.combat(55);
          } else if (e.kind === "special") {
            playSfx("alert", { volume: 0.7 });
          }
          break;
      }
    }
  }
}
