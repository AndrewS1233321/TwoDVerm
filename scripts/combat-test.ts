/**
 * Offline checks of the combat rules, run straight on the server simulation (no network):
 *   npm run combat-test
 */
import {
  ARMOR_LEVELS,
  ARMOR_REDUCTION,
  ARMOR_SETS,
  armorReduction,
  DEFAULT_ARMOR_SET,
  DT,
  DODGE,
  HERO_IDS,
  HEROES,
  NO_RETREATING,
  noRetreatingWeight,
  OLD_GOAT,
  perksOfferedFor,
  RIPOSTE,
  SMOKE_BOMB,
  smokeCloudRadius,
  type ArmorLoadout,
  type ArmorSetDef,
  type ArmorSetId,
  type EnemyDef,
  type FxEvent,
  type HeroId,
  type InputMessage,
} from "@twodverm/shared";
import { damageEnemy, strikeHero, type EnemyHit } from "../server/src/sim/damage";
import { heroMoveMods } from "../server/src/sim/heroes";
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
  hero.inputs.push({ seq: ++seq, mx: 0, my: 0, aim: 0, aimX: 0, aimY: 0, attack: false, block: false, interact: false, dodge: false, fire: false, ult: false, ...input });
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

// Kerri's Smoke Bomb: merchant perk, stagger cloud, then stealth that drops aggro.
{
  const offered = perksOfferedFor("ranger", new Set()).map((p) => p.id);
  check("Merchant offers Kerri Smoke Bomb", offered.includes("smoke_bomb"));
  check("Smoke Bomb is not offered to other heroes", perksOfferedFor("dwarf", new Set()).every((p) => p.id !== "smoke_bomb") && perksOfferedFor("soldier", new Set()).every((p) => p.id !== "smoke_bomb"));

  const { world, hero } = setup("ranger");
  hero.perks.add("smoke_bomb");
  hero.gold = 80;
  const buddy = world.addHero("h2", "Buddy", HEROES.soldier);
  buddy.x = hero.x + 520;
  buddy.y = hero.y;
  const near = world.spawnEnemy("clanrat", hero.x + 36, hero.y, true)!;
  near.targetId = hero.id;
  near.cooldown = 999;
  const far = world.spawnEnemy("clanrat", hero.x + 280, hero.y, true)!;
  far.targetId = hero.id;
  far.cooldown = 999;
  const idle = world.spawnEnemy("slave", hero.x, hero.y + 28, false)!;
  idle.cooldown = 999;
  const ogre = world.spawnEnemy("ogre", hero.x + 70, hero.y, true)!;
  ogre.targetId = hero.id;
  ogre.cooldown = 999;
  const hpNear = near.hp;
  const hpIdle = idle.hp;
  const hpOgre = ogre.hp;
  const hpFar = far.hp;

  tick(world, hero, { dodge: true, mx: -1 });
  const smoke = [...world.hazards.values()].find((h) => h.kind === "smoke");
  const expectedR = smokeCloudRadius(hero.radius);
  check("Dodge drops a smoke cloud", !!smoke && Math.abs(smoke.radius - expectedR) < 0.01 && Math.abs((smoke?.duration ?? 0) - SMOKE_BOMB.cloudTime) < 0.001, smoke ? `r ${smoke.radius}` : "missing");
  check(
    "Smoke staggers enemies inside it and deals no damage",
    near.state === "staggered" && idle.state === "staggered" && ogre.state === "staggered" && near.hp === hpNear && idle.hp === hpIdle && ogre.hp === hpOgre,
    `near ${near.state} idle ${idle.state} ogre ${ogre.state}`,
  );
  check("Enemies outside the cloud are not staggered", far.state !== "staggered" && far.hp === hpFar, far.state);
  check("Stealth starts when the dodge ends, not when it starts", hero.invisT === 0 && hero.dodgeT > 0);

  run(world, hero, DODGE.time);
  check("Kerri is hidden after the dodge", hero.invisT > SMOKE_BOMB.invisTime - 0.35 && hero.invisT <= SMOKE_BOMB.invisTime, hero.invisT.toFixed(2));
  check("Chasers outside the cloud drop Kerri for someone else", far.targetId === buddy.id, far.targetId);

  // Attack while still stealthed (before waiting out stagger / cloud timers).
  const victim = world.spawnEnemy("clanrat", hero.x + 24, hero.y, false)!;
  victim.cooldown = 999;
  victim.hp = 100;
  hero.facing = 0;
  const hpVictim = victim.hp;
  tick(world, hero, { attack: true, aim: 0 });
  run(world, hero, 0.35, { aim: 0 });
  check("Attacks while hidden still deal damage", victim.hp < hpVictim, `${hpVictim} -> ${victim.hp}`);
  check("Attacks while hidden do not draw aggro or make her the target", victim.aggro === false && victim.targetId !== hero.id && hero.invisT > 0, `aggro ${victim.aggro} target ${victim.targetId}`);

  run(world, hero, Math.max(0, SMOKE_BOMB.staggerTime - 0.35));
  check("Staggered chasers retarget after the stagger", near.targetId === buddy.id && ogre.targetId === buddy.id, `near ${near.targetId} ogre ${ogre.targetId}`);
  check("Idle rats in the smoke go back to idle", idle.state === "idle" && idle.aggro === false && idle.targetId !== hero.id, `${idle.state} aggro ${idle.aggro}`);

  // Cloud started at dodge press; finish whatever remains of its lifetime.
  const smokeLeft = [...world.hazards.values()].find((h) => h.kind === "smoke")?.timeLeft ?? 0;
  if (smokeLeft > 0) run(world, hero, smokeLeft + DT);
  check("Smoke cloud is gone after 0.75s", [...world.hazards.values()].every((h) => h.kind !== "smoke"));

  const plain = setup("ranger");
  tick(plain.world, plain.hero, { dodge: true, mx: 1 });
  run(plain.world, plain.hero, DODGE.time);
  check("Dodge without the perk drops no smoke and does not hide her", [...plain.world.hazards.values()].every((h) => h.kind !== "smoke") && plain.hero.invisT === 0);
}

