import { INTERP_DELAY_MS, lerp, lerpAngle } from "@twodverm/shared";

interface Snapshot {
  t: number;
  x: number;
  y: number;
  facing: number;
}

const MAX_SNAPSHOTS = 20;

/** Stores recent server positions for one entity and blends between them slightly in the past. */
export class SnapshotBuffer {
  private snaps: Snapshot[] = [];

  push(t: number, x: number, y: number, facing: number): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && t - last.t < 1) {
      last.x = x;
      last.y = y;
      last.facing = facing;
      return;
    }
    this.snaps.push({ t, x, y, facing });
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift();
  }

  sample(now: number): { x: number; y: number; facing: number } | null {
    const s = this.snaps;
    if (s.length === 0) return null;
    const rt = now - INTERP_DELAY_MS;
    if (rt <= s[0]!.t) return s[0]!;
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1]!;
      const b = s[i]!;
      if (rt >= a.t && rt <= b.t) {
        const k = (rt - a.t) / Math.max(1, b.t - a.t);
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), facing: lerpAngle(a.facing, b.facing, k) };
      }
    }
    return s[s.length - 1]!;
  }

  clear(): void {
    this.snaps = [];
  }
}
