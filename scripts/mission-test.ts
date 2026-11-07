/**
 * Offline checks of enemies, specials, pacing, the event, the boss and win/lose, run straight
 * on the server simulation (no network):
 *   npm run mission-test
 */
import { dist, DOWNED, DT, HEROES, TILE_SIZE, tileCenter, type FxEvent, type HeroId, type InputMessage, type Point } from "@twodverm/shared";
import { damageEnemy, downHero } from "../server/src/sim/damage";
import type { Hero } from "../server/src/sim/types";
import { World } from "../server/src/sim/World";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

let seq = 0;
function setup(ids: HeroId[], keepEnemies = false): { world: World; heroes: Hero[] } {
  const world = new World(11);
  const heroes = ids.map((id, i) => world.addHero(`h${i}`, `Hero ${i}`, HEROES[id]));
  world.startMission();
  if (!keepEnemies) world.enemies.clear();
  return { world, heroes };
}

const idle = (): InputMessage => ({ seq: ++seq, mx: 0, my: 0, aim: 0, attack: false, block: false, interact: false, dodge: false, fire: false, ult: false });

/** Steps the world; `each` runs before every tick and can set inputs or keep heroes alive. */
function run(world: World, seconds: number, each?: () => void): FxEvent[] {
  const all: FxEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    for (const h of world.heroes.values()) h.inputs.push(idle());
    each?.();
    world.fx = [];
    world.step(DT);
    all.push(...world.fx);
  }
  return all;
}

function immortal(world: World): void {
  for (const h of world.heroes.values()) {
    if (h.state === "dead" || h.state === "downed") continue;
    h.hp = h.def.hp;
  }
}

function zonePoint(zone: Set<number>, width: number): Point {
  const i = [...zone][Math.floor(zone.size / 2)]!;
  return tileCenter(i % width, Math.floor(i / width));
}

function place(h: Hero, p: Point): void {
  h.x = p.x;
  h.y = p.y;
}

// Downed heroes bleed out, can be revived, and the dead respawn later.
{
  const { world, heroes } = setup(["soldier", "dwarf"]);
  const [a, b] = heroes as [Hero, Hero];
  place(b, { x: a.x + 30, y: a.y });
  downHero(world, b);
  run(world, 2);
  check("Downed hero bleeds", b.downHp < DOWNED.hp, `downHp ${b.downHp.toFixed(1)}`);
  run(world, DOWNED.reviveTime + 0.3, () => {
    const last = a.inputs[a.inputs.length - 1]!;
    last.interact = true;
  });
  check("Holding E next to a downed teammate revives them", b.state === "idle" && b.hp > 0, `state ${b.state}, hp ${b.hp.toFixed(0)}`);

  downHero(world, b);
  b.downHp = 0.5;
  run(world, 1);
  check("Bleeding out kills the hero", b.state === "dead", `state ${b.state}`);
  run(world, DOWNED.respawnTime + 1, () => immortal(world));
  check("Dead hero respawns while a teammate stands", b.state !== "dead" && b.hp > 0, `state ${b.state}`);
}

// Medical supplies heal and are used up.
{
  const { world, heroes } = setup(["soldier"]);
  const h = heroes[0]!;
  const med = [...world.pickups.values()].find((p) => p.kind === "med")!;
  place(h, med);
  h.hp = 20;
  run(world, DT * 2, () => (h.inputs[h.inputs.length - 1]!.interact = true));
  check("Medical supplies heal", h.hp > 20 && med.used, `hp ${h.hp.toFixed(0)}, used ${med.used}`);
}

// Rats find a path to the heroes through the level.
{
  const { world, heroes } = setup(["soldier"]);
  const h = heroes[0]!;
  const spawn = world.level.hordeSpawns.map((p) => ({ p, d: dist(p.x, p.y, h.x, h.y) })).sort((x, y) => x.d - y.d)[0]!;
  const rat = world.spawnEnemy("clanrat", spawn.p.x, spawn.p.y, true)!;
  world.rebuildFlow();
  let closest = Infinity;
  run(world, 25, () => {
    immortal(world);
    if (world.enemies.has(rat.id)) closest = Math.min(closest, dist(rat.x, rat.y, h.x, h.y));
  });
  check("A rat paths across the map to the hero", closest < 40, `started ${spawn.d.toFixed(0)}px away, got within ${closest.toFixed(0)}px`);
}

