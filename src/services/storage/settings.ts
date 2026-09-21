export interface VisualSettings {
  screenShake: boolean;
  particleDensity: number; // 0..1.5
  crt: boolean;
  reducedMotion: boolean;
  gamepadVibration: boolean;
}

const DEFAULTS: VisualSettings = {
  screenShake: true,
  particleDensity: 1,
  crt: false,
  reducedMotion: false,
  gamepadVibration: true,
};

const KEY = 'gv.settings.v1';

export function loadSettings(): VisualSettings {
  let prefs: Partial<VisualSettings> = {};
  try {
    prefs = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<VisualSettings>;
  } catch {
    prefs = {};
  }
  // Honor OS "reduce motion" by default when the user hasn't chosen.
  if (!localStorage.getItem(KEY)) {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        prefs.reducedMotion = true;
        prefs.screenShake = false;
      }
    } catch {
      /* ignore */
    }
  }
  return { ...DEFAULTS, ...prefs };
}

export function saveSettings(s: VisualSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
