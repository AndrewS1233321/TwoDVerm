import { MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") heroId = "";
  @type("boolean") connected = true;

  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") facing = 0;
  @type("string") state = "idle";
  /** Current attack id (from shared data) or "" when not attacking. */
  @type("string") action = "";
  /** 0 none, 1 windup or charging, 2 active, 3 recovery. */
  @type("uint8") phase = 0;
  /** Increments every time a new attack or action starts, so clients can restart animations. */
  @type("uint16") actionSeq = 0;
  /** 0 to 1 heavy charge progress while charging. */
  @type("float32") charge = 0;

  @type("float32") hp = 0;
  @type("float32") maxHp = 0;
  @type("float32") downHp = 0;
  @type("float32") stamina = 0;
  @type("float32") maxStamina = 0;
  @type("boolean") guardBroken = false;
  /** True while blocking / pushing, or reviving with RMB held. */
  @type("boolean") guarding = false;
  @type("uint8") dodgeCharges = 0;
  @type("uint8") maxDodges = 0;
  @type("uint16") ammo = 0;
  @type("uint16") maxAmmo = 0;
  /** True while the ranged weapon is equipped (Q toggles). */
  @type("boolean") rangedMode = false;
  /** True while carrying a barrel (Q drops; hold attack to throw). */
  @type("boolean") carryingBarrel = false;
  @type("float32") barrelCharge = 0;
  @type("float32") ultCooldown = 0;
  @type("float32") ultActive = 0;
  @type("float32") reviveProgress = 0;
  @type("float32") respawnIn = 0;
  @type("string") grabbedBy = "";

  /** Movement values for client-side prediction. */
  @type("float32") moveSpeed = 0;
  @type("float32") turnRate = 0;
  @type("boolean") canDodge = false;
  @type("float32") dodgeT = 0;
  @type("float32") dodgeDx = 0;
  @type("float32") dodgeDy = 0;
  @type("float32") dodgeSpeed = 0;
  @type("uint32") ackSeq = 0;

  @type("uint16") kills = 0;
  @type("uint32") damageDealt = 0;
  /** Personal gold purse (GP). */
  @type("uint32") gold = 0;
  /** Merchant "dmg up +10%" stacks owned this run. */
  @type("uint16") dmgUpStacks = 0;
  /** Comma-separated owned perk ids. */
  @type("string") perks = "";
  /** True while Rune Ward is charged (drives the glow). */
  @type("boolean") wardReady = false;
  /** Seconds of Smoke Bomb stealth remaining. */
  @type("float32") invisT = 0;

  /** Gingey Wastes Holseher's Map vote (location id) or "". */
  @type("string") vote = "";
}

export class EnemyState extends Schema {
  @type("string") id = "";
  @type("string") type = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") facing = 0;
  @type("string") state = "idle";
  @type("string") action = "";
  @type("uint8") phase = 0;
  @type("uint16") actionSeq = 0;
  @type("float32") hp = 0;
  @type("float32") maxHp = 0;
}

export class PickupState extends Schema {
  @type("string") id = "";
  @type("string") kind = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("boolean") used = false;
}

export class BarrelState extends Schema {
  @type("string") id = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") hp = 0;
  @type("string") carriedBy = "";
  @type("boolean") flying = false;
}

export class HazardState extends Schema {
  @type("string") id = "";
  /** "globe" (flying gas globe) or "gas" (poison cloud). */
  @type("string") kind = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") fromX = 0;
  @type("float32") fromY = 0;
  @type("float32") radius = 0;
  @type("float32") timeLeft = 0;
  @type("float32") duration = 0;
}

export class GameState extends Schema {
  @type("string") phase = "lobby";
  @type("string") hostId = "";
  @type("string") code = "";
  /** "default" | "testing" | "wastes". Set once when the room is created. */
  @type("string") gameMode = "default";
  /** Host Wastes option: start at merchant with extra gold for shop testing. */
  @type("boolean") devTest = false;
  /** Current playable level id (mission, testing zone, or expedition location). */
  @type("string") levelId = "default";
  /** Holseher's Map fork option A (expedition location id). */
  @type("string") expeditionOptionA = "";
  /** Holseher's Map fork option B (expedition location id). */
  @type("string") expeditionOptionB = "";
  /** 1-based index of the next wastes stop to play (0 before the first Travel). */
  @type("uint8") expeditionStop = 0;
  /** Seconds the party has held the merchant exit or wastes exit (0–MERCHANT_EXIT_HOLD). */
  @type("float32") merchantHold = 0;
  /** Compact JSON LevelProperties for the active proc level, or "". */
  @type("string") levelProps = "";
  /** Deterministic seed for client-side regenerateLevel. */
  @type("uint32") procSeed = 0;
  /** Preview props for vote option A (serialized). */
  @type("string") expeditionPropsA = "";
  /** Preview props for vote option B (serialized). */
  @type("string") expeditionPropsB = "";
  @type("boolean") finalObjectiveComplete = false;
  /** Completed section objectives (opens soft gates). */
  @type("uint8") procProgress = 0;
  @type("boolean") gateOpen = false;
  @type("boolean") eventActive = false;
  @type("boolean") eventDone = false;
  @type("float32") eventTimeLeft = 0;
  @type("boolean") bossActive = false;
  @type("float32") missionTime = 0;
  @type("uint16") totalKills = 0;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  @type({ map: PickupState }) pickups = new MapSchema<PickupState>();
  @type({ map: BarrelState }) barrels = new MapSchema<BarrelState>();
  @type({ map: HazardState }) hazards = new MapSchema<HazardState>();
}
