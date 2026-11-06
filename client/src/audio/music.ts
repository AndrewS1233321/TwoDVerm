import { getSettings, onSettingsChange } from "../settings";
import { audioContext, masterNode } from "./sfx";

const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63];
const COMBAT_BPM = 104;

/** Procedural ambience: a low drone with occasional bells, plus war drums during fights. */
export class Music {
  private gain: GainNode | null = null;
  private drumGain: GainNode | null = null;
  private started = false;
  private bellTimer = 0;
  private drumTimer = 0;
  private combatUntil = 0;

  start(): void {
    const ctx = audioContext();
    const master = masterNode();
    if (this.started || !ctx || !master) return;
    this.started = true;
    this.gain = ctx.createGain();
    this.gain.gain.value = getSettings().musicVolume * 0.5;
    this.gain.connect(master);
    this.drumGain = ctx.createGain();
    this.drumGain.gain.value = 0;
    this.drumGain.connect(this.gain);
    onSettingsChange((s) => {
      if (this.gain) this.gain.gain.value = s.musicVolume * 0.5;
    });

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.connect(this.gain);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    for (const [f, type] of [[55, "sawtooth"], [55.4, "sawtooth"], [82.4, "triangle"]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.value = 0.12;
      o.connect(g).connect(filter);
      o.start();
    }
  }

  /** Call when a horde, event or boss begins. */
  combat(seconds: number): void {
    this.combatUntil = Math.max(this.combatUntil, performance.now() + seconds * 1000);
  }

  update(dtSec: number): void {
    const ctx = audioContext();
    if (!this.started || !ctx || !this.gain || !this.drumGain) return;
    const inCombat = performance.now() < this.combatUntil;
    const target = inCombat ? 1 : 0;
    this.drumGain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);

    this.bellTimer -= dtSec;
    if (this.bellTimer <= 0) {
      this.bellTimer = 5 + Math.random() * 7;
      this.bell(ctx, SCALE[Math.floor(Math.random() * SCALE.length)]! * 2);
    }
    this.drumTimer -= dtSec;
    if (this.drumTimer <= 0) {
      const beat = 60 / COMBAT_BPM;
      this.drumTimer += beat;
      if (inCombat) this.drum(ctx, Math.random() < 0.3 ? 2 : 1);
    }
  }

  private bell(ctx: AudioContext, f: number): void {
    if (!this.gain) return;
    const t = ctx.currentTime;
    for (const [mul, vol] of [[1, 0.06], [2.76, 0.02], [5.4, 0.01]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      o.connect(g).connect(this.gain);
      o.start(t);
      o.stop(t + 4.1);
    }
  }

  private drum(ctx: AudioContext, hits: number): void {
    if (!this.drumGain) return;
    for (let i = 0; i < hits; i++) {
      const t = ctx.currentTime + i * 0.14;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.drumGain);
      o.start(t);
      o.stop(t + 0.4);
    }
  }
}
