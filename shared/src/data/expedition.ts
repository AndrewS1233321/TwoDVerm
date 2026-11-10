/**
 * Gingey Wastes expedition locations — Chaos Wastes–style path choices.
 * Info fields mirror Holseher's Map tooltips (name, curse god, factions,
 * modifiers, completion reward). Rewards are still placeholder; each
 * location's layout lives in `levels/expeditionLevels.ts`.
 */

export type ExpeditionLocationId =
  | "grim_causeway"
  | "weeping_quarry"
  | "salt_hollow"
  | "cinder_watch";

export interface ExpeditionLocation {
  id: ExpeditionLocationId;
  name: string;
  /** Short blurb shown on the map detail panel. */
  description: string;
  /** Enemy faction mix, e.g. "Skaven, Chaos". */
  factions: string;
  /** Chaos god taking interest, or null if uncursed. */
  curse: string | null;
  /** Map modifiers shown as +/- lines on Holseher's Map. */
  modifiers: string[];
  /** Placeholder reward for finishing the location. */
  reward: string;
}

export const EXPEDITION_LOCATIONS: Record<ExpeditionLocationId, ExpeditionLocation> = {
  grim_causeway: {
    id: "grim_causeway",
    name: "Grim Causeway",
    description:
      "Storm a ravine fort: through the gatehouse and bailey, hold the causeway platform, clear the keep courtyard, then face what waits on the tower top.",
    factions: "Skaven, Chaos",
    curse: null,
    modifiers: ["+ Hordes", "- Specials"],
    reward: "Placeholder boon: Pilgrim's Coin pouch",
  },
  weeping_quarry: {
    id: "weeping_quarry",
    name: "Weeping Quarry",
    description:
      "Descend a flooded quarry: cross the scaffolds, hold the pump room, break through the collapsed gallery, and fight in the deep pit.",
    factions: "Skaven, Beastmen",
    curse: "Nurgle",
    modifiers: ["+ Elites", "Extra health items"],
    reward: "Placeholder boon: Temporary toughness",
  },
  salt_hollow: {
    id: "salt_hollow",
    name: "Salt Hollow",
    description:
      "Cross the open salt flats, hold the canyon choke, raid the camp in the side canyon, and survive the basin beyond.",
    factions: "Skaven, Chaos",
    curse: "Tzeentch",
    modifiers: ["+ Specials", "- Hordes"],
    reward: "Placeholder boon: Ranged power",
  },
  cinder_watch: {
    id: "cinder_watch",
    name: "Cinder Watch",
    description:
      "Fight through ash streets and burned houses, hold the watchtower, clear the market square, and end it in the gutted keep.",
    factions: "Skaven, Chaos",
    curse: "Khorne",
    modifiers: ["+ Monsters", "Extra Pilgrim's Coins"],
    reward: "Placeholder boon: Melee power",
  },
};

export const EXPEDITION_LOCATION_IDS = Object.keys(EXPEDITION_LOCATIONS) as ExpeditionLocationId[];

/** How many locations a Gingey Wastes expedition runs before the final results. */
export const WASTES_EXPEDITION_STOPS = 4;

/** Seconds the full party must stand in the merchant exit zone to depart. */
export const MERCHANT_EXIT_HOLD = 10;

export const WASTES_MERCHANT_LEVEL_ID = "wastes_merchant";

export function isExpeditionLocationId(v: unknown): v is ExpeditionLocationId {
  return typeof v === "string" && (EXPEDITION_LOCATION_IDS as string[]).includes(v);
}
