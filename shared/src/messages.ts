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
  /** Merchant hall: buy and equip a full hero armor set by id. */
  buyArmorSet: "buyArmorSet",
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
  /** World-space cursor position (used for precision ranged shots). */
  aimX: number;
  aimY: number;
  /** Held buttons. */
  attack: boolean;
  block: boolean;
  interact: boolean;
  /** Pressed since the previous input. */
  dodge: boolean;
  /** Pressed since the previous input: toggles melee / ranged weapon. */
  fire: boolean;
  /**
   * Ultimate button. Held while F is down (Elvish Wrath charges on hold;
   * other ults still fire on the press edge).
   */
  ult: boolean;
}

export interface SelectHeroMessage {
  heroId: HeroId;
}

export interface JoinOptions {
  name: string;
  /** Host-only; ignored when joining an existing room. */
  gameMode?: GameMode;
  /**
   * Host-only Wastes option. When true, the run starts in the merchant hall
   * with DEV_TEST_START_GOLD for every hero (before the first map vote).
   */
  devTest?: boolean;
}

export type GamePhase = "lobby" | "expedition" | "merchant" | "playing" | "victory" | "defeat";

export type HitSide = "front" | "side" | "back";

/** One-off events the server broadcasts each tick for effects and sounds. */
export type FxEvent =
  | { t: "hit"; id: string; by: string; x: number; y: number; dmg: number; side: HitSide; head?: boolean; armor: boolean; heavy: boolean; crit?: boolean }
  | { t: "block"; id: string; x: number; y: number; broke: boolean }
  | { t: "dodge"; id: string }
  | { t: "death"; id: string; x: number; y: number; kind: string; by: string }
  | { t: "tracer"; x1: number; y1: number; x2: number; y2: number; kind: "bullet" | "arrow" | "gun" }
  /** Precision shot impact at the aim point (no travel path). */
  | { t: "impact"; x: number; y: number; kind: "arrow" | "gun" }
  | { t: "push"; id: string; x: number; y: number; facing: number }
  | { t: "down"; id: string }
  | { t: "revive"; id: string }
  | { t: "grab"; id: string; by: string }
  | { t: "release"; id: string }
  | { t: "ult"; id: string; ult: string; x: number; y: number }
  /** Kerri Elvish Wrath reached maximum charge. */
  | { t: "wrathMax"; id: string; x: number; y: number }
  /** Longbow reached full draw (hip-fire). */
  | { t: "bowDrawn"; id: string; x: number; y: number }
  | { t: "pickup"; id: string; kind: string }
  | { t: "gasburst"; x: number; y: number }
  | { t: "portal"; x: number; y: number }
  | { t: "gold"; x: number; y: number; amount: number }
  /** Opens the merchant shop UI for this player. */
  | { t: "shop"; id: string }
  /** A hero's Rune Ward absorbed a hit. */
  | { t: "ward"; id: string; x: number; y: number }
  /** Wastes set piece: cannon fired, wall breached, bell rung, or the bell's clearing blast. */
  | { t: "setpiece"; kind: "cannon" | "breach" | "bell" | "hammer"; x: number; y: number }
  /** Brief white flash of an attack arc (Plague Monk dash strikes). */
  | { t: "slashflash"; x: number; y: number; facing: number; reach: number; arc: number }
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
  const aimX = isFiniteNumber(r.aimX) ? r.aimX : 0;
  const aimY = isFiniteNumber(r.aimY) ? r.aimY : 0;
  return {
    seq: Math.floor(r.seq),
    mx,
    my,
    aim: r.aim,
    aimX,
    aimY,
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
