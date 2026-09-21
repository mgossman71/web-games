import { hashString, seededRandom, todayKey } from '../utils/math';

export interface DailyChallengeDef {
  gameId: string;
  metric: 'score' | 'level' | 'time';
  target: number;
  title: string;
  description: string;
}

const POOL: Array<Omit<DailyChallengeDef, 'description'>> = [
  { gameId: 'neon-snake', metric: 'score', target: 2000, title: 'Snake Feast' },
  { gameId: 'orbital-defense', metric: 'level', target: 10, title: 'Orbital Decree' },
  { gameId: 'neon-racer', metric: 'time', target: 45000, title: 'Under Forty-Five' }, // target lap ms (lower better)
  { gameId: 'brick-blaster', metric: 'score', target: 3000, title: 'Brick Storm' },
  { gameId: 'pixel-defender', metric: 'level', target: 8, title: 'Shield Line' },
  { gameId: 'block-drop', metric: 'score', target: 1500, title: 'Stack Surge' },
  { gameId: 'missile-defense', metric: 'score', target: 4000, title: 'Sky Fortress' },
  { gameId: 'tower-grid', metric: 'level', target: 8, title: 'Grid Commander' },
  { gameId: 'dungeon-maze', metric: 'level', target: 5, title: 'Deeper Delves' },
  { gameId: 'paddle-arena', metric: 'score', target: 100, title: 'Rally Master' },
  { gameId: 'endless-runner', metric: 'score', target: 3000, title: 'Neon Mile' },
  { gameId: 'memory-matrix', metric: 'level', target: 6, title: 'Pattern Recall' },
  { gameId: 'connect-four', metric: 'level', target: 1, title: 'Four in a Row' },
  { gameId: 'checkers', metric: 'level', target: 1, title: 'Kingmaker' },
  { gameId: 'mines', metric: 'level', target: 1, title: 'Clear Zone' },
];

export function getDailyChallenge(date = new Date()): DailyChallengeDef {
  const key = todayKey(date);
  const rnd = seededRandom(hashString(`game-vault:${key}`));
  const base = POOL[Math.floor(rnd() * POOL.length) % POOL.length];
  const g = base.gameId;
  let description: string;
  if (base.metric === 'score') description = `Score ${base.target.toLocaleString()} in ${name(g)}.`;
  else if (base.metric === 'level') description = `Reach wave/level ${base.target} in ${name(g)}.`;
  else description = `Set a lap under ${Math.round(base.target / 1000)}s in ${name(g)}.`;
  return { ...base, description };
}

function name(id: string): string {
  const map: Record<string, string> = {
    'neon-snake': 'Neon Snake',
    'orbital-defense': 'Orbital Defense',
    'neon-racer': 'Neon Racer',
    'brick-blaster': 'Brick Blaster',
    'pixel-defender': 'Pixel Defender',
    'block-drop': 'Block Drop',
    'missile-defense': 'Missile Command Center',
    'tower-grid': 'Tower Grid',
    'dungeon-maze': 'Dungeon Maze',
    'paddle-arena': 'Paddle Arena',
    'endless-runner': 'Endless Runner',
    'memory-matrix': 'Memory Matrix',
    'connect-four': 'Connect Four',
    checkers: 'Checkers',
    mines: 'Mines',
  };
  return map[id] ?? id;
}

export function challengeCompletedKey(): string {
  return `gv.dailyDone.${todayKey()}`;
}
