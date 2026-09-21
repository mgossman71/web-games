export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned rect from a circle's center. */
export function circleRect(c: Circle): Rect {
  return { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
}

export function circleOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

export function circleRectOverlap(c: Circle, rect: Rect): boolean {
  const cx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
  const dx = c.x - cx;
  const dy = c.y - cy;
  return dx * dx + dy * dy <= c.r * c.r;
}

/** Which edge of the rect was hit — 'left' | 'right' | 'top' | 'bottom' | null. */
export function circleRectEdge(c: Circle, rect: Rect): string | null {
  const closestX = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  if (dx * dx + dy * dy > c.r * c.r) return null;
  const dLeft = c.x - (rect.x - c.r);
  const dRight = rect.x + rect.w + c.r - c.x;
  const dTop = c.y - (rect.y - c.r);
  const dBottom = rect.y + rect.h + c.r - c.y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return 'left';
  if (min === dRight) return 'right';
  if (min === dTop) return 'top';
  return 'bottom';
}

export function pointInRect(px: number, py: number, rect: Rect): boolean {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
