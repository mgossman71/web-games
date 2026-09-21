export interface ScoreRecord {
  value: number;
  /** Optional secondary value (e.g. best lap ms in the run). */
  time?: number;
  at: number;
}

const base = (gameId: string) => `gv.score.${gameId}`;
const TIME_PREFIX = 'gv.laptime';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const scores = {
  getBest(gameId: string): number {
    const v = read<number>(base(gameId));
    return typeof v === 'number' && isFinite(v) ? v : 0;
  },

  getBestWithMeta(gameId: string): ScoreRecord | null {
    return read<ScoreRecord>(base(gameId));
  },

  /** Returns true when this score set a new best. */
  submit(gameId: string, value: number): boolean {
    if (!isFinite(value) || value < 0) return false;
    const prev = scores.getBest(gameId);
    if (value <= prev) return false;
    const rec: ScoreRecord = { value, at: Date.now() };
    try {
      localStorage.setItem(base(gameId), JSON.stringify(rec));
    } catch {
      return false;
    }
    scores.recent.push(gameId, value);
    return true;
  },

  recent: {
    push(gameId: string, value: number): void {
      const key = `${base(gameId)}.recent`;
      let list = read<{ value: number; at: number }[]>(key) ?? [];
      list.unshift({ value, at: Date.now() });
      list = list.slice(0, 8);
      try {
        localStorage.setItem(key, JSON.stringify(list));
      } catch {
        /* ignore */
      }
    },
    list(gameId: string): { value: number; at: number }[] {
      return read<{ value: number; at: number }[]>(`${base(gameId)}.recent`) ?? [];
    },
  },
};

/** Track-specific best lap times (ms). */
export const lapTimes = {
  getBest(trackId: string): number | null {
    const v = read<number>(`${TIME_PREFIX}.${trackId}`);
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : null;
  },

  submit(trackId: string, ms: number): boolean {
    if (!isFinite(ms) || ms <= 0) return false;
    const prev = lapTimes.getBest(trackId);
    if (prev !== null && ms >= prev) return false;
    try {
      localStorage.setItem(`${TIME_PREFIX}.${trackId}`, JSON.stringify(Math.round(ms)));
    } catch {
      return false;
    }
    return true;
  },
};

export function allGameIds(): string[] {
  try {
    const ids = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k.startsWith('gv.score.') && !k.includes('.recent')) {
        ids.add(k.slice('gv.score.'.length));
      }
    }
    return [...ids];
  } catch {
    return [];
  }
}
