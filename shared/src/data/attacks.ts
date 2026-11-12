import { ENEMIES } from "./enemies";
import { HEROES } from "./heroes";
import { SHOP_WEAPONS } from "./shopWeapons";
import type { AttackDef } from "./types";

const byId = new Map<string, AttackDef>();
for (const hero of Object.values(HEROES)) {
  for (const a of [...hero.weapon.light, ...hero.weapon.heavy]) byId.set(a.id, a);
}
for (const w of Object.values(SHOP_WEAPONS)) {
  if (w.slot !== "primary") continue;
  for (const a of [...w.melee.light, ...w.melee.heavy]) byId.set(a.id, a);
}
for (const enemy of Object.values(ENEMIES)) {
  for (const a of enemy.attacks) byId.set(a.id, a);
}

/** Looks up any hero or enemy attack by id (the client uses this to animate synced attacks). */
export function getAttack(id: string): AttackDef | undefined {
  return byId.get(id);
}
