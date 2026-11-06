import { getSettings, onSettingsChange } from "../settings";

export type SfxName =
  | "swing"
  | "heavySwing"
  | "hit"
  | "backstab"
  | "armor"
  | "block"
  | "guardBreak"
  | "dodge"
  | "push"
  | "gun"
  | "bullet"
  | "arrow"
  | "squeak"
  | "horn"
  | "roar"
  | "alert"
  | "down"
  | "revive"
  | "pickup"
  | "ult"
  | "gas"
  | "hurt"
  | "chain"
  | "click";

const HEARING_DISTANCE = 900;
const MIN_REPEAT_MS = 45;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const lastPlayed = new Map<SfxName, number>();

/** Must be called from a user gesture (click or key) because browsers block audio until then. */
export function unlockAudio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = getSettings().masterVolume;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    onSettingsChange((s) => {
      if (master) master.gain.value = s.masterVolume;
    });
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function audioContext(): AudioContext | null {
  return ctx;
}

export function masterNode(): GainNode | null {
  return master;
}

interface Voice {
  c: AudioContext;
  out: GainNode;
  t: number;
}

function voice(volume: number): Voice | null {
  if (!ctx || !master || ctx.state !== "running") return null;
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(master);
  return { c: ctx, out, t: ctx.currentTime };
}

function tone(v: Voice, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  const o = v.c.createOscillator();
  const g = v.c.createGain();
  o.type = type;
  const t = v.t + delay;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(v.out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(v: Voice, filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, q = 1, delay = 0): void {
  if (!noise) return;
  const src = v.c.createBufferSource();
  src.buffer = noise;
  const bq = v.c.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  const t = v.t + delay;
  bq.frequency.setValueAtTime(f0, t);
  bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = v.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g).connect(v.out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const RECIPES: Record<SfxName, (v: Voice) => void> = {
  swing: (v) => hiss(v, "bandpass", 700, 2600, 0.13, 0.35, 2),
  heavySwing: (v) => hiss(v, "bandpass", 350, 1600, 0.22, 0.5, 2),
  hit: (v) => {
    hiss(v, "lowpass", 1800, 300, 0.1, 0.6);
    tone(v, "sine", 140, 60, 0.12, 0.6);
  },
  backstab: (v) => {
    hiss(v, "lowpass", 2200, 300, 0.12, 0.7);
    tone(v, "sine", 160, 55, 0.15, 0.7);
    tone(v, "triangle", 1700, 1400, 0.18, 0.25, 0.01);
  },
  armor: (v) => {
    tone(v, "square", 1300, 1250, 0.08, 0.12);
    tone(v, "triangle", 2500, 2400, 0.12, 0.15);
  },
  block: (v) => {
    for (const f of [620, 1130, 1870]) tone(v, "triangle", f, f * 0.97, 0.28, 0.22);
    hiss(v, "highpass", 3000, 2000, 0.05, 0.2);
  },
  guardBreak: (v) => {
    for (const f of [420, 780, 1310]) tone(v, "sawtooth", f, f * 0.8, 0.35, 0.15);
    tone(v, "sine", 90, 40, 0.3, 0.7);
    hiss(v, "lowpass", 1200, 200, 0.3, 0.5);
  },
  dodge: (v) => hiss(v, "bandpass", 400, 1400, 0.16, 0.3, 1.5),
  push: (v) => {
    hiss(v, "lowpass", 900, 150, 0.15, 0.5);
    tone(v, "sine", 110, 50, 0.12, 0.4);
  },
  gun: (v) => {
    hiss(v, "lowpass", 4000, 200, 0.25, 0.8);
    tone(v, "sine", 90, 35, 0.25, 0.8);
  },
  bullet: (v) => hiss(v, "highpass", 2500, 1200, 0.04, 0.25),
  arrow: (v) => {
    tone(v, "sawtooth", 320, 180, 0.12, 0.25);
    hiss(v, "bandpass", 2000, 4000, 0.15, 0.15, 3);
  },
  squeak: (v) => tone(v, "sine", 1800 + Math.random() * 400, 800, 0.14, 0.18),
  horn: (v) => {
    tone(v, "sawtooth", 110, 98, 1.8, 0.25);
    tone(v, "sawtooth", 82, 73, 1.8, 0.2, 0.05);
    hiss(v, "lowpass", 400, 200, 1.6, 0.15);
  },
  roar: (v) => {
    tone(v, "sawtooth", 80, 45, 1.3, 0.5);
    tone(v, "square", 60, 38, 1.2, 0.2, 0.05);
    hiss(v, "lowpass", 700, 120, 1.3, 0.6);
  },
  alert: (v) => {
    tone(v, "triangle", 660, 660, 0.15, 0.3);
    tone(v, "triangle", 990, 990, 0.25, 0.3, 0.14);
  },
  down: (v) => {
    tone(v, "triangle", 330, 220, 0.5, 0.35);
    tone(v, "triangle", 247, 165, 0.7, 0.3, 0.2);
  },
  revive: (v) => {
    tone(v, "triangle", 392, 392, 0.15, 0.3);
    tone(v, "triangle", 494, 494, 0.15, 0.3, 0.1);
    tone(v, "triangle", 587, 587, 0.3, 0.3, 0.2);
  },
  pickup: (v) => {
    tone(v, "sine", 880, 880, 0.1, 0.3);
    tone(v, "sine", 1320, 1320, 0.2, 0.25, 0.08);
  },
  ult: (v) => {
    for (const f of [130, 196, 261]) tone(v, "sawtooth", f, f * 1.5, 0.6, 0.15);
    hiss(v, "bandpass", 300, 3000, 0.6, 0.3, 1);
  },
  gas: (v) => {
    hiss(v, "lowpass", 1500, 200, 0.6, 0.5);
    for (let i = 0; i < 4; i++) tone(v, "sine", 200 + Math.random() * 300, 100, 0.08, 0.15, 0.1 + i * 0.09);
  },
  hurt: (v) => {
    tone(v, "sine", 220, 110, 0.18, 0.4);
    hiss(v, "lowpass", 900, 200, 0.12, 0.4);
  },
  chain: (v) => {
    for (let i = 0; i < 5; i++) tone(v, "square", 1800 + Math.random() * 800, 1500, 0.04, 0.08, i * 0.05);
  },
  click: (v) => tone(v, "triangle", 900, 700, 0.05, 0.15),
};

/** Plays a sound. If a world position and listener are given, it gets quieter with distance. */
export function playSfx(name: SfxName, opts: { volume?: number; at?: { x: number; y: number }; listener?: { x: number; y: number } } = {}): void {
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < MIN_REPEAT_MS) return;
  let vol = opts.volume ?? 1;
  if (opts.at && opts.listener) {
    const d = Math.hypot(opts.at.x - opts.listener.x, opts.at.y - opts.listener.y);
    if (d > HEARING_DISTANCE) return;
    vol *= 1 - (d / HEARING_DISTANCE) * 0.85;
  }
  const v = voice(vol);
  if (!v) return;
  lastPlayed.set(name, now);
  RECIPES[name](v);
}
