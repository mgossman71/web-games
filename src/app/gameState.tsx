import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type GameStatus = 'boot' | 'playing' | 'paused' | 'over';

interface GameStateCtx {
  status: GameStatus;
  paused: boolean;
  over: boolean;
  setPaused: (p: boolean) => void;
  setOver: (o: boolean) => void;
  /** Called by games/games themselves: (value) => void for HUD fields lives in GameShell. */
  reset: () => void;
}

const Ctx = createContext<GameStateCtx | null>(null);

/**
 * Per-game status (playing/paused/over). Lives in one small provider so the
 * shell overlays and the game loop share the exact same truth.
 */
export function GameStatusProvider({ children }: { children: ReactNode }) {
  const [paused, setPausedState] = useState(false);
  const [over, setOverState] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const overRef = useRef(over);
  overRef.current = over;

  // NOTE: these callbacks must keep a stable identity across renders. GameShell
  // memoizes its runtime object on them; an unstable identity recreated the
  // runtime (with ctx: null) and froze every game's canvas on its first frame.
  const setPaused = useCallback((p: boolean) => {
    if (pausedRef.current === p) return;
    // Never allow pause after the game is over.
    if (p && overRef.current) return;
    setPausedState(p);
  }, []);

  const setOver = useCallback((o: boolean) => {
    setOverState(o);
    if (o) setPausedState(false);
  }, []);

  const reset = useCallback(() => {
    setPausedState(false);
    setOverState(false);
  }, []);

  const status: GameStatus = over ? 'over' : paused ? 'paused' : 'playing';

  const value = useMemo<GameStateCtx>(
    () => ({ status, paused, over, setPaused, setOver, reset }),
    [status, paused, over, setPaused, setOver, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGameStatus(): GameStateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGameStatus must be used inside GameStatusProvider');
  return ctx;
}
