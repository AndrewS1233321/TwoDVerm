import { ENEMIES, COMBAT_ENEMY_IDS } from "../data/enemies";
import type { CombatEnemyId, EnemyId } from "../data/types";
import type { CreatureRace, LevelProperties } from "./types";

/** Combat enemies that belong to a race (dummies/merchant excluded). */
export function combatEnemiesOfRace(race: CreatureRace): CombatEnemyId[] {
  return COMBAT_ENEMY_IDS.filter((id) => ENEMIES[id].race === race);
}

/**
 * Resolves which combat enemies may spawn for these props.
 * Races with no combat kits yet fall back to the skaven pool (Chaos is live).
 */
export function enemiesForRaces(props: LevelProperties): {
  horde: CombatEnemyId[];
  elite: CombatEnemyId[];
  special: CombatEnemyId[];
  boss: CombatEnemyId;
  bosses: CombatEnemyId[];
  usedFallback: boolean;
} {
  const races = uniqueRaces(props);
  let usedFallback = false;
  const pools: CombatEnemyId[] = [];
  for (const race of races) {
    const list = combatEnemiesOfRace(race);
    if (list.length === 0) {
      usedFallback = true;
      pools.push(...combatEnemiesOfRace("skaven"));
    } else {
      pools.push(...list);
    }
  }
  const uniq = [...new Set(pools)].filter((id) => !ENEMIES[id].ultraElite);
  const shieldVariants = new Set(Object.values(SHIELD_VARIANTS));
  const horde = uniq.filter(
    (id) => !ENEMIES[id].elite && !ENEMIES[id].special && ENEMIES[id].behavior === "melee" && !shieldVariants.has(id),
  );
  const elite = uniq.filter((id) => ENEMIES[id].elite);
  const special = uniq.filter((id) => ENEMIES[id].special);
  const bosses = uniq.filter((id) => ENEMIES[id].behavior === "boss");
  return {
    horde: horde.length > 0 ? horde : (["slave", "clanrat"] as CombatEnemyId[]),
    elite: elite.length > 0 ? elite : (["stormvermin"] as CombatEnemyId[]),
    special: special.length > 0 ? special : (["gunner", "gas", "hooker", "gutterRunner", "warpfire"] as CombatEnemyId[]),
    boss: bosses[0] ?? "ogre",
    bosses: bosses.length > 0 ? bosses : ["ogre"],
    usedFallback,
  };
}

/** Horde types that sometimes spawn carrying a shield. */
export const SHIELD_VARIANTS: Partial<Record<CombatEnemyId, CombatEnemyId>> = {
  clanrat: "shieldClanrat",
  raider: "bulwark",
};
/** Share of shield-capable horde picks that come with a shield. */
export const SHIELD_VARIANT_CHANCE = 0.2;

export function maybeShielded(id: EnemyId, rng: () => number): EnemyId {
  const shielded = SHIELD_VARIANTS[id as CombatEnemyId];
  return shielded && rng() < SHIELD_VARIANT_CHANCE ? shielded : id;
}

function uniqueRaces(props: LevelProperties): CreatureRace[] {
  const set = new Set<CreatureRace>([props.primaryRace, ...props.allowableRaces]);
  return [...set];
}

export function pickAmbientType(
  pools: ReturnType<typeof enemiesForRaces>,
  eliteChance: number,
  rng: () => number,
): EnemyId {
  if (rng() < eliteChance && pools.elite.length > 0) {
    return pools.elite[Math.floor(rng() * pools.elite.length)]!;
  }
  return maybeShielded(pools.horde[Math.floor(rng() * pools.horde.length)]!, rng);
}
