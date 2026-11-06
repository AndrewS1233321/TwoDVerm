import Phaser from "phaser";
import { ENEMIES, HEROES, type EnemyId, type HeroId, type WeaponStyle } from "@twodverm/shared";
import { palette, shade, toColorNumber } from "./palette";

/** Sprites are drawn at this multiple of world size and displayed scaled down, so they stay crisp when zoomed. */
export const TEX_SCALE = 2;

type G = Phaser.GameObjects.Graphics;

export function heroTextureKey(id: string): string {
  return `hero_${id}`;
}

export function enemyTextureKey(id: string): string {
  return `enemy_${id}`;
}

export function weaponTextureKey(style: string): string {
  return `w_${style}`;
}

/** Hand position (in world px, relative to centre, facing +x) where a creature holds its weapon. */
export function handOffset(radius: number): { x: number; y: number } {
  return { x: radius * 0.45, y: radius * 0.6 };
}

export type DrawnWeaponStyle = WeaponStyle | "ratblade" | "hookpole" | "repeater" | "longbow" | "handgun" | "pistols";

export const WEAPON_INFO: Record<DrawnWeaponStyle, { length: number; handle: number }> = {
  greatsword: { length: 46, handle: 4 },
  daggers: { length: 20, handle: 3 },
  hammer: { length: 36, handle: 3 },
  rapier: { length: 50, handle: 4 },
  claws: { length: 12, handle: 2 },
  halberd: { length: 50, handle: 6 },
  fists: { length: 8, handle: 2 },
  ratblade: { length: 22, handle: 3 },
  hookpole: { length: 46, handle: 6 },
  repeater: { length: 28, handle: 4 },
  longbow: { length: 36, handle: 4 },
  handgun: { length: 34, handle: 4 },
  pistols: { length: 18, handle: 3 },
};

export function rangedWeaponStyle(heroId: HeroId): DrawnWeaponStyle {
  return HEROES[heroId].ranged.id as DrawnWeaponStyle;
}

export function enemyWeaponStyle(id: EnemyId): keyof typeof WEAPON_INFO | null {
  switch (id) {
    case "slave":
    case "clanrat":
      return "ratblade";
    case "stormvermin":
      return "halberd";
    case "hooker":
      return "hookpole";
    default:
      return null;
  }
}

export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const id of Object.keys(HEROES) as HeroId[]) drawHero(scene, g, id);
  for (const id of Object.keys(ENEMIES) as EnemyId[]) drawEnemy(scene, g, id);
  for (const style of Object.keys(WEAPON_INFO) as DrawnWeaponStyle[]) drawWeapon(scene, g, style);
  drawPickups(scene, g);
  drawMisc(scene, g);
  g.destroy();
  makeGlow(scene);
}

