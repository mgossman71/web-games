export interface ScreenShake {
  magnitude: number;
  decay: number;
  offsetX: number;
  offsetY: number;
  enabled: boolean;
}

export const createScreenShake = (): ScreenShake => ({
  magnitude: 0,
  decay: 7,
  offsetX: 0,
  offsetY: 0,
  enabled: true,
});

export function shake(s: ScreenShake, magnitude: number): void {
  s.magnitude = Math.max(s.magnitude, magnitude);
}

export function updateShake(s: ScreenShake, dt: number): void {
  if (s.magnitude <= 0.01) {
    s.magnitude = 0;
    s.offsetX = 0;
    s.offsetY = 0;
    return;
  }
  s.magnitude *= Math.exp(-s.decay * dt);
  const m = s.enabled ? s.magnitude : 0;
  s.offsetX = (Math.random() * 2 - 1) * m;
  s.offsetY = (Math.random() * 2 - 1) * m;
}
