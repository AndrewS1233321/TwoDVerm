import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@twodverm/shared";

const inUse = new Set<string>();

export function claimRoomCode(): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
    if (!inUse.has(code)) {
      inUse.add(code);
      return code;
    }
  }
  throw new Error("No free room codes");
}

export function releaseRoomCode(code: string): void {
  inUse.delete(code);
}
