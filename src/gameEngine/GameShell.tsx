import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCanvas } from './GameCanvas';
import { Hud, type HudState } from '../components/Hud';
import { VirtualControls } from '../components/VirtualControls';
import { useStore } from '../app/globalStore';
import { GameStatusProvider, useGameStatus } from '../app/gameState';
import { InputManager, gamepadConnected } from './input';
import { Particles } from './particles';
import { createScreenShake, shake as addShakeImpl } from './screenShake';
import { audio } from '../audio/engine';
import { scores } from '../services/storage/scores';
import { stats } from '../services/storage/stats';
import { achievements } from '../services/storage/achievements';
import { getDailyChallenge, challengeCompletedKey } from '../services/dailyChallenge';
import { loadSettings } from '../services/storage/settings';
import { setGameRuntime, useGameRuntime } from './useGameRuntime';
import type { GameAction, GameDefinition, SfxName } from '../types';
import type { GameRuntime } from '../services/gameRuntime';

export interface GameComponentProps {
  width: number;
  height: number;
  /** Primary runtime handoff. The shell passes this as a normal prop so the game
   *  never depends on render-order / module-instance / effect-cleanup timing.
   *  Games fall back to useGameRuntime() if it is omitted. */
  runtime?: GameRuntime;
}

export interface GameShellProps {
  def: GameDefinition;
  Game: ComponentType<GameComponentProps>;
  showsLives?: boolean;
  virtualActions?: GameAction[];
  bestLabel?: string;
}

export { useGameRuntime };
export type { GameRuntime };

interface EndInfo {
  finalScore: number;
  newBest: boolean;
  completed: boolean;
  dailyDone: boolean;
}

export function GameShell(props: GameShellProps) {
  return (
    <GameStatusProvider>
      <Shell {...props} />
    </GameStatusProvider>
  );
}

