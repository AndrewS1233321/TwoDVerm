import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME, SERVER_PORT } from "@twodverm/shared";
import { GameRoom } from "./rooms/GameRoom";
import { clientBuildExists, serveClient } from "./static";

const port = Number(process.env.PORT ?? SERVER_PORT);
const latencyArg = process.argv.find((a) => a.startsWith("--latency="));
const latency = Number(latencyArg?.split("=")[1] ?? process.env.SIMULATE_LATENCY ?? 0);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  if (clientBuildExists()) {
    serveClient(req, res);
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" }).end("TwoDVerm server running. In development open http://localhost:5173");
});

const transport = new WebSocketTransport({ server: httpServer });
if (latency > 0) {
  transport.simulateLatency(latency);
  console.log(`Simulating ${latency}ms of latency in each direction`);
}

const gameServer = new Server({ transport });
gameServer.define(ROOM_NAME, GameRoom);

await gameServer.listen(port);
console.log(`TwoDVerm server listening on port ${port}`);
