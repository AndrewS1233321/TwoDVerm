export const palette = {
  bgBase: "#0e0c0b",
  floor: "#2a2623",
  wall: "#4a423b",
  surface: "#1c1917",
  textPrimary: "#e8e0d0",
  textMuted: "#9a8f80",
  accent: "#c9a14a",
  health: "#b3261e",
  stamina: "#d9c46a",
  dodge: "#5fa8d3",
  telegraph: "#ff5a1f",
  ratFur: "#6b5a48",
  warp: "#7cff4f",
  smoke: "#c4beb4",
  success: "#6fbf5f",
  /** Staging / testing circular exit portal (TO THE WASTES). */
  exitPortal: "#4a9fff",
  heroSoldier: "#3d6fb6",
  heroRanger: "#4f9a4a",
  heroDwarf: "#c4782f",
  heroHunter: "#8a3fa0",
  ratFurNum: 0x6b5a48,
} as const;

export function toColorNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

export const colors = {
  floor: toColorNumber(palette.floor),
  wall: toColorNumber(palette.wall),
  accent: toColorNumber(palette.accent),
  health: toColorNumber(palette.health),
  stamina: toColorNumber(palette.stamina),
  dodge: toColorNumber(palette.dodge),
  telegraph: toColorNumber(palette.telegraph),
  warp: toColorNumber(palette.warp),
  smoke: toColorNumber(palette.smoke),
  success: toColorNumber(palette.success),
  exitPortal: toColorNumber(palette.exitPortal),
  textPrimary: toColorNumber(palette.textPrimary),
  textMuted: toColorNumber(palette.textMuted),
};

/** Multiplies each RGB channel by k (k < 1 darkens, k > 1 lightens). */
export function shade(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((color & 0xff) * k));
  return (r << 16) | (g << 8) | b;
}
