import { ENEMIES, COMBAT_ENEMY_IDS } from "../data/enemies";
import type { CombatEnemyId, EnemyId } from "../data/types";
import type { CreatureRace, LevelProperties } from "./types";

/** Combat enemies that belong to a race (dummies/merchant excluded). */
export function combatEnemiesOfRace(race: CreatureRace): CombatEnemyId[] {
  return COMBAT_ENEMY_IDS.filter((id) => ENEMIES[id].race === race);
}

/**
 * Resolves which combat enemies may spawn for these props.
 * Non-skaven races have no kits yet — fall back to the skaven pool.
 */
export function enemiesForRaces(props: LevelProperties): {
  horde: CombatEnemyId[];
  elite: CombatEnemyId[];
  special: CombatEnemyId[];
  boss: CombatEnemyId;
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
  const uniq = [...new Set(pools)];
  const horde = uniq.filter((id) => !ENEMIES[id].elite && !ENEMIES[id].special && ENEMIES[id].behavior === "melee");
  const elite = uniq.filter((id) => ENEMIES[id].elite);
  const special = uniq.filter((id) => ENEMIES[id].special);
  const bosses = uniq.filter((id) => ENEMIES[id].behavior === "boss");
  return {
    horde: horde.length > 0 ? horde : (["slave", "clanrat"] as CombatEnemyId[]),
    elite: elite.length > 0 ? elite : (["stormvermin"] as CombatEnemyId[]),
    special: special.length > 0 ? special : (["gunner", "gas", "hooker"] as CombatEnemyId[]),
    boss: bosses[0] ?? "ogre",
    usedFallback,
  };
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
  return pools.horde[Math.floor(rng() * pools.horde.length)]!;
}
