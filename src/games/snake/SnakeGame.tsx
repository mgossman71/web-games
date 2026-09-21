import { useCallback, useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { enableSwipe, drawLabel } from '../../gameEngine/gameHelpers';
import { clamp } from '../../utils/math';
import type { GameAction } from '../../types';

const COLS = 24;
const ROWS = 24;
const CELL = 20; // 480/24

interface Pt {
  x: number;
  y: number;
}

interface State {
  snake: Pt[];
  dir: Pt;
  queue: Pt[];
  food: Pt;
  gold: (Pt & { ttl: number }) | null;
  obstacles: Pt[];
  eaten: number;
  level: number;
  score: number;
  started: boolean;
  tickTimer: number;
  tickInterval: number;
  growing: number;
  dead: boolean;
  deathT: number;
  flash: number;
}

function freeCell(s: State): Pt {
  const taken = new Set<string>(s.obstacles.map((o) => `${o.x},${o.y}`));
  s.snake.forEach((c) => taken.add(`${c.x},${c.y}`));
  taken.add(`${s.food.x},${s.food.y}`);
  if (s.gold) taken.add(`${s.gold.x},${s.gold.y}`);
  for (let i = 0; i < 600; i++) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if (!taken.has(`${x},${y}`)) return { x, y };
  }
  return { x: Math.floor(COLS / 2), y: 2 };
}

function initState(): State {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  return {
    snake: [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ],
    dir: { x: 1, y: 0 },
    queue: [],
    food: { x: cx + 7, y: cy },
    gold: null,
    obstacles: [],
    eaten: 0,
    level: 1,
    score: 10,
    started: false,
    tickTimer: 0,
    tickInterval: 1 / 7,
    growing: 0,
    dead: false,
    deathT: 0,
    flash: 0,
  };
}

function placeObstacles(s: State): void {
  const target = 5 + s.level * 2;
  while (s.obstacles.length < target) {
    const c = freeCell(s);
    const head = s.snake[0];
    if (Math.abs(c.x - head.x) < 3 && Math.abs(c.y - head.y) < 3) continue;
    s.obstacles.push(c);
  }
}

export default function SnakeGame(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const stRef = useRef<State | null>(null);
  if (stRef.current === null) stRef.current = initState();
  const s = stRef.current;

  // Restart support: when the shell remounts us (runKey), state is fresh anyway.
  useEffect(() => {
    s.dead = false;
    s.deathT = 0;
    rt.setLevel(1);
    rt.setScore(s.score);
  }, [rt, s]);

  const onAction = useCallback(
    (a: GameAction, down: boolean) => {
      if (!down || s.dead) return;
      const dirs: Record<string, Pt> = {
        moveLeft: { x: -1, y: 0 },
        moveRight: { x: 1, y: 0 },
        moveUp: { x: 0, y: -1 },
        moveDown: { x: 0, y: 1 },
      };
      const d = dirs[a];
      if (!d) return;
      s.started = true;
      // Block 180° turns against the latest queued dir as well
      const lastDir = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      if (d.x === -lastDir.x && d.y === -lastDir.y) return;
      s.queue.push(d);
      if (s.queue.length > 2) s.queue.length = 2;
    },
    [s],
  );

  useEffect(() => {
    const off = rt.input.subscribe(onAction);
    const offSwipe = enableSwipe(rt);
    return () => {
      off();
      offSwipe();
    };
  }, [rt, onAction]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = stepWorld(s, rt, dt);
      drawWorld(rt, st);
    },
  });

  return null;
}

