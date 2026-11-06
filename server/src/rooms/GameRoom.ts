import { Room, type Client } from "colyseus";
import {
  DT,
  HERO_IDS,
  HEROES,
  isHeroId,
  MAX_PLAYERS,
  MSG,
  sanitizeInput,
  sanitizeName,
  TICK_MS,
  type HeroId,
} from "@twodverm/shared";
import { GameState, PlayerState } from "../state/GameState";
import { queueInput } from "../sim/heroes";
import { syncHero, syncWorld } from "../sim/sync";
import { World } from "../sim/World";
import { claimRoomCode, releaseRoomCode } from "./roomCodes";

const RECONNECT_SECONDS = 30;

export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;
  state = new GameState();
  private world = new World(Math.floor(Math.random() * 2 ** 31));
  private code = "";

  onCreate(): void {
    this.code = claimRoomCode();
    this.roomId = this.code;
    this.state.code = this.code;
    this.setPatchRate(TICK_MS);
    this.setSimulationInterval(() => this.tick(), TICK_MS);

    this.onMessage(MSG.input, (client, raw: unknown) => {
      const input = sanitizeInput(raw);
      const hero = this.world.heroes.get(client.sessionId);
      if (input && hero) queueInput(hero, input);
    });

    this.onMessage(MSG.selectHero, (client, raw: unknown) => {
      if (this.state.phase !== "lobby") return;
      const heroId = (raw as { heroId?: unknown } | null)?.heroId;
      if (!isHeroId(heroId)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const taken = [...this.state.players.values()].some((p) => p.id !== client.sessionId && p.heroId === heroId);
      if (taken) return;
      player.heroId = heroId;
      this.world.heroes.delete(client.sessionId);
      this.world.addHero(client.sessionId, player.name, HEROES[heroId]);
    });

    this.onMessage(MSG.start, (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "lobby") return;
      if ([...this.state.players.values()].some((p) => !p.heroId)) return;
      this.world.startMission();
      this.syncAll();
      console.log(`Mission started in room ${this.code} with ${this.state.players.size} players`);
    });

    this.onMessage(MSG.returnToLobby, (client) => {
      if (client.sessionId !== this.state.hostId) return;
      if (this.state.phase !== "victory" && this.state.phase !== "defeat") return;
      this.world.phase = "lobby";
      this.world.enemies.clear();
      this.world.hazards.clear();
      this.syncAll();
    });

    console.log(`Room ${this.code} created`);
  }

  onJoin(client: Client, options: unknown): void {
    const name = sanitizeName((options as { name?: unknown } | null)?.name);
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = name;
    this.state.players.set(client.sessionId, player);
    if (!this.state.hostId) this.state.hostId = client.sessionId;

    if (this.state.phase !== "lobby") {
      const heroId = this.freeHeroId();
      if (heroId) {
        player.heroId = heroId;
        const hero = this.world.addHero(client.sessionId, name, HEROES[heroId]);
        this.world.placeLateJoiner(hero);
        syncHero(hero, player);
      }
    }
    console.log(`${name} (${client.sessionId}) joined room ${this.code}`);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const hero = this.world.heroes.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (hero) hero.connected = false;
    if (player) player.connected = false;
    try {
      if (consented) throw new Error("left");
      await this.allowReconnection(client, RECONNECT_SECONDS);
      if (hero) hero.connected = true;
      if (player) player.connected = true;
      console.log(`${player?.name} reconnected to room ${this.code}`);
    } catch {
      this.removePlayer(client.sessionId);
    }
  }

  onDispose(): void {
    releaseRoomCode(this.code);
    console.log(`Room ${this.code} disposed`);
  }

  private removePlayer(sessionId: string): void {
    const name = this.state.players.get(sessionId)?.name;
    this.state.players.delete(sessionId);
    const hero = this.world.heroes.get(sessionId);
    if (hero?.grabbedBy) {
      const e = this.world.enemies.get(hero.grabbedBy);
      if (e) {
        e.grabbedId = "";
        e.state = "chase";
      }
    }
    this.world.heroes.delete(sessionId);
    if (this.state.hostId === sessionId) {
      this.state.hostId = this.state.players.keys().next().value ?? "";
    }
    console.log(`${name} left room ${this.code}`);
  }

  private freeHeroId(): HeroId | null {
    const taken = new Set([...this.state.players.values()].map((p) => p.heroId));
    return HERO_IDS.find((id) => !taken.has(id)) ?? null;
  }

  private tick(): void {
    this.world.step(DT);
    this.syncAll();
    if (this.world.fx.length > 0) {
      this.broadcast(MSG.fx, this.world.fx);
      this.world.fx = [];
    }
  }

  private syncAll(): void {
    syncWorld(this.world, this.state);
  }
}
