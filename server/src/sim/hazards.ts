import { dist, GAS } from "@twodverm/shared";
import { damageEnemy, damageHero } from "./damage";
import type { World } from "./World";

export function updateHazards(world: World, dt: number): void {
  for (const hz of [...world.hazards.values()]) {
    hz.timeLeft -= dt;
    if (hz.kind === "smoke") {
      if (hz.timeLeft <= 0) world.hazards.delete(hz.id);
      continue;
    }
    if (hz.kind === "globe") {
      if (hz.timeLeft <= 0) {
        hz.kind = "gas";
        hz.timeLeft = GAS.cloudTime;
        hz.duration = GAS.cloudTime;
        world.emit({ t: "gasburst", x: hz.x, y: hz.y });
      }
      continue;
    }
    if (hz.timeLeft <= 0) {
      world.hazards.delete(hz.id);
      continue;
    }
    for (const h of world.heroes.values()) {
      if (h.state === "dead") continue;
      if (dist(h.x, h.y, hz.x, hz.y) <= hz.radius + h.radius * 0.5) damageHero(world, h, GAS.heroDps * dt);
    }
    for (const e of [...world.enemies.values()]) {
      if (e.def.behavior === "gas" || e.def.behavior === "boss") continue;
      if (dist(e.x, e.y, hz.x, hz.y) > hz.radius) continue;
      e.hp -= GAS.enemyDps * dt;
      if (e.hp <= 0) damageEnemy(world, null, e, { damage: 1, stagger: 0, srcX: hz.x, srcY: hz.y });
    }
  }
}