{
  const { world, hero } = setup("ranger");
  hero.gold = 50;
  world.phase = "merchant";
  world.spawnEnemy("merchant", hero.x + 10, hero.y, false);
  check("Kerri can buy Smoke Bomb for 50 GP", world.buyPerk(hero.id, "smoke_bomb") && hero.perks.has("smoke_bomb") && hero.gold === 0);
  check("Smoke Bomb cannot be bought twice", !world.buyPerk(hero.id, "smoke_bomb"));
  const other = setup("soldier");
  other.hero.gold = 50;
  other.world.phase = "merchant";
  other.world.spawnEnemy("merchant", other.hero.x + 10, other.hero.y, false);
  check("Other heroes cannot buy Smoke Bomb", !other.world.buyPerk(other.hero.id, "smoke_bomb") && other.hero.gold === 50);
}

// Viktor's Riposte: after a dodge (not ult), next melee is 1.5× reach + guaranteed crit.
{
  const offered = perksOfferedFor("hunter", new Set()).map((p) => p.id);
  check("Merchant offers Viktor Riposte", offered.includes("riposte"));
  check("Riposte is not offered to Kerri", perksOfferedFor("ranger", new Set()).every((p) => p.id !== "riposte"));

  const { world, hero } = setup("hunter");
  hero.perks.add("riposte");
  hero.facing = 0;
  const baseReach = HEROES.hunter.weapon.light[0]!.reach;
  // Beyond normal first-light reach, inside 1.5× Riposte reach (target radius still helps).
  const gap = hero.radius + baseReach * 1.25;
  const pin = (e: Enemy, x: number, y: number) => {
    e.x = x;
    e.y = y;
    e.aggro = true;
    e.cooldown = 999;
    // Stay staggered so they never walk into range mid-swing.
    e.state = "staggered";
    e.stateT = 99;
    e.def = { ...e.def, speed: 0 };
  };

  tick(world, hero, { dodge: true, mx: -1 });
  check("Dodge charges Riposte", hero.riposteReady);

  // Wait out dodge, then light attack into extended reach.
  run(world, hero, DODGE.time + 0.05);
  const near = dummy(world, hero.x + gap, hero.y, Math.PI);
  pin(near, hero.x + gap, hero.y);
  const hp0 = near.hp;
  tick(world, hero, { attack: true, aim: 0 });
  const fx = run(world, hero, 0.7, { aim: 0 });
  check("Riposte swing uses 1.5× reach", near.hp < hp0, `hp ${hp0} -> ${near.hp}`);
  check("Riposte is consumed after the attack", !hero.riposteReady && hero.attack === null);
  const critHit = fx.find((f) => f.t === "hit" && f.id === near.id && f.crit === true);
  check("Riposte hit is a guaranteed critical", !!critHit, critHit ? `dmg ${critHit.dmg}` : "no crit fx");
  // Front hit (mul 1) × crit.
  const expected = Math.round(HEROES.hunter.weapon.light[0]!.damage * RIPOSTE.critMul);
  check("Critical multiplies damage", !!critHit && critHit.dmg === expected, critHit ? `${critHit.dmg} vs ${expected}` : "missing");

  // Without a fresh dodge, a swing at the same gap misses and is not a crit.
  world.enemies.delete(near.id);
  hero.chainLight = 0;
  hero.comboT = 99;
  const far = dummy(world, hero.x + gap, hero.y, Math.PI);
  pin(far, hero.x + gap, hero.y);
  const hpFar = far.hp;
  tick(world, hero, { attack: true, aim: 0 });
  const fx2 = run(world, hero, 0.7, { aim: 0 });
  check("Without Riposte, extended-range target is missed", far.hp === hpFar, `hp ${hpFar} -> ${far.hp}`);
  check("Normal swings are not critical", !fx2.some((f) => f.t === "hit" && f.crit === true));

  // Ultimate dash must not charge Riposte.
  const { world: w2, hero: h2 } = setup("hunter");
  h2.perks.add("riposte");
  h2.ultCd = 0;
  tick(w2, h2, { ult: true });
  check("Ultimate dash does not charge Riposte", !h2.riposteReady && h2.dodgeT > 0 && h2.def.ult === "dash");

  const buy = setup("hunter");
  buy.hero.gold = 50;
  buy.world.phase = "merchant";
  buy.world.spawnEnemy("merchant", buy.hero.x + 10, buy.hero.y, false);
  check("Viktor can buy Riposte for 50 GP", buy.world.buyPerk(buy.hero.id, "riposte") && buy.hero.perks.has("riposte") && buy.hero.gold === 0);
}

