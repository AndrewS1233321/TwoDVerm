/**
 * Generates procedural levels for difficulties 1–4 and each levelType stub;
 * asserts reachability (gates open), section/objective counts, and starts/exit.
 */
import {
  generateLevel,
  LEVEL_TYPES,
  TILE_SIZE,
  validateGeneratedLevel,
  type LevelProperties,
  type LevelType,
} from "@twodverm/shared";

const problems: string[] = [];

function check(props: LevelProperties, seed: number): void {
  const { level, meta } = generateLevel(props, seed);
  const tag = `${props.levelType}@d${props.difficulty} seed=${seed}`;

  // Forest may shrink section count to fit its 3–5 room budget (see meta.budgets).
  if (meta.sections.length !== meta.budgets.sectionCount) {
    problems.push(`${tag}: expected ${meta.budgets.sectionCount} sections, got ${meta.sections.length}`);
  }
  if (meta.objectives.length !== meta.budgets.sectionCount) {
    problems.push(`${tag}: expected ${meta.budgets.sectionCount} objectives, got ${meta.objectives.length}`);
  }
  if (level.playerStarts.length < 1) problems.push(`${tag}: no player starts`);
  if (level.endZone.size === 0) problems.push(`${tag}: no exit zone`);

  const closed = validateGeneratedLevel(level, false);
  if (closed.reachable < 10) problems.push(`${tag}: almost nothing reachable with gates closed (${closed.reachable})`);

  const open = validateGeneratedLevel(level, true);
  if (!open.ok) problems.push(`${tag}: ${open.problems.join("; ")}`);

  const start = level.playerStarts[0]!;
  const sx = Math.floor(start.x / TILE_SIZE);
  const sy = Math.floor(start.y / TILE_SIZE);
  if (level.tiles[sy * level.width + sx] === undefined) {
    problems.push(`${tag}: start outside map`);
  }

  const last = meta.objectives[meta.objectives.length - 1];
  if (!last || last.kind !== "boss") problems.push(`${tag}: final objective is not boss`);

  if (props.levelType === "sewer") {
    for (const section of meta.sections) {
      const n = section.roomIds.length;
      if (n < 5 || n > 12) {
        problems.push(`${tag}: section ${section.index} has ${n} rooms (want 5–12)`);
      }
    }
  }
  if (props.levelType === "forest") {
    const playable = meta.rooms.filter((r) => r.role !== "exit").length;
    if (playable < 3 || playable > 5) {
      problems.push(`${tag}: forest has ${playable} rooms (want 3–5)`);
    }
    const areas = meta.rooms.filter((r) => r.role !== "exit").map((r) => r.w * r.h);
    const avg = areas.reduce((a, b) => a + b, 0) / Math.max(1, areas.length);
    if (avg < 50 || avg > 110) {
      problems.push(`${tag}: forest avg room area ${avg.toFixed(1)} (want ~75)`);
    }
  }

  console.log(
    `OK ${tag}: ${level.width}x${level.height}, ${meta.rooms.length} rooms, ${meta.objectives.length} objs, reachable=${open.reachable}`,
  );
}

let seed = 42;
for (const difficulty of [1, 2, 3, 4]) {
  for (const levelType of LEVEL_TYPES as readonly LevelType[]) {
    check(
      {
        levelType,
        difficulty,
        primaryRace: "skaven",
        allowableRaces: ["skaven"],
      },
      seed++,
    );
  }
}

// Determinism: same seed → same dimensions
const props: LevelProperties = {
  levelType: "dungeon",
  difficulty: 2,
  primaryRace: "skaven",
  allowableRaces: ["skaven", "beastmen"],
};
const a = generateLevel(props, 99901);
const b = generateLevel(props, 99901);
if (a.level.width !== b.level.width || a.level.height !== b.level.height) {
  problems.push("Determinism failed: size mismatch for same seed");
}
if (a.level.tiles.length !== b.level.tiles.length || !a.level.tiles.every((t, i) => t === b.level.tiles[i])) {
  problems.push("Determinism failed: tile mismatch for same seed");
}

if (problems.length > 0) {
  console.error("Procgen problems:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Procgen OK");
