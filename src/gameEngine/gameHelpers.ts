import { type GameRuntime } from '../services/gameRuntime';
import type { GameAction } from '../types';

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

interface SwipeOpts {
  threshold?: number; // px
  /** Map swipe directions to game actions. Missing entries are ignored. */
  actions?: Partial<Record<SwipeDir, GameAction>>;
}

/**
 * Adds swipe detection to the runtime canvas. Works in any game; each
 * direction maps to a normalized action (default: move*).
 */
export function enableSwipe(rt: GameRuntime, opts: SwipeOpts = {}): () => void {
  const canvas = rt.canvas;
  if (!canvas) return () => undefined;
  const threshold = opts.threshold ?? 28;
  const actions = {
    left: opts.actions?.left ?? 'moveLeft',
    right: opts.actions?.right ?? 'moveRight',
    up: opts.actions?.up ?? 'moveUp',
    down: opts.actions?.down ?? 'moveDown',
  };

  let sx = 0;
  let sy = 0;
  let active = false;

  const onDown = (e: PointerEvent) => {
    active = true;
    sx = e.clientX;
    sy = e.clientY;
  };

  const onUp = (e: PointerEvent) => {
    if (!active) return;
    active = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return; // it was a tap
    let dir: SwipeDir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
    else dir = dy > 0 ? 'down' : 'up';
    const action = actions[dir];
    if (action) rt.input.setVirtual(action, true);
  };

  const onMove = (e: PointerEvent) => {
    if (!active) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= threshold * 3) {
      onUp({ clientX: sx + Math.sign(dx) * threshold * 4, clientY: sy + Math.sign(dy) * threshold * 4 } as PointerEvent);
    }
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointermove', onMove);
  };
}

/** Taps on the canvas emit `action` (e.g. jump/fire). Swipes are ignored. */
export function enableCanvasTap(rt: GameRuntime, action: GameAction): () => void {
  const canvas = rt.canvas;
  if (!canvas) return () => undefined;

  let sx = 0;
  let sy = 0;
  let t0 = 0;

  const onDown = (e: PointerEvent) => {
    sx = e.clientX;
    sy = e.clientY;
    t0 = performance.now();
  };
  const onUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - sx, e.clientY - sy);
    const dt = performance.now() - t0;
    if (moved < 24 && dt < 400) {
      rt.input.setVirtual(action, true);
      window.setTimeout(() => rt.input.setVirtual(action, false), 60);
    }
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
  };
}

/** Draw-in helper: rounded rect path with no fill. */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface UiTextOpts {
  font?: string;
  color?: string;
  bg?: string;
  align?: CanvasTextAlign;
  glow?: string;
  glowSize?: number;
}

/** Centered text with optional glow + bg pill. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: UiTextOpts = {},
): void {
  ctx.save();
  ctx.font = opts.font ?? '600 18px Orbitron, monospace';
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.bg) {
    const w = ctx.measureText(text).width;
    ctx.fillStyle = opts.bg;
    const bx = opts.align === 'left' ? x - 8 : opts.align === 'right' ? x - w - 8 : x - w / 2 - 10;
    ctx.fillRect(bx, y - 14, w + 20, 28);
  }
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = opts.glowSize ?? 12;
  }
  ctx.fillStyle = opts.color ?? '#e2e8f0';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Simple FPS counter (debug). */
export function createFpsMeter() {
  let frames = 0;
  let last = performance.now();
  let fps = 60;
  return {
    tick(now: number): number {
      frames++;
      if (now - last >= 500) {
        fps = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
      }
      return fps;
    },
    value(): number {
      return fps;
    },
  };
}
