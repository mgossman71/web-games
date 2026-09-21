import { useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import type { GameAction } from '../../types';

const COLS = 5;
const ROWS = 11;
const CELL = 28;
const CW = COLS * CELL;
const CH = ROWS * CELL;

interface Cell {
  x: number;
  y: number;
}

const TETROMINOES: { cells: Cell[]; color: string }[] = [
  { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], color: '#22d3ee' },
  { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }], color: '#a855f7' },
  { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }], color: '#facc15' },
  { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 1 }], color: '#f472b6' },
  { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], color: '#34d399' },
  { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }], color: '#f97316' },
  { cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 }], color: '#60a5fa' },
];

type Grid = number[][]; // -1 empty, else piece index

const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));

const randomPiece = () => TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];

function collides(grid: Grid, cells: Cell[], ox: number, oy: number): boolean {
  for (const c of cells) {
    const x = c.x + ox;
    const y = c.y + oy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && grid[y][x] !== -1) return true;
  }
  return false;
}

function merge(grid: Grid, cells: Cell[], ox: number, oy: number, idx: number): void {
  for (const c of cells) {
    const x = c.x + ox;
    const y = c.y + oy;
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) grid[y][x] = idx;
  }
}

function clearLines(grid: Grid, sfx: (n: 'coin' | 'levelup') => void): number {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every((v) => v !== -1)) {
      grid.splice(y, 1);
      grid.unshift(new Array(COLS).fill(-1));
      cleared++;
      sfx('coin');
    }
  }
  return cleared;
}

