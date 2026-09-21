import type { GameRuntime } from '../services/gameRuntime';

// Fallback registry. The PRIMARY way a game obtains its runtime is the `runtime`
// PROP that GameShell hands it (see GameShell.tsx) — a plain React prop is immune
// to render-order / module-instance / effect-cleanup timing (React 19 StrictMode).
// GameShell ALSO registers the runtime here during its render as a fallback.
let current: GameRuntime | null = null;

export function setGameRuntime(rt: GameRuntime | null): void {
  current = rt;
}

export function useGameRuntime(): GameRuntime {
  if (!current) {
    throw new Error(
      'GameVault: no active GameRuntime — the game must be rendered inside GameShell, which passes the `runtime` prop.',
    );
  }
  return current;
}