function finish(scene: Phaser.Scene, g: G, key: string, w: number, h: number): void {
  g.generateTexture(key, Math.ceil(w), Math.ceil(h));
  g.clear();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function drawHero(scene: Phaser.Scene, g: G, id: HeroId): void {
  const def = HEROES[id];
  const R = def.radius * TEX_SCALE;
  const size = R * 2 + 12 * TEX_SCALE;
  const cx = size / 2;
  const cy = size / 2;
  const color = toColorNumber(def.color);
  const dark = shade(color, 0.55);
  const skin = 0xe0b08a;

  g.fillStyle(dark);
  g.fillEllipse(cx - R * 0.1, cy, R * 1.3, R * 2.15);
  g.fillStyle(color);
  g.fillCircle(cx - R * 0.15, cy, R * 0.92);
  g.lineStyle(TEX_SCALE * 1.2, 0x000000, 0.55);
  g.strokeCircle(cx - R * 0.15, cy, R * 0.92);
  g.fillStyle(skin);
  g.fillCircle(cx + R * 0.45, cy + R * 0.6, R * 0.2);
  g.fillCircle(cx + R * 0.35, cy - R * 0.55, R * 0.18);

  switch (id) {
    case "soldier":
      g.fillStyle(0x9aa3ad);
      g.fillCircle(cx + R * 0.12, cy, R * 0.5);
      g.fillStyle(0xc23b22);
      g.fillRect(cx - R * 0.45, cy - R * 0.09, R * 0.8, R * 0.18);
      g.fillStyle(0x2b2f35);
      g.fillRect(cx + R * 0.45, cy - R * 0.25, R * 0.1, R * 0.5);
      break;
    case "ranger":
      g.fillStyle(0x2f5e2c);
      g.fillCircle(cx + R * 0.08, cy, R * 0.52);
      g.fillTriangle(cx + R * 0.3, cy - R * 0.42, cx + R * 0.3, cy + R * 0.42, cx + R * 0.78, cy);
      g.fillStyle(skin);
      g.fillCircle(cx + R * 0.42, cy, R * 0.17);
      g.fillStyle(0xd8c27a);
      g.fillTriangle(cx - R * 0.1, cy - R * 0.5, cx - R * 0.6, cy - R * 0.75, cx - R * 0.25, cy - R * 0.25);
      break;
    case "dwarf":
      g.fillStyle(0xd9893a);
      g.fillTriangle(cx + R * 0.2, cy - R * 0.42, cx + R * 0.2, cy + R * 0.42, cx + R * 1.0, cy);
      g.fillStyle(0x8a8f96);
      g.fillCircle(cx + R * 0.02, cy, R * 0.5);
      g.fillStyle(0xe8e0d0);
      g.fillTriangle(cx - R * 0.05, cy - R * 0.4, cx + R * 0.1, cy - R * 0.4, cx - R * 0.2, cy - R * 0.95);
      g.fillTriangle(cx - R * 0.05, cy + R * 0.4, cx + R * 0.1, cy + R * 0.4, cx - R * 0.2, cy + R * 0.95);
      break;
    case "hunter":
      g.fillStyle(0x1b1b1f);
      g.fillCircle(cx + R * 0.05, cy, R * 0.78);
      g.fillStyle(0x2a2a30);
      g.fillCircle(cx + R * 0.05, cy, R * 0.42);
      g.lineStyle(TEX_SCALE * 1.6, color, 1);
      g.strokeCircle(cx + R * 0.05, cy, R * 0.44);
      g.fillStyle(0xd9b44a);
      g.fillRect(cx + R * 0.42, cy - R * 0.08, R * 0.12, R * 0.16);
      break;
  }
  finish(scene, g, heroTextureKey(id), size, size);
}

interface RatLook {
  fur: number;
  width: number;
  extra?: (g: G, cx: number, cy: number, R: number) => void;
}

const RAT_LOOKS: Partial<Record<EnemyId, RatLook>> = {
  slave: {
    fur: 0x7a6a58,
    width: 1.45,
    extra: (g, cx, cy, R) => {
      g.fillStyle(0x9b8a6a, 0.8);
      g.fillEllipse(cx - R * 0.3, cy + R * 0.2, R * 0.7, R * 0.5);
    },
  },
  clanrat: {
    fur: 0x5a4a3c,
    width: 1.65,
    extra: (g, cx, cy, R) => {
      g.fillStyle(0x6b4a2a);
      g.fillEllipse(cx + R * 0.05, cy - R * 0.55, R * 0.7, R * 0.45);
      g.fillEllipse(cx + R * 0.05, cy + R * 0.55, R * 0.7, R * 0.45);
    },
  },
  stormvermin: {
    fur: 0x2b2a2a,
    width: 1.8,
    extra: (g, cx, cy, R) => {
      g.fillStyle(0x4b4f58);
      g.fillEllipse(cx - R * 0.05, cy, R * 1.5, R * 1.55);
      g.fillStyle(0x8a1f1f);
      g.fillRect(cx - R * 0.75, cy - R * 0.12, R * 1.1, R * 0.24);
      g.lineStyle(TEX_SCALE, 0x9aa3ad, 0.8);
      g.strokeEllipse(cx - R * 0.05, cy, R * 1.5, R * 1.55);
    },
  },
  gunner: {
    fur: 0x6b5a48,
    width: 1.6,
    extra: (g, cx, cy, R) => {
      g.fillStyle(0x5a3b22);
      g.fillRect(cx - R * 1.25, cy - R * 0.7, R * 0.8, R * 1.4);
      g.fillStyle(0xb08d3a);
      g.fillCircle(cx - R * 0.85, cy, R * 0.38);
      g.fillStyle(0x2b2b2e);
      g.fillRect(cx + R * 0.2, cy + R * 0.2, R * 1.8, R * 0.42);
      g.fillStyle(0x7cff4f, 0.9);
      g.fillCircle(cx + R * 0.35, cy + R * 0.41, R * 0.14);
    },
  },
  gas: {
    fur: 0x6b5a48,
    width: 1.5,
    extra: (g, cx, cy, R) => {
      g.fillStyle(0x7cff4f, 0.95);
      for (const [dx, dy] of [[-0.5, -0.62], [0, -0.7], [-0.5, 0.62], [0, 0.7]] as const) g.fillCircle(cx + R * dx, cy + R * dy, R * 0.2);
      g.fillStyle(0x3a3a35);
      g.fillCircle(cx + R * 0.95, cy, R * 0.32);
      g.fillStyle(0x7cff4f);
      g.fillCircle(cx + R * 1.05, cy - R * 0.14, R * 0.09);
      g.fillCircle(cx + R * 1.05, cy + R * 0.14, R * 0.09);
    },
  },
  hooker: {
    fur: 0x5d4d3f,
    width: 1.75,
    extra: (g, cx, cy, R) => {
      g.fillStyle(0x3d3128);
      g.fillEllipse(cx - R * 0.35, cy, R * 1.1, R * 1.4);
      g.fillStyle(0x6b4a2a);
      g.fillCircle(cx + R * 0.85, cy, R * 0.3);
    },
  },
};

function drawEnemy(scene: Phaser.Scene, g: G, id: EnemyId): void {
  if (id === "ogre") {
    drawOgre(scene, g);
    return;
  }
  const def = ENEMIES[id];
  const look = RAT_LOOKS[id] ?? { fur: palette.ratFurNum, width: 1.6 };
  const R = def.radius * TEX_SCALE;
  const w = R * 5.4;
  const h = R * 3.2;
  const cx = w / 2;
  const cy = h / 2;

  const tail: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    tail.push(new Phaser.Math.Vector2(cx - R * 0.8 - t * R * 1.7, cy + Math.sin(t * 3) * R * 0.35));
  }
  g.lineStyle(R * 0.16, 0xc98b8b, 1);
  g.strokePoints(tail, false);

  g.fillStyle(look.fur);
  g.fillEllipse(cx - R * 0.1, cy, R * 2.1, R * look.width);
  g.lineStyle(TEX_SCALE, 0x000000, 0.5);
  g.strokeEllipse(cx - R * 0.1, cy, R * 2.1, R * look.width);
  look.extra?.(g, cx, cy, R);

  const head = shade(look.fur, 1.12);
  g.fillStyle(0xc98b8b);
  g.fillCircle(cx + R * 0.5, cy - R * 0.45, R * 0.24);
  g.fillCircle(cx + R * 0.5, cy + R * 0.45, R * 0.24);
  g.fillStyle(head);
  g.fillEllipse(cx + R * 0.72, cy, R * 0.95, R * 0.8);
  g.fillTriangle(cx + R * 0.9, cy - R * 0.3, cx + R * 0.9, cy + R * 0.3, cx + R * 1.5, cy);
  g.fillStyle(0xe58f9a);
  g.fillCircle(cx + R * 1.48, cy, R * 0.09);
  g.fillStyle(0xff2a1a);
  g.fillCircle(cx + R * 0.98, cy - R * 0.18, R * 0.07);
  g.fillCircle(cx + R * 0.98, cy + R * 0.18, R * 0.07);
  if (id === "stormvermin") {
    g.fillStyle(0x5b6068);
    g.fillEllipse(cx + R * 0.65, cy, R * 0.7, R * 0.72);
    g.fillStyle(0xd8d0c0);
    g.fillTriangle(cx + R * 0.5, cy - R * 0.3, cx + R * 0.65, cy - R * 0.3, cx + R * 0.35, cy - R * 0.75);
    g.fillTriangle(cx + R * 0.5, cy + R * 0.3, cx + R * 0.65, cy + R * 0.3, cx + R * 0.35, cy + R * 0.75);
  }
  finish(scene, g, enemyTextureKey(id), w, h);
}