export default function BlockDrop(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;
  const oy = Math.max(8, (H - CH) / 2);

  const s = useRef({
    grid: emptyGrid(),
    cur: randomPiece(),
    curIdx: TETROMINOES.length,
    px: 1,
    py: 0,
    next: randomPiece(),
    score: 0,
    level: 1,
    fallAccum: 0,
    hHold: 0, // horizontal hold accumulator for key-mash prevention
    over: false,
  });

  const colorOf = (v: number) => TETROMINOES[((v % TETROMINOES.length) + TETROMINOES.length) % TETROMINOES.length].color;

  const spawn = () => {
    const st = s.current;
    st.cur = st.next;
    st.curIdx = TETROMINOES.length;
    st.next = randomPiece();
    st.px = 1;
    st.py = 0;
    st.fallAccum = 0;
  };

  useEffect(() => {
    const st = s.current;
    st.grid = emptyGrid();
    st.cur = randomPiece();
    st.next = randomPiece();
    st.curIdx = TETROMINOES.length;
    st.px = 1;
    st.py = 0;
    st.score = 0;
    st.level = 1;
    st.over = false;
    rt.setScore(0);
    rt.setLevel(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryMove = (dx: number, dy: number) => {
    const st = s.current;
    if (collides(st.grid, st.cur.cells, st.px + dx, st.py + dy)) return false;
    st.px += dx;
    st.py += dy;
    return true;
  };

  const rotate = () => {
    const st = s.current;
    const rotated = st.cur.cells.map((c) => ({ x: -c.y, y: c.x }));
    const minx = Math.min(...rotated.map((c) => c.x));
    const miny = Math.min(...rotated.map((c) => c.y));
    const norm = rotated.map((c) => ({ x: c.x - minx, y: c.y - miny }));
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(st.grid, norm, st.px + kick, st.py)) {
        st.cur = { cells: norm, color: st.cur.color };
        st.px += kick;
        rt.sfx('click');
        return;
      }
    }
  };

  const lock = () => {
    const st = s.current;
    merge(st.grid, st.cur.cells, st.px, st.py, st.curIdx);
    const cleared = clearLines(st.grid, (n) => rt.sfx(n));
    if (cleared > 0) {
      st.score += [0, 100, 300, 500, 800][Math.min(cleared, 4)] * st.level;
      if (cleared >= 2) {
        rt.sfx('levelup');
        rt.particles.spawnBurst(W / 2, oy + CH - 30, 18 * cleared, 240, { colors: ['#fff', '#facc15', colorOf(st.curIdx)] });
      }
    }
    st.level = Math.min(15, 1 + Math.floor(st.score / 8000));
    rt.setScore(st.score);
    rt.setLevel(st.level);
    spawn();
    if (collides(st.grid, st.cur.cells, st.px, st.py)) {
      st.over = true;
      rt.endGame(st.score, false);
    }
  };

  useEffect(() => {
    const off = rt.input.subscribe((a: GameAction, down: boolean) => {
      if (!down) return;
      const st = s.current;
      if (st.over) return;
      if (a === 'moveLeft') {
        if (tryMove(-1, 0)) st.hHold = 0;
      } else if (a === 'moveRight') {
        if (tryMove(1, 0)) st.hHold = 0;
      } else if (a === 'moveDown') {
        if (tryMove(0, 1)) {
          st.score += 1;
          rt.setScore(st.score);
        } else lock();
        st.fallAccum = 0;
      } else if (a === 'moveUp' || a === 'fire' || a === 'jump') {
        rotate();
      } else if (a === 'confirm') {
        // hard drop
        let dropped = 0;
        while (!collides(st.grid, st.cur.cells, st.px, st.py + 1)) {
          st.py++;
          dropped++;
        }
        st.score += dropped * 2;
        rt.setScore(st.score);
        rt.sfx('thud');
        lock();
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.over) {
        draw();
        return;
      }
      // axis-driven horizontal movement
      const ax = rt.input.getAxisX();
      if (ax !== 0) st.hHold += dt;
      if (st.hHold > 0.09) {
        if (tryMove(Math.sign(ax), 0)) st.hHold = 0;
      }

      if (dt > 0) st.fallAccum += dt * Math.min(1.25, 0.55 + st.level * 0.07);
      while (st.fallAccum >= 1 && dt > 0) {
        st.fallAccum -= 1;
        if (!tryMove(0, 1)) {
          lock();
          break;
        }
      }
      draw();
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1026');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(96,165,250,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 12;
    ctx.strokeRect(0, oy, CW, CH);
    ctx.restore();

    ctx.strokeStyle = 'rgba(94,120,180,0.15)';
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, oy);
      ctx.lineTo(x * CELL, oy + CH);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, oy + y * CELL);
      ctx.lineTo(CW, oy + y * CELL);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = st.grid[y][x];
        if (v === -1) continue;
        drawCell(ctx, x * CELL, oy + y * CELL, CELL, colorOf(v));
      }
    }

    if (!st.over) {
      // ghost
      let gy = st.py;
      while (!collides(st.grid, st.cur.cells, st.px, gy + 1)) gy++;
      if (gy > st.py) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        for (const c of st.cur.cells) {
          const x = c.x + st.px;
          const y = c.y + gy;
          if (x < 0 || x >= COLS || y < 0) continue;
          drawCell(ctx, x * CELL, oy + y * CELL, CELL, st.cur.color);
        }
        ctx.restore();
      }
      for (const c of st.cur.cells) {
        const x = c.x + st.px;
        const y = c.y + st.py;
        if (x < 0 || x >= COLS || y < 0) continue;
        drawCell(ctx, x * CELL, oy + y * CELL, CELL, st.cur.color);
      }
    }

    // next piece
    const px0 = CW + 18;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,30,0.72)';
    ctx.strokeStyle = 'rgba(96,165,250,0.4)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, px0, oy, 104, 118, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#93a6d4';
    ctx.font = '600 11px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', px0 + 12, oy + 22);
    const xs = st.next.cells.map((c) => c.x);
    const ys = st.next.cells.map((c) => c.y);
    const nx0 = Math.min(...xs);
    const ny0 = Math.min(...ys);
    const bx = px0 + 12 + (80 - (Math.max(...xs) - nx0) * 20) / 2;
    const by = oy + 44;
    for (const c of st.next.cells) {
      drawCell(ctx, (c.x - nx0) * 20 + bx, (c.y - ny0) * 20 + by, 20, st.next.color);
    }
    ctx.fillStyle = '#cbd5f5';
    ctx.font = '600 11px Orbitron, monospace';
    ctx.fillText(`SCORE ${st.score.toLocaleString()}`, px0 + 12, oy + CH - 22);
    ctx.fillText(`LEVEL ${st.level}`, px0 + 12, oy + CH - 6);
    ctx.restore();

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  const pad = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + pad, y + pad, size - pad * 2, (size - pad * 2) / 2.6);
  ctx.restore();
}
