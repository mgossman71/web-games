import { useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { TAU, seededRandom } from '../../utils/math';

/**
 * Dungeon Maze — procedural maze, timer, collectible gems, roaming wraiths.
 */

const SIZES = [
  { cols: 9, rows: 7, gems: 5, enemies: 2, name: 'CRYPT' },
  { cols: 13, rows: 9, gems: 9, enemies: 3, name: 'DEPTHS' },
  { cols: 17, rows: 11, gems: 14, enemies: 5, name: 'ABYSS' },
] as const;

interface Enemy {
  tx: number;
  ty: number;
  px: number;
  py: number;
  timer: number;
}

function buildMaze(cols: number, rows: number, rng: () => number) {
  const wallE: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(true));
  const wallS: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(true));
  const visited: boolean[] = new Array(cols * rows).fill(false);
  const stack: number[] = [0];
  visited[0] = true;

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    let moved = false;
    for (const d of order) {
      const nx = cx + (d === 1 ? 1 : d === 3 ? -1 : 0);
      const ny = cy + (d === 2 ? 1 : d === 0 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (visited[ni]) continue;
      visited[ni] = true;
      if (d === 1) wallE[cy][cx] = false;
      else if (d === 3) wallE[cy][cx - 1] = false;
      else if (d === 2) wallS[cy][cx] = false;
      else wallS[cy - 1][cx] = false;
      stack.push(ni);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }
  for (let i = 0; i < cols * rows * 0.1; i++) {
    const cx = (rng() * cols) | 0;
    const cy = (rng() * rows) | 0;
    if (rng() < 0.5 && cx + 1 < cols) wallE[cy][cx] = false;
    else if (cy + 1 < rows) wallS[cy][cx] = false;
  }
  return { wallE, wallS };
}