function stepWorld(s: State, rt: ReturnType<typeof useGameRuntime>, dt: number) {
  const r = rt as unknown as {
    sfx: (n: string) => void;
    setScore: (v: number) => void;
    setLevel: (v: number) => void;
    endGame: (score: number, completed: boolean) => void;
    particles: { spawnBurst: (x: number, y: number, n: number, sp: number, o?: object) => void };
  };

  // Wait for the player's first input before the snake starts moving,
  // so a fresh run never dies into a wall before anyone has steered.
  if (!s.started && !s.dead) return s;

  if (!s.dead) {
    s.tickTimer += dt;
    let guard = 0;
    while (s.tickTimer >= s.tickInterval && !s.dead && guard++ < 10) {
      s.tickTimer -= s.tickInterval;
      tick(s, r);
    }
    if (s.dead && s.deathT > 0.9) {
      s.dead = false; // let the shell's game-over overlay own this moment once
      // (shell calls endGame on our cue below)
    }
  } else {
    const before = s.deathT;
    s.deathT += dt;
    if (before < 0.05) {
      // first frame of death → route through the shell for the overlay/score submit
      (rt as unknown as { endGame: (n: number, c: boolean) => void }).endGame(s.score, false);
    }
  }
  s.flash = Math.max(0, s.flash - dt * 3.2);
  return s;
}

function tick(s: State, r: { sfx: (n: string) => void; setScore: (v: number) => void; setLevel: (v: number) => void; particles: { spawnBurst: (x: number, y: number, n: number, sp: number, o?: object) => void } }): void {
  if (s.queue.length) {
    const d = s.queue.shift()!;
    if (!(d.x === -s.dir.x && d.y === -s.dir.y)) s.dir = d;
  }
  const head = s.snake[0];
  const nx = head.x + s.dir.x;
  const ny = head.y + s.dir.y;

  const hitWall = nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS;
  const hitObstacle = s.obstacles.some((o) => o.x === nx && o.y === ny);
  const body = s.snake.slice(0, s.snake.length - (s.growing > 0 ? 0 : 1));
  const hitSelf = body.some((c) => c.x === nx && c.y === ny);

  if (hitWall || hitObstacle || hitSelf) {
    s.dead = true;
    r.sfx('explosion');
    const hx = (head.x + 0.5) * CELL;
    const hy = (head.y + 0.5) * CELL;
    r.particles.spawnBurst(hx, hy, 34, 240, { colors: ['#ef4444', '#f97316', '#ffffff', '#34d399'] });
    return;
  }

  s.snake.unshift({ x: nx, y: ny });

  if (nx === s.food.x && ny === s.food.y) {
    s.score += 10 * s.level;
    s.eaten += 1;
    s.growing += 1;
    s.flash = 1;
    r.particles.spawnBurst((nx + 0.5) * CELL, (ny + 0.5) * CELL, 16, 140, { colors: ['#a3e635', '#22d3ee', '#ffffff'] });
    r.sfx('coin');
    if (s.eaten % 6 === 0) {
      s.level += 1;
      s.tickInterval = clamp(1 / 7 - (s.level - 1) * 0.027, 0.058, 0.16);
      if (s.level >= 3) placeObstacles(s);
      r.setLevel(s.level);
      r.sfx('levelup');
    }
    if (!s.gold && Math.random() < 0.35) {
      s.gold = { ...freeCell(s), ttl: 5 };
      r.sfx('powerup');
    }
    s.food = freeCell(s);
  }

  if (s.gold) {
    s.gold.ttl -= 0.143;
    if (nx === s.gold.x && ny === s.gold.y) {
      s.score += 50;
      s.growing += 2;
      s.flash = 1;
      r.particles.spawnBurst((nx + 0.5) * CELL, (ny + 0.5) * CELL, 26, 180, { colors: ['#facc15', '#fff7ed', '#f472b6'] });
      r.sfx('powerup');
      s.gold = null;
    } else if (s.gold.ttl <= 0) {
      s.gold = null;
    }
  }

  if (s.growing > 0) s.growing -= 1;
  else s.snake.pop();

  r.setScore(s.score);
}