function Shell(params: GameShellProps) {
  const { def, Game, showsLives = true, virtualActions = [], bestLabel = 'BEST' } = params;
  const navigate = useNavigate();
  const { sfx, visual, muted, toggleMute, reducedMotion } = useStore();
  const { paused, setPaused, over, setOver, reset } = useGameStatus();
  const [runKey, setRunKey] = useState(1);
  const [hud, setHud] = useState<HudState>(() => ({
    score: 0,
    best: scores.getBest(def.id),
    level: 0,
    lives: 0,
    timeLabel: null,
  }));
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [padOn, setPadOn] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const startRef = useRef(performance.now());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const overRef = useRef(over);
  overRef.current = over;
  const levelRef = useRef(0);
  const bestTimeRef = useRef<number>(Infinity);
  const completedRef = useRef(false);

  const { input, particles, shakeState } = useMemo(
    () => ({
      input: new InputManager(
        {
          onAction: (a: GameAction, down: boolean) => {
            if (!down) return;
            if (a === 'pause' || a === 'menu') {
              shellApiRef.current.togglePause();
            }
          },
          onAxis: () => undefined,
        },
        { preventDefaultKeys: [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] },
      ),
      particles: new Particles(420),
      shakeState: createScreenShake(),
    }),
    [],
  );

  // ---- api ---------------------------------------------------------------
  const shellApiRef = useRef({
    togglePause: () => {
      if (overRef.current) return;
      const next = !pausedRef.current;
      setPaused(next);
      if (next) audio.play('select');
    },
    endGame: (finalScore: number, completed: boolean) => {
      if (overRef.current) return;
      setOver(true);
      const durationMs = Math.max(0, Math.round(performance.now() - startRef.current));
      const newBest = scores.submit(def.id, finalScore);
      const challenge = getDailyChallenge();
      let dailyDone = false;
      if (challenge.gameId === def.id) {
        if (challenge.metric === 'score' && finalScore >= challenge.target) dailyDone = true;
        else if (challenge.metric === 'level' && levelRef.current >= challenge.target) dailyDone = true;
        else if (challenge.metric === 'time' && bestTimeRef.current <= challenge.target) dailyDone = true;
        if (dailyDone) {
          try {
            localStorage.setItem(challengeCompletedKey(), '1');
          } catch {
            /* ignore */
          }
        }
      }
      stats.endSession(def.id, durationMs, completed, finalScore);
      achievements.addTime(durationMs);
      if (finalScore >= 1000) achievements.report('score-1000', finalScore);
      if (levelRef.current >= 10) achievements.report('survive-10', levelRef.current);
      setEndInfo({ finalScore, newBest, completed, dailyDone });
      audio.play(completed ? 'win' : 'gameover');
      if (loadSettings().gamepadVibration) navigator.vibrate?.(completed ? [80, 60, 160] : 260);
    },
  });

  const runtime = useMemo<GameRuntime>(() => {
    return {
      canvas: null,
      ctx: null,
      width: def.width,
      height: def.height,
      input,
      particles,
      addShake: (m: number) => {
        if (!overRef.current && !pausedRef.current) addShakeImpl(shakeState, m);
      },
      shake: shakeState,
      sfx: (name: SfxName) => sfx(name),
      achievement: (id) => {
        achievements.unlock(id);
      },
      setScore: (v) => {
        setHud((h) => ({ ...h, score: Math.max(0, Math.round(v)) }));
        if (v >= 1000) achievements.report('score-1000', v);
      },
      setLevel: (v) => {
        levelRef.current = Math.max(0, Math.round(v));
        setHud((h) => ({ ...h, level: levelRef.current }));
        if (levelRef.current >= 10) achievements.report('survive-10', levelRef.current);
      },
      setLives: (v) => setHud((h) => ({ ...h, lives: Math.max(0, Math.round(v)) })),
      setTimeLabel: (label) => {
        if (label !== null) {
          const ms = Number(label);
          if (isFinite(ms) && ms > 0) bestTimeRef.current = Math.min(bestTimeRef.current, ms);
        }
        setHud((h) => ({ ...h, timeLabel: label }));
      },
      endGame: (scoreNow = 0, completed = false) => shellApiRef.current.endGame(scoreNow, completed),
      setPaused: (p) => {
        if (!overRef.current) setPaused(p);
      },
      markCompleted: () => {
        completedRef.current = true;
      },
      reportTime: (ms) => {
        if (isFinite(ms) && ms > 0) bestTimeRef.current = Math.min(bestTimeRef.current, ms);
      },
      now: () => performance.now(),
      isPaused: () => pausedRef.current,
      isOver: () => overRef.current,
    };
  }, [def.id, def.width, def.height, input, particles, shakeState, sfx, setPaused]);

  // Fallback registration (primary path is the `runtime` prop below). React
  // guarantees a parent's render body runs before its children render, so the
  // game can also resolve useGameRuntime(); the effect clears it on unmount.
  setGameRuntime(runtime);
  useEffect(() => {
    return () => setGameRuntime(null);
  }, [runtime]);

  const onReady = useMemo(
    () => (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      runtime.canvas = canvas;
      runtime.ctx = ctx;
      input.attach(window);
      startRef.current = performance.now();
      stats.startSession(def.id);
      achievements.recordGamePlayed(def.id, { totalMs: stats.get().totalPlayTimeMs });
      audio.play('start');
      return () => {
        input.detach();
        particles.clear();
      };
    },
    [runtime, input, particles, def.id],
  );

  // Re-enable input on a fresh run (detach/attach after pause toggles).
  useEffect(() => {
    input.setDisabled(paused || over);
  }, [paused, over, input, runKey]);

  const restart = () => {
    setEndInfo(null);
    completedRef.current = false;
    levelRef.current = 0;
    bestTimeRef.current = Infinity;
    setHud((h) => ({ ...h, score: 0, level: 0, lives: 0, timeLabel: null }));
    particles.clear();
    reset();
    setRunKey((k) => k + 1);
    startRef.current = performance.now();
    audio.play('start');
  };

  const exit = () => {
    audio.play('select');
    navigate('/');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  };

  // ---- visual sync -------------------------------------------------------
  useEffect(() => {
    particles.setDensity(visual.particleDensity);
    shakeState.enabled = visual.screenShake && !reducedMotion;
  }, [particles, shakeState, visual.particleDensity, visual.screenShake, reducedMotion]);

  // ---- gamepad -----------------------------------------------------------
  useEffect(() => {
    const check = () => setPadOn(gamepadConnected());
    const c = () => setPadOn(true);
    window.addEventListener('gamepadconnected', c);
    window.addEventListener('gamepaddisconnected', check);
    check();
    const t = window.setInterval(check, 2000);
    return () => {
      window.removeEventListener('gamepadconnected', c);
      window.removeEventListener('gamepaddisconnected', check);
      clearInterval(t);
    };
  }, []);

  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window),
    [],
  );

  const shellCls = ['gv-shell', visual.crt ? 'gv-crt' : '', reducedMotion ? 'gv-reduced-motion' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellCls}>
      <header className="gv-shell-head">
        <button type="button" className="gv-btn" onClick={exit}>
          ← Library
        </button>
        <div className="gv-shell-id">
          <span className="gv-dot" style={{ background: def.accent }} aria-hidden />
          <span className="gv-shell-name">{def.name}</span>
          <span className="gv-shell-genre">{def.genre}</span>
        </div>
        <div className="gv-shell-tools">
          {padOn && (
            <span className="gv-badge" role="status">
              🎮 Controller connected
            </span>
          )}
          <button
            type="button"
            className="gv-icon-btn"
            onClick={() => {
              audio.unlock();
              toggleMute();
              sfx('click');
            }}
            aria-pressed={!muted}
            aria-label={muted ? 'Sound off — click to enable' : 'Sound on — click to mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" className="gv-icon-btn" onClick={() => setShowHelp(true)} aria-label="How to play">
            ?
          </button>
          <button
            type="button"
            className="gv-icon-btn"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            ⛶
          </button>
        </div>
      </header>

      <main className="gv-shell-main">
        <GameCanvas
          designWidth={def.width}
          designHeight={def.height}
          ariaLabel={`${def.name} play field`}
          onReady={onReady}
        />
        <Game key={runKey} width={def.width} height={def.height} runtime={runtime} />

        {isTouchDevice && !over && (
          <VirtualControls actions={virtualActions} visible onAction={(a, d) => input.setVirtual(a, d)} />
        )}

        {paused && !over && (
          <div className="gv-overlay" role="dialog" aria-label="Game paused">
            <h2 className="gv-overlay-title">PAUSED</h2>
            <p className="gv-overlay-sub">Take a breath, player.</p>
            <div className="gv-btn-row">
              <button type="button" className="gv-btn gv-primary" onClick={() => shellApiRef.current.togglePause()} autoFocus>
                Resume
              </button>
              <button type="button" className="gv-btn" onClick={restart}>
                Restart
              </button>
              <button type="button" className="gv-btn gv-danger" onClick={exit}>
                Quit
              </button>
            </div>
          </div>
        )}

        {over && (
          <div className="gv-overlay" role="dialog" aria-label="Game over">
            <h2 className="gv-overlay-title">{endInfo?.completed ? 'YOU WIN' : 'GAME OVER'}</h2>
            <p className="gv-score-final" style={{ color: def.accent }}>
              {(endInfo?.finalScore ?? 0).toLocaleString()}
            </p>
            {endInfo?.newBest && <p className="gv-newbest">★ NEW BEST SCORE ★</p>}
            {endInfo?.dailyDone && <p className="gv-daily-done">✓ Daily challenge complete!</p>}
            <div className="gv-btn-row">
              <button type="button" className="gv-btn gv-primary" onClick={restart} autoFocus>
                Play Again
              </button>
              <button type="button" className="gv-btn" onClick={exit}>
                Back to Library
              </button>
            </div>
          </div>
        )}

        {showHelp && (
          <div className="gv-overlay gv-overlay-help" role="dialog" aria-modal="true" aria-label={`${def.name} — instructions`}>
            <div className="gv-help">
              <h2 className="gv-overlay-title">{def.name}</h2>
              <p>{def.description}</p>
              <h4>Controls</h4>
              <ul className="gv-help-list">
                {def.controls.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="gv-mute-note">
                Pause with P, Start, or the ⏸ button. Keyboard, gamepad and touch all work together.
              </p>
              <button type="button" className="gv-btn gv-primary" onClick={() => setShowHelp(false)} autoFocus>
                Let's play
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="gv-shell-bottom">
        <Hud hud={hud} showsLives={showsLives} bestLabel={bestLabel} />
        <div className="gv-btn-row gv-btn-row-mini">
          <button
            type="button"
            className="gv-btn gv-mini"
            onClick={() => shellApiRef.current.togglePause()}
            disabled={over}
            aria-label="Pause or resume"
          >
            {paused ? '▶' : '⏸'}
          </button>
          <button type="button" className="gv-btn gv-mini" onClick={restart} aria-label="Restart game">
            ↻
          </button>
          <button type="button" className="gv-btn gv-mini gv-danger" onClick={exit} aria-label="Exit to library">
            ✕
          </button>
        </div>
      </footer>
    </div>
  );
}
