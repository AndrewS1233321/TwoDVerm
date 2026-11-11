import { deg } from "./math";

export const HERO_TURN_RATE = 14;

export const DODGE = {
  time: 0.2,
  speed: 560,
  cooldown: 0.25,
  /** Seconds after the last dodge before charges start refilling. */
  refillDelay: 0.7,
  /** Seconds to refill one charge. */
  refillTime: 1.1,
};

export const DIRECTION = {
  /** Half-angle of the front cone. Hits inside it are "front" and can be blocked. */
  frontHalfArc: deg(60),
  /** Half-angle of the rear cone. Hits inside it are "back". */
  backHalfArc: deg(60),
};

export const BLOCK = {
  staminaRegenDelay: 0.9,
  staminaRegenPerSec: 1.4,
  guardBreakStagger: 0.8,
  guardBreakLockout: 1.2,
  guardBreakDamageMul: 0.5,
  /** Blocked hits at or above this stagger power still knock the blocker back briefly. */
  heavyBlockStaggerPower: 3,
  heavyBlockStaggerTime: 0.3,
};

export const PUSH = {
  cost: 0.5,
  reach: 34,
  arc: deg(140),
  power: 2,
  knockback: 280,
  cooldown: 0.45,
  duration: 0.25,
};

/** Damage multiplier by hit location, applied before armor. */
export const HERO_DAMAGE_TAKEN = { head: 1, front: 1, side: 1, back: 1.25 };
/** Back is the baseline backstab: double damage, still reduced by back armor. */
export const ENEMY_DAMAGE_TAKEN = { head: 1, front: 1, side: 1.2, back: 2 };

export const MELEE = {
  /** Holding attack at least this long turns it into a heavy charge instead of a light attack. */
  heavyHoldThreshold: 0.2,
  /** How long an early light-attack click is remembered. */
  lightBufferTime: 0.35,
  /** Idle time after which attack chains restart from the first attack. */
  comboResetTime: 0.9,
  /** Fraction of recovery after which the next attack in a chain may start. */
  chainWindow: 0.45,
  staggerTime: 0.5,
  backStaggerMul: 1.5,
};

/** Movement speed multiplier per hero state. */
export const HERO_STATE_SPEED: Record<string, number> = {
  idle: 1,
  windup: 0.55,
  active: 0.55,
  recovery: 0.75,
  charging: 0.6,
  blocking: 0.55,
  pushing: 0.5,
  staggered: 0.25,
  shooting: 0.7,
  reviving: 0,
  downed: 0.3,
  grabbed: 0,
  dead: 0,
};

export const HERO_STATE_TURN: Record<string, number> = {
  idle: 1,
  windup: 0.8,
  active: 0.3,
  recovery: 0.8,
  charging: 0.7,
  blocking: 1,
  pushing: 0.5,
  staggered: 0.15,
  shooting: 1,
  reviving: 0.5,
  downed: 0.4,
  grabbed: 0,
  dead: 0,
};

export const DOWNED = {
  hp: 100,
  bleedPerSec: 1,
  reviveTime: 3,
  reviveRange: 56,
  reviveHpFraction: 0.4,
  respawnTime: 45,
  respawnHpFraction: 0.5,
};

export const INTERACT_RANGE = 48;
/** Reach for set-piece interactions (cannon, bell); the props are larger than pickups. */
export const OBJECTIVE_INTERACT_RANGE = 72;
export const MED_HEAL_FRACTION = 0.6;

/** RMB precision aim while a ranged weapon is drawn. */
export const PRECISION_SHOT = {
  /** Hit radius around the aim point (no ray; only targets in this circle). */
  radius: 3,
  /** Minimum head hotspot radius (small rats). */
  headRadius: 4,
  /** Head hotspot also grows with body: at least radius × this. */
  headRadiusScale: 0.35,
  /** Head sits this fraction of radius along the enemy's facing (sprites face +X). */
  headOffset: 0.45,
  /** Damage multiplier when the aim hits the head hotspot. */
  headDamageMul: 2,
} as const;

export const HOOK = {
  dragSpeed: 70,
  dps: 4,
  maxDragTime: 10,
  holdDistance: 26,
  cooldown: 6,
  releaseStagger: 1.5,
};

export const GAS = {
  throwRangeMin: 180,
  throwRangeMax: 340,
  fleeDistance: 130,
  cooldown: 6,
  windup: 0.8,
  flightTime: 0.9,
  cloudRadius: 72,
  cloudTime: 6,
  heroDps: 10,
  enemyDps: 5,
};

export const GUNNER = {
  range: 360,
  aimTime: 1.3,
  fireTime: 2.6,
  shotInterval: 0.08,
  reloadTime: 3,
  damage: 2.5,
  blockCost: 0.15,
  spread: 0.09,
  turnRate: 1.3,
  maxShotDistance: 650,
};

/** Warpfire Thrower: closes in, winds up, then sprays a cone of fire. */
export const WARPFIRE = {
  approachRange: 200,
  windup: 1.1,
  sprayTime: 3,
  reloadTime: 4,
  range: 220,
  arc: Math.PI * (40 / 180),
  dps: 18,
  /** Facing turn rate while spraying (rad/s); slow, so heroes can flank. */
  sprayTurnRate: 0.9,
};

/** Stormfiend warpfire arms: long green cone that leaves burning ground. */
export const STORMFIEND_FIRE = {
  minRange: 160,
  /** How far away a target can be for the fiend to start spraying. */
  maxRange: 420,
  windup: 0.9,
  sprayTime: 2.2,
  cooldown: 7,
  range: 400,
  arc: Math.PI * (50 / 180),
  dps: 22,
  sprayTurnRate: 0.8,
  /** Lingering warpflame patches left on ground the cone sweeps. */
  groundBurnDuration: 5,
  groundBurnRadius: 30,
  groundBurnDps: 14,
  /** Along-cone / across-cone sample density when painting burn patches. */
  groundBurnSteps: 10,
  groundBurnRays: 5,
};

/** Gutter Runner: stalks unseen, leaps at an isolated hero, pins them. */
export const RUNNER = {
  leapRange: 220,
  leapWindup: 0.35,
  leapSpeed: 620,
  leapMaxTime: 0.5,
  /** Distance from the hero at which a leap connects. */
  leapHitPad: 8,
  pinDps: 9,
  recoverTime: 1.2,
  /** Minimum time between pounces; also how long it flees after a push stun. */
  cooldown: 5,
  /** Full stun when a hero push-blocks the pounce. */
  pushStun: 1.25,
};

/** Shield-bearers: guard break duration after a heavy hit or push lands on the shield. */
export const SHIELD = {
  breakStagger: 1.5,
  /** Stagger power that breaks the guard instead of being blocked. */
  breakPower: 2,
};

/** Sack Rat: flees when it sees heroes, despawns if it escapes. */
export const SACK_RAT = {
  fleeSight: 420,
  escapeDistance: 900,
  escapeTime: 6,
  maxPerLevel: 2,
};

export const ENEMY_AGGRO = {
  sightRange: 300,
  alwaysRange: 120,
  alertRadius: 220,
};
