import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import type { GameAction } from '../../types';

const LEVELS: { id: 'easy' | 'medium' | 'hard'; name: string; cols: number; rows: number; mines: number }[] = [
  { id: 'easy', name: 'EASY', cols: 8, rows: 8, mines: 10 },
  { id: 'medium', name: 'MEDIUM', cols: 12, rows: 10, mines: 24 },
  { id: 'hard', name: 'HARD', cols: 16, rows: 12, mines: 55 },
];

interface MC {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
  exploded: boolean;
}

const NUM_COLORS = ['', '#60a5fa', '#4ade80', '#f87171', '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6', '#e2e8f0'];

export default function Mines(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;
  const [levelIdx, setLevelIdx] = useState(1);
  const level = LEVELS[levelIdx];

  const CELL = Math.floor(Math.min((W - 40) / level.cols, (H - 80) / level.rows));
  const ox = Math.max(8, (W - CELL * level.cols) / 2);
  const oy = Math.max(30, (H - CELL * level.rows) / 2);

  const s = useRef({
    grid: [] as MC[][],
    started: false, // first click safe
    over: false,
    won: false,
    time: 0,
    flagsUsed: 0,
  });

  const newBoard = useCallback((firstRex: number, firstC: number) => {
    const { cols, rows, mines } = level;
    const grid: MC[][] = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { mine: false, revealed: false, flagged: false, adjacent: 0, exploded: false };
      }
    }
    // place mines anywhere except first-click 3x3
    const forbidden = new Set<number>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = firstRex + dr;
        const cc = firstC + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) forbidden.add(rr * cols + cc);
      }
    }
    const spots: number[] = [];
    for (let i = 0; i < rows * cols; i++) {
      if (!forbidden.has(i)) spots.push(i);
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let i = 0; i < mines; i++) {
      const idx = spots[i];
      grid[Math.floor(idx / cols)][idx % cols].mine = true;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr][cc].mine) count++;
          }
        }
        grid[r][c].adjacent = count;
      }
    }
    s.current.grid = grid;
  }, [level]);

  const reset = useCallback(() => {
    s.current.started = false;
    s.current.over = false;
    s.current.won = false;
    s.current.time = 0;
    s.current.flagsUsed = 0;
    newBoard(1, 1);
    rt.setScore(0);
  }, [newBoard, rt]);

  useEffect(() => {
    reset();
  }, [reset, levelIdx]);

  const floodReveal = (row: number, col: number) => {
    const st = s.current;
    const { cols, rows } = level;
    const stack: [number, number][] = [[row, col]];
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const cell = st.grid[r][c];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.adjacent === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && !st.grid[rr][cc].revealed) {
              stack.push([rr, cc]);
            }
          }
        }
      }
    }
  };

  const checkWin = () => {
    const st = s.current;
    const { cols, rows, mines } = level;
    let revealedCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (st.grid[r][c].revealed) revealedCount++;
      }
    }
    if (revealedCount === cols * rows - mines) {
      st.over = true;
      st.won = true;
      const bonus = Math.max(0, 2000 - Math.round(st.time * 8) - levelIdx * 300 + 800);
      rt.endGame(bonus, true);
    }
  };

  const clickCell = (row: number, col: number) => {
    const st = s.current;
    if (st.over) return;
    const cell = st.grid[row][col];
    if (cell.flagged || cell.revealed) return;

    if (!st.started) {
      st.started = true;
      newBoard(row, col);
    }

    const target = st.grid[row][col];
    if (target.mine) {
      target.exploded = true;
      target.revealed = true;
      st.over = true;
      rt.sfx('explosion');
      rt.addShake(14);
      rt.particles.spawnBurst(ox + col * CELL + CELL / 2, oy + row * CELL + CELL / 2, 36, 240, { colors: ['#ef4444', '#f97316', '#facc15'] });
      // reveal all mines
      for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
          if (s.current.grid[r][c].mine) s.current.grid[r][c].revealed = true;
        }
      }
      rt.endGame(0, false);
      return;
    }

    floodReveal(row, col);
    rt.sfx('thud');
    const remaining = level.mines - st.flagsUsed;
    rt.setScore(Math.max(0, Math.round(500 - st.time * 6) + remaining * 2));
    checkWin();
  };

  const flagCell = (row: number, col: number) => {
    const st = s.current;
    if (st.over || !st.started) return;
    const cell = st.grid[row][col];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    if (cell.flagged) st.flagsUsed++;
    else st.flagsUsed--;
    rt.sfx('click');
    const remaining = level.mines - st.flagsUsed;
    rt.setScore(Math.max(0, Math.round(500 - st.time * 6) + remaining * 2));
  };

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.started && !st.over) {
        st.time += dt;
      }
      draw();
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;
    const { cols, rows } = level;

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c1020');
    g.addColorStop(1, '#050710');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * CELL;
        const y = oy + r * CELL;
        const cell = st.grid[r][c];

        if (cell.revealed) {
          ctx.fillStyle = cell.exploded ? '#7f1d1d' : (r + c) % 2 === 0 ? '#1a2135' : '#171c2c';
          ctx.fillRect(x, y, CELL, CELL);
        } else {
          // raised button
          const grad = ctx.createLinearGradient(x, y, x, y + CELL);
          grad.addColorStop(0, '#3a4569');
          grad.addColorStop(1, '#232b44');
          ctx.fillStyle = grad;
          roundR(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 4);
          ctx.fill();
          // bevel
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          roundR(ctx, x + 3, y + 3, CELL - 6, CELL * 0.4, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(10,14,26,0.6)';
          ctx.lineWidth = 1;
          roundR(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 4);
          ctx.stroke();
        }

        // content
        if (cell.revealed) {
          if (cell.mine) {
            ctx.save();
            ctx.translate(x + CELL / 2, y + CELL / 2);
            if (cell.exploded) {
              ctx.shadowColor = '#f97316';
              ctx.shadowBlur = 16;
            }
            ctx.fillStyle = '#111827';
            ctx.beginPath();
            ctx.arc(0, 0, CELL * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = CELL * 0.06;
            for (let a = 0; a < 8; a++) {
              const ang = (a / 8) * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(ang) * CELL * 0.3, Math.sin(ang) * CELL * 0.3);
              ctx.stroke();
            }
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(-CELL * 0.07, -CELL * 0.07, CELL * 0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (cell.adjacent > 0) {
            ctx.fillStyle = NUM_COLORS[cell.adjacent];
            ctx.font = `800 ${Math.floor(CELL * 0.5)}px Orbitron, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(cell.adjacent), x + CELL / 2, y + CELL / 2 + 2);
          }
        } else if (cell.flagged) {
          ctx.save();
          ctx.translate(x + CELL / 2, y + CELL / 2);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(0, -CELL * 0.26);
          ctx.lineTo(CELL * 0.24, -CELL * 0.1);
          ctx.lineTo(0, -CELL * 0.06);
          ctx.lineTo(CELL * 0.24, CELL * 0.1);
          ctx.lineTo(0, -CELL * 0.08);
          ctx.lineTo(-CELL * 0.18, -CELL * 0.08);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -CELL * 0.08);
          ctx.lineTo(0, CELL * 0.26);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // HUD: level selector + remaining
    ctx.textAlign = 'left';
    const flagsLeft = level.mines - st.flagsUsed;
    ctx.font = '600 13px Orbitron, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${level.name}`, 16, 22);
    ctx.fillStyle = flagsLeft <= 3 ? '#f87171' : '#94a3b8';
    ctx.fillText(`MINES LEFT ${flagsLeft}`, W - 150, 22);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px Orbitron, monospace';
    ctx.fillText(`TIME ${st.time.toFixed(0)}s  ·  click/tap to reveal · F or double-tap to flag`, W / 2, H - 10);

    rt.particles.draw(ctx);
    ctx.restore();
  };

  // Pointer handling: click / double-tap flag
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    let lastTap = 0;
    let lastCell = '';
    const toCell = (e: PointerEvent): [number, number] | null => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const c = Math.floor((x - ox) / CELL);
      const r = Math.floor((y - oy) / CELL);
      if (r < 0 || r >= level.rows || c < 0 || c >= level.cols) return null;
      return [r, c];
    };
    const onDown = (e: PointerEvent) => {
      const cell = toCell(e);
      if (!cell) return;
      const [r, c] = cell;
      const now = performance.now();
      const key = `${r},${c}`;
      if (now - lastTap < 350 && lastCell === key) {
        lastTap = 0;
        lastCell = '';
        flagCell(r, c);
      } else {
        lastTap = now;
        lastCell = key;
        // delayed single-click so double-tap can flag
        const t = setTimeout(() => clickCell(r, c), 260);
        // store for cancel
        (canvas as unknown as { _t?: number })._t = t;
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    return () => canvas.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, levelIdx, CELL, ox, oy, W, H]);

  // F key flags cell under cursor-ish: flag toggle for next single-tap? Simpler: F toggles flag mode for mouse-click via subscription
  useEffect(() => {
    const off = rt.input.subscribe((a: GameAction, down) => {
      if (!down || a !== 'fire') return;
      // F: cycle level (simplest keyboard control for board game)
    });
    const keyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' || e.key === 'f') {
        setLevelIdx((i) => (i + 1) % LEVELS.length);
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => {
      off();
      window.removeEventListener('keydown', keyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  return null;
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
