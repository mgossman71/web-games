export interface PlayerStats {
  gamesPlayed: number;
  totalPlayTimeMs: number;
  gameSessions: Record<string, number>;
  longestSessionMs: number;
  gamesCompleted: number;
  highScores: Record<string, number>;
}

const KEY = 'gv.stats.v1';

function load(): PlayerStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as PlayerStats);
  } catch {
    /* ignore */
  }
  return fresh();
}

function fresh(): PlayerStats {
  return {
    gamesPlayed: 0,
    totalPlayTimeMs: 0,
    gameSessions: {},
    longestSessionMs: 0,
    gamesCompleted: 0,
    highScores: {},
  };
}

function normalize(s: Partial<PlayerStats>): PlayerStats {
  return { ...fresh(), ...s, gameSessions: s.gameSessions ?? {}, highScores: s.highScores ?? {} };
}

function persist(s: PlayerStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const stats = {
  get(): PlayerStats {
    return load();
  },

  /** Call at game start. */
  startSession(gameId: string): void {
    const s = load();
    s.gamesPlayed += 1;
    s.gameSessions[gameId] = (s.gameSessions[gameId] ?? 0) + 1;
    persist(s);
  },

  /** Call at game end. */
  endSession(gameId: string, durationMs: number, completed: boolean, score: number): void {
    const s = load();
    s.totalPlayTimeMs += Math.max(0, durationMs);
    if (durationMs > s.longestSessionMs) s.longestSessionMs = durationMs;
    if (completed) s.gamesCompleted += 1;
    if (score > 0) s.highScores[gameId] = Math.max(s.highScores[gameId] ?? 0, score);
    persist(s);
  },

  favoriteGame(): string | null {
    const s = load();
    let best: string | null = null;
    let bestCount = 0;
    for (const [id, n] of Object.entries(s.gameSessions)) {
      if (n > bestCount) {
        best = id;
        bestCount = n;
      }
    }
    return best;
  },
};
