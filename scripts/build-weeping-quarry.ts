/**
 * Builds a winding mine layout for Weeping Quarry and prints AuthoredMission rows.
 * Run: npx tsx scripts/build-weeping-quarry.ts
 */
const W = 152;
const H = 78;

const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "#"));

function fill(x0: number, y0: number, x1: number, y1: number, ch = "."): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) g[y]![x] = ch;
}

function set(x: number, y: number, ch: string): void {
  if (x >= 0 && y >= 0 && x < W && y < H && g[y]![x] !== "#") g[y]![x] = ch;
}

/** 3-wide corridor along an orthogonal polyline (tile centers of the path spine). */
function corridor(points: [number, number][]): void {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    if (y0 === y1) {
      fill(Math.min(x0, x1), y0 - 1, Math.max(x0, x1), y0 + 1, ".");
    } else if (x0 === x1) {
      fill(x0 - 1, Math.min(y0, y1), x0 + 1, Math.max(y0, y1), ".");
    } else {
      throw new Error(`diagonal segment ${x0},${y0} -> ${x1},${y1}`);
    }
  }
}

// Rooms
fill(4, 3, 20, 14); // camp
fill(34, 5, 52, 16); // scaffolds
fill(32, 22, 58, 36); // upper pit
fill(38, 26, 52, 32, "_"); // flood
fill(78, 30, 98, 46); // pump room
fill(88, 12, 108, 24); // drainage
fill(64, 52, 82, 64); // sump
fill(112, 28, 136, 46); // collapsed gallery
fill(114, 8, 134, 22); // old workings
fill(108, 54, 146, 72); // deep pit
fill(118, 60, 128, 64, "#"); // pillars
fill(134, 60, 138, 64, "#");
fill(86, 62, 100, 72); // exit alcove

// Winding corridors
corridor([
  [20, 10],
  [26, 10],
  [26, 18],
  [30, 18],
  [30, 10],
  [34, 10],
]); // camp -> scaffolds
corridor([
  [44, 16],
  [44, 19],
  [60, 19],
  [60, 24],
  [50, 24],
  [50, 22],
]); // scaffolds -> upper pit
corridor([
  [58, 30],
  [66, 30],
  [66, 42],
  [72, 42],
  [72, 36],
  [78, 36],
]); // upper pit -> pump
corridor([
  [92, 30],
  [92, 24],
]); // pump -> drainage
corridor([
  [82, 46],
  [82, 50],
  [74, 50],
  [74, 52],
]); // pump -> sump
corridor([
  [98, 38],
  [104, 38],
  [104, 50],
  [108, 50],
  [108, 40],
  [112, 40],
]); // pump -> gallery
corridor([
  [124, 28],
  [124, 22],
]); // gallery -> old workings
corridor([
  [124, 46],
  [124, 50],
  [140, 50],
  [140, 54],
  [130, 54],
]); // gallery -> deep pit
corridor([
  [108, 66],
  [100, 66],
]); // deep pit -> exit

// Objective zones
fill(84, 34, 94, 42, "H");
fill(118, 32, 132, 42, "K");
for (let y = 54; y <= 72; y++) {
  for (let x = 108; x <= 146; x++) {
    if (g[y]![x] === "." || g[y]![x] === "_") g[y]![x] = "B";
  }
}
fill(118, 60, 128, 64, "#");
fill(134, 60, 138, 64, "#");
fill(88, 64, 98, 70, "E");

// Gates last so they seal the 3-wide passages
for (let x = 103; x <= 105; x++) g[44]![x] = "1"; // vertical descent toward gallery
for (let x = 123; x <= 125; x++) g[48]![x] = "2"; // vertical descent toward deep pit
for (let y = 65; y <= 67; y++) g[y]![101] = "3"; // exit seal

// Markers
set(8, 8, "S");
set(9, 8, "S");
set(8, 9, "S");
set(9, 9, "S");
set(6, 5, "A");
set(17, 12, "b");
set(12, 13, "M");
set(40, 8, "b");
set(48, 14, "r");
set(36, 12, "h");
set(50, 28, "r");
set(42, 34, "p");
set(96, 14, "h"); // drainage
set(100, 16, "p");
set(104, 20, "M");
set(70, 56, "b");
set(66, 60, "h"); // sump
set(78, 62, "p");
set(90, 44, "A");
set(96, 32, "b");
set(86, 44, "s");
set(120, 12, "h"); // old workings
set(130, 16, "b");
set(128, 20, "r");
set(134, 36, "p");
set(116, 44, "b");
set(140, 58, "A");
set(112, 70, "b");
set(144, 68, "r");
set(110, 56, "s");
set(54, 8, "h"); // scaffolds far corner
set(46, 34, "h"); // upper pit rim

const rows = g.map((row) => row.join(""));
const labels = [
  { name: "camp", tx: 12, ty: 8 },
  { name: "scaffolds", tx: 43, ty: 10 },
  { name: "upper pit", tx: 45, ty: 29 },
  { name: "pump room", tx: 88, ty: 38 },
  { name: "drainage", tx: 98, ty: 18 },
  { name: "sump", tx: 73, ty: 58 },
  { name: "collapsed gallery", tx: 124, ty: 37 },
  { name: "old workings", tx: 124, ty: 15 },
  { name: "deep pit", tx: 127, ty: 63 },
  { name: "exit", tx: 93, ty: 67 },
];

import { writeFileSync } from "fs";
const out = `export const WEEPING_QUARRY: AuthoredMission = {
  floor: ".",
  theme: "mine",
  labels: ${JSON.stringify(labels, null, 4).replace(/"([^"]+)":/g, "$1:")},
  rows: [
${rows.map((r) => `    ${JSON.stringify(r)},`).join("\n")}
  ],
};
`;
writeFileSync("tmp/weeping_quarry_gen.ts", out);
console.log(`wrote tmp/weeping_quarry_gen.ts (${W}x${H})`);