function drawOgre(scene: Phaser.Scene, g: G): void {
  const R = ENEMIES.ogre.radius * TEX_SCALE;
  const size = R * 3.4;
  const cx = size / 2;
  const cy = size / 2;
  const skin = 0x5b5248;
  g.fillStyle(0x4d453d);
  g.fillEllipse(cx - R * 0.15, cy, R * 1.35, R * 2.2);
  g.fillStyle(skin);
  g.fillCircle(cx - R * 0.15, cy, R * 0.82);
  g.lineStyle(TEX_SCALE * 1.5, 0x000000, 0.5);
  g.strokeCircle(cx - R * 0.15, cy, R * 0.82);
  g.fillStyle(0x7cff4f, 0.85);
  for (const [dx, dy] of [[-0.6, -0.2], [-0.45, 0.25], [-0.75, 0.05]] as const) {
    g.fillTriangle(cx + R * dx, cy + R * dy, cx + R * (dx - 0.25), cy + R * (dy - 0.08), cx + R * (dx - 0.12), cy + R * (dy + 0.12));
  }
  for (const side of [-1, 1]) {
    g.fillStyle(0x4d453d);
    g.fillEllipse(cx + R * 0.5, cy + side * R * 0.78, R * 0.95, R * 0.55);
    g.fillStyle(0x6a5e52);
    g.fillCircle(cx + R * 0.98, cy + side * R * 0.8, R * 0.33);
    g.lineStyle(TEX_SCALE, 0x000000, 0.5);
    g.strokeCircle(cx + R * 0.98, cy + side * R * 0.8, R * 0.33);
  }
  g.fillStyle(0x6a5e52);
  g.fillCircle(cx + R * 0.42, cy, R * 0.38);
  g.fillStyle(0xe8e0d0);
  g.fillTriangle(cx + R * 0.68, cy - R * 0.2, cx + R * 0.68, cy - R * 0.05, cx + R * 0.95, cy - R * 0.22);
  g.fillTriangle(cx + R * 0.68, cy + R * 0.2, cx + R * 0.68, cy + R * 0.05, cx + R * 0.95, cy + R * 0.22);
  g.fillStyle(0xff2a1a);
  g.fillCircle(cx + R * 0.6, cy - R * 0.13, R * 0.06);
  g.fillCircle(cx + R * 0.6, cy + R * 0.13, R * 0.06);
  finish(scene, g, enemyTextureKey("ogre"), size, size);
}

