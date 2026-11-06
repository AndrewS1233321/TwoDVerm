import type { HeroId } from "./data/types";
import { clamp, isFiniteNumber } from "./math";

export const MSG = {
  input: "input",
  selectHero: "selectHero",
  start: "start",
  returnToLobby: "returnToLobby",
  fx: "fx",
} as const;

/** One fixed-step (1/TICK_RATE s) sample of a player's controls. */
export interface InputMessage {
  seq: number;
  /** Movement direction, length at most 1. */
  mx: number;
  my: number;
  /** World-space aim angle in radians. */
  aim: number;
  /** Held buttons. */
  attack: boolean;
  block: boolean;
  interact: boolean;
  /** Pressed since the previous input. */
  dodge: boolean;
  fire: boolean;
  ult: boolean;
}

export interface SelectHeroMessage {
  heroId: HeroId;
}

export interface JoinOptions {
  name: string;
}

export type GamePhase = "lobby" | "playing" | "victory" | "defeat";

export type HitSide = "front" | "side" | "back";

/** One-off events the server broadcasts each tick for effects and sounds. */
export type FxEvent =
  | { t: "hit"; id: string; by: string; x: number; y: number; dmg: number; side: HitSide; armor: boolean; heavy: boolean }
  | { t: "block"; id: string; x: number; y: number; broke: boolean }
  | { t: "dodge"; id: string }
  | { t: "death"; id: string; x: number; y: number; kind: string; by: string }
  | { t: "tracer"; x1: number; y1: number; x2: number; y2: number; kind: "bullet" | "arrow" | "gun" }
  | { t: "push"; id: string; x: number; y: number; facing: number }
  | { t: "down"; id: string }
  | { t: "revive"; id: string }
  | { t: "grab"; id: string; by: string }
  | { t: "release"; id: string }
  | { t: "ult"; id: string; ult: string; x: number; y: number }
  | { t: "pickup"; id: string; kind: string }
  | { t: "gasburst"; x: number; y: number }
  | { t: "announce"; text: string; kind: "horde" | "event" | "boss" | "info" | "special" };

export function sanitizeInput(raw: unknown): InputMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isFiniteNumber(r.seq) || !isFiniteNumber(r.mx) || !isFiniteNumber(r.my) || !isFiniteNumber(r.aim)) return null;
  let mx = clamp(r.mx, -1, 1);
  let my = clamp(r.my, -1, 1);
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return {
    seq: Math.floor(r.seq),
    mx,
    my,
    aim: r.aim,
    attack: r.attack === true,
    block: r.block === true,
    interact: r.interact === true,
    dodge: r.dodge === true,
    fire: r.fire === true,
    ult: r.ult === true,
  };
}

export function sanitizeName(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const cleaned = s.replace(/[^\p{L}\p{N} _\-.]/gu, "").trim().slice(0, 16);
  return cleaned || "Hero";
}
