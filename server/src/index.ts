import { Server } from "colyseus";
import { ROOM_NAME, SERVER_PORT } from "@twodverm/shared";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT ?? SERVER_PORT);

const gameServer = new Server();
gameServer.define(ROOM_NAME, GameRoom);

await gameServer.listen(port);
console.log(`TwoDVerm server listening on port ${port}`);