function drawWorld(rt: ReturnType<typeof useGameRuntime>, s: State): void {
  const ctx = rt.ctx;
  if (!ctx) return;
  const W = rt.width;
  const H = rt.height;

  let sx = 0;
  let sy = 0;
  if (rt.shake.enabled) {
    sx = (Math.random() * 2 - 1) * rt.shake.magnitude;
    sy = (Math.random() * 2 - 1) * rt.shake.magnitude;
    rt.shake.magnitude *= 0.88;
    if (rt.shake.magnitude < 0.1) rt.shake.magnitude = 0;
  }

  ctx.save();
  ctx.translate(sx, sy);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#081119');
  bg.addColorStop(1, '#04080f');
  ctx.fillStyle = bg;
  ctx.fillRect(-24, -24, W + 48, H + 48);

  ctx.strokeStyle = 'rgba(148,163,184,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, H);
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(W, y * CELL + 0.5);
  }
  ctx.stroke();

  for (const o of s.obstacles) {
    ctx.fillStyle = '#16233b';
    ctx.fillRect(o.x * CELL + 3, o.y * CELL + 3, CELL - 6, CELL - 6);
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.fillRect(o.x * CELL + 3, o.y * CELL + 3, CELL - 6, 2);
  }

  const p = 0.5 + 0.5 * Math.sin(performance.now() / 210);
  ctx.save();
  ctx.shadowColor = '#a3e635';
  ctx.shadowBlur = 12 + p * 10;
  ctx.fillStyle = '#a3e635';
  ctx.beginPath();
  ctx.arc((s.food.x + 0.5) * CELL, (s.food.y + 0.5) * CELL, 5.5 + p * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ecfccb';
  ctx.beginPath();
  ctx.arc((s.food.x + 0.5) * CELL - 1.5, (s.food.y + 0.5) * CELL - 1.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (s.gold) {
    const g = s.gold;
    const blink = g.ttl < 1.6 ? (Math.sin(performance.now() / 70) > 0 ? 1 : 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc((g.x + 0.5) * CELL, (g.y + 0.5) * CELL, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.font = '700 13px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', (g.x + 0.5) * CELL, (g.y + 0.5) * CELL + 1);
    ctx.restore();
  }

  const n = s.snake.length;
  for (let i = n - 1; i >= 0; i--) {
    const c = s.snake[i];
    const t = 1 - i / Math.max(1, n);
    const isHead = i === 0;
    ctx.save();
    if (isHead) {
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 15;
      ctx.fillStyle = s.dead ? '#ef4444' : '#86efac';
    } else {
      ctx.fillStyle = s.dead ? `rgba(127,29,29,${0.35 + 0.5 * t})` : `rgba(16,185,129,${0.3 + 0.6 * t})`;
    }
    const x = c.x * CELL;
    const y = c.y * CELL;
    const r = isHead ? 7 : 5;
    ctx.beginPath();
    ctx.moveTo(x + 2 + r, y + 2);
    ctx.arcTo(x + CELL - 2, y + 2, x + CELL - 2, y + CELL - 2, r);
    ctx.arcTo(x + CELL - 2, y + CELL - 2, x + 2, y + CELL - 2, r);
    ctx.arcTo(x + 2, y + CELL - 2, x + 2, y + 2, r);
    ctx.arcTo(x + 2, y + 2, x + CELL - 2, y + 2, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const h = s.snake[0];
  const d = s.dir;
  const hx = (h.x + 0.5) * CELL;
  const hy = (h.y + 0.5) * CELL;
  ctx.fillStyle = '#022c22';
  const exo = d.x * 4.2;
  const eyo = d.y * 4.2;
  const px = -d.y * 4.4;
  const py = d.x * 4.4;
  ctx.beginPath();
  ctx.arc(hx + exo + px, hy + eyo + py, 2.1, 0, Math.PI * 2);
  ctx.arc(hx + exo - px, hy + eyo - py, 2.1, 0, Math.PI * 2);
  ctx.fill();

  if (!s.started && !s.dead) {
    const blink = 0.55 + 0.45 * Math.sin(performance.now() / 280);
    ctx.save();
    ctx.globalAlpha = blink;
    drawLabel(ctx, 'PRESS AN ARROW KEY — OR SWIPE — TO START', W / 2, H / 2 - 34, {
      font: '700 14px Orbitron, monospace',
      color: '#a7f3d0',
      glow: '#34d399',
      glowSize: 14,
    });
    ctx.restore();
  }

  if (s.flash > 0) {
    ctx.fillStyle = `rgba(163,230,53,${s.flash * 0.07})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (s.dead) {
    ctx.fillStyle = `rgba(2,6,23,${Math.min(0.55, s.deathT * 1.6)})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();

  rt.particles.update(1 / 60);
  rt.particles.draw(ctx);
}
