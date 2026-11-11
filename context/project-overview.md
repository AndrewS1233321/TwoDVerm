# Vermy-2D

## Overview

Vermy-2D is a browser-based, top-down 2D co-op action game heavily
inspired by Vermintide 2. Up to 4 friends fight through a grim city
overrun by ratmen, using timing-based melee combat (attack chains,
blocking, pushing, dodging) plus ranged weapons. Players join by
opening a link and typing a room code: no installs, no accounts. The
game is moderately fast-paced; reaction time and attack timing matter.

## Goals

1. 4 players on different home internet connections can play one
   mission together with combat that feels responsive (own movement
   reacts instantly; hits feel fair at up to ~120ms ping).
2. A friend can go from receiving a link to playing in under 1 minute
   with no downloads or sign-up.
3. Melee combat rewards skill: attack chains, directional hits
   (front vs back), blocking with stamina, and dodging with charges.
4. One complete mission (start, mid-event, end) with hordes, elites,
   specials and a boss, paced by an AI Director.

## Core User Flow

1. Host opens the game URL, picks a game mode (Default, Testing
   zone, or The Gingey Wastes), and clicks "Create game".
2. The game shows a 4-letter room code; host shares URL and code.
3. Friends open the URL, enter a name and the room code, click "Join".
4. In the lobby, each player picks a hero (unique per team).
5. Host starts: Default/Testing enter the mission; Gingey Wastes
   always opens the Testing zone staging hall (merchant + summon
   pads), whether or not DevTest is checked. DevTest still grants
   starting gold. When the whole party holds the green
   "TO THE WASTES" pad for 10s, Gingey's Map opens so the party votes
   on a forked path (Chaos Wastes style). Each option shows its level
   type, rolled difficulty, and races; Travel loads that location's
   hand-designed mission (one fixed layout per location).
6. All players spawn at the start zone of the chosen level.
7. Players fight through the level; the Director spawns hordes,
   specials and a boss (Default mission and Wastes missions).
   Wastes maps have section objectives (hold / mini-boss) and a final
   boss; the exit unlocks after the boss, then a 10s party hold.
   Campaign-style Wastes maps (Hallowed Rampart) swap in set pieces
   instead: an elite-mix hold, a cannon breach and a bell finale that
   unlocks the exit.
8. Downed players can be revived by teammates.
9. Mission ends in victory (end zone — instant on Default; hold after
   boss on Wastes) or defeat (all players downed). Wastes then enters
   the merchant hall → next map vote (4 stops) → results.

## Features

### Multiplayer

- Room creation and joining by 4-letter code (1 to 4 players)
- Server-authoritative simulation at 30 ticks per second
- Client-side prediction for own movement; interpolation for others
- Handling of players leaving and rejoining mid-mission

### Combat

- Mouse aim; every creature has a facing direction with limited turn speed
- Light attack chain (each click advances to the next attack)
- Heavy attack chain (click-and-hold charge; each heavy advances its chain)
- Every attack has wind-up, active and recovery phases, and a hit arc
- Cleave: some attacks hit multiple targets
- Directional hits: blocks only work from the front; hits from behind
  deal bonus damage and stagger (applies to players and enemies)
- Block stamina: spent on blocked hits and pushes; empty = guard break
- Dodge charges: separate resource; each dodge spends one; refill over time
- Push: short-range shove that staggers enemies
- Input buffering so slightly-early inputs still register

### Creatures

- Every creature has its own collision radius (small rats, medium
  heroes, huge ogre)
- Horde rats, clan rats, armoured elites
- Specials: gas thrower, hooker (grabs and drags), gunner
- Boss: rat ogre
- Enemies telegraph attacks with clear visual wind-ups

### Heroes

- 4 original archetypes: soldier, elf ranger, dwarf, witch hunter
- Each has a melee weapon, a ranged weapon with ammo, and an ultimate
- Downed state, crawling, and teammate revive

### World and pacing

- Linear levels drawn as ASCII maps in `shared/src/levels/`: the
  Default mission plus four Gingey Wastes missions (Grim Causeway,
  Weeping Quarry, Salt Hollow, Cinder Watch)
- AI Director controls hordes, specials and boss timing
- Mid-level "hold the point" horde event

### Presentation

- Simple code-drawn sprites that rotate to facing
- Hit feedback: flash, hit-pause, screen shake
- HUD: health, block stamina, dodge charges, ammo, teammate status
- Sound effects and music

## Scope

### In Scope

- Everything in Features above
- Keyboard and mouse controls on desktop browsers (Chrome, Edge, Firefox)
- Hosting on a single small cloud server (Fly.io)

### Out of Scope

- Bots to fill empty player slots
- Accounts, logins, saved progression, loot or unlocks
- Mobile or controller support
- Missions beyond the Default mission and the five Wastes missions
- Public matchmaking or server browser
- Voice or text chat (friends use Discord)
- Anti-cheat beyond server authority
- Any Fatshark art, audio or names

## Success Criteria

1. Four players on separate home connections complete a full mission
   without desyncs or disconnects.
2. A new player joins from a link and code in under 1 minute.
3. With 100ms simulated latency, own movement feels instant and
   blocks/dodges against telegraphed attacks work reliably.
4. A backstab deals visibly more damage than a frontal hit, and a
   frontal block stops a frontal hit but not a hit from behind.
5. Light and heavy chains each play their distinct attacks in order.
6. 60 enemies on screen with 4 players runs smoothly (60 FPS on a
   mid-range laptop).