// Markus No retreating: dodge body-checks stagger harder near the end of the dash.
{
  check("Merchant offers Markus No retreating", perksOfferedFor("soldier", new Set()).some((p) => p.id === "no_retreating"));
  check("No retreating is not offered to Viktor", perksOfferedFor("hunter", new Set()).every((p) => p.id !== "no_retreating"));

  const earlyW = noRetreatingWeight(DODGE.time * 0.95, DODGE.time);
  const lateW = noRetreatingWeight(DODGE.time * 0.05, DODGE.time);
  check("No retreating weight is much higher at the end of a dodge", lateW > earlyW * 5, `early ${earlyW.toFixed(3)} late ${lateW.toFixed(3)}`);

  const { world, hero } = setup("soldier");
  hero.perks.add("no_retreating");
  hero.facing = 0;
  const early = dummy(world, hero.x + hero.radius + 10, hero.y, Math.PI);
  early.cooldown = 999;
  early.hp = 9999;
  const hpEarly = early.hp;

  // Contact on the first dodge frame (near the start).
  tick(world, hero, { dodge: true, mx: 1 });
  check("Early dodge contact staggers briefly", early.state === "staggered" && early.stateT <= NO_RETREATING.staggerTimeMin + 0.2, `t ${early.stateT.toFixed(3)}`);
  check("No retreating deals no damage", early.hp === hpEarly);

  // Fresh dodge, then force a contact in the final moments of the dash.
  world.enemies.delete(early.id);
  run(world, hero, DODGE.time + 0.05);
  tick(world, hero, { dodge: true, mx: 1 });
  hero.dodgeT = DT * 1.5;
  hero.noRetreatHit.clear();
  const late = dummy(world, hero.x + 8, hero.y, Math.PI);
  late.cooldown = 999;
  late.hp = 9999;
  run(world, hero, DT, { mx: 1 });
  check(
    "Late dodge contact staggers much longer",
    late.state === "staggered" && late.stateT >= NO_RETREATING.staggerTimeMax * 0.55,
    `t ${late.stateT.toFixed(3)}`,
  );

  const plain = setup("soldier");
  const rat = dummy(plain.world, plain.hero.x + 12, plain.hero.y, Math.PI);
  rat.cooldown = 999;
  tick(plain.world, plain.hero, { dodge: true, mx: 1 });
  check("Dodge without the perk does not stagger on contact", rat.state !== "staggered");

  const buy = setup("soldier");
  buy.hero.gold = 50;
  buy.world.phase = "merchant";
  buy.world.spawnEnemy("merchant", buy.hero.x + 10, buy.hero.y, false);
  check("Markus can buy No retreating for 50 GP", buy.world.buyPerk(buy.hero.id, "no_retreating") && buy.hero.perks.has("no_retreating") && buy.hero.gold === 0);
}

