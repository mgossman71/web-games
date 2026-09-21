import { useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';

/**
 * Connect Four — classic 7×6 vs. a sharp AI.
 * Drop discs in a line-4. AI wins, blocks, and punishes your blunders.
 */

const COLS = 7;
const ROWS = 6;
type Cell = 0 | 1 | 2; // 0 empty, 1 player (cyan), 2 AI (pink)

interface Disc {
  col: number;
  row: number;
  y: number; // current pixel y for animation
  targetY: number;
  owner: Cell;
}

function validCols(g: Cell[][]) {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (g[0][c] === 0) out.push(c);
  return out;
}

function dropRow(g: Cell[][], col: number) {
  for (let r = ROWS - 1; r >= 0; r--) if (g[r][col] === 0) return r;
  return -1;
}

function line4(g: Cell[][], r: number, c: number, v: Cell) {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of dirs) {
    let cnt = 1;
    for (let s = 1; s < 4; s++) {
      const rr = r + dr * s;
      const cc = c + dc * s;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || g[rr][cc] !== v) break;
      cnt++;
    }
    for (let s = 1; s < 4; s++) {
      const rr = r - dr * s;
      const cc = c - dc * s;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || g[rr][cc] !== v) break;
      cnt++;
    }
    if (cnt >= 4) return true;
  }
  return false;
}

function aiMove(g: Cell[][]): number {
  const moves = validCols(g);
  if (moves.length === 0) return -1;
  // 1) win now
  for (const c of moves) {
    const r = dropRow(g, c);
    g[r][c] = 2;
    const w = line4(g, r, c, 2);
    g[r][c] = 0;
    if (w) return c;
  }
  // 2) block player win
  for (const c of moves) {
    const r = dropRow(g, c);
    g[r][c] = 1;
    const w = line4(g, r, c, 1);
    g[r][c] = 0;
    if (w) return c;
  }
  // 3) don't hand player a win above (column with row<4 that would complete 4 for player)
  const safe = moves.filter((c) => {
    const r = dropRow(g, c);
    if (r >= 4) return true; // safe landing on bottom two rows
    g[r][c] = 2;
    // check: if player then drops in same column
    if (r > 0 && g[r - 1][c] === 0) {
      g[r - 1][c] = 1;
      const danger = line4(g, r - 1, c, 1);
      g[r - 1][c] = 0;
      g[r][c] = 0;
      if (danger) return false;
    }
    g[r][c] = 0;
    return true;
  });
  const pool = safe.length ? safe : moves;
  // prefer center
  pool.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + (Math.random() - 0.5) * 0.4);
  return pool[(Math.random() * Math.min(pool.length, 3)) | 0];
}

