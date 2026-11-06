export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;
export const DT = 1 / TICK_RATE;

export const SERVER_PORT = 2567;
export const ROOM_NAME = "game";
export const MAX_PLAYERS = 4;

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const MAX_NAME_LENGTH = 16;

export const TILE_SIZE = 32;

/** How far behind real time remote entities are drawn, so there are always two snapshots to blend. */
export const INTERP_DELAY_MS = 110;
/** Server catch-up limit, so a burst of late inputs cannot make a player move faster than normal for long. */
export const MAX_INPUTS_PER_TICK = 3;
export const MAX_QUEUED_INPUTS = 15;

export const MAX_ENEMIES = 90;
