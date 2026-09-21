import { useEffect, useRef } from 'react';
import type { GameRuntime } from '../services/gameRuntime';

interface LoopOptions {
  /** Called every frame with clamped dt in SECONDS while status is playing. */
  onFrame: (dt: number, rt: GameRuntime) => void;
  /** Called once when unmounting. */
  onCleanup?: () => void;
  /** Max dt seconds (default 0.05 = 20fps floor). Prevents tunneling after tab switches. */
  maxDt?: number;
  /** When false, the loop still renders but games typically skip updates. */
  running?: boolean;
}

/**
 * requestAnimationFrame game loop bound to a GameRuntime.
 * - Clamps dt (tab-switch safe)
 * - Continues rendering while paused (shell overlays sit on top) but dt is
 *   delivered as 0 so time-based logic freezes
 * - Cancels cleanly on unmount
 */
export function useGameLoop(rt: GameRuntime, opts: LoopOptions): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let mounted = true;

    const tick = (t: number) => {
      if (!mounted) return;
      const cur = optsRef.current;
      let raw = (t - last) / 1000;
      last = t;
      if (raw < 0) raw = 0;
      const cap = cur.maxDt ?? 0.05;
      let dt = Math.min(raw, cap);
      if (rt.isPaused() || cur.running === false) {
        dt = 0; // still draw, but freeze time
      }
      try {
        cur.onFrame(dt, rt);
      } catch (err) {
        // One bad frame must not kill the game — log and move on.
        // eslint-disable-next-line no-console
        console.error('[game]', err);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame((t) => {
      last = t;
      raf = requestAnimationFrame(tick);
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      optsRef.current.onCleanup?.();
    };
    // Intentionally bound once per runtime instance; games read latest via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);
}
