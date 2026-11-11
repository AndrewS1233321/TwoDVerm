/**
 * Builds the Hallowed Rampart layout (besieged holy city) and prints AuthoredMission rows.
 * Run: npx tsx scripts/build-hallowed-rampart.ts
 * Section flow: training-yard hold (H, gate 1) -> gatehouse cannon (C, rubble wall 2)
 * -> temple bell (R zone, L bell, V wave spawns, 4 seal doors, exit gate 3).
 */
import { mkdirSync, writeFileSync } from "fs";

const W = 176;
const H = 84;
const F = ",";

const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "#"));

function fill(x0: number, y0: number, x1: number, y1: number, ch = F): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) g[y]![x] = ch;
}

function set(x: number, y: number, ch: string): void {
  if (g[y]?.[x] === undefined || g[y]![x] === "#") throw new Error(`marker ${ch} on wall at ${x},${y}`);
  g[y]![x] = ch;
}

/** 3-wide corridor along an orthogonal polyline (tile centers of the path spine). */
function corridor(points: [number, number][]): void {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    if (y0 === y1) fill(Math.min(x0, x1), y0 - 1, Math.max(x0, x1), y0 + 1);
    else if (x0 === x1) fill(x0 - 1, Math.min(y0, y1), x0 + 1, Math.max(y0, y1));
    else throw new Error(`diagonal segment ${x0},${y0} -> ${x1},${y1}`);
  }
}

// Barracks quarter (start)
fill(4, 58, 22, 78);
fill(14, 62, 15, 63, "#");
fill(14, 72, 15, 73, "#");

// Burning cart lane with wrecked carts
fill(22, 63, 58, 71);
fill(30, 65, 32, 66, "#");
fill(40, 68, 42, 69, "#");
fill(50, 64, 52, 65, "#");

// Fountain plaza
fill(58, 54, 82, 78);
fill(68, 64, 72, 68, "#");

// Training yard (hold) and drill shed
fill(56, 28, 84, 48);
fill(62, 20, 78, 27);
fill(62, 27, 67, 27, "#");
fill(73, 27, 78, 27, "#");
corridor([
  [70, 48],
  [70, 54],
]);

// Yard -> rampart barracks (gate 1)
corridor([
  [84, 38],
  [96, 38],
]);
fill(96, 30, 116, 46);
fill(100, 34, 101, 36, "#");
fill(110, 40, 111, 42, "#");

// Wall walk with two towers up to the gatehouse
corridor([
  [106, 30],
  [106, 8],
  [130, 8],
]);
fill(101, 14, 111, 22);
fill(116, 4, 124, 12);
fill(130, 3, 150, 20);
fill(136, 14, 137, 15, "#");
fill(143, 14, 144, 15, "#");

// Rubble wall (gate 2) -> north wall bastion -> statue terrace
corridor([
  [150, 12],
  [160, 12],
  [160, 28],
]);
fill(156, 6, 168, 16);
fill(146, 28, 172, 46);
fill(152, 33, 153, 34, "#");
fill(165, 33, 166, 34, "#");
fill(152, 40, 153, 41, "#");
fill(165, 40, 166, 41, "#");

// Temple (bell finale) and the exit beyond its west door
corridor([
  [160, 46],
  [160, 54],
]);
fill(134, 54, 172, 80);
fill(140, 60, 142, 62, "#");
fill(164, 60, 166, 62, "#");
fill(140, 72, 142, 74, "#");
fill(164, 72, 166, 74, "#");
corridor([
  [126, 70],
  [134, 70],
]);
fill(110, 62, 126, 78);

// Objective zones
fill(60, 32, 80, 45, "H");
for (let y = 54; y <= 80; y++) {
  for (let x = 134; x <= 172; x++) if (g[y]![x] === F) g[y]![x] = "R";
}
set(153, 66, "L");
for (const [x, y] of [
  [136, 56],
  [170, 56],
  [136, 79],
  [170, 79],
  [153, 79],
] as const) {
  set(x, y, "V");
}
set(138, 12, "C");
fill(114, 66, 122, 74, "E");

// Gates and doors last so they seal the 3-wide passages
for (let y = 37; y <= 39; y++) g[y]![89] = "1";
for (let y = 11; y <= 13; y++) g[y]![152] = "2";
for (let x = 159; x <= 161; x++) g[53]![x] = "4";
for (let y = 69; y <= 71; y++) g[y]![133] = "3";

// Barracks quarter
set(7, 68, "S");
set(8, 68, "S");
set(7, 69, "S");
set(8, 69, "S");
set(5, 60, "A");
set(20, 76, "M");
set(18, 60, "b");
set(6, 77, "b");
// Cart lane
set(26, 64, "h");
set(44, 64, "p");
set(36, 64, "b");
set(46, 70, "b");
set(34, 70, "r");
// Fountain plaza
set(60, 77, "h");
set(80, 56, "h");
set(79, 76, "M");
set(62, 56, "b");
set(76, 74, "r");
set(60, 60, "s");
// Drill shed / training yard
set(64, 21, "h");
set(77, 21, "h");
set(76, 23, "p");
set(57, 47, "A");
set(83, 30, "b");
set(57, 29, "b");
// Rampart barracks
set(114, 45, "h");
set(98, 44, "p");
set(115, 31, "M");
set(104, 44, "b");
set(112, 33, "s");
set(100, 40, "r");
// Towers and gatehouse
set(102, 15, "h");
set(110, 21, "p");
set(103, 21, "A");
set(122, 5, "h");
set(118, 10, "b");
set(120, 11, "r");
set(146, 5, "b");
set(132, 19, "M");
set(148, 18, "s");
// North wall and statue terrace
set(166, 7, "h");
set(162, 15, "r");
set(147, 29, "h");
set(170, 30, "p");
set(150, 30, "b");
set(170, 44, "A");
set(147, 44, "M");
set(158, 37, "s");
set(168, 37, "b");

const rows = g.map((row) => row.join(""));
const labels: [string, number, number][] = [
  ["barracks quarter", 13, 67],
  ["cart lane", 40, 66],
  ["fountain plaza", 70, 60],
  ["drill shed", 70, 23],
  ["training yard", 70, 30],
  ["rampart barracks", 106, 38],
  ["wall walk", 106, 26],
  ["watchtower", 106, 18],
  ["corner tower", 120, 8],
  ["gatehouse", 140, 6],
  ["north wall", 162, 10],
  ["statue terrace", 159, 30],
  ["temple of the hammer", 153, 57],
  ["exit", 118, 70],
];

const out = `export const HALLOWED_RAMPART: AuthoredMission = {
  floor: "${F}",
  sections: [
    { zone: "H", gate: "1", kind: "hold", eliteMix: true },
    { zone: "C", gate: "2", kind: "cannon" },
    { zone: "R", gate: "3", kind: "bell" },
  ],
  labels: [
${labels.map(([name, tx, ty]) => `    { name: ${JSON.stringify(name)}, tx: ${tx}, ty: ${ty} },`).join("\n")}
  ],
  rows: [
${rows.map((r) => `    ${JSON.stringify(r)},`).join("\n")}
  ],
};
`;
mkdirSync("tmp", { recursive: true });
writeFileSync("tmp/hallowed_rampart_gen.ts", out);
console.log(`wrote tmp/hallowed_rampart_gen.ts (${W}x${H})`);
