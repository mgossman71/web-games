import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface Props {
  designWidth: number;
  designHeight: number;
  ariaLabel: string;
  className?: string;
  /**
   * Called once when the canvas + 2d context are ready.
   * Return an optional cleanup function.
   */
  onReady?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => (() => void) | void;
}

/**
 * Responsive, DPR-aware canvas. The game draws in `designWidth x designHeight`
 * logical units; CSS scales the canvas to fit the container while the 2D context
 * transform keeps rendering crisp at any size.
 */
export function GameCanvas({ designWidth, designHeight, ariaLabel, className, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const scale = Math.min(rect.width / designWidth, rect.height / designHeight);
    const cssW = Math.max(1, Math.floor(designWidth * scale));
    const cssH = Math.max(1, Math.floor(designHeight * scale));
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }, [designWidth, designHeight]);

  useLayoutEffect(() => {
    fit();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [fit]);

  // Notify the shell once the canvas exists with a valid 2d context.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (document.fonts?.load) {
      // Ensure canvas text (Orbitron) is ready before first paint.
      void document.fonts.load('700 16px Orbitron').catch(() => undefined);
    }
    const cleanup = onReadyRef.current?.(canvas, ctx);
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  return (
    <div ref={wrapRef} className={`gv-canvas-wrap ${className ?? ''}`}>
      <canvas ref={canvasRef} className="gv-canvas" aria-label={ariaLabel} role="img" />
    </div>
  );
}
