import { useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';

/**
 * Checkers Clashes — 8×8 checkers vs. a tactical AI.
 * Forced captures, kings, double jumps. Out-think the machine.
 */

const N = 8;
type P = 0 | 1 | 2; // 0 empty, 1 player (red, bottom), 2 AI (white, top)

type Board = P[][];

function freshBoard(): Board {
  const b: Board = Array.from({ length: N }, () => Array<P>(N).fill(0));
  for (let r = 0; r < 3; r++) for (let c = 0; c < N; c++) if ((r + c) % 2 === 1) b[r][c] = 2;
  for (let r = 5; r < 8; r++) for (let c = 0; c < N; c++) if ((r + c) % 2 === 1) b[r][c] = 1;
  return b;
}

interface Move {
  from: [number, number];
  to: [number, number];
  jumps: [number, number][];
  captures?: [number, number][];
  kinged: boolean;
}

function legalMoves(b: Board, owner: P): Move[] {
  const moves: Move[] = [];
  // first find captures
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== owner) continue;
      const king = b[r][c] !== 0 && pieceKing(b, r, c);
      const caps = captureMoves(b, r, c, owner, king);
      if (caps.length) moves.push(...caps);
    }
  }
  if (moves.length) return moves;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (b[r][c] !== owner) continue;
      const dirs = stepDirs(owner);
      for (const [dr, dc] of dirs) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N || b[rr][cc] !== 0) continue;
        moves.push({ from: [r, c], to: [rr, cc], jumps: [[r, c]], kinged: willKing(owner, rr) });
      }
    }
  }
  return moves;
}

function pieceKing(b: Board, r: number, c: number): boolean {
  const o = b[r][c];
  const homeRow = o === 1 ? N - 1 : 0;
  return o === 1 ? r === 0 : r === homeRow;
}

function stepDirs(owner: P): [number, number][] {
  // player 1 moves up (toward row 0), player 2 moves down
  if (owner === 1) return [[-1, -1], [-1, 1]];
  return [[1, -1], [1, 1]];
}

function kingDirs(): [number, number][] {
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
}

function willKing(owner: P, rr: number): boolean {
  return owner === 1 ? rr === 0 : rr === N - 1;
}

function captureMoves(b: Board, r: number, c: number, owner: P, king: boolean): Move[] {
  const out: Move[] = [];
  const dirs = king ? kingDirs() : stepDirs(owner);
  const enemy: P = owner === 1 ? 2 : 1;
  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const tr = r + 2 * dr;
    const tc = c + 2 * dc;
    if (tr < 0 || tr >= N || tc < 0 || tc >= N) continue;
    if (b[mr][mc] === enemy && b[tr][tc] === 0) {
      const k = king || willKing(owner, tr);
      out.push({ from: [r, c], to: [tr, tc], jumps: [[r, c], [tr, tc]], captures: [[mr, mc]], kinged: willKing(owner, tr) });
      void k;
    }
  }
  return out;
}

function applyMove(b: Board, m: Move, owner: P): Board {
  const nb = b.map((row) => [...row]);
  nb[m.from[0]][m.from[1]] = 0;
  nb[m.to[0]][m.to[1]] = owner;
  for (const [cr, cc] of m.captures ?? []) nb[cr][cc] = 0;
  return nb;
}

function aiPick(b: Board, owner: P): Move {
  const moves = legalMoves(b, owner);
  if (moves.length === 0) return moves[0];
  // value: captures x3 + count + center bonus; prefer max captures
  let best = -Infinity;
  let pool: Move[] = moves;
  for (const m of moves) {
    let v = (m.captures?.length ?? 0) * 10 + m.jumps.length * 2 + (m.kinged ? 4 : 0);
    const [tr, tc] = m.to;
    v += -(Math.abs(tr - 3.5) + Math.abs(tc - 3.5)) * 0.15;
    v += Math.random() * 0.3;
    if (v > best) {
      best = v;
      pool = [m];
    } else if (v === best) {
      pool.push(m);
    }
  }
  return pool[(Math.random() * pool.length) | 0];
}

