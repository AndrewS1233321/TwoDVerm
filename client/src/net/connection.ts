import { Client, type Room } from "colyseus.js";
import { ROOM_NAME, SERVER_PORT } from "@twodverm/shared";

function serverUrl(): string {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  if (import.meta.env.DEV) {
    return `${protocol}://${location.hostname}:${SERVER_PORT}`;
  }
  return `${protocol}://${location.host}`;
}

export async function joinGame(): Promise<Room> {
  const client = new Client(serverUrl());
  return client.joinOrCreate(ROOM_NAME);
}