export default function DungeonMaze(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;
  const [sizeIdx, setSizeIdx] = useState(0);
  const size = SIZES[sizeIdx];
  const CELL = Math.floor(Math.min((W - 48) / size.cols, (H - 96) / size.rows));
  const boardW = CELL * size.cols;
  const boardH = CELL * size.rows;
  const ox = Math.max(8, (W - boardW) / 2);
  const oy = Math.max(44, (H - boardH) / 2);

  const s = useRef({
    wallE: [] as boolean[][],
    wallS: [] as boolean[][],
    px: 0,
    py: 0,
    gems: [] as { cx: number; cy: number; taken: boolean }[],
    enemies: [] as Enemy[],
    time: 0,
    lives: 3,
    over: false,
    won: false,
    hitFlash: 0,
    sizeIdx: 0,
  });

  const regen = (si: number) => {
    const cfg = SIZES[si];
    const rng = seededRandom(((rt.now() * 0.0001) & 0xffff) | 0 || 7);
    const { wallE, wallS } = buildMaze(cfg.cols, cfg.rows, rng);
    s.current.wallE = wallE;
    s.current.wallS = wallS;
    s.current.px = ox + CELL / 2;
    s.current.py = oy + CELL / 2;
    s.current.hitFlash = 0;
    s.current.sizeIdx = si;
    // gems: random cells ≥ 2 steps out
    const spots: [number, number][] = [];
    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        if (x + y >= 2) spots.push([x, y]);
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    s.current.gems = spots.slice(0, cfg.gems).map(([cx, cy]) => ({ cx, cy, taken: false }));
    // wraiths: far corner region
    const far: [number, number][] = [];
    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        if (x > cfg.cols * 0.55 && y > cfg.rows * 0.55) far.push([x, y]);
      }
    }
    const pool = far.length > 0 ? far : spots;
    s.current.enemies = [];
    for (let i = 0; i < cfg.enemies; i++) {
      const [fx, fy] = pool[(rng() * pool.length) | 0];
      s.current.enemies.push({ tx: fx, ty: fy, px: ox + fx * CELL + CELL / 2, py: oy + fy * CELL + CELL / 2, timer: 0 });
    }
  };

  useEffect(() => {
    s.current.time = 0;
    s.current.lives = 3;
    s.current.over = false;
    s.current.won = false;
    rt.setLevel(sizeIdx + 1);
    rt.setLives(3);
    regen(sizeIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      const cfg = SIZES[st.sizeIdx];
      if (st.sizeIdx !== sizeIdx) {
        st.sizeIdx = sizeIdx;
        regen(sizeIdx);
      }
      if (st.over) {
        draw();
        return;
      }
      st.time += dt;
      st.hitFlash = Math.max(0, st.hitFlash - dt * 2);
      const frac = st.gems.filter((g) => !g.taken).length;
      rt.setTimeLabel(`${frac} GEM${frac === 1 ? '' : 'S'} · ${st.time.toFixed(0)}s`);

      // movement
      let dx = 0;
      let dy = 0;
      if (rt.input.isHeld('moveLeft')) dx -= 1;
      if (rt.input.isHeld('moveRight')) dx += 1;
      if (rt.input.isHeld('moveUp')) dy -= 1;
      if (rt.input.isHeld('moveDown')) dy += 1;
      const ax = rt.input.getAxisX();
      const ay = rt.input.getAxisY();
      if (ax !== 0) dx = ax;
      if (ay !== 0) dy = ay;
      const l = Math.hypot(dx, dy);
      if (l > 0) {
        dx /= l;
        dy /= l;
        const speed = Math.min(CELL * 7, 170);
        collideMove(st, ox, oy, cfg.cols, cfg.rows, CELL, CELL * 0.22, dx * speed * dt, dy * speed * dt);
      }

      // gems
      const pcx = Math.floor((st.px - ox) / CELL);
      const pcy = Math.floor((st.py - oy) / CELL);
      for (const g of st.gems) {
        if (!g.taken && g.cx === pcx && g.cy === pcy) {
          g.taken = true;
          rt.sfx('coin');
          st.time = st.time; // (timer keeps running)
          rt.particles.spawnBurst(ox + g.cx * CELL + CELL / 2, oy + g.cy * CELL + CELL / 2, 16, 150, { colors: ['#facc15', '#fef9c3', '#fff'] });
        }
      }
      if (st.gems.every((g) => g.taken)) {
        st.over = true;
        st.won = true;
        const score = Math.max(100, Math.round(2500 - st.time * 15) + st.sizeIdx * 400);
        rt.endGame(score, true);
        draw();
        return;
      }

      // wraiths: chase if close, otherwise wander
      for (const e of st.enemies) {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 0.7 + Math.random() * 0.8;
          const ecx = Math.max(0, Math.min(cfg.cols - 1, Math.round((e.px - ox - CELL / 2) / CELL)));
          const ecy = Math.max(0, Math.min(cfg.rows - 1, Math.round((e.py - oy - CELL / 2) / CELL)));
          const open: [number, number][] = [];
          if (ecy > 0 && st.wallS[ecy - 1][ecx] === false) open.push([ecx, ecy - 1]);
          if (ecy + 1 < cfg.rows && st.wallS[ecy][ecx] === false) open.push([ecx, ecy + 1]);
          if (ecx > 0 && st.wallE[ecy][ecx - 1] === false) open.push([ecx - 1, ecy]);
          if (ecx + 1 < cfg.cols && st.wallE[ecy][ecx] === false) open.push([ecx + 1, ecy]);
          if (open.length > 0) {
            if (Math.hypot(e.px - st.px, e.py - st.py) < CELL * 4) {
              open.sort((aa, bb) => Math.hypot(aa[0] - pcx, aa[1] - pcy) - Math.hypot(bb[0] - pcx, bb[1] - pcy));
              [e.tx, e.ty] = open[0];
            } else {
              [e.tx, e.ty] = open[(Math.random() * open.length) | 0];
            }
          }
        }
        const ex = ox + e.tx * CELL + CELL / 2;
        const ey = oy + e.ty * CELL + CELL / 2;
        e.px += (ex - e.px) * Math.min(1, dt * 3.2);
        e.py += (ey - e.py) * Math.min(1, dt * 3.2);

        if (Math.hypot(st.px - e.px, st.py - e.py) < CELL * 0.44 && st.hitFlash <= 0) {
          st.lives -= 1;
          st.hitFlash = 1;
          rt.sfx('explosion');
          rt.addShake(10);
          rt.setLives(st.lives);
          st.px = ox + CELL / 2;
          st.py = oy + CELL / 2;
          for (const w of st.enemies) w.timer = Math.max(w.timer, 1.5);
          if (st.lives <= 0) {
            st.over = true;
            rt.endGame(0, false);
            draw();
            return;
          }
        }
      }

      rt.particles.update(dt);
      draw();
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;
    const cfg = SIZES[st.sizeIdx];

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c0a16');
    g.addColorStop(1, '#05040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // floor
    for (let cy = 0; cy < cfg.rows; cy++) {
      for (let cx = 0; cx < cfg.cols; cx++) {
        ctx.fillStyle = (cx + cy) % 2 === 0 ? 'rgba(30,26,52,0.65)' : 'rgba(22,19,39,0.65)';
        ctx.fillRect(ox + cx * CELL, oy + cy * CELL, CELL, CELL);
      }
    }

    // walls
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = Math.max(2, CELL * 0.09);
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let cy = 0; cy < cfg.rows; cy++) {
      for (let cx = 0; cx < cfg.cols; cx++) {
        const x = ox + cx * CELL;
        const y = oy + cy * CELL;
        if (cy === 0) line(ctx, x, y, x + CELL, y);
        if (cx === 0) line(ctx, x, y, x, y + CELL);
        if (cy === cfg.rows - 1) line(ctx, x, y + CELL, x + CELL, y + CELL);
        if (cx === cfg.cols - 1) line(ctx, x + CELL, y, x + CELL, y + CELL);
        if (cx < cfg.cols - 1 && st.wallE[cy][cx]) line(ctx, x + CELL, y, x + CELL, y + CELL);
        if (cy < cfg.rows - 1 && st.wallS[cy][cx]) line(ctx, x, y + CELL, x + CELL, y + CELL);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // gems
    for (const gem of st.gems) {
      if (gem.taken) continue;
      const gx = ox + gem.cx * CELL + CELL / 2;
      const gy = oy + gem.cy * CELL + CELL / 2 + Math.sin(rt.now() / 320 + gem.cx * 1.7) * 2.5;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-CELL * 0.18, -CELL * 0.18, CELL * 0.36, CELL * 0.36);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-CELL * 0.09, -CELL * 0.09, CELL * 0.18, CELL * 0.18);
      ctx.restore();
    }

    // portal (top-right)
    const portalX = ox + ((cfg.cols - 1) * CELL + CELL / 2 | 0);
    const portalY = oy + (cfg.rows - 1) * CELL + CELL / 2;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(rt.now() / 180);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(portalX, portalY, CELL * 0.3, 0, TAU);
    ctx.stroke();
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.arc(portalX, portalY, CELL * 0.18, rt.now() / 300, rt.now() / 300 + 4);
    ctx.stroke();
    ctx.restore();

    // player
    const blink = st.hitFlash > 0.55 && Math.sin(rt.now() / 45) > 0;
    if (!blink) {
      ctx.save();
      ctx.translate(st.px, st.py);
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#0e7490';
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -CELL * 0.06, CELL * 0.22, Math.PI, 0);
      ctx.lineTo(CELL * 0.24, CELL * 0.22);
      ctx.lineTo(-CELL * 0.24, CELL * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f0fdff';
      ctx.fillRect(-CELL * 0.12, -CELL * 0.08, CELL * 0.08, CELL * 0.07);
      ctx.fillRect(CELL * 0.04, -CELL * 0.08, CELL * 0.08, CELL * 0.07);
      ctx.restore();
    }

    // wraiths
    for (const e of st.enemies) {
      ctx.save();
      ctx.translate(e.px, e.py);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.arc(0, -2, CELL * 0.26, Math.PI, 0);
      for (let i = 3; i >= -3; i--) {
        const wx = (i / 3) * CELL * 0.26;
        ctx.lineTo(wx, CELL * 0.24 + Math.sin(rt.now() / 140 + i) * 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fecaca';
      ctx.beginPath();
      ctx.arc(-CELL * 0.09, -CELL * 0.06, CELL * 0.05, 0, TAU);
      ctx.arc(CELL * 0.09, -CELL * 0.06, CELL * 0.05, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (st.hitFlash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${st.hitFlash * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }

    // size selector hint
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`MAZE SIZE: ${SIZES[st.sizeIdx].name}  (cycle with R)`, W / 2, H - 8);

    rt.particles.draw(ctx);
    ctx.restore();
  };

  // cycle maze size with R
  useEffect(() => {
    const off = rt.input.subscribe((a, down) => {
      if (!down || a !== 'confirm') return;
      if (s.current.over) return;
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && !s.current.over) {
        setSizeIdx((i) => (i + 1) % SIZES.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

interface MazeRef {
  px: number;
  py: number;
  wallE: boolean[][];
  wallS: boolean[][];
}

/**
 * Wall-correct movement for a small circle in the grid maze.
 * ox/oy = board origin, CELL = cell size, r = player radius.
 */
function collideMove(ref: MazeRef, ox: number, oy: number, cols: number, rows: number, CELL: number, r: number, dx: number, dy: number): void {
  // X axis first (clean corner behavior)
  if (dx !== 0) {
    const nx = ref.px + dx;
    if (dx > 0) {
      // wall line being crossed (if any)
      const bx = (Math.floor((ref.px + r - ox) / CELL) + 1) * CELL + ox;
      if (ref.px + r < bx && nx + r >= bx) {
        const cxi = Math.floor((bx - ox) / CELL) - 1;
        if (cxi >= 0 && cxi < cols) {
          const top = Math.ceil((ref.py - r - oy) / CELL);
          const bot = Math.floor((ref.py + r - oy) / CELL);
          let blocked = false;
          for (let cy = Math.max(0, top); cy <= Math.min(rows - 1, bot); cy++) {
            if (ref.wallE[cy]?.[cxi] === true) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            ref.px = bx - r - 0.01;
          }
        }
      } else {
        ref.px = nx;
      }
    } else {
      const bx = Math.ceil((ref.px - r - ox) / CELL) * CELL + ox;
      if (ref.px - r > bx && nx - r <= bx) {
        const cxi = Math.ceil((bx - ox) / CELL);
        if (cxi >= 0 && cxi < cols) {
          const top = Math.ceil((ref.py - r - oy) / CELL);
          const bot = Math.floor((ref.py + r - oy) / CELL);
          let blocked = false;
          for (let cy = Math.max(0, top); cy <= Math.min(rows - 1, bot); cy++) {
            if (ref.wallE[cy]?.[cxi] === true) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            ref.px = bx + r + 0.01;
          }
        }
      } else {
        ref.px = nx;
      }
    }
  }
  if (dy !== 0) {
    const ny = ref.py + dy;
    if (dy > 0) {
      const by = (Math.floor((ref.py + r - oy) / CELL) + 1) * CELL + oy;
      if (ref.py + r < by && ny + r >= by) {
        const cyi = Math.floor((by - oy) / CELL) - 1;
        if (cyi >= 0 && cyi < rows) {
          const left = Math.ceil((ref.px - r - ox) / CELL);
          const right = Math.floor((ref.px + r - ox) / CELL);
          let blocked = false;
          for (let cx = Math.max(0, left); cx <= Math.min(cols - 1, right); cx++) {
            if (ref.wallS[cyi]?.[cx] === true) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            ref.py = by - r - 0.01;
          }
        }
      } else {
        ref.py = ny;
      }
    } else {
      const by = Math.ceil((ref.py - r - oy) / CELL) * CELL + oy;
      if (ref.py - r > by && ny - r <= by) {
        const cyi = Math.ceil((by - oy) / CELL);
        if (cyi >= 0 && cyi < rows) {
          const left = Math.ceil((ref.px - r - ox) / CELL);
          const right = Math.floor((ref.px + r - ox) / CELL);
          let blocked = false;
          for (let cx = Math.max(0, left); cx <= Math.min(cols - 1, right); cx++) {
            if (ref.wallS[cyi]?.[cx] === true) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            ref.py = by + r + 0.01;
          }
        }
      } else {
        ref.py = ny;
      }
    }
  }
}
