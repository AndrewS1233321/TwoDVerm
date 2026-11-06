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
  dodgeCharges: number;
  maxDodges: number;
  ammo: number;
  maxAmmo: number;
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
  ackSeq: number;
  kills: number;
  damageDealt: number;
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
  gateOpen: boolean;
  eventActive: boolean;
  eventDone: boolean;
  eventTimeLeft: number;
  bossActive: boolean;
  missionTime: number;
  totalKills: number;
  players: MapLike<PlayerView>;
  enemies: MapLike<EnemyView>;
  pickups: MapLike<PickupView>;
  hazards: MapLike<HazardView>;
}
