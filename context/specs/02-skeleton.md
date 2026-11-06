# Unit 02: Project Skeleton

## Goal

A single `npm run dev` starts a Colyseus server on port 2567 and a Vite
dev server on port 5173. Opening http://localhost:5173 shows a Phaser
canvas with a dark stone floor and the text "TwoDVerm", and the browser
connects to the server's `"game"` room and shows "Connected" or an error.

## Design

- Full-window canvas, `bgBase` background, floor drawn as a grid of
  `floor`-coloured tiles with subtle `wall`-coloured grid lines.
- Status text top-left in `textMuted`.

## Implementation

### Root

- `package.json` with npm workspaces `shared`, `server`, `client`.
- Scripts: `dev` (runs server and client together), `typecheck`,
  `build` (client), `start` (server in production).
- `tsconfig.base.json` with strict settings shared by all packages.
- `.gitignore` for `node_modules`, `dist`, `__MACOSX`.

### shared

- Package `@twodverm/shared`, consumed as TypeScript source.
- `src/constants.ts`: `TICK_RATE = 30`, `SERVER_PORT = 2567`,
  `ROOM_NAME = "game"`, `MAX_PLAYERS = 4`, `TILE_SIZE = 32`.

### server

- Colyseus server on `SERVER_PORT` with one room `GameRoom` registered
  under `ROOM_NAME`, `maxClients = MAX_PLAYERS`.
- `GameRoom` has an empty schema state and a fixed-rate simulation
  interval at `TICK_RATE` (does nothing yet). Logs joins and leaves.

### client

- Vite + Phaser. `GameScene` draws the floor and status text.
- On start, connect with `colyseus.js` to
  `ws://<hostname>:2567` in dev and join or create `ROOM_NAME`.
- Show "Connected (session <id>)" or "Cannot reach server".

## Dependencies

- phaser, colyseus.js (client)
- colyseus, @colyseus/schema (server)
- vite, typescript, tsx, concurrently (dev tooling)

## Verify when done

- [ ] `npm install` succeeds
- [ ] `npm run dev` starts both servers without errors
- [ ] Browser shows the floor and "Connected (session ...)"
- [ ] Opening a second tab shows a second join in the server log
- [ ] Stopping the server makes a fresh page load show "Cannot reach server"
- [ ] `npm run typecheck` passes
