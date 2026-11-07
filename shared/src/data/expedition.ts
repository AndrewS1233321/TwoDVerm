/**
 * Gingey Wastes expedition locations — Chaos Wastes–style path choices.
 * Info fields mirror Holseher's Map tooltips (name, curse god, factions,
 * modifiers, completion reward). Content is placeholder for now.
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
    description: "A cracked stone bridge over a fogged ravine. Placeholder layout.",
    factions: "Skaven, Chaos",
    curse: null,
    modifiers: ["+ Hordes", "- Specials"],
    reward: "Placeholder boon: Pilgrim's Coin pouch",
  },
  weeping_quarry: {
    id: "weeping_quarry",
    name: "Weeping Quarry",
    description: "Flooded pits and rusted scaffolding. Placeholder layout.",
    factions: "Skaven, Beastmen",
    curse: "Nurgle",
    modifiers: ["+ Elites", "Extra health items"],
    reward: "Placeholder boon: Temporary toughness",
  },
  salt_hollow: {
    id: "salt_hollow",
    name: "Salt Hollow",
    description: "A bleached canyon cut by dry wind. Placeholder layout.",
    factions: "Skaven, Chaos",
    curse: "Tzeentch",
    modifiers: ["+ Specials", "- Hordes"],
    reward: "Placeholder boon: Ranged power",
  },
  cinder_watch: {
    id: "cinder_watch",
    name: "Cinder Watch",
    description: "Burned outposts and ash dunes. Placeholder layout.",
    factions: "Skaven, Chaos",
    curse: "Khorne",
    modifiers: ["+ Monsters", "Extra Pilgrim's Coins"],
    reward: "Placeholder boon: Melee power",
  },
};

export const EXPEDITION_LOCATION_IDS = Object.keys(EXPEDITION_LOCATIONS) as ExpeditionLocationId[];

/** How many locations a Gingey Wastes expedition runs before the final results. */
export const WASTES_EXPEDITION_STOPS = 4;

export function isExpeditionLocationId(v: unknown): v is ExpeditionLocationId {
  return typeof v === "string" && (EXPEDITION_LOCATION_IDS as string[]).includes(v);
}
