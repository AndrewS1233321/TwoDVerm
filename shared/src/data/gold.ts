import type { EnemyId } from "./types";
import { ENEMIES } from "./enemies";

export interface GoldDropTable {
  /** Chance 0–1 that a kill drops gold. */
  chance: number;
  /** Inclusive minimum GP before party split. */
  min: number;
  /** Inclusive maximum GP before party split. */
  max: number;
}

/** Non-boss combat drops are always 1–5 GP before splitting. */
const MOB_AMOUNT = { min: 1, max: 5 } as const;

export const GOLD_DROPS: Record<EnemyId, GoldDropTable> = {
  slave: { chance: 0.05, ...MOB_AMOUNT },
  clanrat: { chance: 0.1, ...MOB_AMOUNT },
  shieldClanrat: { chance: 0.1, ...MOB_AMOUNT },
  stormvermin: { chance: 0.15, ...MOB_AMOUNT },
  shieldStormvermin: { chance: 0.15, ...MOB_AMOUNT },
  plagueMonk: { chance: 0.15, ...MOB_AMOUNT },
  gunner: { chance: 0.5, ...MOB_AMOUNT },
  gas: { chance: 0.5, ...MOB_AMOUNT },
  hooker: { chance: 0.5, ...MOB_AMOUNT },
  gutterRunner: { chance: 0.5, ...MOB_AMOUNT },
  warpfire: { chance: 0.5, ...MOB_AMOUNT },
  sackRat: { chance: 1, min: 30, max: 60 },
  ogre: { chance: 1, min: 100, max: 200 },
  stormfiend: { chance: 1, min: 100, max: 200 },
  dummy: { chance: 0, min: 0, max: 0 },
  dummyLight: { chance: 0, min: 0, max: 0 },
  dummyMedium: { chance: 0, min: 0, max: 0 },
  dummyHeavy: { chance: 0, min: 0, max: 0 },
  dummySuperHeavy: { chance: 0, min: 0, max: 0 },
  merchant: { chance: 0, min: 0, max: 0 },
};

/** Roll a gold drop for this enemy. Returns 0 when nothing drops. */
export function rollGoldDrop(enemyId: EnemyId, rng: () => number): number {
  const table = GOLD_DROPS[enemyId] ?? goldDropForDef(enemyId);
  if (table.chance <= 0 || rng() >= table.chance) return 0;
  if (table.max <= table.min) return table.min;
  return table.min + Math.floor(rng() * (table.max - table.min + 1));
}

/** Fallback for unknown ids using elite/special/boss flags. */
function goldDropForDef(enemyId: EnemyId): GoldDropTable {
  const def = ENEMIES[enemyId];
  if (!def || def.behavior === "dummy") return { chance: 0, min: 0, max: 0 };
  if (def.behavior === "boss") return { chance: 1, min: 100, max: 200 };
  if (def.special) return { chance: 0.5, ...MOB_AMOUNT };
  if (def.elite) return { chance: 0.15, ...MOB_AMOUNT };
  return { chance: 0.05, ...MOB_AMOUNT };
}

/**
 * Split `total` GP across `n` players. Remainder GP go one each to the
 * earliest recipients so nothing is lost.
 */
export function splitGoldEvenly(total: number, n: number): number[] {
  if (total <= 0 || n <= 0) return [];
  const base = Math.floor(total / n);
  let rem = total % n;
  const shares = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    shares[i] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return shares;
}
