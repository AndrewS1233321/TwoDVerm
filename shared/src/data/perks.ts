import type { HeroId } from "./types";

export type PerkId = "rune_ward" | "smoke_bomb" | "riposte" | "no_retreating";

export interface PerkDef {
  id: PerkId;
  name: string;
  description: string;
  cost: number;
  /** Heroes that may be offered this perk. */
  heroIds: HeroId[];
  /** Perks that must already be owned before this one is offered. */
  requires?: PerkId[];
  /** Owning any of these perks blocks this one from being offered. */
  excludes?: PerkId[];
}

export const PERK_COST = 50;

/** Bardin's ward: fully blocks one discrete hit, then recharges. */
export const RUNE_WARD = {
  cooldown: 20,
} as const;

/**
 * Kerri's dodge drops smoke, then she vanishes.
 * Cloud radius is `radiusDiameters` times her body diameter (2 × radius).
 */
export const SMOKE_BOMB = {
  radiusDiameters: 2.5,
  /** How long the cloud stays on the ground. */
  cloudTime: 0.75,
  /** Stagger applied to enemies standing in the cloud. No damage. */
  staggerTime: 0.45,
  /** Invisibility after the dodge finishes. */
  invisTime: 1.5,
} as const;

/** Smoke cloud radius in world pixels for a hero of the given body radius. */
export function smokeCloudRadius(heroRadius: number): number {
  return SMOKE_BOMB.radiusDiameters * heroRadius * 2;
}

/** Viktor: after a dodge (not his ult dash), the next melee strike is extended and critical. */
export const RIPOSTE = {
  /** Multiplier applied to attack reach (and thrust / lunge for feel). */
  reachMul: 2,
  /** Damage multiplier for the guaranteed critical hit. */
  critMul: 2,
} as const;

/**
 * Markus: dodge body-checks stagger enemies. Strength scales with how far
 * through the dodge the contact happens (weak at the start, heavy at the end).
 */
export const NO_RETREATING = {
  /** Extra reach beyond overlapping body radii. */
  pad: 8,
  staggerTimeMin: 0.12,
  staggerTimeMax: 1.55,
  knockbackMin: 70,
  knockbackMax: 520,
} as const;

/** 0 at dodge start → 1 at dodge end (ease-in so the finish hits much harder). */
export function noRetreatingWeight(dodgeTRemaining: number, dodgeDuration: number): number {
  if (dodgeDuration <= 0) return 1;
  const progress = Math.max(0, Math.min(1, 1 - dodgeTRemaining / dodgeDuration));
  return progress * progress;
}

export const PERKS: Record<PerkId, PerkDef> = {
  rune_ward: {
    id: "rune_ward",
    name: "Rune Ward",
    description: "Every 20s, a ward fully blocks one hit.",
    cost: PERK_COST,
    heroIds: ["dwarf"],
  },
  smoke_bomb: {
    id: "smoke_bomb",
    name: "Smoke Bomb",
    description: "Dodging drops smoke that briefly staggers enemies. When the dodge ends you vanish for 1.5s, and enemies stop chasing you.",
    cost: PERK_COST,
    heroIds: ["ranger"],
  },
  riposte: {
    id: "riposte",
    name: "Riposte",
    description: "After a dodge, your next melee attack has double reach and is a guaranteed critical hit. Does not trigger from your ultimate.",
    cost: PERK_COST,
    heroIds: ["hunter"],
  },
  no_retreating: {
    id: "no_retreating",
    name: "No retreating",
    description: "While dodging, enemies you barge into are staggered. Hits late in the dodge stagger much harder than hits at the start.",
    cost: PERK_COST,
    heroIds: ["soldier"],
  },
};

export const PERK_IDS = Object.keys(PERKS) as PerkId[];

export function isPerkId(v: unknown): v is PerkId {
  return typeof v === "string" && v in PERKS;
}

/** Every perk this hero can access, owned or not (shop listing order). */
export function perksForHero(heroId: string): PerkDef[] {
  return PERK_IDS.map((id) => PERKS[id]).filter((p) => (p.heroIds as string[]).includes(heroId));
}

/** Perks the merchant offers this visit: eligible, unowned, dependencies satisfied. */
export function perksOfferedFor(heroId: string, owned: ReadonlySet<PerkId>): PerkDef[] {
  return perksForHero(heroId).filter((p) => {
    if (owned.has(p.id)) return false;
    if (p.requires && !p.requires.every((r) => owned.has(r))) return false;
    if (p.excludes && p.excludes.some((x) => owned.has(x))) return false;
    return true;
  });
}

export function serializePerks(perks: Iterable<PerkId>): string {
  return [...perks].sort().join(",");
}

export function parsePerks(raw: string | undefined | null): Set<PerkId> {
  const out = new Set<PerkId>();
  if (!raw) return out;
  for (const part of raw.split(",")) {
    if (isPerkId(part)) out.add(part);
  }
  return out;
}
