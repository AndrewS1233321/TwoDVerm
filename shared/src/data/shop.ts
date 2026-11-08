export type ShopItemId = "dmg_up";

export interface ShopItemDef {
  id: ShopItemId;
  /** Display name shown in the merchant menu. */
  name: string;
  /** Short description under the title. */
  description: string;
  cost: number;
  /** Additive damage bonus per purchased stack (0.1 = +10%). */
  damageBonusPerStack: number;
}

export const SHOP_ITEMS: Record<ShopItemId, ShopItemDef> = {
  dmg_up: {
    id: "dmg_up",
    name: "dmg up +10%",
    description: "+10% damage to melee, ranged, and ultimates. Stacks for the whole run.",
    cost: 50,
    damageBonusPerStack: 0.1,
  },
};

export const SHOP_ITEM_IDS = Object.keys(SHOP_ITEMS) as ShopItemId[];

export function isShopItemId(v: unknown): v is ShopItemId {
  return typeof v === "string" && v in SHOP_ITEMS;
}

/** Multiplier applied to all hero damage from purchased dmg-up stacks. */
export function shopDamageMul(dmgUpStacks: number): number {
  if (dmgUpStacks <= 0) return 1;
  return 1 + dmgUpStacks * SHOP_ITEMS.dmg_up.damageBonusPerStack;
}