export default function Checkers(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const cell = Math.min((W - 40) / N, (H - 90) / N);
  const bx = (W - cell * N) / 2;
  const by = (H - cell * N) / 2 + 14;

  const [selected, setSelected] = useState<[number, number] | null>(null);
  const selRef = useRef<[number, number] | null>(null);
  selRef.current = selected;

  const s = useRef({
    board: freshBoard(),
    turn: 1 as P,
    legal: [] as Move[],
    over: false,
    lastMove: null as Move | null,
    animT: 0,
    score: 0,
  });

  useEffect(() => {
    const st = s.current;
    st.board = freshBoard();
    st.turn = 1;
    st.legal = legalMoves(st.board, 1);
    st.over = false;
    st.lastMove = null;
    setSelected(null);
    rt.setScore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;
  const isKing = (r: number, c: number) => (s.current.board[r][c] === 1 ? r === 0 : r === N - 1);

  function tryMove(m: Move) {
    const st = s.current;
    if (st.over || st.turn !== 1) return;
    if (!st.legal.some((x) => x.from[0] === m.from[0] && x.from[1] === m.from[1] && x.to[0] === m.to[0] && x.to[1] === m.to[1])) return;
    let nb = applyMove(st.board, m, 1);
    const capCount = m.captures?.length ?? 0;
    st.board = nb;
    st.lastMove = m;
    st.animT = 0.25;
    if (capCount > 0) {
      rt.addShake(6);
      rt.sfx('hit');
    } else {
      rt.sfx('select');
    }
    setSelected(null);
    // continue multi-jump for player if further capture from new spot
    const further = captureMoves(nb, m.to[0], m.to[1], 1, isKing(m.to[0], m.to[1]));
    const canContinue = further.length > 0 && capCount > 0 && !(m.kinged);
    if (canContinue) {
      st.legal = further;
      return;
    }
    st.legal = legalMoves(nb, 2);
    if (st.legal.length === 0) {
      st.over = true;
      st.score = 1000;
      rt.setScore(1000);
      rt.endGame(1000, true);
      return;
    }
    st.turn = 2;
  }

  // AI turn
  useEffect(() => {
    const id = window.setInterval(() => {
      const st = s.current;
      if (st.over || st.turn !== 2) return;
      const m = aiPick(st.board, 2);
      if (!m) return;
      st.board = applyMove(st.board, m, 2);
      st.lastMove = m;
      st.animT = 0.25;
      rt.sfx((m.captures?.length ?? 0) > 0 ? 'hit' : 'tick');
      const canContinue = (m.captures?.length ?? 0) > 0 && !m.kinged;
      const further = canContinue ? captureMoves(st.board, m.to[0], m.to[1], 2, isKing(m.to[0], m.to[1])) : [];
      if (canContinue && further.length > 0) {
        st.legal = further;
        return; // loop tick will pick up again
      }
      st.legal = legalMoves(st.board, 1);
      if (st.legal.length === 0) {
        st.over = true;
        rt.endGame(0, false);
        return;
      }
      st.turn = 1;
    }, 600);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  function cellOf(e: PointerEvent): [number, number] | null {
    const canvas = rt.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const c = Math.floor((x - bx) / cell);
    const r = Math.floor((y - by) / cell);
    if (!inBounds(r, c)) return null;
    return [r, c] as [number, number];
  }

  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const dn = (e: PointerEvent) => {
      const cc = cellOf(e);
      if (!cc) return;
      const [r, c] = cc;
      const st = s.current;
      if (st.over || st.turn !== 1) return;
      const sel = selRef.current;
      if (sel && sel[0] === r && sel[1] === c) {
        setSelected(null);
        return;
      }
      if (st.board[r][c] === 1) {
        setSelected([r, c]);
        rt.sfx('click');
        return;
      }
      // attempt a move to [r,c] from selection
      if (sel) {
        const m = st.legal.find(
          (x) => x.from[0] === sel[0] && x.from[1] === sel[1] && x.to[0] === r && x.to[1] === c,
        );
        if (m) tryMove(m);
        else rt.sfx('danger');
      }
    };
    canvas.addEventListener('pointerdown', dn);
    return () => canvas.removeEventListener('pointerdown', dn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, W, H, bx, by, cell]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      s.current.animT = Math.max(0, s.current.animT - dt);
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
    bg.addColorStop(0, '#170a12');
    bg.addColorStop(1, '#0a0610');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // board
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = bx + c * cell;
        const y = by + r * cell;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#3b1f2a' : '#1a0f16';
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.strokeStyle = 'rgba(217,70,239,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, cell * N, cell * N);

    // highlights for legal moves from selection
    const sel = selected;
    const targets: Move[] = sel ? st.legal.filter((m) => m.from[0] === sel[0] && m.from[1] === sel[1]) : [];
    for (const m of targets) {
      const x = bx + m.to[1] * cell;
      const y = by + m.to[0] * cell;
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(rt.now() / 150) * 0.15;
      ctx.fillStyle = m.captures?.length ? 'rgba(250,204,21,0.4)' : 'rgba(52,211,153,0.35)';
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // last move
    if (st.lastMove && st.animT > 0) {
      ctx.save();
      ctx.globalAlpha = st.animT * 1.6;
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 3;
      ctx.strokeRect(bx + st.lastMove.to[1] * cell + 3, by + st.lastMove.to[0] * cell + 3, cell - 6, cell - 6);
      ctx.restore();
    }

    // pieces
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = st.board[r][c];
        if (!p) continue;
        const x = bx + c * cell + cell / 2;
        const y = by + r * cell + cell / 2;
        const player = p === 1;
        const base = player ? '#9f1239' : '#cbd5e1';
        const lite = player ? '#fb7185' : '#f1f5f9';
        const dark = player ? '#4c0519' : '#64748b';
        const king = isKing(r, c);
        ctx.save();
        ctx.shadowColor = player ? 'rgba(251,113,133,0.8)' : 'rgba(226,232,240,0.7)';
        ctx.shadowBlur = 10;
        const grd = ctx.createRadialGradient(x - cell * 0.1, y - cell * 0.12, 2, x, y, cell * 0.34);
        grd.addColorStop(0, lite);
        grd.addColorStop(0.65, base);
        grd.addColorStop(1, dark);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.32, 0, Math.PI * 2);
        ctx.fill();
        // inner ring
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.22, 0, Math.PI * 2);
        ctx.stroke();
        if (king) {
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 8;
          // star
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const a2 = a + Math.PI / 5;
            const R = cell * 0.16;
            const r2 = cell * 0.07;
            if (i === 0) ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
            ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
            ctx.lineTo(x + Math.cos(a + (Math.PI * 2) / 5) * R, y + Math.sin(a + (Math.PI * 2) / 5) * R);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // turn banner
    ctx.font = '700 12px Orbitron, monospace';
    ctx.textAlign = 'center';
    if (st.over) {
      const win = s.current.score >= 1000;
      ctx.fillStyle = win ? '#fb7185' : '#cbd5e1';
      ctx.fillText(win ? 'VICTORY — BOARD CLEARED' : 'DEFEAT — OUTMANEUVERED', W / 2, by - 26);
    } else {
      ctx.fillStyle = st.turn === 1 ? '#fb7185' : '#cbd5e1';
      ctx.fillText(st.turn === 1 ? 'YOUR MOVE — TAP A PIECE' : 'AI IS MOVING…', W / 2, by - 26);
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}