// Bardin Old Goat: dodge into an enemy stops the dodge, damages, knocks back, no stagger, focuses him.
{
  check("Merchant offers Bardin Old Goat", perksOfferedFor("dwarf", new Set()).some((p) => p.id === "old_goat"));
  check("Old Goat is not offered to Markus", perksOfferedFor("soldier", new Set()).every((p) => p.id !== "old_goat"));

  const { world, hero } = setup("dwarf");
  hero.perks.add("old_goat");
  hero.facing = 0;
  const rat = dummy(world, hero.x + hero.radius + 8, hero.y, Math.PI);
  rat.cooldown = 999;
  rat.hp = 500;
  const hp0 = rat.hp;
  const x0 = rat.x;

  tick(world, hero, { dodge: true, mx: 1 });
  check("Old Goat stops the dodge on contact", hero.dodgeT === 0);
  check("Old Goat deals 160 damage", Math.round(hp0 - rat.hp) === OLD_GOAT.damage, `${hp0} -> ${rat.hp}`);
  check("Old Goat does not stagger", rat.state !== "staggered");
  check("Old Goat knocks the enemy back", rat.x > x0, `x ${x0.toFixed(1)} -> ${rat.x.toFixed(1)}`);
  check("Old Goat makes the enemy target Bardin", rat.targetId === hero.id && rat.aggro);

  const plain = setup("dwarf");
  const other = dummy(plain.world, plain.hero.x + 10, plain.hero.y, Math.PI);
  other.cooldown = 999;
  other.hp = 500;
  const ohp = other.hp;
  tick(plain.world, plain.hero, { dodge: true, mx: 1 });
  check("Dodge without Old Goat does not shoulder-check", other.hp === ohp && plain.hero.dodgeT > 0);

  const buy = setup("dwarf");
  buy.hero.gold = 50;
  buy.world.phase = "merchant";
  buy.world.spawnEnemy("merchant", buy.hero.x + 10, buy.hero.y, false);
  check("Bardin can buy Old Goat for 50 GP", buy.world.buyPerk(buy.hero.id, "old_goat") && buy.hero.perks.has("old_goat") && buy.hero.gold === 0);
}

// Layered armor: per-location levels, pierce steps levels down, head hits, backstab 2x through back armor.
{
  check("Bardin starts with one dodge charge", HEROES.dwarf.dodges === 1 && setup("dwarf").hero.dodgeCharges === 1);

  const loadout: ArmorLoadout = { head: "superHeavy", front: "heavy", side: "medium", back: "light" };
  check(
    "Armor levels reduce 0 / 25 / 50 / 75 / 95%",
    ARMOR_LEVELS.map((l) => ARMOR_REDUCTION[l]).join(",") === "0,0.25,0.5,0.75,0.95",
  );
  check("Pierce 1 makes heavy act as medium", armorReduction(loadout, "front", 1) === ARMOR_REDUCTION.medium);
  check("Pierce never goes below unarmored", armorReduction(loadout, "back", 5) === 0);

  const { world } = setup("dwarf");
  const strike = (location: "front" | "side" | "back", hit: Partial<EnemyHit> = {}): number => {
    const e = world.spawnEnemy("clanrat", 0, 0, true)!;
    (e as { def: EnemyDef }).def = { ...e.def, armor: loadout };
    e.hp = 9999;
    e.facing = 0;
    const src = { front: { x: 30, y: 0 }, side: { x: 0, y: 30 }, back: { x: -30, y: 0 } }[location];
    const hp0 = e.hp;
    damageEnemy(world, null, e, { damage: 100, stagger: 0, srcX: e.x + src.x, srcY: e.y + src.y, ...hit });
    world.enemies.delete(e.id);
    return Math.round((hp0 - e.hp) * 100) / 100;
  };
  check("Front heavy armor takes 25%", strike("front") === 25, `${strike("front")}`);
  check("Side medium armor takes 1.2x then 50%", strike("side") === 60, `${strike("side")}`);
  check("Backstab is 2x and still reduced by light back armor", strike("back") === 150, `${strike("back")}`);
  check("Head-flagged hits use head armor (super heavy)", strike("front", { head: true }) === 5, `${strike("front", { head: true })}`);
  check("Pierce 1 on the front: heavy acts as medium", strike("front", { armorPierce: 1 }) === 50, `${strike("front", { armorPierce: 1 })}`);

  const plainRat = world.spawnEnemy("clanrat", 0, 0, true)!;
  plainRat.hp = 9999;
  plainRat.facing = 0;
  damageEnemy(world, null, plainRat, { damage: 100, stagger: 0, srcX: plainRat.x - 30, srcY: plainRat.y });
  check("Unarmored backstab deals exactly double the attack's base damage", 9999 - plainRat.hp === 200, `${9999 - plainRat.hp}`);
  world.enemies.delete(plainRat.id);

  const storm = setup("soldier");
  const sv = storm.world.spawnEnemy("stormvermin", storm.hero.x + 30, storm.hero.y, true)!;
  sv.facing = Math.PI;
  sv.hp = 9999;
  damageEnemy(storm.world, null, sv, { damage: 100, stagger: 0, srcX: storm.hero.x, srcY: storm.hero.y });
  check("Stormvermin front is heavy armor", Math.round(9999 - sv.hp) === 25, `${9999 - sv.hp}`);
}

