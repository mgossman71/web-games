import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { audio, type AudioSettings } from '../audio/engine';
import { loadSettings, saveSettings, type VisualSettings } from '../services/storage/settings';

interface Store {
  visual: VisualSettings;
  setVisual: (patch: Partial<VisualSettings>) => void;
  audioSettings: AudioSettings;
  setAudio: (patch: Partial<AudioSettings>) => void;
  muted: boolean;
  toggleMute: () => void;
  sfx: (name: Parameters<typeof audio.play>[0]) => void;
  reducedMotion: boolean;
}

const Ctx = createContext<Store | null>(null);

const AUDIO_KEY = 'gv.audioSettings.v1';
const MUTED_KEY = 'gv.muted';

function defaultAudio(): AudioSettings {
  return { master: 0.8, music: 0.45, effects: 0.85, musicEnabled: true, effectsEnabled: true };
}

function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (raw) return { ...defaultAudio(), ...(JSON.parse(raw) as Partial<AudioSettings>) };
  } catch {
    /* ignore */
  }
  return defaultAudio();
}

export function GlobalStoreProvider({ children }: { children: ReactNode }) {
  const [visual, setVisualState] = useState<VisualSettings>(() => loadSettings());
  const [audioSettings, setAudioState] = useState<AudioSettings>(() => loadAudioSettings());
  const [muted, setMutedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    audio.setSettings(audioSettings);
    audio.setMuted(muted);
  }, [audioSettings, muted]);

  const setVisual = useCallback((patch: Partial<VisualSettings>) => {
    setVisualState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const setAudio = useCallback((patch: Partial<AudioSettings>) => {
    setAudioState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(AUDIO_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const sfx = useCallback((name: Parameters<typeof audio.play>[0]) => audio.play(name), []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<Store>(
    () => ({
      visual,
      setVisual,
      audioSettings,
      setAudio,
      muted,
      toggleMute,
      sfx,
      reducedMotion: visual.reducedMotion,
    }),
    [visual, setVisual, audioSettings, setAudio, muted, toggleMute, sfx],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside GlobalStoreProvider');
  return ctx;
}
