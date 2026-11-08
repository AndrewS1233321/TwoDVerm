import type { HeroId } from "./types";

export type PerkId = "rune_ward";

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

export const PERKS: Record<PerkId, PerkDef> = {
  rune_ward: {
    id: "rune_ward",
    name: "Rune Ward",
    description: "Every 20s, a ward fully blocks one hit.",
    cost: PERK_COST,
    heroIds: ["dwarf"],
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
