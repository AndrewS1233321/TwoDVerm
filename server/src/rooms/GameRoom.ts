import { Room, type Client } from "colyseus";
import {
  DEV_TEST_START_GOLD,
  buildWastesLevel,
  DT,
  EXPEDITION_LOCATION_IDS,
  HERO_IDS,
  HEROES,
  isExpeditionLocationId,
  isHeroId,
  MAX_PLAYERS,
  MSG,
  rollLevelProperties,
  rollProcSeed,
  sanitizeGameMode,
  sanitizeInput,
  sanitizeName,
  serializeLevelProps,
  TICK_MS,
  WASTES_EXPEDITION_STOPS,
  type ExpeditionLocationId,
  type HeroId,
} from "@twodverm/shared";
import { thinkAiHero, type AiHeroBrain } from "../sim/aiHero";
import { GameState, PlayerState } from "../state/GameState";
import { queueInput } from "../sim/heroes";
import { syncHero, syncWorld } from "../sim/sync";
import { World } from "../sim/World";
import { claimRoomCode, releaseRoomCode } from "./roomCodes";

const RECONNECT_SECONDS = 30;

export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;
  state = new GameState();
  private world!: World;
  private code = "";
  /** Locations already cleared this expedition (preferred excluded from the next fork). */
  private playedLocations: ExpeditionLocationId[] = [];
  private lastPhase = "lobby";
  /** Combat brains for host-spawned AI teammates. */
  private readonly aiBrains = new Map<string, AiHeroBrain>();

  onCreate(options: unknown): void {
    const opts = options as { gameMode?: unknown; devTest?: unknown } | null;
    const mode = sanitizeGameMode(opts?.gameMode);
    const devTest = mode === "wastes" && opts?.devTest === true;
    this.world = new World(Math.floor(Math.random() * 2 ** 31), mode);
    this.world.devTest = devTest;
    this.state.gameMode = mode;
    this.state.devTest = devTest;
    this.state.levelId = this.world.levelId;

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
      if (!player || player.isAi) return;
      const taken = [...this.state.players.values()].some((p) => p.id !== client.sessionId && p.heroId === heroId);
      if (taken) return;
      player.heroId = heroId;
      this.world.heroes.delete(client.sessionId);
      this.world.addHero(client.sessionId, player.name, HEROES[heroId]);
    });

    this.onMessage(MSG.addAiHero, (client, raw: unknown) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "lobby") return;
      const heroId = (raw as { heroId?: unknown } | null)?.heroId;
      if (!isHeroId(heroId)) return;
      if (this.state.players.size >= MAX_PLAYERS) return;
      if ([...this.state.players.values()].some((p) => p.heroId === heroId)) return;
      const id = `ai-${heroId}`;
      if (this.state.players.has(id)) return;
      const player = new PlayerState();
      player.id = id;
      player.name = `AI ${HEROES[heroId].name}`;
      player.heroId = heroId;
      player.isAi = true;
      player.connected = true;
      this.state.players.set(id, player);
      this.world.addHero(id, player.name, HEROES[heroId]);
      this.aiBrains.set(id, { seq: 0, ranged: false });
      this.refreshMaxClients();
      console.log(`AI ${HEROES[heroId].name} seated in room ${this.code}`);
    });

    this.onMessage(MSG.removeAiHero, (client, raw: unknown) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "lobby") return;
      const heroId = (raw as { heroId?: unknown } | null)?.heroId;
      if (!isHeroId(heroId)) return;
      const id = `ai-${heroId}`;
      const player = this.state.players.get(id);
      if (!player?.isAi) return;
      this.removePlayer(id);
      this.aiBrains.delete(id);
      this.refreshMaxClients();
    });

    this.onMessage(MSG.start, (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "lobby") return;
      if ([...this.state.players.values()].some((p) => !p.heroId)) return;
      this.world.resetRunEconomy();
      if (this.state.gameMode === "wastes") {
        if (this.state.devTest) this.world.grantDevTestStartingGold();
        this.world.enterWastesHub();
        this.state.levelId = this.world.levelId;
        this.lastPhase = "merchant";
        this.syncAll();
        console.log(
          `Wastes staging hall opened in room ${this.code} (${this.state.players.size} players${
            this.state.devTest ? `, ${DEV_TEST_START_GOLD} GP` : ""
          })`,
        );
      } else {
        this.world.startMission();
        this.syncAll();
        console.log(`Mission started in room ${this.code} (${this.state.gameMode}) with ${this.state.players.size} players`);
      }
    });

    this.onMessage(MSG.buyShopItem, (client, raw: unknown) => {
      const itemId = (raw as { itemId?: unknown } | null)?.itemId;
      if (typeof itemId !== "string") return;
      if (this.world.buyShopItem(client.sessionId, itemId)) this.syncAll();
    });

    this.onMessage(MSG.buyPerk, (client, raw: unknown) => {
      const perkId = (raw as { perkId?: unknown } | null)?.perkId;
      if (typeof perkId !== "string") return;
      if (this.world.buyPerk(client.sessionId, perkId)) this.syncAll();
    });

    this.onMessage(MSG.buyArmorSet, (client, raw: unknown) => {
      const setId = (raw as { setId?: unknown } | null)?.setId;
      if (typeof setId !== "string") return;
      if (this.world.buyArmorSet(client.sessionId, setId)) this.syncAll();
    });

    this.onMessage(MSG.buyWeapon, (client, raw: unknown) => {
      const weaponId = (raw as { weaponId?: unknown } | null)?.weaponId;
      if (typeof weaponId !== "string") return;
      if (this.world.buyWeapon(client.sessionId, weaponId)) this.syncAll();
    });

    this.onMessage(MSG.voteLocation, (client, raw: unknown) => {
      if (this.state.phase !== "expedition") return;
      const locationId = (raw as { locationId?: unknown } | null)?.locationId;
      if (!isExpeditionLocationId(locationId)) return;
      if (locationId !== this.state.expeditionOptionA && locationId !== this.state.expeditionOptionB) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.vote = locationId;
      if (this.allConnectedVoted()) this.resolveExpeditionAndStart();
    });

    this.onMessage(MSG.travel, (client) => {
      if (client.sessionId !== this.state.hostId || this.state.phase !== "expedition") return;
      const anyVote = [...this.state.players.values()].some((p) => p.vote);
      if (!anyVote) return;
      this.resolveExpeditionAndStart();
    });

    this.onMessage(MSG.devPickLocation, (client, raw: unknown) => {
      if (!this.state.devTest) return;
      if (client.sessionId !== this.state.hostId || this.state.phase !== "expedition") return;
      const locationId = (raw as { locationId?: unknown } | null)?.locationId;
      if (!isExpeditionLocationId(locationId)) return;
      this.startExpeditionAt(locationId);
    });

    this.onMessage(MSG.returnToLobby, (client) => {
      if (client.sessionId !== this.state.hostId) return;
      if (this.state.phase !== "victory" && this.state.phase !== "defeat") return;
      this.resetExpeditionProgress();
      this.world.phase = "lobby";
      this.world.enemies.clear();
      this.world.hazards.clear();
      this.state.expeditionOptionA = "";
      this.state.expeditionOptionB = "";
      this.state.expeditionPropsA = "";
      this.state.expeditionPropsB = "";
      for (const p of this.state.players.values()) p.vote = "";
      this.syncAll();
    });

    console.log(`Room ${this.code} created (${mode})`);
  }

  private resetExpeditionProgress(): void {
    this.playedLocations = [];
    this.state.expeditionStop = 0;
    this.lastPhase = "lobby";
    this.world.resetRunEconomy();
  }

  onJoin(client: Client, options: unknown): void {
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new Error("Room is full");
    }
    const name = sanitizeName((options as { name?: unknown } | null)?.name);
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = name;
    player.isAi = false;
    this.state.players.set(client.sessionId, player);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    this.refreshMaxClients();

    if (this.state.phase !== "lobby" && this.state.phase !== "expedition") {
      const heroId = this.freeHeroId();
      if (heroId) {
        player.heroId = heroId;
        const hero = this.world.addHero(client.sessionId, name, HEROES[heroId]);
        this.world.placeLateJoiner(hero);
        // Catch up a late joiner to the opening staging hall before the first map.
        if (this.state.devTest && this.state.phase === "merchant" && this.state.expeditionStop === 0) {
          hero.gold = DEV_TEST_START_GOLD;
        }
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

  /** Opens Holseher's Map with two random forked locations (Chaos Wastes style). */
  private beginExpeditionVote(): void {
    const [a, b] = this.pickForkOptions();
    const nextStop = Math.min(this.state.expeditionStop + 1, WASTES_EXPEDITION_STOPS);
    this.state.expeditionOptionA = a;
    this.state.expeditionOptionB = b;
    this.state.expeditionPropsA = serializeLevelProps(
      rollLevelProperties(nextStop, a, rollProcSeed(this.world.roomSeed, nextStop, a)),
    );
    this.state.expeditionPropsB = serializeLevelProps(
      rollLevelProperties(nextStop, b, rollProcSeed(this.world.roomSeed, nextStop, b)),
    );
    for (const p of this.state.players.values()) p.vote = "";
    this.world.phase = "expedition";
    this.lastPhase = "expedition";
    this.syncAll();
  }

  /** Prefer unplayed locations; if fewer than two remain, redraw from the full pool. */
  private pickForkOptions(): [ExpeditionLocationId, ExpeditionLocationId] {
    const remaining = EXPEDITION_LOCATION_IDS.filter((id) => !this.playedLocations.includes(id));
    const pool = [...(remaining.length >= 2 ? remaining : EXPEDITION_LOCATION_IDS)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.world.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return [pool[0]!, pool[1]!];
  }

  private allConnectedVoted(): boolean {
    // Humans must vote; AI auto-vote separately and don't block the tally.
    const humans = [...this.state.players.values()].filter((p) => p.connected && !p.isAi);
    return humans.length > 0 && humans.every((p) => !!p.vote);
  }

  /** Cap Colyseus seats so AI + humans never exceed MAX_PLAYERS. */
  private refreshMaxClients(): void {
    const aiCount = [...this.state.players.values()].filter((p) => p.isAi).length;
    this.maxClients = Math.max(1, MAX_PLAYERS - aiCount);
  }

  private driveAiTeammates(): void {
    if (this.state.phase === "expedition") {
      for (const p of this.state.players.values()) {
        if (!p.isAi || p.vote) continue;
        p.vote = this.state.expeditionOptionA || this.state.expeditionOptionB;
      }
      if (this.allConnectedVoted()) this.resolveExpeditionAndStart();
      return;
    }
    if (this.state.phase !== "playing" && this.state.phase !== "merchant") return;
    for (const p of this.state.players.values()) {
      if (!p.isAi) continue;
      const hero = this.world.heroes.get(p.id);
      if (!hero) continue;
      let brain = this.aiBrains.get(p.id);
      if (!brain) {
        brain = { seq: 0, ranged: false };
        this.aiBrains.set(p.id, brain);
      }
      queueInput(hero, thinkAiHero(this.world, hero, brain));
    }
  }

  /** Majority vote wins; ties broken at random (Chaos Wastes style). */
  private resolveExpeditionAndStart(): void {
    const winner = this.tallyVotes();
    if (!winner) return;
    this.startExpeditionAt(winner);
  }

  /** Begin the next wastes stop at `winner` (vote result or devTest jump). */
  private startExpeditionAt(winner: ExpeditionLocationId): void {
    if (this.state.phase !== "expedition") return;
    this.state.expeditionStop += 1;
    const stop = this.state.expeditionStop;
    const seed = rollProcSeed(this.world.roomSeed, stop, winner);
    const props = rollLevelProperties(stop, winner, seed);
    const { level, meta } = buildWastesLevel(winner, props, seed);
    this.world.loadGeneratedLevel(winner, level, meta, props, seed);
    this.state.levelId = winner;
    this.state.expeditionPropsA = "";
    this.state.expeditionPropsB = "";
    this.world.startMission();
    this.lastPhase = "playing";
    this.syncAll();
    console.log(
      `Expedition stop ${stop}/${WASTES_EXPEDITION_STOPS}: ${winner} (${props.levelType} d${props.difficulty}) seed=${seed} in room ${this.code}`,
    );
  }

  /** After clearing a wastes map, send the party to the merchant hall. */
  private maybeContinueWastesExpedition(): void {
    if (this.state.gameMode !== "wastes") return;
    if (this.lastPhase !== "playing" || this.world.phase !== "victory") return;

    const cleared = this.world.levelId;
    if (isExpeditionLocationId(cleared) && !this.playedLocations.includes(cleared)) {
      this.playedLocations.push(cleared);
    }

    this.world.enterMerchantHall();
    this.state.levelId = this.world.levelId;
    this.lastPhase = "merchant";
    console.log(`Merchant hall opened in room ${this.code} after stop ${this.state.expeditionStop}`);
  }

  /** Merchant exit hold finished → next map vote, or expedition results after the last stop. */
  private maybeLeaveMerchant(): void {
    if (this.state.gameMode !== "wastes") return;
    if (this.world.phase !== "merchant" || !this.world.merchantDepart) return;
    this.world.merchantDepart = false;
    this.world.merchantHold = 0;
    this.world.enemies.clear();
    this.world.hazards.clear();
    this.world.pickups.clear();

    if (this.state.expeditionStop >= WASTES_EXPEDITION_STOPS) {
      this.world.phase = "victory";
      this.lastPhase = "victory";
      this.world.emit({
        t: "announce",
        text: "Expedition complete! The Wastes yield… for now.",
        kind: "info",
      });
      return;
    }

    this.world.emit({
      t: "announce",
      text:
        this.state.expeditionStop === 0
          ? "The Wastes await. Choose your first road."
          : `Onward (${this.state.expeditionStop}/${WASTES_EXPEDITION_STOPS}). Choose the next road.`,
      kind: "info",
    });
    this.beginExpeditionVote();
  }

  private tallyVotes(): ExpeditionLocationId | null {
    const counts = new Map<string, number>();
    for (const p of this.state.players.values()) {
      if (!p.vote) continue;
      counts.set(p.vote, (counts.get(p.vote) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    let best = 0;
    for (const n of counts.values()) best = Math.max(best, n);
    const tied = [...counts.entries()].filter(([, n]) => n === best).map(([id]) => id);
    const pick = tied[Math.floor(this.world.rng() * tied.length)]!;
    return isExpeditionLocationId(pick) ? pick : null;
  }

  private removePlayer(sessionId: string): void {
    const leaving = this.state.players.get(sessionId);
    const name = leaving?.name;
    this.state.players.delete(sessionId);
    this.aiBrains.delete(sessionId);
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
      const nextHuman = [...this.state.players.values()].find((p) => !p.isAi);
      this.state.hostId = nextHuman?.id ?? this.state.players.keys().next().value ?? "";
    }
    this.refreshMaxClients();
    console.log(`${name} left room ${this.code}`);
  }

  private freeHeroId(): HeroId | null {
    const taken = new Set([...this.state.players.values()].map((p) => p.heroId));
    return HERO_IDS.find((id) => !taken.has(id)) ?? null;
  }

  private tick(): void {
    this.driveAiTeammates();
    this.world.step(DT);
    this.maybeContinueWastesExpedition();
    this.maybeLeaveMerchant();
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
