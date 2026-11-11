import { angleTo, dist, type InputMessage } from "@twodverm/shared";
import type { Enemy, Hero } from "./types";
import type { World } from "./World";

/** Per-AI combat mode (melee vs ranged preference). */
export interface AiHeroBrain {
  seq: number;
  ranged: boolean;
}

/**
 * Simple teammate AI: revive downed allies, fight nearby enemies, otherwise
 * follow the nearest human. Mirrors `scripts/bot-friend.ts` think().
 */
export function thinkAiHero(world: World, me: Hero, brain: AiHeroBrain): InputMessage {
  brain.seq++;
  const input: InputMessage = {
    seq: brain.seq,
    mx: 0,
    my: 0,
    aim: me.facing,
    aimX: me.x,
    aimY: me.y,
    attack: false,
    block: false,
    interact: false,
    dodge: false,
    fire: false,
    ult: false,
  };
  if (world.phase !== "playing" && world.phase !== "merchant") return input;
  if (me.state === "dead" || me.state === "downed" || me.state === "grabbed") return input;

  const others = [...world.heroes.values()].filter((h) => h.id !== me.id && h.state !== "dead");
  let nearest: Enemy | null = null;
  let nd = Infinity;
  for (const e of world.enemies.values()) {
    if (e.def.behavior === "dummy") continue;
    const d = dist(me.x, me.y, e.x, e.y);
    if (d < nd) {
      nd = d;
      nearest = e;
    }
  }

  const downed = others.find((h) => h.state === "downed");
  if (downed && (!nearest || nd > 70)) {
    if (brain.ranged) {
      input.fire = true;
      brain.ranged = false;
    }
    const d = dist(me.x, me.y, downed.x, downed.y);
    if (d > 40) {
      input.mx = (downed.x - me.x) / d;
      input.my = (downed.y - me.y) / d;
    }
    input.aim = angleTo(me.x, me.y, downed.x, downed.y);
    input.aimX = downed.x;
    input.aimY = downed.y;
    input.interact = d < 50;
    return input;
  }

  if (nearest && nd < 260) {
    input.aim = angleTo(me.x, me.y, nearest.x, nearest.y);
    input.aimX = nearest.x;
    input.aimY = nearest.y;
    if (nd > 46) {
      input.mx = (nearest.x - me.x) / nd;
      input.my = (nearest.y - me.y) / nd;
    }
    const wantRanged = nd > 120;
    if (wantRanged !== brain.ranged) {
      input.fire = true;
      brain.ranged = wantRanged;
    }
    const threatened = !brain.ranged && nearest.state === "attack" && nearest.attack?.phase === "active" && nd < 70;
    if (threatened) input.block = true;
    else if (brain.ranged) input.attack = true;
    else input.attack = nd < 70 && brain.seq % 12 < 2;
    return input;
  }

  if (brain.ranged) {
    input.fire = true;
    brain.ranged = false;
  }
  const humans = others.filter((h) => !h.id.startsWith("ai-"));
  const leader =
    (humans.length > 0 ? humans : others).sort((a, b) => dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y))[0];
  if (leader) {
    const d = dist(me.x, me.y, leader.x, leader.y);
    if (d > 80) {
      input.mx = (leader.x - me.x) / d;
      input.my = (leader.y - me.y) / d;
    }
    input.aim = angleTo(me.x, me.y, leader.x, leader.y);
    input.aimX = leader.x;
    input.aimY = leader.y;
  }
  return input;
}
