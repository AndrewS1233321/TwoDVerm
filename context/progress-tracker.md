# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Foundation (units 1-2)

## Current Goal

- Unit 02: project skeleton (see `context/specs/02-skeleton.md`)

## Completed

- Unit 01: context files and build plan written.

## In Progress

- Unit 02: source files written; dependencies not yet installed
  (waiting for a good internet connection). Run `npm install` then
  `npm run dev` to verify.

## Next Up

- Unit 03: join by room code, server-moved players, deploy to Fly.io

## Open Questions

- Can light and heavy attacks mix within one combo (light, light,
  heavy as in Vermintide)? Decide in the unit 05b spec.
- Fly.io region: pick the one nearest all four players (likely Sydney).

## Architecture Decisions

- Server-authoritative simulation from the start, because retrofitting
  multiplayer onto a single-player game is very costly.
- Colyseus for rooms and state sync, to avoid writing low-level netcode.
- Phaser physics not used; collision lives in `shared/` so the server
  (which has no Phaser) runs the same rules.
- Every creature has facing and radius, so directional hits and
  different sizes work identically for heroes and enemies.
- Two separate player resources: block stamina and dodge charges.
- Sprites are code-drawn first; AI image generation used for
  backgrounds and menus.

## Session Notes

- Node v24 and git are installed on the dev machine.
