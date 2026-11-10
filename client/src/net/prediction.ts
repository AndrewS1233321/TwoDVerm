import {
  confineToBossRoom,
  DODGE,
  DT,
  HEROES,
  isHeroId,
  stepMovement,
  type InputMessage,
  type Level,
  type MoveBody,
  type MoveMods,
} from "@twodverm/shared";
import type { PlayerView } from "./types";

const SNAP_DISTANCE = 96;
const SMOOTHING_PER_SEC = 14;

/**
 * Client-side prediction for the local hero: inputs move the hero immediately using the
 * shared movement rules, then each server update replays the inputs the server has not
 * processed yet on top of the server's position.
 */
export class Predictor {
  readonly body: MoveBody = { x: 0, y: 0, facing: 0, dodgeT: 0, dodgeDx: 0, dodgeDy: 0, dodgeSpeed: 0 };
  /** Visual-only offset that eases out small corrections instead of snapping. */
  readonly offset = { x: 0, y: 0 };
  private pending: InputMessage[] = [];
  private seq = 0;
  private mods: MoveMods = { radius: 14, speed: 0, turnRate: 0, canDodge: false, dodgeSpeed: DODGE.speed };
  private initialised = false;

  nextSeq(): number {
    return ++this.seq;
  }

  /** Applies a just-sent input locally. */
  apply(input: InputMessage, level: Level, gateOpen: boolean, bossLocked = false): void {
    if (!this.initialised) return;
    this.pending.push(input);
    const started = stepMovement(this.body, input, this.mods, level, gateOpen, DT);
    if (started) this.mods.canDodge = false;
    if (bossLocked) this.confine(level);
  }

  reconcile(p: PlayerView, level: Level, gateOpen: boolean, bossLocked = false): void {
    this.mods = {
      radius: isHeroId(p.heroId) ? HEROES[p.heroId].radius : 14,
      speed: p.moveSpeed,
      turnRate: p.turnRate,
      canDodge: p.canDodge,
      dodgeSpeed: p.dodgeBaseSpeed || DODGE.speed,
    };
    const before = { x: this.body.x, y: this.body.y };
    if (!this.initialised) this.seq = Math.max(this.seq, p.ackSeq);
    this.pending = this.pending.filter((i) => i.seq > p.ackSeq);

    Object.assign(this.body, {
      x: p.x,
      y: p.y,
      facing: p.facing,
      dodgeT: p.dodgeT,
      dodgeDx: p.dodgeDx,
      dodgeDy: p.dodgeDy,
      dodgeSpeed: p.dodgeSpeed,
    });
    const mods = { ...this.mods };
    for (const input of this.pending) {
      if (stepMovement(this.body, input, mods, level, gateOpen, DT)) mods.canDodge = false;
      if (bossLocked) this.confine(level);
    }
    this.mods.canDodge = mods.canDodge;

    if (this.initialised) {
      const dx = before.x - this.body.x;
      const dy = before.y - this.body.y;
      if (Math.hypot(dx, dy) > SNAP_DISTANCE) {
        this.offset.x = 0;
        this.offset.y = 0;
      } else {
        this.offset.x += dx;
        this.offset.y += dy;
      }
    }
    this.initialised = true;
  }

  decay(dtSec: number): void {
    const k = Math.exp(-SMOOTHING_PER_SEC * dtSec);
    this.offset.x *= k;
    this.offset.y *= k;
  }

  reset(): void {
    this.pending = [];
    this.initialised = false;
    this.offset.x = 0;
    this.offset.y = 0;
  }

  private confine(level: Level): void {
    const p = confineToBossRoom(level, this.body.x, this.body.y, this.mods.radius);
    this.body.x = p.x;
    this.body.y = p.y;
  }
}
