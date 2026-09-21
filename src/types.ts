export type Genre =
  | 'Arcade'
  | 'Puzzle'
  | 'Strategy'
  | 'Racing'
  | 'Action'
  | 'Sports'
  | 'Board'
  | 'Cards'
  | 'Casual'
  | 'Multiplayer';

export type InputMethod = 'keyboard' | 'mouse' | 'touch' | 'gamepad';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type GameStatus = 'ready' | 'playing' | 'paused' | 'over';

export interface HudStats {
  score: number;
  highScore: number;
  level: number;
  lives: number;
  /** Free-form secondary stat label (e.g. "LAP 2/3", "MOVES 14"). */
  time?: string;
}

/** Normalized actions every game may consume — see engine/input.ts. */
export type GameAction =
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveDown'
  | 'jump'
  | 'fire'
  | 'pause'
  | 'start'
  | 'menu'
  | 'primary'
  | 'secondary'
  | 'confirm'
  | 'cancel';

export interface GameContext {
  /** Fixed logical play-area size in CSS pixels (design size). */
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  requestAction: (action: GameAction) => void;
  setScore: (value: number) => void;
  setLevel: (value: number) => void;
  setLives: (value: number) => void;
  setTimeLabel: (label: string | null) => void;
  endGame: () => void;
  playSfx: (name: SfxName) => void;
  now: () => number;
  reducedMotion: boolean;
  /** Add screen shake (0–20 intensity). No-op when shake is disabled. */
  addShake: (magnitude: number) => void;
  /** Report an achievement the game just unlocked (guarded, idempotent). */
  achievement: (id: AchievementId) => void;
  /** True while the game is in the 'playing' status (not paused). */
  isPlaying: () => boolean;
}

export type SfxName =
  | 'laser'
  | 'shoot'
  | 'explosion'
  | 'hit'
  | 'thud'
  | 'coin'
  | 'point'
  | 'score'
  | 'powerup'
  | 'gameover'
  | 'select'
  | 'start'
  | 'levelup'
  | 'click'
  | 'tick'
  | 'danger'
  | 'win';

export type AchievementId =
  | 'first-game'
  | 'score-1000'
  | 'five-games'
  | 'complete-race'
  | 'survive-10'
  | 'one-hour'
  | 'beat-hard-ai';

export interface GameDefinition {
  id: string;
  name: string;
  short: string;
  description: string;
  genre: Genre;
  tags: string[];
  players: 1 | 2;
  difficulty: Difficulty;
  controls: string[];
  supportedInputs: InputMethod[];
  accent: string;
  artId: string;
  features: string[];
  /** Logical canvas design size; GameCanvas scales responsively. */
  width: number;
  height: number;
}
