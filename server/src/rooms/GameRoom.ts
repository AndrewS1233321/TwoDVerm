import { Room, type Client } from "colyseus";
import { MAX_PLAYERS, TICK_MS } from "@twodverm/shared";
import { GameState } from "../state/GameState";

export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;
  state = new GameState();

  onCreate(): void {
    this.setSimulationInterval(() => this.tick(), TICK_MS);
    console.log(`Room ${this.roomId} created`);
  }

  onJoin(client: Client): void {
    console.log(`Client ${client.sessionId} joined room ${this.roomId}`);
  }

  onLeave(client: Client): void {
    console.log(`Client ${client.sessionId} left room ${this.roomId}`);
  }

  onDispose(): void {
    console.log(`Room ${this.roomId} disposed`);
  }

  private tick(): void {}
}