// Hero armor sets: defaults per hero, armor reduces incoming damage, trade-offs apply, buying replaces the set.
{
  for (const heroId of HERO_IDS) {
    const { hero } = setup(heroId);
    check(`${HEROES[heroId].name} starts in ${ARMOR_SETS[DEFAULT_ARMOR_SET[heroId]].name}`, hero.armorSetId === DEFAULT_ARMOR_SET[heroId]);
  }

  const sets = ARMOR_SETS as Record<string, ArmorSetDef>;
  sets.testHeavy = {
    id: "testHeavy" as ArmorSetId,
    name: "Test Heavy",
    hero: "dwarf",
    cost: 50,
    loadout: { head: "heavy", front: "heavy", side: "medium", back: "light" },
    tradeoffs: { speedMul: 0.8, dodgesDelta: 1, staminaMul: 0.5, dodgeDistanceMul: 0.5 },
    description: "Test only.",
  };

  const buy = setup("dwarf");
  buy.hero.gold = 60;
  buy.world.phase = "merchant";
  buy.world.spawnEnemy("merchant", buy.hero.x + 10, buy.hero.y, false);
  check("Kerri cannot buy Bardin's armor", !setup("ranger").world.buyArmorSet("h1", "testHeavy"));
  check("Bardin buys a full armor set", buy.world.buyArmorSet(buy.hero.id, "testHeavy") && buy.hero.armorSetId === ("testHeavy" as ArmorSetId) && buy.hero.gold === 10);
  check("Buying the worn set again is rejected", !buy.world.buyArmorSet(buy.hero.id, "testHeavy"));
  check("Armor trade-offs change stats", buy.hero.stats.speed === HEROES.dwarf.speed * 0.8 && buy.hero.stats.dodges === HEROES.dwarf.dodges + 1 && buy.hero.stats.stamina === HEROES.dwarf.stamina * 0.5);
  check("Stamina is capped to the new maximum", buy.hero.stamina <= buy.hero.stats.stamina);
  const mods = heroMoveMods(buy.hero);
  check("Armor slows movement and dodges", mods.speed === HEROES.dwarf.speed * 0.8 && mods.dodgeSpeed === DODGE.speed * 0.5);

  buy.world.phase = "playing";
  buy.hero.facing = 0;
  const hp0 = buy.hero.hp;
  strikeHero(buy.world, buy.hero, { damage: 40, stagger: 0, blockCost: 1, srcId: "e", srcX: buy.hero.x + 30, srcY: buy.hero.y });
  check("Hero front heavy armor takes 25%", Math.round(hp0 - buy.hero.hp) === 10, `${hp0} -> ${buy.hero.hp}`);
  const hp1 = buy.hero.hp;
  strikeHero(buy.world, buy.hero, { damage: 40, stagger: 0, blockCost: 1, srcId: "e", srcX: buy.hero.x - 30, srcY: buy.hero.y });
  check("Hero back light armor: 1.25x then 25% off", Math.round(hp1 - buy.hero.hp) === 38, `${hp1} -> ${buy.hero.hp}`);

  buy.world.startMission();
  check("Armor set persists into the next mission", buy.hero.armorSetId === ("testHeavy" as ArmorSetId));
  delete sets.testHeavy;
}

console.log(failures === 0 ? "\nAll combat checks passed" : `\n${failures} combat check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
