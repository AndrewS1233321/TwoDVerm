import { moveCircle } from "./collision";
import type { Level } from "./level";
import { turnTowards } from "./math";
import type { InputMessage } from "./messages";
import { DODGE } from "./tuning";

/** The parts of a hero that both the server and the client's prediction move. */
export interface MoveBody {
  x: number;
  y: number;
  facing: number;
  dodgeT: number;
  dodgeDx: number;
  dodgeDy: number;
  dodgeSpeed: number;
}

/** Limits decided by the server from the hero's state, synced so the client predicts with the same values. */
export interface MoveMods {
  radius: number;
  /** Effective movement speed in px/s for the current state. */
  speed: number;
  /** Turn rate in radians per second for the current state. */
  turnRate: number;
  canDodge: boolean;
  /** Speed of a dodge started this input (armor can shorten dodges). */
  dodgeSpeed: number;
}

/**
 * Advances a hero body by one input. Returns true if this input started a dodge,
 * so the server can spend a dodge charge.
 */
export function stepMovement(
  body: MoveBody,
  input: InputMessage,
  mods: MoveMods,
  level: Level,
  gateOpen: boolean,
  dt: number,
): boolean {
  let started = false;
  let mx = input.mx;
  let my = input.my;
  const mlen = Math.hypot(mx, my);
  if (mlen > 1) {
    mx /= mlen;
    my /= mlen;
  }

  if (input.dodge && mods.canDodge && body.dodgeT <= 0) {
    if (mlen > 0.1) {
      body.dodgeDx = input.mx / mlen;
      body.dodgeDy = input.my / mlen;
    } else {
      body.dodgeDx = -Math.cos(body.facing);
      body.dodgeDy = -Math.sin(body.facing);
    }
    body.dodgeT = DODGE.time;
    body.dodgeSpeed = mods.dodgeSpeed;
    started = true;
  }

  let vx: number;
  let vy: number;
  if (body.dodgeT > 0) {
    vx = body.dodgeDx * body.dodgeSpeed;
    vy = body.dodgeDy * body.dodgeSpeed;
    body.dodgeT = Math.max(0, body.dodgeT - dt);
  } else {
    vx = mx * mods.speed;
    vy = my * mods.speed;
  }

  body.facing = turnTowards(body.facing, input.aim, mods.turnRate * dt);
  const p = moveCircle(level, gateOpen, body.x, body.y, mods.radius, vx * dt, vy * dt);
  body.x = p.x;
  body.y = p.y;
  return started;
}
