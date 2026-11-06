import { Client, type Room } from "colyseus.js";
import { ROOM_NAME, SERVER_PORT, type JoinOptions } from "@twodverm/shared";
import type { GameStateView } from "./types";

export type GameRoom = Room<GameStateView>;

/** The room's state is empty until the first patch arrives, which can be a while on a slow link. */
export function hasState(room: GameRoom | null): room is GameRoom {
  return !!room?.state?.players;
}

const RECONNECT_KEY = "twodverm.reconnect";

function serverUrl(): string {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  if (import.meta.env.DEV) return `${protocol}://${location.hostname}:${SERVER_PORT}`;
  return `${protocol}://${location.host}`;
}

const client = new Client(serverUrl());

function remember(room: GameRoom): void {
  sessionStorage.setItem(RECONNECT_KEY, JSON.stringify({ roomId: room.roomId, token: room.reconnectionToken }));
}

export async function createGame(options: JoinOptions): Promise<GameRoom> {
  const room = await client.create<GameStateView>(ROOM_NAME, options);
  remember(room);
  return room;
}

export async function joinGame(code: string, options: JoinOptions): Promise<GameRoom> {
  const room = await client.joinById<GameStateView>(code.trim().toUpperCase(), options);
  remember(room);
  return room;
}

/** Rejoins the room this tab was in before a refresh, if the server still holds the seat. */
export async function tryReconnect(): Promise<GameRoom | null> {
  const raw = sessionStorage.getItem(RECONNECT_KEY);
  if (!raw) return null;
  try {
    const { token } = JSON.parse(raw) as { roomId: string; token: string };
    const room = await client.reconnect<GameStateView>(token);
    remember(room);
    return room;
  } catch {
    forgetRoom();
    return null;
  }
}

export function forgetRoom(): void {
  sessionStorage.removeItem(RECONNECT_KEY);
}

/** Turns server errors into something a player can act on. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found|invalid/i.test(msg)) return "No game with that code. Check the code and try again.";
  if (/locked|full/i.test(msg)) return "That game is full (4 players max).";
  if (/ECONNREFUSED|Failed to fetch|NetworkError|offline/i.test(msg)) return "Cannot reach the game server.";
  return msg || "Something went wrong.";
}