export default function ConnectFour(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const cell = Math.min((W - 48) / COLS, (H - 80) / ROWS);
  const bx = (W - cell * COLS) / 2;
  const by = (H - cell * ROWS) / 2 + 8;

  const [hover, setHover] = useState(3);

  const s = useRef({
    grid: Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0)),
    discs: [] as Disc[],
    turn: 1 as Cell,
    aiThinking: false,
    over: false,
    winOwner: 0 as Cell | 3,
    score: 0,
  });

  useEffect(() => {
    const st = s.current;
    st.grid = Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
    st.discs = [];
    st.turn = 1;
    st.aiThinking = false;
    st.over = false;
    st.winOwner = 0;
    st.score = 0;
    rt.setScore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowY = (r: number) => by + r * cell + cell / 2;
  const colX = (c: number) => bx + c * cell + cell / 2;

  function doDrop(col: number) {
    const st = s.current;
    if (st.over || st.aiThinking || st.turn !== 1) return;
    const r = dropRow(st.grid, col);
    if (r < 0) {
      rt.sfx('danger');
      return;
    }
    st.grid[r][col] = 1;
    st.discs.push({ col, row: r, y: by - cell / 2, targetY: rowY(r), owner: 1 });
    rt.sfx('thud');
    if (line4(st.grid, r, col, 1)) {
      finishGame(1);
      return;
    }
    if (validCols(st.grid).length === 0) {
      finishGame(3);
      return;
    }
    st.turn = 2;
    st.aiThinking = true;
  }

  function finishGame(owner: Cell | 3) {
    const st = s.current;
    st.over = true;
    st.winOwner = owner;
    if (owner === 1) {
      st.score = 1000;
      rt.setScore(1000);
    }
    setTimeout(() => rt.endGame(st.score, owner === 1), 800);
  }

  // AI turn (runs via loop tick so it pauses correctly)
  useEffect(() => {
    const id = window.setInterval(() => {
      const st = s.current;
      if (st.over || st.turn !== 2 || !st.aiThinking) return;
      const c = aiMove(st.grid);
      if (c < 0) return;
      const r = dropRow(st.grid, c);
      st.grid[r][c] = 2;
      st.discs.push({ col: c, row: r, y: by - cell / 2, targetY: rowY(r), owner: 2 });
      st.turn = 1;
      rt.sfx('hit');
      if (line4(st.grid, r, c, 2)) {
        st.aiThinking = false;
        finishGame(2);
        return;
      }
      if (validCols(st.grid).length === 0) {
        st.aiThinking = false;
        finishGame(3);
        return;
      }
      st.aiThinking = false;
    }, 550);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, cell, by]);

  // pointer
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const toCol = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const c = Math.floor((x - bx) / cell);
      return Math.max(0, Math.min(COLS - 1, c));
    };
    const mv = (e: PointerEvent) => setHover(toCol(e));
    const dn = (e: PointerEvent) => doDrop(toCol(e));
    canvas.addEventListener('pointermove', mv);
    canvas.addEventListener('pointerdown', dn);
    return () => {
      canvas.removeEventListener('pointermove', mv);
      canvas.removeEventListener('pointerdown', dn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, W, bx, cell]);

  // keyboard
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, h - 1));
      if (e.key === 'ArrowRight') setHover((h) => Math.min(COLS - 1, h + 1));
      if (e.key === 'ArrowDown' || e.key === ' ') doDrop(hoverRef.current);
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  const hoverRef = useRef(hover);
  hoverRef.current = hover;

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      for (const d of st.discs) {
        if (d.y < d.targetY) d.y = Math.min(d.targetY, d.y + (60 + (d.targetY - d.y) * 6) * dt);
      }
      rt.particles.update(dt);
      draw();
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;

    ctx.save();
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0f1e');
    bg.addColorStop(1, '#060910');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // hint arrow over hovered column
    if (!st.over && st.turn === 1 && validCols(st.grid).includes(hover)) {
      const ax = colX(hover);
      const ay = by - 26 + Math.sin(rt.now() / 200) * 4;
      ctx.save();
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(ax, ay + 12);
      ctx.lineTo(ax - 10, ay);
      ctx.lineTo(ax + 10, ay);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // board plate
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
    ctx.lineWidth = 2;
    roundR(ctx, bx - 10, by - 10, cell * COLS + 20, cell * ROWS + 20, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // holes
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.beginPath();
        ctx.arc(colX(c), rowY(r), cell * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(4,8,18,0.9)';
        ctx.fill();
      }
    }

    // discs (draw in insertion order so newer on top)
    for (const d of st.discs) {
      const x = colX(d.col);
      const color = d.owner === 1 ? '#22d3ee' : '#f472b6';
      const glow = d.owner === 1 ? 'rgba(34,211,238,0.9)' : 'rgba(244,114,182,0.9)';
      // shadow
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = d.owner === 1 ? '#0e7490' : '#9d174d';
      ctx.beginPath();
      ctx.arc(x, d.y, cell * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // face
      const fg = ctx.createRadialGradient(x - cell * 0.12, d.y - cell * 0.12, cell * 0.05, x, d.y, cell * 0.4);
      fg.addColorStop(0, color);
      fg.addColorStop(1, d.owner === 1 ? '#0891b2' : '#be185d');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(x, d.y, cell * 0.38, 0, Math.PI * 2);
      ctx.fill();
      // rim
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, d.y, cell * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }

    // winning line
    if (st.over && st.winOwner >= 1 && st.winOwner <= 2) {
      const owner = st.winOwner as Cell;
      const cells = winLine(st.grid, owner);
      if (cells.length === 4) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(colX(cells[0][1]), rowY(cells[0][0]));
        ctx.lineTo(colX(cells[3][1]), rowY(cells[3][0]));
        ctx.stroke();
        ctx.restore();
      }
    }

    // status
    ctx.font = '700 13px Orbitron, monospace';
    ctx.textAlign = 'center';
    if (st.over) {
      const msg = st.winOwner === 1 ? 'VICTORY!' : st.winOwner === 2 ? 'AI WINS' : 'DRAW';
      ctx.fillStyle = st.winOwner === 1 ? '#22d3ee' : st.winOwner === 2 ? '#f472b6' : '#94a3b8';
      ctx.fillText(msg, W / 2, by - 44);
    } else {
      ctx.fillStyle = st.turn === 1 ? '#67e8f9' : '#f9a8d4';
      ctx.fillText(st.turn === 1 ? 'YOUR TURN — TAP A COLUMN' : 'AI IS THINKING…', W / 2, by - 44);
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

function winLine(g: Cell[][], v: Cell): [number, number][] {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g[r][c] !== v) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || g[rr][cc] !== v) break;
          line.push([rr, cc]);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return [];
}

function roundR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
