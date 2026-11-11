/**
 * Client-side shapes of the synced server state (server/src/state/GameState.ts).
 * Keep these in step with the server schema.
 */
export interface MapLike<T> {
  get(key: string): T | undefined;
  forEach(cb: (value: T, key: string) => void): void;
  values(): IterableIterator<T>;
  readonly size: number;
}

export interface PlayerView {
  id: string;
  name: string;
  heroId: string;
  connected: boolean;
  /** Host-spawned AI teammate. */
  isAi: boolean;
  x: number;
  y: number;
  facing: number;
  state: string;
  action: string;
  phase: number;
  actionSeq: number;
  charge: number;
  hp: number;
  maxHp: number;
  downHp: number;
  stamina: number;
  maxStamina: number;
  guardBroken: boolean;
  /** Blocking / pushing, or reviving while holding RMB. */
  guarding: boolean;
  dodgeCharges: number;
  maxDodges: number;
  ammo: number;
  maxAmmo: number;
  rangedMode: boolean;
  ultCooldown: number;
  ultActive: number;
  reviveProgress: number;
  respawnIn: number;
  grabbedBy: string;
  moveSpeed: number;
  turnRate: number;
  canDodge: boolean;
  dodgeT: number;
  dodgeDx: number;
  dodgeDy: number;
  dodgeSpeed: number;
  /** Speed a newly started dodge will use (after armor). */
  dodgeBaseSpeed: number;
  ackSeq: number;
  kills: number;
  damageDealt: number;
  /** Personal gold purse (GP). */
  gold: number;
  /** Merchant dmg-up stacks this run. */
  dmgUpStacks: number;
  /** Comma-separated owned perk ids. */
  perks: string;
  /** Equipped armor set id. */
  armorSetId: string;
  /** Rune Ward charged (glow). */
  wardReady: boolean;
  /** Riposte charged after a dodge. */
  riposteReady: boolean;
  /** Current melee swing is a Riposte crit. */
  riposteStrike: boolean;
  /** Kerri Elvish Wrath: holding F to charge. */
  wrathCharging: boolean;
  /** Kerri Elvish Wrath charge 0–1. */
  wrathCharge: number;
  /** Longbow hip-fire draw 0–1. */
  bowDraw: number;
  /** Seconds of Smoke Bomb stealth remaining. */
  invisT: number;
  /** Gingey Wastes vote (location id) or "". */
  vote: string;
  carryingBarrel: boolean;
  /** 0–1 throw charge while holding a barrel. */
  barrelCharge: number;
}

export interface EnemyView {
  id: string;
  type: string;
  x: number;
  y: number;
  facing: number;
  state: string;
  action: string;
  phase: number;
  actionSeq: number;
  hp: number;
  maxHp: number;
}

export interface PickupView {
  id: string;
  kind: string;
  x: number;
  y: number;
  used: boolean;
}

export interface BarrelView {
  id: string;
  x: number;
  y: number;
  hp: number;
  carriedBy: string;
  flying: boolean;
}

export interface HazardView {
  id: string;
  kind: string;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  radius: number;
  timeLeft: number;
  duration: number;
}

export interface GameStateView {
  phase: string;
  hostId: string;
  code: string;
  gameMode: string;
  /** Wastes host option: merchant + starting gold before the first map. */
  devTest: boolean;
  levelId: string;
  expeditionOptionA: string;
  expeditionOptionB: string;
  expeditionStop: number;
  merchantHold: number;
  levelProps: string;
  procSeed: number;
  expeditionPropsA: string;
  expeditionPropsB: string;
  finalObjectiveComplete: boolean;
  procProgress: number;
  gateOpen: boolean;
  eventActive: boolean;
  eventDone: boolean;
  eventTimeLeft: number;
  bossActive: boolean;
  objectiveCharge: number;
  objectiveCount: number;
  objectiveTarget: number;
  doorsSealed: boolean;
  missionTime: number;
  totalKills: number;
  players: MapLike<PlayerView>;
  enemies: MapLike<EnemyView>;
  pickups: MapLike<PickupView>;
  barrels: MapLike<BarrelView>;
  hazards: MapLike<HazardView>;
}
