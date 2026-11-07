# Architecture Context

## Stack

| Layer          | Technology                          | Role                                                          |
| -------------- | ----------------------------------- | ------------------------------------------------------------- |
| Language       | TypeScript (strict)                 | Single language for client, server and shared rules           |
| Client engine  | Phaser 3                            | Rendering, input, audio, cameras, scenes                      |
| Client tooling | Vite                                | Dev server with hot reload; production client build           |
| Server         | Node.js + Colyseus                  | Rooms, room codes, joining, state sync over WebSockets        |
| State sync     | @colyseus/schema                    | Declares synced state; sends only changes each tick           |
| Server runtime | tsx                                 | Runs TypeScript server directly in dev and production         |
| Levels         | ASCII maps + shared procgen         | Hand-authored ASCII in `shared/src/levels/`; Gingey Wastes missions from `shared/src/procgen/` (seed + `LevelProperties`) |
| Menus          | HTML/CSS overlay (`client/index.html`, `client/src/ui/overlay.ts`) | Main menu, lobby, results, pause, settings |
| Hosting        | Fly.io (single region near players) | Serves the built client and runs the game server on one URL   |
| Repo layout    | npm workspaces                      | `client`, `server`, `shared` packages in one repository       |

## System Boundaries

- `client/` — Phaser game. Draws the world from server state, reads
  keyboard and mouse, sends inputs, plays sound, shows UI and HUD.
  Runs prediction of the local player's movement only, using `shared/`.
  Never decides damage, hits, deaths or enemy behaviour.
- `server/` — Colyseus rooms and the authoritative simulation loop
  (30 ticks/sec). Owns all game outcomes: movement, combat, AI,
  Director, spawning, win/lose. In production also serves the built
  client files.
- `shared/` — Pure game rules and data with no Phaser and no Colyseus
  imports: constants, math, collision, movement, combat resolution,
  weapon and enemy data tables, message types. Imported by both sides.
- Sprites are drawn in code at startup (`client/src/render/textures.ts`)
  and sounds and music are synthesised with WebAudio (`client/src/audio/`),
  so there are no asset files to download.
- `scripts/` — Headless tools run on the server simulation: `combat-test`,
  `mission-test`, `check:level`, `check:procgen`, `bot-test` (network smoke
  test) and `bot` (bot teammates that join a room by code).
- `context/` — Project documentation and specs for AI-driven development.

## Client Layout

- `scenes/GameScene.ts` — world drawing, input sending (30/sec), local
  prediction, interpolation of others, effects and sounds from `fx` events.
- `scenes/HudScene.ts` — health, block stamina, dodge pips, ammo, ultimate,
  teammates, announcements, event timer, boss bar, prompts.
- `net/` — connection (create/join/reconnect), prediction, interpolation.
- `render/` — level, creature views (weapon swing animation from attack
  data), effects, palette, generated textures.
- One-off events (hits, blocks, deaths, tracers, announcements) are sent as
  an `fx` message list each tick; lasting state is synced via the schema.

## Simulation Model

- Fixed tick: 30 ticks per second on the server (`TICK_RATE` in `shared/`).
- Clients send input messages each frame they change:
  movement vector, aim angle, and button states (light, heavy, block,
  dodge, push, interact), tagged with an input sequence number.
- The server applies queued inputs each tick, advances the simulation,
  and Colyseus syncs the changed state.
- Local player: predicted on the client with `shared/` movement code,
  reconciled against the server's last processed input sequence.
- Remote players and enemies: interpolated ~100ms behind on the client.

## Entity Model

Every creature (hero or enemy) has:

- `x`, `y` — position in world pixels
- `facing` — angle in radians; turns at a limited `turnSpeed`
- `radius` — collision and hit radius (varies per creature type)
- `state` — e.g. idle, moving, windup, attacking, recovery, blocking,
  staggered, dodging, downed, dead
- `hp`, plus heroes have `blockStamina` and `dodgeCharges`
- Combat rules read these fields the same way for heroes and enemies.

## Storage Model

- **In-memory (server)**: all room and match state. Nothing persists
  after a room closes.
- **Static files**: the client build only.
- **Browser storage**: settings and name in localStorage; a reconnect
  token in sessionStorage so a refresh rejoins the same seat.
- **No database.** No accounts, no saved progress (see out of scope).

## Auth and Access Model

- No accounts. A player supplies a display name when joining.
- A room is joined by its 4-letter code. Max 4 clients per room.
- The first player in a room is the host and can start the mission.
- Clients are untrusted: the server validates and clamps every input
  (e.g. movement vector length <= 1, aim angle is a finite number).

## Invariants

1. The server is authoritative for all combat, health, resources,
   enemy behaviour and win/lose outcomes.
2. Clients send only inputs (including aim direction), never
   positions, damage, hits or state changes.
3. Game rules and tuning numbers live in `shared/`. They are never
   duplicated or copy-pasted between client and server.
4. `shared/` never imports Phaser, Colyseus, DOM or Node-only APIs.
5. Phaser's built-in physics is never used for gameplay. Collision and
   movement come from `shared/`.
6. Weapons, attack chains, enemy stats and creature sizes are data
   tables in `shared/`, not hard-coded branches in logic.
7. Simulation code uses the fixed tick delta, never wall-clock time
   or frame rate.
8. Procedural wastes layouts are deterministic: server and client both
   call `generateLevel(props, seed)` so tile data is not synced wholesale.
9. Wastes proc missions enable the Director with difficulty budgets;
   exit victory requires the final boss objective, then a 10s party hold.
