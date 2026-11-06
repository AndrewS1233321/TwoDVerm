/**
 * Offline checks of the combat rules, run straight on the server simulation (no network):
 *   npm run combat-test
 */
import { DT, HEROES, type FxEvent, type HeroId, type InputMessage } from "@twodverm/shared";
import { strikeHero } from "../server/src/sim/damage";
import type { Enemy, Hero } from "../server/src/sim/types";
import { World } from "../server/src/sim/World";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

let seq = 0;
function setup(heroId: HeroId): { world: World; hero: Hero } {
  const world = new World(7);
  const hero = world.addHero("h1", "Tester", HEROES[heroId]);
  world.startMission();
  world.enemies.clear();
  hero.facing = 0;
  return { world, hero };
}

function tick(world: World, hero: Hero, input: Partial<InputMessage> = {}): FxEvent[] {
  hero.inputs.push({ seq: ++seq, mx: 0, my: 0, aim: 0, attack: false, block: false, interact: false, dodge: false, fire: false, ult: false, ...input });
  world.fx = [];
  world.step(DT);
  return world.fx;
}

function run(world: World, hero: Hero, seconds: number, input: Partial<InputMessage> = {}): FxEvent[] {
  const all: FxEvent[] = [];
  for (let t = 0; t < seconds; t += DT) all.push(...tick(world, hero, input));
  return all;
}

/** A rat that never attacks back, facing the given angle. */
function dummy(world: World, x: number, y: number, facing: number): Enemy {
  const e = world.spawnEnemy("clanrat", x, y, true)!;
  e.hp = 9999;
  e.facing = facing;
  e.cooldown = 999;
  return e;
}

function attackIds(world: World, hero: Hero, pattern: Array<{ hold: number; wait: number }>): string[] {
  const ids: string[] = [];
  let lastSeq = hero.actionSeq;
  const watch = () => {
    if (hero.actionSeq !== lastSeq && hero.attack) ids.push(hero.attack.def.id);
    lastSeq = hero.actionSeq;
  };
  for (const step of pattern) {
    for (let t = 0; t < step.hold; t += DT) {
      tick(world, hero, { attack: true });
      watch();
    }
    for (let t = 0; t < step.wait; t += DT) {
      tick(world, hero);
      watch();
    }
  }
  return ids;
}

// Light chain: each click plays the next light attack, then loops.
{
  const { world, hero } = setup("soldier");
  const ids = attackIds(world, hero, [0, 1, 2, 3].map(() => ({ hold: DT, wait: 0.55 })));
  const light = HEROES.soldier.weapon.light.map((a) => a.id);
  check("Light clicks walk the light chain", ids.join() === [light[0], light[1], light[2], light[0]].join(), ids.join(" > "));
}

// Light chain resets after a pause.
{
  const { world, hero } = setup("soldier");
  const ids = attackIds(world, hero, [
    { hold: DT, wait: 0.55 },
    { hold: DT, wait: 2 },
    { hold: DT, wait: 0.5 },
  ]);
  const l1 = HEROES.soldier.weapon.light[0]!.id;
  check("Light chain resets after idling", ids[2] === l1, ids.join(" > "));
}

// Heavy chain: holding charges, releasing swings the next heavy attack.
{
  const { world, hero } = setup("soldier");
  const ids = attackIds(world, hero, [
    { hold: 0.6, wait: 0.8 },
    { hold: 0.6, wait: 0.8 },
    { hold: 0.6, wait: 0.8 },
  ]);
  const heavy = HEROES.soldier.weapon.heavy.map((a) => a.id);
  check("Held clicks walk the heavy chain", ids.join() === [heavy[0], heavy[1], heavy[0]].join(), ids.join(" > "));
}

// Light and heavy chains are separate: a heavy between lights does not reset the light chain.
{
  const { world, hero } = setup("soldier");
  const ids = attackIds(world, hero, [
    { hold: DT, wait: 0.55 },
    { hold: 0.6, wait: 0.7 },
    { hold: DT, wait: 0.5 },
  ]);
  const w = HEROES.soldier.weapon;
  check("Heavy in the middle keeps the light chain going", ids.join() === [w.light[0]!.id, w.heavy[0]!.id, w.light[1]!.id].join(), ids.join(" > "));
}

// Back hits on enemies hurt more than front hits.
{
  const { world, hero } = setup("hunter");
  const front = dummy(world, hero.x + 30, hero.y, Math.PI);
  const fx1 = run(world, hero, 0.05, { attack: true }).concat(run(world, hero, 0.6));
  const frontHit = fx1.find((e) => e.t === "hit" && e.id === front.id);
  world.enemies.clear();
  const back = dummy(world, hero.x + 30, hero.y, 0);
  run(world, hero, 1.2);
  const fx2: FxEvent[] = [];
  for (let t = 0; t < 0.65; t += DT) {
    back.facing = 0;
    back.x = hero.x + 30;
    back.y = hero.y;
    fx2.push(...tick(world, hero, { attack: t < 0.05 }));
  }
  const backHit = fx2.find((e) => e.t === "hit" && e.id === back.id);
  const fd = frontHit?.t === "hit" ? frontHit.dmg : 0;
  const bd = backHit?.t === "hit" ? backHit.dmg : 0;
  check("Front hit lands and reads as front", frontHit?.t === "hit" && frontHit.side === "front", `dmg ${fd}`);
  check("Back hit reads as back and deals more", backHit?.t === "hit" && backHit.side === "back" && bd > fd, `front ${fd} vs back ${bd}`);
}

