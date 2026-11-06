import { isSolidTile, MISSION_1, parseLevel, TILE_SIZE, type Level } from "@twodverm/shared";

const level = parseLevel(MISSION_1);

function reachable(l: Level, gateOpen: boolean): Set<number> {
  const s = l.playerStarts[0];
  if (!s) throw new Error("Level has no S (player start) tiles");
  const start = Math.floor(s.y / TILE_SIZE) * l.width + Math.floor(s.x / TILE_SIZE);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const i = queue.shift()!;
    const x = i % l.width;
    const y = Math.floor(i / l.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (isSolidTile(l, gateOpen, x + dx, y + dy)) continue;
      const j = (y + dy) * l.width + (x + dx);
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen;
}

const closed = reachable(level, false);
const open = reachable(level, true);
const firstOf = (s: Set<number>) => [...s][0] ?? -1;
const problems: string[] = [];

if (level.playerStarts.length < 4) problems.push("Need at least 4 S tiles");
if (level.endZone.size === 0) problems.push("No E (end zone) tiles");
if (!closed.has(firstOf(level.holdZone))) problems.push("Hold zone H is not reachable from the start");
if (closed.has(firstOf(level.endZone))) problems.push("End zone is reachable without opening the gate");
if (!open.has(firstOf(level.endZone))) problems.push("End zone is not reachable even with the gate open");

console.log(`Level ${level.width}x${level.height}: ${level.hordeSpawns.length} horde spawns, ${level.specialSpawns.length} special spawns`);
if (problems.length > 0) {
  console.error("Problems:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Level OK");
