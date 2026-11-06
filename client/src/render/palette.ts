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
  success: "#6fbf5f",
  heroSoldier: "#3d6fb6",
  heroRanger: "#4f9a4a",
  heroDwarf: "#c4782f",
  heroHunter: "#8a3fa0",
} as const;

export function toColorNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}