// Blocking only works from the front and costs block stamina.
{
  const { world, hero } = setup("soldier");
  run(world, hero, 0.3, { block: true });
  const hit = { damage: 10, stagger: 0, blockCost: 1, srcId: "e", srcX: hero.x + 30, srcY: hero.y };
  const s0 = hero.stamina;
  const hp0 = hero.hp;
  const r1 = strikeHero(world, hero, hit);
  check("Front attack is blocked", r1 === "blocked" && hero.hp === hp0, `result ${r1}`);
  check("Blocking spends block stamina", hero.stamina < s0, `${s0} -> ${hero.stamina}`);
  const r2 = strikeHero(world, hero, { ...hit, srcX: hero.x - 30 });
  check("Attack from behind gets through a block", r2 === "hit" && hero.hp < hp0, `result ${r2}, hp ${hp0} -> ${hero.hp}`);
}

// Guard break when block stamina runs out.
{
  const { world, hero } = setup("soldier");
  run(world, hero, 0.3, { block: true });
  hero.stamina = 0.2;
  const fx: FxEvent[] = [];
  world.fx = fx;
  const r = strikeHero(world, hero, { damage: 10, stagger: 0, blockCost: 1, srcId: "e", srcX: hero.x + 30, srcY: hero.y });
  const broke = fx.some((e) => e.t === "block" && e.broke);
  check("Guard breaks when block stamina runs out", r === "hit" && broke && hero.state === "staggered", `state ${hero.state}`);
}

// Push: block + attack shoves and staggers enemies in front, and costs stamina.
{
  const { world, hero } = setup("soldier");
  const e = dummy(world, hero.x + 28, hero.y, Math.PI);
  run(world, hero, 0.3, { block: true });
  const s0 = hero.stamina;
  const x0 = e.x;
  const fx = run(world, hero, DT, { block: true, attack: true }).concat(run(world, hero, 0.2, { block: true }));
  check("Push fires while blocking", fx.some((f) => f.t === "push"));
  check("Push staggers and shoves the rat", e.state === "staggered" && e.x > x0, `state ${e.state}, x ${x0.toFixed(0)} -> ${e.x.toFixed(0)}`);
  check("Push spends block stamina", hero.stamina < s0, `${s0} -> ${hero.stamina}`);
}

// Dodge uses its own charges, gives brief invulnerability and refills over time.
{
  const { world, hero } = setup("ranger");
  const charges0 = hero.dodgeCharges;
  const stamina0 = hero.stamina;
  tick(world, hero, { mx: 1, dodge: true });
  check("Dodge spends a dodge charge, not block stamina", hero.dodgeCharges === charges0 - 1 && hero.stamina === stamina0, `${charges0} -> ${hero.dodgeCharges}`);
  const r = strikeHero(world, hero, { damage: 10, stagger: 0, blockCost: 1, srcId: "e", srcX: hero.x + 30, srcY: hero.y });
  check("Attacks during a dodge miss", r === "dodged", `result ${r}`);
  run(world, hero, 3);
  check("Dodge charges refill", hero.dodgeCharges === charges0, `${hero.dodgeCharges}/${charges0}`);
}

// Q toggles to the ranged weapon; left click then fires instead of swinging.
{
  const { world, hero } = setup("soldier");
  run(world, hero, DT, { fire: true });
  check("Q draws the ranged weapon", hero.rangedMode);
  const ammo0 = hero.ammo;
  run(world, hero, DT, { attack: true });
  check("Left click fires while ranged is drawn", hero.ammo === ammo0 - 1 && hero.state === "shooting", `ammo ${ammo0} -> ${hero.ammo}`);
  run(world, hero, DT, { fire: true });
  check("Q a second time puts the melee weapon back", !hero.rangedMode);
  const ids = attackIds(world, hero, [{ hold: DT, wait: 0.4 }]);
  check("Left click is a melee swing again after holstering", ids[0] === HEROES.soldier.weapon.light[0]!.id, ids.join(" > "));
}

// A rat telegraphs (windup) before its swing lands, so there is time to react.
{
  const { world, hero } = setup("soldier");
  const e = world.spawnEnemy("clanrat", hero.x + 26, hero.y, true)!;
  e.cooldown = 0;
  let windupSeen = -1;
  let hitAt = -1;
  for (let t = 0; t < 3 && hitAt < 0; t += DT) {
    const fx = tick(world, hero);
    if (windupSeen < 0 && e.state === "attack" && e.attack?.phase === "windup") windupSeen = t;
    if (fx.some((f) => f.t === "hit" && f.id === hero.id)) hitAt = t;
  }
  check("Rat winds up before it hits", windupSeen >= 0 && hitAt - windupSeen >= 0.4, `windup at ${windupSeen.toFixed(2)}s, hit at ${hitAt.toFixed(2)}s`);
}

console.log(failures === 0 ? "\nAll combat checks passed" : `\n${failures} combat check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