function drawWeapon(scene: Phaser.Scene, g: G, style: DrawnWeaponStyle): void {
  const S = TEX_SCALE;
  const { length } = WEAPON_INFO[style];
  const w = (length + 4) * S;
  const h = 18 * S;
  const cy = h / 2;
  const steel = 0xc8ced6;
  const wood = 0x6b4a2a;
  switch (style) {
    case "greatsword":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.5 * S, 9 * S, 3 * S);
      g.fillStyle(0xd9b44a);
      g.fillRect(9 * S, cy - 5 * S, 2.5 * S, 10 * S);
      g.fillStyle(steel);
      g.fillRect(11.5 * S, cy - 2.5 * S, 30 * S, 5 * S);
      g.fillTriangle(41.5 * S, cy - 2.5 * S, 41.5 * S, cy + 2.5 * S, 46 * S, cy);
      g.lineStyle(S * 0.6, 0x8a9099, 1);
      g.lineBetween(12 * S, cy, 42 * S, cy);
      break;
    case "daggers":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.2 * S, 5 * S, 2.4 * S);
      g.fillStyle(0xd9b44a);
      g.fillRect(5 * S, cy - 3 * S, 1.5 * S, 6 * S);
      g.fillStyle(steel);
      g.fillTriangle(6.5 * S, cy - 2 * S, 6.5 * S, cy + 2 * S, 20 * S, cy);
      break;
    case "hammer":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.5 * S, 28 * S, 3 * S);
      g.fillStyle(0x8a8f96);
      g.fillRect(24 * S, cy - 7 * S, 11 * S, 14 * S);
      g.fillStyle(0xd9893a);
      g.fillRect(28 * S, cy - 1.5 * S, 3 * S, 3 * S);
      g.lineStyle(S, 0x4a4f56, 1);
      g.strokeRect(24 * S, cy - 7 * S, 11 * S, 14 * S);
      break;
    case "rapier":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.2 * S, 6 * S, 2.4 * S);
      g.lineStyle(S * 1.2, 0xd9b44a, 1);
      g.strokeCircle(7 * S, cy, 3.8 * S);
      g.fillStyle(steel);
      g.fillRect(8 * S, cy - 0.9 * S, 40 * S, 1.8 * S);
      g.fillTriangle(48 * S, cy - 0.9 * S, 48 * S, cy + 0.9 * S, 50 * S, cy);
      break;
    case "ratblade":
      g.fillStyle(0x3d3128);
      g.fillRect(0, cy - 1.2 * S, 5 * S, 2.4 * S);
      g.fillStyle(0x8a6a4a);
      g.fillTriangle(5 * S, cy - 2.5 * S, 5 * S, cy + 2.5 * S, 22 * S, cy - 0.5 * S);
      g.fillStyle(0x5a4030);
      g.fillCircle(12 * S, cy + 1 * S, 1 * S);
      break;
    case "halberd":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.3 * S, 46 * S, 2.6 * S);
      g.fillStyle(0x9aa3ad);
      g.fillTriangle(36 * S, cy - 1 * S, 44 * S, cy - 1 * S, 40 * S, cy - 8 * S);
      g.fillRect(36 * S, cy - 3 * S, 8 * S, 2 * S);
      g.fillTriangle(46 * S, cy - 1.5 * S, 46 * S, cy + 1.5 * S, 50 * S, cy);
      break;
    case "hookpole":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.3 * S, 40 * S, 2.6 * S);
      g.lineStyle(2.2 * S, 0x9aa3ad, 1);
      g.beginPath();
      g.arc(42 * S, cy - 3 * S, 4 * S, Math.PI * 0.5, Math.PI * 1.9, false);
      g.strokePath();
      break;
    case "claws":
    case "fists":
      g.fillStyle(0x8a8f96);
      g.fillCircle(6 * S, cy, 3 * S);
      break;
    case "repeater":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.5 * S, 8 * S, 3 * S);
      g.fillStyle(0x4a423b);
      g.fillRect(8 * S, cy - 2.5 * S, 16 * S, 5 * S);
      g.fillStyle(steel);
      g.fillRect(24 * S, cy - 1.2 * S, 6 * S, 2.4 * S);
      g.fillStyle(0xd9b44a);
      g.fillCircle(14 * S, cy + 4 * S, 2.2 * S);
      break;
    case "longbow":
      g.lineStyle(2.2 * S, wood, 1);
      g.beginPath();
      g.arc(18 * S, cy, 16 * S, -Math.PI * 0.55, Math.PI * 0.55, false);
      g.strokePath();
      g.lineStyle(S * 0.8, 0xe8e0d0, 1);
      g.lineBetween(10 * S, cy - 13 * S, 10 * S, cy + 13 * S);
      g.fillStyle(0xc9a14a);
      g.fillTriangle(10 * S, cy - 1 * S, 10 * S, cy + 1 * S, 34 * S, cy);
      break;
    case "handgun":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.5 * S, 10 * S, 3 * S);
      g.fillStyle(0x3d3832);
      g.fillRect(8 * S, cy - 2.8 * S, 22 * S, 5.6 * S);
      g.fillStyle(steel);
      g.fillRect(30 * S, cy - 1.4 * S, 6 * S, 2.8 * S);
      g.fillStyle(0xd9b44a);
      g.fillRect(12 * S, cy + 2.5 * S, 4 * S, 3 * S);
      break;
    case "pistols":
      g.fillStyle(wood);
      g.fillRect(0, cy - 1.3 * S, 6 * S, 2.6 * S);
      g.fillStyle(0x3d3832);
      g.fillRect(5 * S, cy - 2.2 * S, 10 * S, 4.4 * S);
      g.fillStyle(steel);
      g.fillRect(15 * S, cy - 1.1 * S, 5 * S, 2.2 * S);
      break;
  }
  finish(scene, g, weaponTextureKey(style), w, h);
}

