/**
 * Validates the authored Gingey Wastes missions at difficulties 1–4: size cap,
 * objective order, gate sequencing (each gate opens the next section only),
 * marker placement, set pieces (cannon, bell, seal doors) and determinism.
 */
import {
  AUTHORED_MAX_HEIGHT,
  AUTHORED_MAX_WIDTH,
  EXPEDITION_LOCATION_IDS,
  EXPEDITION_MISSIONS,
  missionSections,
  parseAuthoredMission,
  rollLevelProperties,
  TILE_GATE,
  TILE_SIZE,
  TILE_WALL,
  type Level,
  type Point,
} from "@twodverm/shared";

const problems: string[] = [];

function reachable(level: Level, openGates: ReadonlySet<number>): Set<number> {
  const s = level.playerStarts[0]!;
  return reachableFrom(level, Math.floor(s.y / TILE_SIZE) * level.width + Math.floor(s.x / TILE_SIZE), openGates);
}

function reachableFrom(level: Level, start: number, openGates: ReadonlySet<number>): Set<number> {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const i = queue.shift()!;
    const x = i % level.width;
    const y = (i - x) / level.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
      const j = ny * level.width + nx;
      const t = level.tiles[j]!;
      if (t === TILE_WALL || (t === TILE_GATE && !openGates.has(j)) || seen.has(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return seen;
}

const tileOf = (level: Level, p: Point) => Math.floor(p.y / TILE_SIZE) * level.width + Math.floor(p.x / TILE_SIZE);

for (const id of EXPEDITION_LOCATION_IDS) {
  for (const stop of [1, 2, 3, 4]) {
    const seed = 1000 + stop;
    const props = rollLevelProperties(stop, id, seed);
    const { level, meta } = parseAuthoredMission(id, props, seed);
    const tag = `${id}@d${props.difficulty}`;
    const fail = (msg: string) => problems.push(`${tag}: ${msg}`);

    if (level.width > AUTHORED_MAX_WIDTH || level.height > AUTHORED_MAX_HEIGHT) {
      fail(`size ${level.width}x${level.height} exceeds ${AUTHORED_MAX_WIDTH}x${AUTHORED_MAX_HEIGHT}`);
    }
    if (level.playerStarts.length < 4) fail("needs at least 4 player starts");
    if (level.endZone.size === 0) fail("no exit zone");
    const kinds = meta.objectives.map((o) => o.kind).join(",");
    const expected = missionSections(EXPEDITION_MISSIONS[id]);
    if (kinds !== expected.map((s) => s.kind).join(",")) fail(`objective order ${kinds}`);

    const open = new Set<number>();
    meta.objectives.forEach((obj, i) => {
      if (obj.zone.length === 0) fail(`${obj.kind} objective has no zone`);
      if (meta.sectionGates[i]!.length === 0) fail(`gate ${i + 1} missing`);
      const seen = reachable(level, open);
      if (!obj.zone.some((t) => seen.has(t))) fail(`${obj.kind} zone not reachable before gate ${i + 1}`);
      if (!seen.has(tileOf(level, obj.center))) fail(`${obj.kind} spawn centre not reachable`);
      if (obj.interactPoint && !seen.has(tileOf(level, obj.interactPoint))) fail(`${obj.kind} interact point not reachable before gate ${i + 1}`);
      if ((obj.kind === "cannon" || obj.kind === "bell") && !obj.interactPoint) fail(`${obj.kind} has no interact point`);
      const fightAt = obj.interactPoint ?? obj.center;
      const usable = level.hordeSpawns.filter((p) => {
        const d = Math.hypot(p.x - fightAt.x, p.y - fightAt.y);
        return seen.has(tileOf(level, p)) && d >= 520 && d <= 1500;
      });
      if (obj.kind !== "boss" && usable.length < 2) fail(`${obj.kind}: fewer than 2 horde spawns 16-47 tiles away`);
      for (const p of obj.spawnPoints ?? []) {
        if (!seen.has(tileOf(level, p))) fail(`${obj.kind} wave spawn ${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)} unreachable`);
      }
      const next = meta.objectives[i + 1];
      if (next && next.zone.some((t) => seen.has(t))) fail(`${next.kind} zone reachable before gate ${i + 1} opens`);
      if ([...level.endZone].some((t) => seen.has(t))) fail(`exit reachable before gate ${i + 1} opens`);
      for (const g of meta.sectionGates[i]!) open.add(g);
    });

    const all = reachable(level, open);
    if (![...level.endZone].some((t) => all.has(t))) fail("exit not reachable with all gates open");
    const bossObj = meta.objectives.find((o) => o.kind === "boss");
    if (bossObj && level.bossRoom.size !== bossObj.zone.length) fail("boss room does not match the B zone");
    if (!bossObj && level.bossRoom.size > 0) fail("boss room present without a boss section");

    const bellObj = meta.objectives.find((o) => o.kind === "bell");
    const sp = level.setPieces;
    if (bellObj) {
      if (!sp || sp.sealDoors.length === 0) fail("bell section has no seal doors");
      if ((bellObj.spawnPoints?.length ?? 0) < 2) fail("bell section needs at least 2 wave spawns (V)");
      for (const d of sp?.sealDoors ?? []) {
        if (sp!.bellZone.has(d)) fail("seal door inside the bell zone");
        const x = d % level.width;
        const y = Math.floor(d / level.width);
        const borders = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => sp!.bellZone.has((y + dy!) * level.width + x + dx!));
        if (!borders) fail(`seal door ${x},${y} does not border the bell zone`);
      }
      // With the doors shut, the bell zone must be cut off from everything outside it.
      const sealed: Level = { ...level, tiles: level.tiles.slice() };
      for (const d of sp?.sealDoors ?? []) sealed.tiles[d] = TILE_GATE;
      const bellStart = bellObj.interactPoint ?? bellObj.center;
      const inside = reachableFrom(sealed, tileOf(level, bellStart), new Set());
      for (const t of inside) {
        if (!sp!.bellZone.has(t)) {
          fail(`bell room leaks at ${t % level.width},${Math.floor(t / level.width)} while sealed`);
          break;
        }
      }
    }
    const cannonIdx = meta.objectives.findIndex((o) => o.kind === "cannon");
    if (cannonIdx >= 0 && sp && sp.rubbleGates.size !== meta.sectionGates[cannonIdx]!.length) {
      fail("rubble wall does not match the cannon gate");
    }

    const markers: [string, Point[]][] = [
      ["start", level.playerStarts],
      ["horde spawn", level.hordeSpawns],
      ["special spawn", level.specialSpawns],
      ["ambient rats", level.ambientRats],
      ["ambient elites", level.ambientElites],
      ["ammo", level.ammoCrates],
      ["med kit", level.medKits],
      ["barrel", level.barrelSpawns],
    ];
    for (const [name, points] of markers) {
      for (const p of points) {
        if (!all.has(tileOf(level, p))) fail(`${name} at ${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)} unreachable`);
      }
    }
    if (level.hordeSpawns.length < 4) fail("fewer than 4 horde spawns");
    if (level.specialSpawns.length < 3) fail("fewer than 3 special spawns");

    const again = parseAuthoredMission(id, props, seed);
    if (again.level.barrelSpawns.length !== level.barrelSpawns.length) fail("not deterministic for the same seed");

    console.log(
      `OK ${tag}: ${level.width}x${level.height}, hordes=${level.hordeSpawns.length} specials=${level.specialSpawns.length} ` +
        `barrels=${level.barrelSpawns.length} reachable=${all.size}`,
    );
  }
}

if (problems.length > 0) {
  console.error("Wastes mission problems:\n- " + [...new Set(problems)].join("\n- "));
  process.exit(1);
}
console.log("Wastes missions OK");
