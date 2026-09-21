import { useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import type { GameAction } from '../../types';

type Mode = 'cpu' | 'local2';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** First to 7. AI skills per level: paddle speed, reaction window, aim error. */
const AI_LEVELS = [
  { speed: 220, react: 0.28, error: 46, name: 'ROOKIE' },
  { speed: 330, react: 0.16, error: 24, name: 'PRO' },
  { speed: 460, react: 0.07, error: 8, name: 'CHAMPION' },
];

export default function PaddleArena(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const midY = H / 2;
  const paddleH = 86;
  const paddleSpeed = 430;
  const serveDelay = 0.9;

  const s = useRef({
    p1: { y: midY },
    p2: { y: midY },
    ball: { x: W / 2, y: H / 2, vx: 380, vy: 120 } as Ball,
    s1: 0,
    s2: 0,
    serveTimer: serveDelay,
    serveDir: 1,
    mode: 'cpu' as Mode,
    aiLevel: 1,
    aiTarget: midY,
    over: false,
    flash: 0,
  });

  const targetScore = 7;

  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const toY = (clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return ((clientY - rect.top) / rect.height) * H;
    };
    const toX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * W;
    };
    const move = (e: PointerEvent) => {
      const st = s.current;
      const x = toX(e.clientX);
      const y = toY(e.clientY);
      if (x < W / 2) st.p1.y = y;
      else if (st.mode === 'local2') st.p2.y = y;
    };
    canvas.addEventListener('pointermove', move);
    return () => canvas.removeEventListener('pointermove', move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  useEffect(() => {
    const st = s.current;
    st.s1 = 0;
    st.s2 = 0;
    st.serveTimer = serveDelay;
    st.ball = { x: W / 2, y: H / 2, vx: 380 * (Math.random() < 0.5 ? 1 : -1), vy: (Math.random() - 0.5) * 200 };
    rt.setScore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const off = rt.input.subscribe((a: GameAction) => {
      const st = s.current;
      if (st.over) return;
      if (a === 'confirm') {
        if (st.mode === 'cpu') st.mode = 'local2';
        else st.mode = 'cpu';
      }
      if (a === 'fire') {
        st.aiLevel = (st.aiLevel + 1) % AI_LEVELS.length;
        rt.setTimeLabel(`AI: ${AI_LEVELS[st.aiLevel].name}`);
      }
      if (a === 'pause' || a === 'menu') return;
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      st.flash = Math.max(0, st.flash - dt * 3);

      // P1: left column keys/mouse/touch
      let p1 = 0;
      if (rt.input.isHeld('moveUp')) p1 -= 1;
      if (rt.input.isHeld('moveDown')) p1 += 1;
      if (rt.input.isHeld('jump')) p1 -= 1;
      if (rt.input.isHeld('fire')) p1 += 1;
      // mouse/touch drag for P1 handled via canvas pointer in the effect below

      if (st.mode === 'local2') {
        // P2: arrow keys / right stick
        let p2 = 0;
        const ay = rt.input.getAxisY();
        if (ay !== 0) p2 = ay;
        st.p2.y += p2 * paddleSpeed * dt;
      } else {
        const cfg = AI_LEVELS[st.aiLevel];
        if (st.ball.vx > 0) {
          // predict
          const rel = st.ball.y - st.p2.y;
          const lag = cfg.react + Math.abs(rel) / 900;
          const err = (Math.sin(rt.now() / 90) * cfg.error) / 2;
          st.aiTarget += (st.ball.y + err - st.aiTarget) * Math.min(1, dt / Math.max(0.02, lag));
        } else {
          st.aiTarget += (midY - st.aiTarget) * Math.min(1, dt * 3);
        }
        const dy = st.aiTarget - st.p2.y;
        const maxMove = cfg.speed * dt;
        st.p2.y += Math.abs(dy) <= maxMove ? dy : Math.sign(dy) * maxMove;
      }

      st.p1.y += p1 * paddleSpeed * dt;

      // clamp
      st.p1.y = Math.max(paddleH / 2 + 8, Math.min(H - paddleH / 2 - 8, st.p1.y));
      st.p2.y = Math.max(paddleH / 2 + 8, Math.min(H - paddleH / 2 - 8, st.p2.y));

      if (st.serveTimer > 0) {
        st.serveTimer -= dt;
        st.ball.x = W / 2;
        st.ball.y = midY;
        draw();
        return;
      }

      if (st.over) {
        draw();
        return;
      }

      const b = st.ball;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // walls
      if (b.y < 10) {
        b.y = 10;
        b.vy = Math.abs(b.vy);
        rt.sfx('thud');
      } else if (b.y > H - 10) {
        b.y = H - 10;
        b.vy = -Math.abs(b.vy);
        rt.sfx('thud');
      }

      // paddles (x = 34 left, W-34 right)
      if (b.vx < 0 && b.x < 46 && b.x > 18 && Math.abs(b.y - st.p1.y) < paddleH / 2 + 9) {
        b.x = 46;
        const rel = (b.y - st.p1.y) / (paddleH / 2);
        const speed = Math.min(760, Math.hypot(b.vx, b.vy) * 1.045);
        const ang = rel * 0.95;
        b.vx = Math.cos(ang) * speed;
        b.vy = Math.sin(ang) * speed;
        st.s1 = Math.min(st.s1, targetScore); // score unchanged on save
        rt.sfx('thud');
        rt.addShake(3);
        rt.particles.spawnBurst(46, b.y, 8, 140, { colors: ['#22d3ee', '#fff'] });
      }
      if (b.vx > 0 && b.x > W - 46 && b.x < W - 18 && Math.abs(b.y - st.p2.y) < paddleH / 2 + 9) {
        b.x = W - 46;
        const rel = (b.y - st.p2.y) / (paddleH / 2);
        const speed = Math.min(760, Math.hypot(b.vx, b.vy) * 1.045);
        const ang = Math.PI - rel * 0.95;
        b.vx = Math.cos(ang) * speed;
        b.vy = Math.sin(ang) * speed;
        rt.sfx('thud');
        rt.addShake(3);
        rt.particles.spawnBurst(W - 46, b.y, 8, 140, { colors: ['#f472b6', '#fff'] });
      }

      // scoring
      if (b.x < -14) {
        st.s2 += 1;
        scoreEvent(1);
      } else if (b.x > W + 14) {
        st.s1 += 1;
        scoreEvent(2);
      }

      rt.particles.update(dt);
      draw();

      function scoreEvent(winner: 1 | 2) {
        rt.sfx('coin');
        st.flash = 1;
        if (st.s1 >= targetScore || st.s2 >= targetScore) {
          st.over = true;
          const scoreNow = winner === 1 ? 1000 : 200;
          rt.endGame(scoreNow, true);
        } else {
          st.serveTimer = serveDelay;
          st.serveDir = winner === 1 ? -1 : 1;
          st.ball = {
            x: W / 2,
            y: midY,
            vx: 360 * st.serveDir,
            vy: (Math.random() - 0.5) * 240,
          };
        }
      }
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#071019');
    g.addColorStop(0.5, '#0a1224');
    g.addColorStop(1, '#120818');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // center net
    ctx.strokeStyle = 'rgba(148,163,184,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 12);
    ctx.lineTo(W / 2, H - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // scores
    ctx.font = '800 58px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(34,211,238,0.9)';
    ctx.fillText(String(st.s1), W / 2 - 80, 74);
    ctx.fillStyle = 'rgba(244,114,182,0.9)';
    ctx.fillText(String(st.s2), W / 2 + 80, 74);
    ctx.font = '600 12px Orbitron, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('FIRST TO 7', W / 2, H - 14);

    // paddles
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;
    roundRectP(ctx, 20, st.p1.y - paddleH / 2, 16, paddleH, 6, '#22d3ee');
    ctx.restore();
    ctx.save();
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 16;
    roundRectP(ctx, W - 36, st.p2.y - paddleH / 2, 16, paddleH, 6, st.mode === 'local2' ? '#fb923c' : '#f472b6');
    ctx.restore();

    // ball
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(st.ball.x, st.ball.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // serve countdown
    if (st.serveTimer > 0) {
      ctx.font = '800 40px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(248,250,252,${0.4 + 0.6 * Math.sin(rt.now() / 120)})`;
      ctx.fillText('GET READY', W / 2, H / 2 - 110);
    }

    // flash banner
    if (st.flash > 0) {
      ctx.font = '800 30px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, st.flash);
      ctx.fillStyle = '#facc15';
      ctx.fillText('POINT!', W / 2, H / 2 + 90);
      ctx.globalAlpha = 1;
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

function roundRectP(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
