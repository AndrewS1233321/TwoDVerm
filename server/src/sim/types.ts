import type { AttackDef, EnemyDef, HeroDef, InputMessage, MoveBody } from "@twodverm/shared";

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
  held: { attack: boolean; block: boolean; interact: boolean };
  edges: HeroEdges;
  ackSeq: number;

  kills: number;
  damageDealt: number;
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
  kind: "globe" | "gas";
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

export type Creature = Hero | Enemy;

export function isHero(c: Creature): c is Hero {
  return "def" in c && "weapon" in c.def;
}
