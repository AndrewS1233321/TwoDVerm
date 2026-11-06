# Code Standards

## General

- Keep modules small and single-purpose (aim for under ~200 lines).
- Fix root causes; do not layer workarounds on top of bugs.
- Prefer plain functions operating on data over deep class hierarchies.
- Name tuning numbers as constants in `shared/`; no unexplained magic
  numbers in logic.
- Comments only explain constraints the code cannot show.

## TypeScript

- `strict` mode everywhere.
- Avoid `any`. Use explicit interfaces or narrow types.
- Validate every message from a client on the server before using it.
- Use `type` imports for types (`import type { X } from ...`).
- Angles are radians. Positions and radii are world pixels.
  Durations in data tables are milliseconds; simulation converts to ticks.

## Phaser (client)

- One Phaser `Scene` per screen: `MenuScene`, `LobbyScene`, `GameScene`,
  `ResultsScene`.
- Scenes render state and forward input; gameplay rules stay in `shared/`.
- Rendering objects are keyed by entity id and created/destroyed in
  response to server state add/remove events.
- Do not use Phaser Arcade or Matter physics for gameplay.

## Colyseus (server)

- One room type, `GameRoom`, registered as `"game"`.
- Synced state is declared with `@colyseus/schema` in `server/src/state/`.
- Sync only what clients need to draw; keep internal AI data out of
  the schema.
- Message handlers only validate and queue inputs; the tick loop
  applies them.

## Shared

- Pure, deterministic functions: same inputs give same outputs.
- No randomness without a passed-in seeded random function.
- Data tables (`weapons.ts`, `enemies.ts`, `heroes.ts`) are typed
  `as const` objects or arrays with exported interfaces.

## File Organization

- `client/src/scenes/` — Phaser scenes
- `client/src/net/` — Colyseus client connection, prediction, interpolation
- `client/src/render/` — sprite creation, effects, HUD drawing
- `client/public/assets/` — sprites, audio, maps
- `server/src/rooms/` — Colyseus room classes
- `server/src/state/` — schema state classes
- `server/src/sim/` — tick loop systems (combat, AI, director)
- `shared/src/` — constants, math, collision, movement, combat, data tables,
  message types
