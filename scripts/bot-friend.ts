/**
 * A simple bot teammate for testing without friends. It joins a room by code, picks a free
 * hero, follows the nearest player, fights nearby rats and revives downed teammates.
 *   npm run bot -- ABCD          (one bot)
 *   npm run bot -- ABCD 3        (three bots)
 */
import { Client, type Room } from "colyseus.js";
import { angleTo, dist, HERO_IDS, MSG, SERVER_PORT, type InputMessage } from "@twodverm/shared";

const url = process.env.SERVER_URL ?? `ws://localhost:${SERVER_PORT}`;
const code = (process.argv[2] ?? "").toUpperCase();
const count = Math.min(3, Math.max(1, Number(process.argv[3] ?? 1)));

interface P {
  id: string;
  heroId: string;
  x: number;
  y: number;
  state: string;
}
interface E {
  x: number;
  y: number;
  state: string;
  phase: number;
}
interface S {
  phase: string;
  players: Map<string, P>;
  enemies: Map<string, E>;
}

function think(room: Room<S>, seq: number): InputMessage {
  const input: InputMessage = { seq, mx: 0, my: 0, aim: 0, attack: false, block: false, interact: false, dodge: false, fire: false, ult: false };
  const me = room.state.players.get(room.sessionId);
  if (!me || room.state.phase !== "playing") return input;
  const others = [...room.state.players.values()].filter((p) => p.id !== me.id && p.state !== "dead");

  let nearest: E | null = null;
  let nd = Infinity;
  for (const e of room.state.enemies.values()) {
    const d = dist(me.x, me.y, e.x, e.y);
    if (d < nd) {
      nd = d;
      nearest = e;
    }
  }

  const downed = others.find((p) => p.state === "downed");
  if (downed && (!nearest || nd > 70)) {
    const d = dist(me.x, me.y, downed.x, downed.y);
    if (d > 40) {
      input.mx = (downed.x - me.x) / d;
      input.my = (downed.y - me.y) / d;
    }
    input.aim = angleTo(me.x, me.y, downed.x, downed.y);
    input.interact = d < 50;
    return input;
  }

  if (nearest && nd < 260) {
    input.aim = angleTo(me.x, me.y, nearest.x, nearest.y);
    if (nd > 46) {
      input.mx = (nearest.x - me.x) / nd;
      input.my = (nearest.y - me.y) / nd;
    }
    const threatened = nearest.state === "attack" && nearest.phase === 1 && nd < 70;
    if (threatened) input.block = true;
    else input.attack = nd < 70 && seq % 12 < 2;
    if (nd > 150 && seq % 45 === 0) input.fire = true;
    return input;
  }

  const leader = others.sort((a, b) => dist(me.x, me.y, a.x, a.y) - dist(me.x, me.y, b.x, b.y))[0];
  if (leader) {
    const d = dist(me.x, me.y, leader.x, leader.y);
    if (d > 80) {
      input.mx = (leader.x - me.x) / d;
      input.my = (leader.y - me.y) / d;
    }
    input.aim = angleTo(me.x, me.y, leader.x, leader.y);
  }
  return input;
}

async function runBot(index: number): Promise<void> {
  const client = new Client(url);
  const room = await client.joinById<S>(code, { name: `Bot ${index + 1}` });
  console.log(`Bot ${index + 1} joined ${code}`);
  let seq = 0;
  let picked = false;
  setInterval(() => {
    if (!room.state?.players) return;
    if (room.state.phase === "lobby" && !picked) {
      const me = room.state.players.get(room.sessionId);
      const taken = new Set([...room.state.players.values()].map((p) => p.heroId));
      const free = HERO_IDS.find((h) => !taken.has(h));
      if (me && !me.heroId && free) room.send(MSG.selectHero, { heroId: free });
      if (me?.heroId) picked = true;
    }
    if (room.state.phase === "lobby") picked = !!room.state.players.get(room.sessionId)?.heroId;
    seq++;
    room.send(MSG.input, think(room, seq));
  }, 1000 / 30);
  room.onLeave(() => {
    console.log(`Bot ${index + 1} left`);
    process.exit(0);
  });
}

if (code.length !== 4) {
  console.log("Usage: npm run bot -- ROOMCODE [count]");
  process.exit(1);
}
for (let i = 0; i < count; i++) {
  runBot(i).catch((err) => {
    console.error(`Bot ${i + 1} failed:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