// Specials do their thing.
{
  const { world, heroes } = setup(["soldier", "ranger"]);
  const [a, b] = heroes as [Hero, Hero];
  place(b, { x: a.x + 20, y: a.y });
  const hook = world.spawnEnemy("hooker", a.x + 90, a.y, true)!;
  let grabbed = false;
  run(world, 8, () => {
    immortal(world);
    if (a.state === "grabbed" || b.state === "grabbed") grabbed = true;
  });
  const victim = a.grabbedBy ? a : b.grabbedBy ? b : null;
  check("Packmaster grabs a hero", grabbed, victim ? `${victim.name} grabbed` : "");
  if (victim && world.enemies.has(hook.id)) {
    const saver = victim === a ? b : a;
    damageEnemy(world, saver, hook, { damage: 5, stagger: 1, srcX: saver.x, srcY: saver.y });
    check("Hitting the Packmaster frees the hero", !victim.grabbedBy && victim.state !== "grabbed", `state ${victim.state}`);
  }
}
{
  const { world, heroes } = setup(["soldier"]);
  const h = heroes[0]!;
  world.spawnEnemy("gunner", h.x + 200, h.y, true);
  const fx = run(world, 8, () => immortal(world));
  const bullets = fx.filter((e) => e.t === "tracer" && e.kind === "bullet").length;
  const hits = fx.filter((e) => e.t === "hit" && e.id === h.id).length;
  check("Ratling Gunner aims, then fires a stream of bullets", bullets > 5 && hits > 0, `${bullets} bullets, ${hits} hits`);
}
{
  const { world, heroes } = setup(["soldier"]);
  const h = heroes[0]!;
  world.spawnEnemy("gas", h.x + 250, h.y, true);
  let sawGas = false;
  const hp0 = h.hp;
  run(world, 10, () => {
    for (const z of world.hazards.values()) if (z.kind === "gas") sawGas = true;
  });
  check("Globadier throws a gas cloud that hurts", sawGas && h.hp < hp0, `hp ${hp0} -> ${h.hp.toFixed(0)}`);
}

// The director sends hordes and specials over time.
{
  const { world } = setup(["soldier", "ranger"], true);
  const fx = run(world, 75, () => immortal(world));
  const hordes = fx.filter((e) => e.t === "announce" && e.kind === "horde").length;
  const specials = [...world.enemies.values()].filter((e) => e.def.special).length + fx.filter((e) => e.t === "death" && ["gunner", "gas", "hooker"].includes(e.kind)).length;
  check("A horde arrives within 75 seconds", hordes >= 1, `${hordes} horde(s)`);
  check("Specials spawn", specials >= 1, `${specials} special(s) seen`);
}

// Holding the square opens the gate.
{
  const { world, heroes } = setup(["soldier", "dwarf"]);
  const p = zonePoint(world.level.holdZone, world.level.width);
  for (const h of heroes) place(h, p);
  const fx = run(world, 55, () => {
    immortal(world);
    for (const h of heroes) if (h.state !== "grabbed") place(h, p);
  });
  check("Standing in the square starts the event", fx.some((e) => e.t === "announce" && e.kind === "event"));
  check("Surviving the event opens the gate", world.gateOpen && world.eventDone, `gate ${world.gateOpen}`);
}

// The boss arrives when the whole living party is in the boss room, and can be killed.
{
  const { world, heroes } = setup(["soldier"]);
  const h = heroes[0]!;
  world.gateOpen = true;
  const bossTile = [...world.level.bossRoom][0];
  place(h, bossTile != null ? tileCenter(bossTile % world.level.width, Math.floor(bossTile / world.level.width)) : world.level.ogreSpawn!);
  run(world, DT * 2);
  const ogre = [...world.enemies.values()].find((e) => e.def.id === "ogre");
  check("Rat Ogre spawns when the party is in the boss room", !!ogre && world.bossActive);
  if (ogre) {
    while (world.enemies.has(ogre.id)) damageEnemy(world, h, ogre, { damage: 100, stagger: 0, srcX: h.x, srcY: h.y });
    check("Killing the Rat Ogre ends the boss fight", !world.bossActive);
  }
}

// Win and lose.
{
  const { world, heroes } = setup(["soldier", "ranger"]);
  world.gateOpen = true;
  const end = zonePoint(world.level.endZone, world.level.width);
  for (const h of heroes) place(h, end);
  run(world, DT * 2);
  check("All standing heroes in the end zone wins", world.phase === "victory", world.phase);
}
{
  const { world, heroes } = setup(["soldier", "ranger"]);
  for (const h of heroes) downHero(world, h);
  run(world, DT * 2);
  check("Everyone down loses", world.phase === "defeat", world.phase);
}

// A full horde on four heroes stays well inside the 33ms tick budget.
{
  const { world, heroes } = setup(["soldier", "ranger", "dwarf", "hunter"]);
  const h = heroes[0]!;
  for (let i = 0; world.enemies.size < 90 && i < 400; i++) {
    const a = (i / 90) * Math.PI * 2;
    world.spawnEnemy(i % 3 ? "slave" : "clanrat", h.x + Math.cos(a) * (60 + (i % 5) * TILE_SIZE), h.y + Math.sin(a) * (60 + (i % 5) * TILE_SIZE), true);
  }
  const t0 = performance.now();
  run(world, 10, () => immortal(world));
  const perTick = (performance.now() - t0) / (10 / DT);
  check("90 rats on 4 heroes runs fast enough for a small server", perTick < 8, `${perTick.toFixed(2)}ms per tick, ${world.enemies.size} rats left`);
}

console.log(failures === 0 ? "\nAll mission checks passed" : `\n${failures} mission check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
