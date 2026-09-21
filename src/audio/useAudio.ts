import { useCallback, useEffect, useState } from 'react';
import { audio } from '../audio/engine';
import type { AudioSettings } from '../audio/engine';
import type { SfxName } from '../types';

/**
 * React wrapper around the singleton audio engine. The audio engine itself
 * is independent from React so games can call `playSfx` without re-rendering.
 */
export function useAudio(): {
  sfx: (name: SfxName) => void;
  unlock: () => void;
  settings: AudioSettings;
  updateSettings: (patch: Partial<AudioSettings>) => void;
  toggleMute: () => void;
  muted: boolean;
} {
  const [settings, setSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [muted, setMuted] = useState<boolean>(() => loadMuted());

  useEffect(() => {
    audio.setSettings(settings);
    audio.setMuted(muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, muted]);

  const sfx = useCallback((name: SfxName) => audio.play(name), []);
  const unlock = useCallback(() => {
    audio.unlock();
    audio.play('select');
  }, []);

  const updateSettings = useCallback((patch: Partial<AudioSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAudioSettings(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem('gv.muted', next ? '1' : '0');
      return next;
    });
  }, []);

  return { sfx, unlock, settings, updateSettings, toggleMute, muted };
}

const KEY = 'gv.audioSettings.v1';

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultAudio(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultAudio();
}

function defaultAudio(): AudioSettings {
  return { master: 0.8, music: 0.45, effects: 0.85, musicEnabled: true, effectsEnabled: true };
}

function saveAudioSettings(s: AudioSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function loadMuted(): boolean {
  try { return localStorage.getItem('gv.muted') === '1'; } catch { return false; }
}
