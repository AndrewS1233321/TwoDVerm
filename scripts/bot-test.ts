/**
 * Headless smoke test: two bot players create and join a room by code, pick heroes,
 * start the mission, walk and attack. Run with the server already running:
 *   npx tsx scripts/bot-test.ts
 */
import { Client, type Room } from "colyseus.js";
import { MSG, ROOM_NAME, SERVER_PORT, type FxEvent, type InputMessage } from "@twodverm/shared";

const url = process.env.SERVER_URL ?? `ws://localhost:${SERVER_PORT}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRoom = Room<any>;

function inputLoop(room: AnyRoom, make: (seq: number) => Partial<InputMessage>): () => void {
  let seq = 0;
  const timer = setInterval(() => {
    seq++;
    const base: InputMessage = { seq, mx: 0, my: 0, aim: 0, attack: false, block: false, interact: false, dodge: false, fire: false, ult: false };
    room.send(MSG.input, { ...base, ...make(seq) });
  }, 1000 / 30);
  return () => clearInterval(timer);
}

async function main(): Promise<void> {
  const a = new Client(url);
  const b = new Client(url);
  const host: AnyRoom = await a.create(ROOM_NAME, { name: "HostBot" });
  console.log("Room code:", host.roomId);
  const guest: AnyRoom = await b.joinById(host.roomId, { name: "GuestBot" });
  await sleep(300);
  console.log("Players in room:", host.state.players.size);

  const fxCounts: Record<string, number> = {};
  host.onMessage(MSG.fx, (list: FxEvent[]) => {
    for (const e of list) fxCounts[e.t] = (fxCounts[e.t] ?? 0) + 1;
  });

  host.send(MSG.selectHero, { heroId: "soldier" });
  guest.send(MSG.selectHero, { heroId: "soldier" });
  await sleep(200);
  guest.send(MSG.selectHero, { heroId: "dwarf" });
  await sleep(300);
  const heroes = [...host.state.players.values()].map((p: { name: string; heroId: string }) => `${p.name}=${p.heroId}`);
  console.log("Heroes (duplicate pick should be refused):", heroes.join(", "));

  host.send(MSG.start);
  await sleep(400);
  console.log("Phase:", host.state.phase, "Enemies:", host.state.enemies.size, "Pickups:", host.state.pickups.size);

  const me = () => host.state.players.get(host.sessionId);
  const start = { x: me().x, y: me().y };
  const stopA = inputLoop(host, (seq) => ({ mx: 1, aim: 0, attack: seq % 20 < 3, dodge: seq === 45 }));
  const stopB = inputLoop(guest, () => ({ my: 1, aim: Math.PI / 2, block: true }));
  await sleep(2500);
  stopA();
  stopB();
  await sleep(300);

  const p = me();
  console.log(`Host moved from (${start.x.toFixed(0)},${start.y.toFixed(0)}) to (${p.x.toFixed(0)},${p.y.toFixed(0)}), ackSeq=${p.ackSeq}`);
  console.log(`Host dodges left ${p.dodgeCharges}/${p.maxDodges}, state=${p.state}`);
  const g = host.state.players.get(guest.sessionId);
  console.log(`Guest state=${g.state} (should be blocking or idle)`);
  console.log("FX seen:", JSON.stringify(fxCounts));

  await guest.leave();
  await host.leave();
  process.exit(0);
}

main().catch((err) => {
  console.error("Bot test failed:", err);
  process.exit(1);
});
