import type { AchievementId } from '../../types';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  icon: string; // emoji/glyph — no image assets
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-game', title: 'First Light', description: 'Play your first game', icon: '🕹️' },
  { id: 'score-1000', title: 'Thousand Club', description: 'Score 1,000 points in one game', icon: '⭐' },
  { id: 'five-games', title: 'Collectionist', description: 'Play five different games', icon: '🗂️' },
  { id: 'complete-race', title: 'Clean Lap', description: 'Finish a race in Neon Racer', icon: '🏁' },
  { id: 'survive-10', title: 'Wave Survivor', description: 'Reach wave/level 10 in any arcade game', icon: '🛡️' },
  { id: 'one-hour', title: 'Marathon', description: 'Play for a full session hour total', icon: '⏱️' },
  { id: 'beat-hard-ai', title: 'Machine Breaker', description: 'Beat a hard AI opponent', icon: '🤖' },
];

export interface AchievementEvent {
  id: AchievementId;
  at: number;
}

type Listener = (ev: AchievementEvent) => void;

const UNLOCKED_KEY = 'gv.achievements.v1';
const UNLOCK_COUNT_KEY = 'gv.achievementCount.v1';
const DIFFERENT_GAMES_KEY = 'gv.differentGames.v1';

function readUnlocked(): AchievementEvent[] {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    const list = raw ? (JSON.parse(raw) as AchievementEvent[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

class AchievementManager {
  private listeners = new Set<Listener>();
  private cache: Map<AchievementId, boolean>;
  private differentGames: string[];

  constructor() {
    this.cache = new Map(readUnlocked().map((e) => [e.id, true]));
    try {
      const raw = localStorage.getItem(DIFFERENT_GAMES_KEY);
      this.differentGames = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      this.differentGames = [];
    }
  }

  isUnlocked(id: AchievementId): boolean {
    return this.cache.get(id) === true;
  }

  unlockedList(): AchievementEvent[] {
    return readUnlocked();
  }

  /**
   * Mark a game as played. Returns true (and auto-unlocks 'first-game'
   * and — after the 5th distinct game — 'five-games') when relevant.
   */
  recordGamePlayed(gameId: string, session: { totalMs: number }): boolean {
    const newly: AchievementId[] = [];
    if (!this.cache.has('first-game')) newly.push('first-game');
    if (!this.differentGames.includes(gameId)) {
      this.differentGames.push(gameId);
      try {
        localStorage.setItem(DIFFERENT_GAMES_KEY, JSON.stringify(this.differentGames));
      } catch {
        /* ignore */
      }
      if (this.differentGames.length >= 5 && !this.cache.has('five-games')) {
        newly.push('five-games');
      }
    }
    if (session.totalMs >= 3_600_000 && !this.cache.has('one-hour')) newly.push('one-hour');
    if (newly.length) for (const id of newly) this.unlock(id);
    return newly.length > 0;
  }

  /** Report a gameplay fact; unlocks matching achievements idempotently. */
  report(fact: 'score-1000' | 'complete-race' | 'survive-10' | 'beat-hard-ai', value: number): boolean {
    if (fact === 'score-1000' && value >= 1000) return this.unlock('score-1000');
    if (fact === 'survive-10' && value >= 10) return this.unlock('survive-10');
    if (fact === 'complete-race') return this.unlock('complete-race');
    if (fact === 'beat-hard-ai') return this.unlock('beat-hard-ai');
    return false;
  }

  unlock(id: AchievementId): boolean {
    if (this.cache.has(id)) return false;
    this.cache.set(id, true);
    const list = readUnlocked();
    if (!list.some((e) => e.id === id)) {
      list.push({ id, at: Date.now() });
      try {
        localStorage.setItem(UNLOCKED_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
    }
    const ev = { id, at: Date.now() };
    this.listeners.forEach((l) => {
      try {
        l(ev);
      } catch {
        /* ignore */
      }
    });
    return true;
  }

  onUnlock(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Incremental counter for the one-hour achievement. */
  addTime(ms: number): void {
    const cur = readNumber(UNLOCK_COUNT_KEY) + ms;
    writeNumber(UNLOCK_COUNT_KEY, cur);
    if (cur >= 3_600_000) this.unlock('one-hour');
  }
}

function readNumber(key: string): number {
  try {
    const v = Number(localStorage.getItem(key) ?? '0');
    return isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, v: number): void {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

export const achievements = new AchievementManager();
