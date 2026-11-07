/**
 * Generates procedural levels for difficulties 1–4 and each levelType stub;
 * asserts reachability (gates open), section/objective counts, and starts/exit.
 */
import {
  budgetsFromDifficulty,
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
  const budgets = budgetsFromDifficulty(props.difficulty);
  const tag = `${props.levelType}@d${props.difficulty} seed=${seed}`;

  if (meta.sections.length !== budgets.sectionCount) {
    problems.push(`${tag}: expected ${budgets.sectionCount} sections, got ${meta.sections.length}`);
  }
  if (meta.objectives.length !== budgets.sectionCount) {
    problems.push(`${tag}: expected ${budgets.sectionCount} objectives, got ${meta.objectives.length}`);
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
