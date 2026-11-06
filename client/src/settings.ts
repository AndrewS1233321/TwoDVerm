export interface Settings {
  masterVolume: number;
  musicVolume: number;
  damageNumbers: boolean;
  screenShake: boolean;
  name: string;
}

const KEY = "twodverm.settings";
const DEFAULTS: Settings = { masterVolume: 0.7, musicVolume: 0.4, damageNumbers: true, screenShake: true, name: "" };

let current: Settings = load();
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  for (const l of listeners) l(current);
}

export function onSettingsChange(cb: (s: Settings) => void): void {
  listeners.add(cb);
}
