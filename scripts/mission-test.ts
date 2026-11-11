/**
 * Offline checks of enemies, specials, pacing, the event, the boss and win/lose, run straight
 * on the server simulation (no network):
 *   npm run mission-test
 */
import {
  buildWastesLevel,
  dist,
  DOWNED,
  DT,
  ENEMIES,
  enemiesForRaces,
  HEROES,
  rollLevelProperties,
  MONK,
  RUNNER,
  SHIELD,
  TILE_SIZE,
  tileCenter,
  WARPFIRE,
  type FxEvent,
  type HeroId,
  type InputMessage,
  type Point,
} from "@twodverm/shared";
import { damageEnemy, downHero, killEnemy } from "../server/src/sim/damage";
import { sprayCone } from "../server/src/sim/enemies";
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

const idle = (): InputMessage => ({ seq: ++seq, mx: 0, my: 0, aim: 0, aimX: 0, aimY: 0, attack: false, block: false, interact: false, dodge: false, fire: false, ult: false });

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

// Full Skaven roster: shields, flurry, pin, warpfire cone, sack loot, stormfiend spray, boss pool.
{
  const world = new World(19, "testing");
  const h = world.addHero("h0", "Hero 0", HEROES.soldier);
  const buddy = world.addHero("h1", "Hero 1", HEROES.ranger);
  world.startMission();
  world.enemies.clear();
  const origin = world.level.playerStarts[0]!;
  place(h, origin);
  place(buddy, { x: origin.x + 64, y: origin.y });
  h.iframesT = 0;
  buddy.iframesT = 0;

  const shield = world.spawnEnemy("shieldClanrat", origin.x + 40, origin.y, true)!;
  shield.x = origin.x + 40;
  shield.y = origin.y;
  shield.facing = Math.PI;
  const hp0 = shield.hp;
  damageEnemy(world, h, shield, { damage: 20, stagger: 0, srcX: h.x, srcY: h.y });
  check("Shield blocks a frontal light hit", shield.hp === hp0 && shield.state !== "staggered", `hp ${shield.hp}/${hp0} state ${shield.state}`);
  damageEnemy(world, h, shield, { damage: 20, stagger: SHIELD.breakPower, heavy: true, srcX: h.x, srcY: h.y });
  check("Heavy hit breaks a raised shield", shield.state === "staggered", shield.state);
  shield.state = "chase";
  shield.stateT = 0;
  const hp1 = shield.hp;
  damageEnemy(world, h, shield, { damage: 20, stagger: 0, srcX: shield.x + 80, srcY: shield.y });
  check("Back hit lands through a shield", shield.hp < hp1, `hp ${shield.hp}/${hp1}`);
  killEnemy(world, shield, h);

  const monk = world.spawnEnemy("plagueMonk", origin.x + 90, origin.y, true)!;
  monk.x = origin.x + 90;
  monk.y = origin.y;
  monk.targetId = h.id;
  monk.cooldown = 0;
  monk.monkOpened = false;
  place(h, origin);
  // Drive the monk into range and through the opening 6-hit flurry.
  let sawSlash = false;
  let maxChain = 0;
  let flurryStartX = 0;
  let flurryEndX = 0;
  for (let i = 0; i < 300; i++) {
    place(h, origin);
    h.state = "idle";
    run(world, DT, () => immortal(world));
    if (monk.attack?.def.id === "monk_slash") {
      if (!sawSlash) flurryStartX = monk.x;
      sawSlash = true;
      maxChain = Math.max(maxChain, monk.chainLeft);
      flurryEndX = monk.x;
    }
    if (monk.monkOpened) break;
  }
  check(
    "Plague Monk opens with a chasing 6-hit flurry",
    sawSlash && maxChain >= MONK.openerHits - 1 && monk.monkOpened,
    `saw ${sawSlash} maxChain ${maxChain} opened ${monk.monkOpened}`,
  );
  check(
    "Plague Monk advances while flurrying",
    flurryEndX < flurryStartX - 8,
    `x ${flurryEndX.toFixed(0)} from ${flurryStartX.toFixed(0)}`,
  );
  check(
    "Plague Monk pauses after the opener",
    monk.cooldown >= MONK.pause - 0.15,
    `cd ${monk.cooldown.toFixed(2)}`,
  );
  // After the pause, the next flurry should be 3 hits.
  monk.cooldown = 0;
  monk.x = origin.x + 28;
  monk.y = origin.y;
  maxChain = 0;
  for (let i = 0; i < 200; i++) {
    place(h, origin);
    h.state = "idle";
    run(world, DT, () => immortal(world));
    if (monk.state === "attack") maxChain = Math.max(maxChain, monk.chainLeft);
    if (monk.state === "attack" && monk.chainLeft === MONK.followHits - 1) break;
  }
  check(
    "Plague Monk follow-up flurry is 3 hits",
    maxChain === MONK.followHits - 1,
    `maxChain ${maxChain}`,
  );
  killEnemy(world, monk, h);

  place(h, origin);
  place(buddy, { x: origin.x + 400, y: origin.y });
  h.state = "idle";
  h.grabbedBy = "";
  h.iframesT = 0;
  buddy.state = "idle";
  buddy.grabbedBy = "";
  const runner = world.spawnEnemy("gutterRunner", origin.x + 10, origin.y, true)!;
  runner.x = origin.x + 10;
  runner.y = origin.y;
  runner.state = "leap";
  runner.leapAngle = Math.PI;
  runner.shotT = 1;
  runner.facing = Math.PI;
  run(world, DT, () => {
    immortal(world);
    h.iframesT = 0;
  });
  check("Gutter Runner pin grabs a hero", h.state === "grabbed" && runner.state === "pin", `hero ${h.state} runner ${runner.state}`);
  damageEnemy(world, buddy, runner, { damage: 30, stagger: 1, srcX: buddy.x, srcY: buddy.y });
  check("Teammate hit releases a pin", h.state !== "grabbed" && runner.state !== "pin", `hero ${h.state} runner ${runner.state}`);
  if (world.enemies.has(runner.id)) killEnemy(world, runner, h);

  // Push-block a mid-air pounce: immunity while pushing, then stun + flee.
  place(h, origin);
  h.state = "idle";
  h.grabbedBy = "";
  h.iframesT = 0;
  h.facing = 0;
  h.stamina = h.def.stamina;
  h.pushCd = 0;
  const pouncer = world.spawnEnemy("gutterRunner", origin.x + 20, origin.y, true)!;
  pouncer.x = origin.x + 20;
  pouncer.y = origin.y;
  pouncer.state = "leap";
  pouncer.leapAngle = Math.PI;
  pouncer.shotT = 1;
  pouncer.facing = Math.PI;
  h.state = "pushing";
  h.stateT = 1;
  run(world, DT, () => {
    immortal(world);
    h.state = "pushing";
    h.iframesT = 0;
  });
  check("Pushing hero cannot be pounced", h.state !== "grabbed" && pouncer.state === "leap", `hero ${h.state} runner ${pouncer.state}`);
  // Raise block with the runner out of pounce range, then bring it in and push.
  const pushTick = (input: Partial<InputMessage>): void => {
    for (const hero of world.heroes.values()) {
      hero.inputs.push({
        seq: ++seq,
        mx: 0,
        my: 0,
        aim: 0,
        aimX: hero.x + 40,
        aimY: hero.y,
        attack: false,
        block: false,
        interact: false,
        dodge: false,
        fire: false,
        ult: false,
        ...input,
      });
    }
    world.fx = [];
    world.step(DT);
    immortal(world);
  };
  h.facing = 0;
  h.state = "idle";
  h.stamina = h.def.stamina;
  h.pushCd = 0;
  h.grabbedBy = "";
  pouncer.x = origin.x + 120;
  pouncer.y = origin.y;
  pouncer.state = "stalk";
  pouncer.shotT = 0;
  pouncer.cooldown = 0;
  pouncer.grabbedId = "";
  pushTick({ block: true });
  check("Hero is blocking before the push", h.state === "blocking", h.state);
  pouncer.x = origin.x + 28;
  pouncer.y = origin.y;
  pouncer.state = "leap";
  pouncer.leapAngle = Math.PI;
  pouncer.facing = Math.PI;
  pouncer.shotT = 1;
  pushTick({ block: true, attack: true });
  check(
    "Push-block stuns a Gutter Runner",
    pouncer.state === "staggered" && Math.abs(pouncer.stateT - RUNNER.pushStun) < 0.08 && pouncer.cooldown >= RUNNER.cooldown - 0.15,
    `state ${pouncer.state} stun ${pouncer.stateT.toFixed(2)} cd ${pouncer.cooldown.toFixed(2)} kb ${Math.hypot(pouncer.kvx, pouncer.kvy).toFixed(0)} hero ${h.state}`,
  );
  check("Push-block knocks the Gutter Runner back", Math.hypot(pouncer.kvx, pouncer.kvy) > 50);
  // Finish the stun → flee until cooldown ends.
  pouncer.stateT = 0.01;
  run(world, DT * 2, () => immortal(world));
  check("Stunned Gutter Runner flees after the stun", pouncer.state === "flee", pouncer.state);
  pouncer.cooldown = 0;
  run(world, DT * 2, () => immortal(world));
  check("Gutter Runner stops fleeing when pounce is ready", pouncer.state === "stalk" || pouncer.state === "chase", pouncer.state);
  if (world.enemies.has(pouncer.id)) killEnemy(world, pouncer, h);

  place(h, origin);
  h.hp = h.def.hp;
  h.state = "idle";
  const thrower = world.spawnEnemy("warpfire", origin.x + 80, origin.y, true)!;
  thrower.x = origin.x + 80;
  thrower.y = origin.y;
  thrower.facing = Math.PI;
  thrower.state = "spray";
  thrower.shotT = 1;
  const hpBefore = h.hp;
  sprayCone(world, thrower, WARPFIRE.range, WARPFIRE.arc, WARPFIRE.dps, 0.5);
  check("Warpfire damages heroes in its cone", h.hp < hpBefore, `hp ${h.hp}/${hpBefore}`);
  const behind = world.spawnEnemy("warpfire", origin.x - 80, origin.y, true)!;
  behind.x = origin.x - 80;
  behind.y = origin.y;
  behind.facing = Math.PI;
  behind.state = "spray";
  const hpMid = h.hp;
  sprayCone(world, behind, WARPFIRE.range, WARPFIRE.arc, WARPFIRE.dps, 0.5);
  check("Warpfire misses heroes behind the thrower", h.hp === hpMid, `hp ${h.hp}/${hpMid}`);
  killEnemy(world, thrower, h);
  killEnemy(world, behind, h);

  const sack = world.spawnEnemy("sackRat", origin.x + 60, origin.y, false)!;
  sack.state = "flee";
  sack.aggro = true;
  const pickupsBefore = world.pickups.size;
  killEnemy(world, sack, h);
  check("Sack Rat drops loot on death", world.pickups.size > pickupsBefore, `pickups ${world.pickups.size}`);

  const open = { x: origin.x + 120, y: origin.y + 40 };
  place(h, open);
  const fiend = world.spawnEnemy("stormfiend", open.x + 200, open.y, true)!;
  fiend.x = open.x + 200;
  fiend.y = open.y;
  fiend.targetId = h.id;
  fiend.stateT = 1;
  fiend.fireCd = 0;
  fiend.cooldown = 1;
  fiend.state = "chase";
  fiend.aggro = true;
  fiend.attack = null;
  run(world, DT, () => {
    immortal(world);
    place(h, open);
    h.iframesT = 0;
  });
  check("Stormfiend sprays warpfire at range", fiend.state === "spray_windup" || fiend.state === "spray", `${fiend.state} d=${Math.round(dist(fiend.x, fiend.y, h.x, h.y))}`);
  // Finish wind-up and spray long enough to paint the ground.
  fiend.state = "spray";
  fiend.shotT = 0.5;
  run(world, 0.4, () => {
    immortal(world);
    place(h, open);
  });
  const burns = [...world.hazards.values()].filter((hz) => hz.kind === "warpflame");
  check("Stormfiend leaves warpflame on the ground", burns.length > 0, `${burns.length} patches`);
  if (burns[0]) {
    const patch = burns[0]!;
    place(h, { x: patch.x, y: patch.y });
    const hpBurn = h.hp;
    run(world, 0.5, () => immortal(world));
    // immortal restores hp each tick before step — force damage check without heal:
    h.hp = hpBurn;
    for (let t = 0; t < 0.5; t += DT) {
      for (const hero of world.heroes.values()) hero.inputs.push(idle());
      world.fx = [];
      world.step(DT);
    }
    check("Warpflame ground burn deals DoT", h.hp < hpBurn, `hp ${h.hp}/${hpBurn}`);
  }
  killEnemy(world, fiend, h);
}

{
  const seen = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const props = rollLevelProperties(1, "grim_causeway", seed);
    const { meta } = buildWastesLevel("grim_causeway", props, seed);
    const boss = meta.objectives.find((o) => o.kind === "boss");
    if (boss?.spawnType) seen.add(boss.spawnType);
  }
  const pools = enemiesForRaces(rollLevelProperties(1, "grim_causeway", 1));
  check("Wastes boss pool includes Rat Ogre and Stormfiend", pools.bosses.includes("ogre") && pools.bosses.includes("stormfiend"), pools.bosses.join(","));
  check("Wastes seeded boss pick covers both bosses", seen.has("ogre") && seen.has("stormfiend"), [...seen].join(","));
}

console.log(failures === 0 ? "\nAll mission checks passed" : `\n${failures} mission check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
