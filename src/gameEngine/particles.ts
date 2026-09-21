import { TAU } from '../utils/math';

/** Deterministic RNG used by the particle system. */
export interface ParticleRng {
  next: () => number;
}

const mathRng: ParticleRng = { next: Math.random };

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  active: boolean;
}

const DEFAULT_COLORS = ['#22d3ee', '#a855f7', '#f472b6', '#facc15', '#ffffff'];

/**
 * Pool-based particle system. Zero allocation per frame (particles are
 * pre-allocated and recycled). All games share one instance per canvas.
 */
export class Particles {
  private pool: P[] = [];
  private density = 1;
  private rng: ParticleRng = mathRng;
  private cursor = 0;

  constructor(capacity = 420) {
    this.pool = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = {
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1, color: '#fff',
        gravity: 0, drag: 0, active: false,
      };
    }
  }

  setDensity(d: number): void {
    this.density = Math.max(0, Math.min(1.5, d));
  }

  setRng(r: ParticleRng): void {
    this.rng = r;
  }

  spawnBurst(
    x: number, y: number, count: number, speed: number,
    opts: Partial<{ colors: string[]; size: number; life: number; gravity: number; spread: number; angle: number; drag: number }> = {},
  ): void {
    const n = Math.round(count * this.density);
    const colors = opts.colors ?? DEFAULT_COLORS;
    const baseAngle = opts.angle ?? 0;
    const spread = opts.spread ?? TAU;
    for (let i = 0; i < n; i++) {
      const p = this.nextParticle();
      if (!p) return;
      const a = baseAngle + (this.rng.next() - 0.5) * spread;
      const s = speed * (0.35 + this.rng.next() * 0.85);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = (opts.life ?? 0.55) * (0.6 + this.rng.next() * 0.7);
      p.life = p.maxLife;
      p.size = (opts.size ?? 2.4) * (0.6 + this.rng.next() * 0.9);
      p.gravity = opts.gravity ?? 0;
      p.drag = opts.drag ?? 1.6;
      p.color = colors[(this.rng.next() * colors.length) | 0];
      p.active = true;
    }
  }

  spark(x: number, y: number, color: string, n = 6): void {
    this.spawnBurst(x, y, n, 160, { colors: [color, '#ffffff'], size: 1.8, life: 0.35, drag: 3 });
  }

  update(dt: number): void {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.drag > 0) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const pool = this.pool;
    ctx.save();
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + t * 0.7);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }

  clear(): void {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) pool[i].active = false;
  }

  private nextParticle(): P | null {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      this.cursor = (this.cursor + 1) % pool.length;
      const p = pool[this.cursor];
      if (!p.active) return p;
    }
    // Pool exhausted — recycle the oldest slot (oldest tracked by cursor order)
    const p = pool[(this.cursor + 1) % pool.length];
    this.cursor = (this.cursor + 1) % pool.length;
    return p;
  }
}
