import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '../services/storage/achievements';
import { achievements, type AchievementEvent } from '../services/storage/achievements';

interface Toast extends AchievementEvent {
  key: number;
}

/**
 * Global achievement toast feed. Mount anywhere (App root).
 * Toasts auto-dismiss; respects reduced-motion for animation.
 */
export function useAchievementToasts(): { toasts: Toast[]; dismiss: (key: number) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    const off = achievements.onUnlock((ev) => {
      const key = ++counter;
      setToasts((t) => [...t, { ...ev, key }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.key !== key));
      }, 5200);
    });
    return off;
  }, []);

  const dismiss = (key: number) => setToasts((t) => t.filter((x) => x.key !== key));
  return { toasts, dismiss };
}

export function achievementLabel(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
