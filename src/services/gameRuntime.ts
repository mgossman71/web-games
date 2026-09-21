import type { AchievementId, SfxName } from '../types';
import type { InputManager } from '../gameEngine/input';
import type { Particles } from '../gameEngine/particles';
import type { ScreenShake } from '../gameEngine/screenShake';

/** Handle handed to each game. Every gameplay system the shell owns lands here. */
export interface GameRuntime {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  input: InputManager;
  particles: Particles;
  shake: ScreenShake;
  /** Add screen shake (0–20). No-op when disabled in settings. */
  addShake: (magnitude: number) => void;
  sfx: (name: SfxName) => void;
  /** Fire an achievement by id (idempotent; the shell toasts it). */
  achievement: (id: AchievementId) => void;
  setScore: (v: number) => void;
  setLevel: (v: number) => void;
  setLives: (v: number) => void;
  /** Secondary HUD label: e.g. "LAP 2/3", "1:23.4", "MOVES 14". */
  setTimeLabel: (label: string | null) => void;
  /** Report the best time of this run in ms (used for daily challenge / records). */
  reportTime: (ms: number) => void;
  /** Flag that this run was a *completed* game (win condition met). */
  markCompleted: () => void;
  /** Ends the run. `completed` = player won (vs. lost). */
  endGame: (finalScore?: number, completed?: boolean) => void;
  setPaused: (paused: boolean) => void;
  /** Monotonic clock (does not freeze on its own — check isPaused in your loop). */
  now: () => number;
  isPaused: () => boolean;
  isOver: () => boolean;
}

export type { GameAction } from '../types';
