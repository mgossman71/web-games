import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { TAU } from '../../utils/math';

/**
 * Memory Matrix — card matching with original canvas-drawn glyphs
 * (geometric neon symbols, no copyrighted content).
 */

const SIZES = [
  { id: 'small', cols: 4, rows: 4, name: '4×4 EASY' },
  { id: 'medium', cols: 4, rows: 6, name: '6×4 MEDIUM' },
  { id: 'large', cols: 6, rows: 6, name: '6×6 HARD' },
] as const;

// 18 distinct original glyphs
const GLYPH_PATHS: ((ctx: CanvasRenderingContext2D, s: number) => void)[] = [
  // 0 circle-dot
  (ctx, s) => {
    ctx.strokeStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.12, 0, TAU);
    ctx.fill();
  },
  // 1 triangle
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.48);
    ctx.lineTo(s * 0.45, s * 0.38);
    ctx.lineTo(-s * 0.45, s * 0.38);
    ctx.closePath();
    ctx.stroke();
  },
  // 2 square
  (ctx, s) => {
    const h = s * 0.38;
    ctx.strokeRect(-h, -h, h * 2, h * 2);
  },
  // 3 diamond
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.48);
    ctx.lineTo(s * 0.42, 0);
    ctx.lineTo(0, s * 0.48);
    ctx.lineTo(-s * 0.42, 0);
    ctx.closePath();
    ctx.stroke();
  },
  // 4 plus
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.lineTo(0, s * 0.42);
    ctx.moveTo(-s * 0.42, 0);
    ctx.lineTo(s * 0.42, 0);
    ctx.stroke();
  },
  // 5 X
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.4);
    ctx.lineTo(s * 0.4, s * 0.4);
    ctx.moveTo(s * 0.4, -s * 0.4);
    ctx.lineTo(-s * 0.4, s * 0.4);
    ctx.stroke();
  },
  // 6 zigzag
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.3);
    ctx.lineTo(-s * 0.15, -s * 0.3);
    ctx.lineTo(s * 0.15, s * 0.3);
    ctx.lineTo(s * 0.45, -s * 0.3);
    ctx.stroke();
  },
  // 7 half circle
  (ctx, s) => {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, 0);
    ctx.lineTo(s * 0.42, 0);
    ctx.stroke();
  },
  // 8 concentric
  (ctx, s) => {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, TAU);
    ctx.stroke();
  },
  // 9 bars
  (ctx, s) => {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.28 - s * 0.08, -s * 0.4);
      ctx.lineTo(i * s * 0.28 + s * 0.08, -s * 0.4);
      ctx.lineTo(i * s * 0.28 + s * 0.08, s * 0.4);
      ctx.lineTo(i * s * 0.28 - s * 0.08, s * 0.4);
      ctx.closePath();
      ctx.stroke();
    }
  },
  // 10 crosshair
  (ctx, s) => {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(0, -s * 0.25);
    ctx.moveTo(0, s * 0.55);
    ctx.lineTo(0, s * 0.25);
    ctx.moveTo(-s * 0.55, 0);
    ctx.lineTo(-s * 0.25, 0);
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 0.25, 0);
    ctx.stroke();
  },
  // 11 chevron
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.2);
    ctx.lineTo(0, -s * 0.25);
    ctx.lineTo(s * 0.4, s * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.5);
    ctx.lineTo(0, s * 0.05);
    ctx.lineTo(s * 0.4, s * 0.5);
    ctx.stroke();
  },
  // 12 eye
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, 0);
    ctx.quadraticCurveTo(0, -s * 0.5, s * 0.5, 0);
    ctx.quadraticCurveTo(0, s * 0.5, -s * 0.5, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, TAU);
    ctx.fill();
  },
  // 13 hex
  (ctx, s) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const x = Math.cos(a) * s * 0.45;
      const y = Math.sin(a) * s * 0.45;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  },
  // 14 lightning
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 0.5);
    ctx.lineTo(-s * 0.25, s * 0.05);
    ctx.lineTo(0, s * 0.05);
    ctx.lineTo(-s * 0.15, s * 0.5);
    ctx.lineTo(s * 0.3, -s * 0.05);
    ctx.lineTo(s * 0.05, -s * 0.05);
    ctx.closePath();
    ctx.stroke();
  },
  // 15 arrow up
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(s * 0.4, 0);
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(0, s * 0.5);
    ctx.lineTo(s * 0.18, s * 0.28);
    ctx.moveTo(0, s * 0.5);
    ctx.lineTo(-s * 0.18, s * 0.28);
    ctx.stroke();
  },
  // 16 target
  (ctx, s) => {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.1, 0, TAU);
    ctx.stroke();
  },
  // 17 wave
  (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.15);
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.5, 0, -s * 0.15);
    ctx.quadraticCurveTo(s * 0.25, s * 0.2, s * 0.5, -s * 0.15);
    ctx.stroke();
  },
];

