import type { HeroId } from "./data/types";
import type { GameMode } from "./gameMode";
import { clamp, isFiniteNumber } from "./math";

export const MSG = {
  input: "input",
  selectHero: "selectHero",
  start: "start",
  returnToLobby: "returnToLobby",
  /** Gingey Wastes: vote for a Holseher's Map location. */
  voteLocation: "voteLocation",
  /** Gingey Wastes: host confirms travel after votes. */
  travel: "travel",
  /** Merchant hall: buy a shop item by id. */
  buyShopItem: "buyShopItem",
  /** Merchant hall: buy a hero perk by id. */
  buyPerk: "buyPerk",
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
  /** Pressed since the previous input: toggles melee / ranged weapon. */
  fire: boolean;
  ult: boolean;
}

export interface SelectHeroMessage {
  heroId: HeroId;
}

export interface JoinOptions {
  name: string;
  /** Host-only; ignored when joining an existing room. */
  gameMode?: GameMode;
}

export type GamePhase = "lobby" | "expedition" | "merchant" | "playing" | "victory" | "defeat";

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
  | { t: "gold"; x: number; y: number; amount: number }
  /** Opens the merchant shop UI for this player. */
  | { t: "shop"; id: string }
  /** A hero's Rune Ward absorbed a hit. */
  | { t: "ward"; id: string; x: number; y: number }
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