function drawPickups(scene: Phaser.Scene, g: G): void {
  const S = TEX_SCALE;
  g.fillStyle(0x6b4a2a);
  g.fillRect(0, 0, 22 * S, 16 * S);
  g.lineStyle(S, 0x3d2a18, 1);
  g.strokeRect(0, 0, 22 * S, 16 * S);
  g.fillStyle(0xd9b44a);
  for (let i = 0; i < 5; i++) g.fillRect((3 + i * 3.5) * S, 4 * S, 2 * S, 8 * S);
  finish(scene, g, "pickup_ammo", 22 * S, 16 * S);

  g.fillStyle(0xe8e0d0);
  g.fillRect(0, 0, 18 * S, 16 * S);
  g.lineStyle(S, 0x8a8070, 1);
  g.strokeRect(0, 0, 18 * S, 16 * S);
  g.fillStyle(0xb3261e);
  g.fillRect(7.5 * S, 3 * S, 3 * S, 10 * S);
  g.fillRect(4 * S, 6.5 * S, 10 * S, 3 * S);
  finish(scene, g, "pickup_med", 18 * S, 16 * S);
}

function drawMisc(scene: Phaser.Scene, g: G): void {
  g.fillStyle(0x000000, 1);
  g.fillEllipse(32, 20, 64, 40);
  finish(scene, g, "shadow", 64, 40);

  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  finish(scene, g, "dot", 8, 8);

  g.lineStyle(3, 0x9a8f80, 1);
  g.lineBetween(12, 2, 12, 30);
  g.lineBetween(4, 10, 20, 10);
  finish(scene, g, "grave", 24, 32);
}

function makeGlow(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("glow", 128, 128);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  tex.refresh();
}