interface Card {
  glyph: number;
  faceUp: boolean;
  matched: boolean;
  flipT: number; // 0..1
  popT: number;
}

export default function MemoryMatrix(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;
  const [sizeIdx, setSizeIdx] = useState(0);
  const size = SIZES[sizeIdx];
  const pairs = (size.cols * size.rows) / 2; // total pairs in deck
  void pairs;

  const gap = 10;
  const marginX = 24;
  const topPad = 44;
  const cellW = (W - marginX * 2 - gap * (size.cols - 1)) / size.cols;
  const cellH = Math.min(cellW * 1.25, (H - topPad - 40 - gap * (size.rows - 1)) / size.rows);
  const bw = cellW * size.cols + gap * (size.cols - 1);
  const bh = cellH * size.rows + gap * (size.rows - 1);
  const ox = (W - bw) / 2;
  const oy = topPad + (H - topPad - 30 - bh) / 2;

  const s = useRef({
    cards: [] as Card[],
    sel: -1,
    selTime: 0,
    moves: 0,
    time: 0,
    over: false,
    won: false,
    sizeIdx: 0,
    score: 0,
  });

  const newGame = useCallback((si: number) => {
    const cfg = SIZES[si];
    const n = (cfg.cols * cfg.rows) / 2;
    const glyphIdx = Array.from({ length: 18 }, (_, i) => i);
    for (let i = glyphIdx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [glyphIdx[i], glyphIdx[j]] = [glyphIdx[j], glyphIdx[i]];
    }
    const glyphs = glyphIdx.slice(0, n);
    const deck = [...glyphs, ...glyphs];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    s.current.cards = deck.map((g) => ({ glyph: g, faceUp: false, matched: false, flipT: 0, popT: 0 }));
    s.current.sel = -1;
    s.current.moves = 0;
    s.current.time = 0;
    s.current.over = false;
    s.current.won = false;
    s.current.sizeIdx = si;
    s.current.score = 0;
  }, []);

  useEffect(() => {
    newGame(sizeIdx);
    rt.setScore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeIdx]);

  const cellPos = (i: number): [number, number] => {
    const r = Math.floor(i / size.cols);
    const c = i % size.cols;
    return [ox + c * (cellW + gap), oy + r * (cellH + gap)];
  };

  const finish = () => {
    const st = s.current;
    st.over = true;
    st.won = true;
    const parity = sizeIdx * 500;
    const score = Math.max(200, 3000 - st.moves * 25 - Math.round(st.time * 12) + parity);
    st.score = score;
    rt.sfx('win');
    rt.particles.spawnBurst(W / 2, H / 2, 50, 280, { colors: ['#22d3ee', '#a855f7', '#facc15'] });
    rt.endGame(score, true);
  };

  const tapCell = (i: number) => {
    const st = s.current;
    if (st.over) return;
    const card = st.cards[i];
    if (card.matched || card.faceUp) return;

    card.faceUp = true;
    card.flipT = 0;
    rt.sfx('click');
    const [tx, ty] = cellPos(i);
    rt.particles.spark(tx + cellW / 2, ty + cellH / 2, '#22d3ee', 4);

    if (st.sel === -1) {
      st.sel = i;
      st.selTime = rt.now();
      return;
    }

    const first = st.cards[st.sel];
    st.sel = -1;
    st.moves += 1;
    if (first.glyph === card.glyph) {
      first.matched = true;
      card.matched = true;
      first.popT = 0;
      card.popT = 0;
      rt.sfx('coin');
      const [fx, fy] = cellPos(st.cards.indexOf(first));
      const [sx, sy] = cellPos(i);
      rt.particles.spawnBurst(fx + cellW / 2, fy + cellH / 2, 10, 120, { colors: ['#34d399', '#fff'] });
      rt.particles.spawnBurst(sx + cellW / 2, sy + cellH / 2, 10, 120, { colors: ['#34d399', '#fff'] });
      if (st.cards.every((c) => c.matched)) {
        finish();
      }
    } else {
      // flip back after delay
      setTimeout(() => {
        if (s.current.over) return;
        first.faceUp = false;
        first.flipT = 0;
        card.faceUp = false;
        card.flipT = 0;
        rt.sfx('thud');
      }, 850);
    }
  };

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (s.current.sizeIdx !== sizeIdx) {
        newGame(sizeIdx);
      }
      if (!st.over) st.time += dt;
      rt.setTimeLabel(st.moves > 0 ? `${st.moves} MOVES · ${st.time.toFixed(0)}s` : 'FIND ALL PAIRS');
      for (const c of st.cards) {
        if (c.faceUp && c.flipT < 1) c.flipT = Math.min(1, c.flipT + dt * 4);
        if (c.matched && c.popT < 1) c.popT = Math.min(1, c.popT + dt * 3);
      }
      draw();
    },
  });

  // pointer
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const c = Math.floor((x - ox) / (cellW + gap));
      const r = Math.floor((y - oy) / (cellH + gap));
      if (c < 0 || c >= size.cols || r < 0 || r >= size.rows) return;
      const idx = r * size.cols + c;
      const cardAt = s.current.cards[idx];
      if (cardAt && !s.current.over) {
        // ensure within cell (not in gap)
        const withinC = x % (cellW + gap) <= cellW;
        const withinR = y % (cellH + gap) <= cellH;
        if (withinC && withinR) tapCell(idx);
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    return () => canvas.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, sizeIdx]);

  // keyboard: cycle board size
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c') {
        setSizeIdx((i) => (i + 1) % SIZES.length);
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;
    const cfgs = SIZES[st.sizeIdx];

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d0d1c');
    g.addColorStop(1, '#070710');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.font = '800 26px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 13px Orbitron, monospace';
    ctx.fillText(cfgs.name, 16, 24);

    // deck
    for (let i = 0; i < st.cards.length; i++) {
      const card = st.cards[i];
      const [x, y] = cellPos(i);
      const t = card.faceUp || card.matched ? card.flipT : 1 - 0;
      const scale = card.matched ? 1 - card.popT * 0.15 : 1 + Math.sin(card.popT * Math.PI) * 0.06;

      const cx = x + cellW / 2;
      const cy = y + cellH / 2;
      const vis = card.matched ? Math.max(0, 1 - card.popT) : 1;
      const faceFraction = card.faceUp || card.matched ? card.flipT : 0;
      void t;
      void vis;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(0.02, faceFraction * scale + (1 - faceFraction) * 1), Math.max(0.02, faceFraction + (1 - faceFraction)));
      const w = cellW;
      const h = cellH;
      // back
      if (faceFraction < 0.5 || true) {
        const bg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        bg.addColorStop(0, '#1e1b3a');
        bg.addColorStop(1, '#14122a');
        ctx.fillStyle = bg;
        roundR(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(139,92,246,0.5)';
        ctx.lineWidth = 1.5;
        roundR(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.stroke();
        // pattern
        ctx.strokeStyle = 'rgba(139,92,246,0.25)';
        ctx.beginPath();
        ctx.moveTo(-w * 0.3, -h * 0.25);
        ctx.lineTo(w * 0.3, h * 0.25);
        ctx.moveTo(w * 0.3, -h * 0.25);
        ctx.lineTo(-w * 0.3, h * 0.25);
        ctx.stroke();
      }
      ctx.restore();

      // face (drawn fully when flipped, clipped by flipT for animation)
      if (faceFraction > 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(faceFraction * (card.matched ? 1 + Math.sin(card.popT * Math.PI) * 0.1 : 1), faceFraction);
        if (card.matched) {
          ctx.globalAlpha = 1 - card.popT;
        }
        const bg2 = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        bg2.addColorStop(0, card.matched ? 'rgba(52,211,153,0.25)' : 'rgba(34,211,238,0.22)');
        bg2.addColorStop(1, '#0e1326');
        ctx.fillStyle = bg2;
        roundR(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = card.matched ? 'rgba(52,211,153,0.8)' : 'rgba(34,211,238,0.8)';
        ctx.lineWidth = 2;
        roundR(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.stroke();
        // glyph
        ctx.strokeStyle = card.matched ? '#34d399' : '#67e8f9';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = Math.max(2, cellW * 0.07);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = card.matched ? '#34d399' : '#22d3ee';
        ctx.shadowBlur = 8;
        GLYPH_PATHS[card.glyph % GLYPH_PATHS.length](ctx, Math.min(cellW, cellH) * 0.8);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

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
