import type { AttackDef, EnemyDef, HeroDef, InputMessage, MoveBody, PerkId } from "@twodverm/shared";

export type AttackKind = "light" | "heavy" | "enemy";
export type AttackPhase = "windup" | "active" | "recovery";

export interface ActiveAttack {
  def: AttackDef;
  kind: AttackKind;
  phase: AttackPhase;
  /** Seconds elapsed in the current phase. */
  t: number;
  hit: Set<string>;
  hitsLeft: number;
  /** Riposte: this swing is a guaranteed critical with extended reach. */
  crit: boolean;
}

export type HeroState =
  | "idle"
  | "attack"
  | "charging"
  | "blocking"
  | "pushing"
  | "staggered"
  | "shooting"
  | "reviving"
  | "downed"
  | "grabbed"
  | "dead";

/** Button changes seen in this tick's inputs. */
export interface HeroEdges {
  dodgeStarted: boolean;
  fire: boolean;
  ult: boolean;
  interact: boolean;
  attackPressed: boolean;
  attackReleased: boolean;
}

export interface Hero extends MoveBody {
  id: string;
  name: string;
  def: HeroDef;
  radius: number;
  connected: boolean;
  /** Knockback velocity, decays every tick. */
  kvx: number;
  kvy: number;

  hp: number;
  state: HeroState;
  stateT: number;
  staggerT: number;
  attack: ActiveAttack | null;
  actionSeq: number;

  chainLight: number;
  chainHeavy: number;
  comboT: number;
  attackHeldT: number;
  prevAttackHeld: boolean;
  lightBufferT: number;
  chargeT: number;
  heavyQueued: boolean;

  stamina: number;
  staminaDelay: number;
  guardBrokenT: number;
  pushCd: number;

  dodgeCharges: number;
  dodgeRefillT: number;
  dodgeCooldown: number;
  iframesT: number;

  ammo: number;
  shotCd: number;
  /** True while the ranged weapon is equipped; left-click fires instead of melee. */
  rangedMode: boolean;
  /** Barrel currently equipped ("" if none). */
  carryingBarrelId: string;
  /** Seconds left-click has been held while charging a barrel throw. */
  barrelCharge: number;
  ultCd: number;
  ultActiveT: number;
  dashHit: Set<string>;

  downHp: number;
  reviveT: number;
  reviveTargetId: string;
  respawnT: number;
  grabbedBy: string;

  inputs: InputMessage[];
  lastInput: InputMessage | null;
  /** Latest world-space cursor aim (precision shots). */
  aimX: number;
  aimY: number;
  held: { attack: boolean; block: boolean; interact: boolean };
  edges: HeroEdges;
  ackSeq: number;

  kills: number;
  damageDealt: number;
  /** Personal gold purse (GP) for merchant spending; persists across wastes stops. */
  gold: number;
  /** Stacks of merchant "dmg up +10%"; persists for the whole run. */
  dmgUpStacks: number;
  /** Perks bought at the merchant; persist for the whole run. */
  perks: Set<PerkId>;
  /** Seconds until Rune Ward is ready again (ready when <= 0). */
  wardCd: number;
  /** Seconds of stealth remaining (Smoke Bomb). Enemies ignore her while > 0. */
  invisT: number;
  /** Dodge in progress should grant stealth when dodgeT hits 0. */
  vanishAfterDodge: boolean;
  /** Riposte charged: next melee attack is extended + critical. */
  riposteReady: boolean;
}

export type EnemyAiState =
  | "idle"
  | "chase"
  | "attack"
  | "staggered"
  | "aim"
  | "fire"
  | "reload"
  | "throw"
  | "flee"
  | "drag";

export interface Enemy {
  id: string;
  def: EnemyDef;
  x: number;
  y: number;
  facing: number;
  radius: number;
  kvx: number;
  kvy: number;
  hp: number;
  state: EnemyAiState;
  stateT: number;
  attack: ActiveAttack | null;
  actionSeq: number;
  aggro: boolean;
  targetId: string;
  cooldown: number;
  grabbedId: string;
  shotT: number;
  lastDamagerId: string;
  /** Seconds since any hero was near; used to despawn stragglers far behind. */
  lonelyT: number;
}

export interface Hazard {
  id: string;
  kind: "globe" | "gas" | "smoke";
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  radius: number;
  timeLeft: number;
  duration: number;
}

export interface Pickup {
  id: string;
  kind: "ammo" | "med";
  x: number;
  y: number;
  used: boolean;
}

export interface Barrel {
  id: string;
  x: number;
  y: number;
  hp: number;
  kvx: number;
  kvy: number;
  /** Hero id carrying this barrel, or "". */
  carriedBy: string;
  flying: boolean;
  vx: number;
  vy: number;
  flightT: number;
  landX: number;
  landY: number;
  throwerId: string;
}

export type Creature = Hero | Enemy;

export function isHero(c: Creature): c is Hero {
  return "def" in c && "weapon" in c.def;
}
